import { Check, Copy, Crown, LogOut, Play, QrCode, UserPlus, UsersRound } from 'lucide-react'

export function Room({ room, players, isHost, qrUrl, onAddDemo, onLeave, onStart }) {
  const canStart = players.length > 1
  return (
    <main className="page room-page">
      <section className="room-hero">
        <div className="room-kicker">房間 <strong>{room.code}</strong></div>
        <h1>{room.name}</h1>
        <p>{isHost ? '等大家到齊，就可以開始今天的畫畫挑戰。' : '你已經加入房間，等老師按下開始吧。'}</p>
        <div className="room-controls">
          {isHost ? <button className="primary-button" disabled={!canStart} onClick={onStart}><Play size={19} fill="currentColor" /> 開始遊戲</button> : <span className="waiting-chip"><span /> 等待房主開始…</span>}
          <button className="text-button" onClick={onLeave}><LogOut size={18} /> 離開房間</button>
        </div>
        {!canStart ? <div className="inline-hint">至少要有 2 位玩家才能開始</div> : null}
      </section>

      <section className="player-board">
        <div className="section-heading">
          <div><h2>玩家名單</h2><p>已加入 {players.length} / 6 人</p></div>
          <UsersRound />
        </div>
        <div className="player-grid">
          {players.map((player, index) => (
            <div className="player-tile" key={player.id}>
              <span className="avatar" style={{ '--avatar': player.color }}>{player.avatar}</span>
              <div><strong>{player.name}</strong><span>{index === 0 ? <><Crown size={14} /> 房主</> : <><Check size={14} /> 已準備</>}</span></div>
            </div>
          ))}
          {Array.from({ length: 6 - players.length }).map((_, index) => <div className="player-tile player-tile--empty" key={index}>等待加入…</div>)}
        </div>
        {isHost && players.length < 6 ? <button className="demo-button" onClick={onAddDemo}><UserPlus size={17} /> 邀請一位測試玩家</button> : null}
      </section>

      <aside className="invite-panel">
        <span className="tape tape--small" />
        <h2>邀同學加入</h2>
        {qrUrl ? <img src={qrUrl} alt="加入房間 QR Code" /> : null}
        <div className="room-code-large">{room.code}</div>
        <button className="secondary-button" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Copy size={17} /> 複製邀請連結</button>
        <p><QrCode size={17} /> 用手機相機也能直接掃描</p>
      </aside>
    </main>
  )
}
