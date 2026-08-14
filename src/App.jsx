import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { AppHeader } from './components/Brand'
import { DrawingCanvas } from './components/DrawingCanvas'
import { Lobby } from './components/Lobby'
import { NameGate } from './components/NameGate'
import { PromptStage } from './components/PromptStage'
import { Results, Scoring } from './components/Results'
import { Room } from './components/Room'
import { RESULT_SEEDS, SAMPLE_PLAYERS } from './lib/data'
import { createGameBus } from './lib/gameBus'

const initialName = () => sessionStorage.getItem('draw-ai-name') || ''
const deepLinkCode = () => window.location.pathname.match(/\/room\/([^/]+)/)?.[1]?.toUpperCase() || ''
const playerRecord = (name) => ({ id: 'me', name, avatar: name.slice(0, 1), color: '#4b72dd' })

export default function App() {
  const [playerName, setPlayerName] = useState(initialName)
  const [screen, setScreen] = useState(() => initialName() && deepLinkCode() ? 'room' : 'lobby')
  const [room, setRoom] = useState(() => deepLinkCode() ? { code: deepLinkCode(), name: `房間 ${deepLinkCode()}`, host: '朋友的房間', count: 1 } : null)
  const [isHost, setIsHost] = useState(() => !deepLinkCode())
  const [players, setPlayers] = useState(() => initialName() && deepLinkCode() ? [{ id: 'host', name: '朋友的房間', avatar: '朋', color: '#f0b941' }, playerRecord(initialName())] : [])
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState([])
  const [qrUrl, setQrUrl] = useState('')

  const ownPlayer = useMemo(() => playerRecord(playerName), [playerName])

  useEffect(() => {
    if (!room) return
    QRCode.toDataURL(`${window.location.origin}/room/${room.code}`, { width: 220, margin: 1 }).then(setQrUrl)
  }, [room])

  useEffect(() => {
    const bus = createGameBus((message) => {
      if (!room || message.roomCode !== room.code) return
      if (message.type === 'JOIN') setPlayers((current) => current.some((item) => item.id === message.player.id) ? current : [...current, message.player].slice(0, 6))
      if (message.type === 'PROMPT') { setPrompt(message.prompt); setScreen('draw') }
    })
    return () => bus.close()
  }, [room])

  useEffect(() => {
    if (!room || isHost) return
    const bus = createGameBus(() => {})
    bus.send({ type: 'JOIN', roomCode: room.code, player: ownPlayer })
    bus.close()
  }, [isHost, ownPlayer, room])

  const saveName = (name) => {
    sessionStorage.setItem('draw-ai-name', name)
    setPlayerName(name)
    const code = deepLinkCode()
    if (code) {
      setRoom({ code, name: `房間 ${code}`, host: '朋友的房間', count: 1 })
      setIsHost(false)
      setPlayers([{ id: 'host', name: '朋友的房間', avatar: '朋', color: '#f0b941' }, playerRecord(name)])
      setScreen('room')
    }
  }
  const createRoom = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    setRoom({ code, name: `${playerName}的畫畫班`, host: playerName, count: 1 })
    setIsHost(true); setPlayers([ownPlayer]); setScreen('room')
    window.history.replaceState({}, '', `/room/${code}`)
  }
  const joinRoom = useCallback((nextRoom) => {
    setRoom(nextRoom); setIsHost(false); setPlayers([ { id: 'host', name: nextRoom.host, avatar: nextRoom.host.slice(0, 1), color: '#f0b941' }, ownPlayer ]); setScreen('room')
    window.history.replaceState({}, '', `/room/${nextRoom.code}`)
    const bus = createGameBus(() => {})
    bus.send({ type: 'JOIN', roomCode: nextRoom.code, player: ownPlayer })
    bus.close()
  }, [ownPlayer])
  const leave = useCallback(() => {
    setRoom(null); setPrompt(''); setScreen('lobby'); setPlayers([]); window.history.replaceState({}, '', '/')
  }, [])
  const addDemo = () => setPlayers((current) => {
    const next = SAMPLE_PLAYERS.find((sample) => !current.some((player) => player.id === sample.id))
    return next ? [...current, next] : current
  })
  const confirmPrompt = (value) => {
    setPrompt(value); setScreen('draw')
    createGameBus(() => {}).send({ type: 'PROMPT', roomCode: room.code, prompt: value })
  }
  const submitDrawing = useCallback(async (image) => {
    setScreen('scoring')
    let aiResult
    try {
      if (import.meta.env.DEV) throw new Error('Use the local demo scorer during Vite development')
      const response = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, image }) })
      if (!response.ok) throw new Error('AI scoring unavailable')
      aiResult = await response.json()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      aiResult = { score: 86, description: `主題「${prompt}」辨識度很高，線條大膽又有自己的風格！`, demo: true }
    }
    setResults([{ name: playerName, image, score: aiResult.score, description: aiResult.description }, ...RESULT_SEEDS.slice(0, Math.max(1, players.length - 1))])
    setScreen('results')
  }, [playerName, players.length, prompt])

  if (!playerName) return <NameGate onContinue={saveName} />
  const showHeader = !['draw'].includes(screen)
  return (
    <div className="app-shell">
      {showHeader ? <AppHeader playerName={playerName} onHome={leave} /> : null}
      {screen === 'lobby' ? <Lobby playerName={playerName} onCreate={createRoom} onJoin={joinRoom} /> : null}
      {screen === 'room' ? <Room room={room} players={players} isHost={isHost} qrUrl={qrUrl} onAddDemo={addDemo} onLeave={leave} onStart={() => setScreen('prompt')} /> : null}
      {screen === 'prompt' ? <PromptStage isHost={isHost} onConfirm={confirmPrompt} /> : null}
      {screen === 'draw' ? <DrawingCanvas prompt={prompt} onSubmit={submitDrawing} /> : null}
      {screen === 'scoring' ? <Scoring /> : null}
      {screen === 'results' ? <Results prompt={prompt} results={results} onReplay={() => setScreen('prompt')} onHome={leave} /> : null}
    </div>
  )
}
