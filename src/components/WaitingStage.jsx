import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock3, LoaderCircle, RefreshCw, UsersRound } from 'lucide-react'

export function WaitingStage({ players, hostId, results, roundStartedAt, ownPlayerId, isHost, scoring, error, onRetry, onExpire }) {
  const [now, setNow] = useState(() => Date.now())
  const expiredRef = useRef(false)
  const students = useMemo(() => players.filter((player) => player.id !== hostId), [hostId, players])
  const completedIds = useMemo(() => new Set(results.map((result) => result.id)), [results])
  const startTime = roundStartedAt ? new Date(roundStartedAt).getTime() : now
  const seconds = Math.max(0, 180 - Math.floor((now - startTime) / 1000))
  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isHost || seconds > 0 || expiredRef.current) return
    expiredRef.current = true
    onExpire()
  }, [isHost, onExpire, seconds])

  return (
    <main className="center-stage waiting-results-stage">
      <div className="waiting-topline"><Clock3 size={18} /> {formatted}</div>
      <div className="orbit">{scoring ? <LoaderCircle /> : <UsersRound />}</div>
      <h1>{isHost ? '正在等待大家交卷…' : scoring ? 'AI 正在評讀你的作品…' : '作品已送出！'}</h1>
      <p>{isHost ? '所有學生完成後，排行榜會自動公布。' : '先休息一下，等其他同學完成吧。'}</p>
      <div className="submission-progress">
        <div><strong>{results.length} / {students.length}</strong><span>份作品完成 AI 評分</span></div>
        <div className="submission-track"><span style={{ width: `${students.length ? (results.length / students.length) * 100 : 0}%` }} /></div>
        <ul>
          {students.map((player) => {
            const done = completedIds.has(player.id)
            const isScoringSelf = player.id === ownPlayerId && scoring
            return <li key={player.id}><span className="avatar avatar--small" style={{ '--avatar': player.color }}>{player.avatar}</span><strong>{player.name}</strong><em className={done ? 'done' : ''}>{done ? <><Check size={14} /> 已送出</> : isScoringSelf ? <><LoaderCircle size={14} className="spin-icon" /> AI 評分中</> : '作畫中'}</em></li>
          })}
        </ul>
      </div>
      {error ? <div className="submission-error"><strong>作品評分暫時失敗</strong><span>{error}</span><button className="secondary-button" onClick={onRetry}><RefreshCw size={16} /> 再試一次</button></div> : null}
    </main>
  )
}
