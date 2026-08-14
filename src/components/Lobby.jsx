import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Camera, Copy, DoorOpen, Plus, RefreshCw, UsersRound } from 'lucide-react'
import { PUBLIC_ROOMS } from '../lib/data'
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

export function Lobby({ playerName, onCreate, onJoin }) {
  const [code, setCode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [inviteCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase())
  const [qrUrl, setQrUrl] = useState('')
  const inviteUrl = `${window.location.origin}/room/${inviteCode}`

  useEffect(() => { QRCode.toDataURL(inviteUrl, { margin: 1, width: 200, color: { dark: '#151515' } }).then(setQrUrl) }, [inviteUrl])

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
        <button className="primary-button create-button" onClick={onCreate}><Plus size={21} /> 建立新房間</button>
        <div className="capacity-note"><UsersRound /> 最多 <strong>6</strong> 位玩家</div>
      </section>

      <section className="room-browser">
        <div className="section-heading"><div><h2>公開房間</h2><p>找到喜歡的房間，直接加入吧。</p></div><button className="icon-button" aria-label="重新整理"><RefreshCw size={19} /></button></div>
        <ul className="room-list">{PUBLIC_ROOMS.map((room) => <RoomRow key={room.code} room={room} onJoin={onJoin} />)}</ul>
        <form className="join-code" onSubmit={joinByCode}>
          <DoorOpen />
          <div><label htmlFor="room-code">有房間代碼？</label><input id="room-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="輸入 6 位代碼" maxLength={8} /></div>
          <button className="secondary-button" disabled={!code.trim()}>加入</button>
        </form>
      </section>

      <aside className="qr-card">
        <span className="tape tape--small" />
        <h2>掃一下，馬上玩</h2>
        <p>分享這個入口給身邊的同學。</p>
        {qrUrl ? <img src={qrUrl} alt={`房間連結 ${inviteCode} 的 QR Code`} /> : <div className="qr-loading" />}
        <strong className="invite-code">{inviteCode}</strong>
        <div className="qr-actions">
          <button className="secondary-button" onClick={() => navigator.clipboard?.writeText(inviteUrl)}><Copy size={17} /> 複製連結</button>
          <button className="secondary-button" onClick={() => setScannerOpen(true)}><Camera size={17} /> 掃描</button>
        </div>
      </aside>
      {scannerOpen ? <QRScanner onClose={() => setScannerOpen(false)} onResult={handleScan} /> : null}
    </main>
  )
}
