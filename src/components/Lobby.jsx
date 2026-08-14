import { useState } from 'react'
import { Camera, DoorOpen, Plus, RefreshCw, UsersRound, WifiOff } from 'lucide-react'
import { QRScanner } from './QRScanner'

function RoomRow({ room, onJoin }) {
  return (
    <li className="room-row">
      <div><strong>{room.name}</strong><span>{room.host} · {room.topic}</span></div>
      <div className="room-count"><UsersRound size={16} /> {room.count}/6</div>
      <button className="secondary-button" onClick={() => onJoin(room)}>加入</button>
    </li>
  )
}

export function Lobby({ playerName, rooms, loading, multiplayerReady, error, onRefresh, onCreate, onJoin }) {
  const [code, setCode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  const joinByCode = (event) => {
    event.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean) onJoin({ code: clean, name: `房間 ${clean}`, host: '神秘老師', count: 2, topic: '準備中' })
  }

  const handleScan = (value) => {
    const clean = value.split('/').filter(Boolean).at(-1)?.toUpperCase() || value
    setScannerOpen(false)
    onJoin({ code: clean, name: `房間 ${clean}`, host: '掃描加入', count: 2, topic: '準備中' })
  }

  return (
    <main className="page lobby-page">
      <section className="lobby-intro">
        <span className="scribble">嗨，{playerName}！</span>
        <h1>今天想畫<br />什麼呢？</h1>
        <p>自己開一間，或加入朋友的房間。每間房最多 6 位玩家。</p>
        <button className="primary-button create-button" disabled={!multiplayerReady} onClick={onCreate}><Plus size={21} /> 建立新房間</button>
        <div className="capacity-note"><UsersRound /> 最多 <strong>6</strong> 位玩家</div>
      </section>

      <section className="room-browser">
        <div className="section-heading"><div><h2>公開房間</h2><p>找到喜歡的房間，直接加入吧。</p></div><button className="icon-button" onClick={onRefresh} aria-label="重新整理"><RefreshCw size={19} /></button></div>
        {loading ? <div className="rooms-empty">正在尋找房間…</div> : null}
        {!loading && rooms.length ? <ul className="room-list">{rooms.map((room) => <RoomRow key={room.code} room={room} onJoin={onJoin} />)}</ul> : null}
        {!loading && !rooms.length ? <div className="rooms-empty"><strong>{multiplayerReady ? '現在還沒有公開房間' : '多人連線尚未設定'}</strong><span>{multiplayerReady ? '成為第一位開房的人吧！' : '請在 Vercel 設定 Supabase 環境變數。'}</span></div> : null}
        {error ? <div className="service-error">{error}</div> : null}
        <form className="join-code" onSubmit={joinByCode}>
          <DoorOpen />
          <div><label htmlFor="room-code">有房間代碼？</label><input id="room-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="輸入 6 位代碼" maxLength={8} /></div>
          <button className="secondary-button" disabled={!code.trim()}>加入</button>
        </form>
      </section>

      <aside className="qr-card">
        <span className="tape tape--small" />
        {multiplayerReady ? <Camera size={42} className="aside-icon" /> : <WifiOff size={42} className="aside-icon" />}
        <h2>{multiplayerReady ? '掃一下，馬上玩' : '等待連線設定'}</h2>
        <p>{multiplayerReady ? '房主建立房間後會取得專屬 QR Code，其他人也能在這裡掃描加入。' : '設定資料庫後，電腦和手機就能看見同一批房間。'}</p>
        <button className="secondary-button" disabled={!multiplayerReady} onClick={() => setScannerOpen(true)}><Camera size={17} /> 掃描房間</button>
      </aside>
      {scannerOpen ? <QRScanner onClose={() => setScannerOpen(false)} onResult={handleScan} /> : null}
    </main>
  )
}
