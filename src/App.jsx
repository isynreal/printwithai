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
import {
  createRemoteRoom,
  joinRemoteRoom,
  listPublicRooms,
  multiplayerConfigured,
  subscribeToRoom,
  subscribeToRooms,
  updateRemoteRoom,
} from './lib/roomService'

const initialName = () => sessionStorage.getItem('draw-ai-name') || ''
const deepLinkCode = () => window.location.pathname.match(/\/room\/([^/]+)/)?.[1]?.toUpperCase() || ''
const initialPlayerId = () => {
  const stored = sessionStorage.getItem('draw-ai-player-id')
  if (stored) return stored
  const created = crypto.randomUUID()
  sessionStorage.setItem('draw-ai-player-id', created)
  return created
}
const playerRecord = (name, id) => ({ id, name, avatar: name.slice(0, 1), color: '#4b72dd' })

export default function App() {
  const [playerName, setPlayerName] = useState(initialName)
  const [playerId] = useState(initialPlayerId)
  const [screen, setScreen] = useState(() => initialName() && deepLinkCode() ? 'room' : 'lobby')
  const [room, setRoom] = useState(() => deepLinkCode() ? { code: deepLinkCode(), name: `房間 ${deepLinkCode()}`, host: '載入中…', count: 0 } : null)
  const [isHost, setIsHost] = useState(() => !deepLinkCode())
  const [hostToken, setHostToken] = useState(() => deepLinkCode() ? sessionStorage.getItem(`draw-ai-host-${deepLinkCode()}`) || '' : '')
  const [players, setPlayers] = useState([])
  const [publicRooms, setPublicRooms] = useState([])
  const [lobbyLoading, setLobbyLoading] = useState(multiplayerConfigured)
  const [serviceError, setServiceError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState([])
  const [qrUrl, setQrUrl] = useState('')

  const ownPlayer = useMemo(() => playerRecord(playerName, playerId), [playerId, playerName])
  const roomCode = room?.code

  const refreshRooms = useCallback(async () => {
    if (!multiplayerConfigured) { setPublicRooms([]); setLobbyLoading(false); return }
    setLobbyLoading(true)
    try {
      setPublicRooms(await listPublicRooms())
      setServiceError('')
    } catch {
      setServiceError('目前無法讀取房間，請確認 Supabase 資料表與環境變數。')
    } finally {
      setLobbyLoading(false)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'lobby') return
    const unsubscribe = subscribeToRooms(refreshRooms)
    const timer = window.setTimeout(refreshRooms, 0)
    return () => { window.clearTimeout(timer); unsubscribe() }
  }, [refreshRooms, screen])

  useEffect(() => {
    if (!room) return
    QRCode.toDataURL(`${window.location.origin}/room/${room.code}`, { width: 220, margin: 1 }).then(setQrUrl)
  }, [room])

  useEffect(() => {
    if (!roomCode || !multiplayerConfigured) return
    return subscribeToRoom(roomCode, (nextRoom) => {
      setRoom(nextRoom)
      setPlayers(nextRoom.players)
      if (nextRoom.prompt) setPrompt(nextRoom.prompt)
      if (nextRoom.state === 'prompt') setScreen('prompt')
      if (nextRoom.state === 'drawing') setScreen('draw')
    })
  }, [roomCode])

  useEffect(() => {
    if (!room || isHost || !playerName || !multiplayerConfigured || players.length) return
    let active = true
    joinRemoteRoom(room.code, ownPlayer).then((joined) => {
      if (!active) return
      setRoom(joined)
      setPlayers(joined.players)
      if (joined.prompt) setPrompt(joined.prompt)
      if (joined.state === 'prompt') setScreen('prompt')
      if (joined.state === 'drawing') setScreen('draw')
    }).catch(() => {
      if (active) { setServiceError('找不到這個房間，可能已經結束或超過 6 人。'); setScreen('lobby'); window.history.replaceState({}, '', '/') }
    })
    return () => { active = false }
  }, [isHost, ownPlayer, playerName, players.length, room])

  useEffect(() => {
    if (multiplayerConfigured) return
    const bus = createGameBus((message) => {
      if (!room || message.roomCode !== room.code) return
      if (message.type === 'JOIN') setPlayers((current) => current.some((item) => item.id === message.player.id) ? current : [...current, message.player].slice(0, 6))
      if (message.type === 'PROMPT') { setPrompt(message.prompt); setScreen('draw') }
    })
    return () => bus.close()
  }, [room])

  const saveName = (name) => {
    sessionStorage.setItem('draw-ai-name', name)
    setPlayerName(name)
    const code = deepLinkCode()
    if (code) {
      setRoom({ code, name: `房間 ${code}`, host: '載入中…', count: 0 })
      setIsHost(Boolean(sessionStorage.getItem(`draw-ai-host-${code}`)))
      setPlayers([])
      setScreen('room')
    }
  }

  const createRoom = async () => {
    if (!multiplayerConfigured) { setServiceError('請先設定 Supabase，才可以建立跨裝置房間。'); return }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const token = crypto.randomUUID()
    const candidate = { code, name: `${playerName}的畫畫班`, host: playerName, hostId: playerId, players: [ownPlayer] }
    try {
      const created = await createRemoteRoom(candidate, token)
      sessionStorage.setItem(`draw-ai-host-${code}`, token)
      setHostToken(token); setRoom(created); setIsHost(true); setPlayers(created.players); setScreen('room'); setServiceError('')
      window.history.replaceState({}, '', `/room/${code}`)
    } catch {
      setServiceError('房間建立失敗，請確認 Supabase 的 schema.sql 已執行。')
    }
  }

  const joinRoom = useCallback(async (nextRoom) => {
    if (!multiplayerConfigured) { setServiceError('多人連線尚未設定，現在無法跨裝置加入房間。'); return }
    try {
      const joined = await joinRemoteRoom(nextRoom.code, ownPlayer)
      setRoom(joined); setIsHost(false); setPlayers(joined.players); setPrompt(joined.prompt); setServiceError('')
      setScreen(joined.state === 'drawing' ? 'draw' : joined.state === 'prompt' ? 'prompt' : 'room')
      window.history.replaceState({}, '', `/room/${joined.code}`)
    } catch {
      setServiceError('加入失敗：房間可能已開始、已滿或不存在。')
    }
  }, [ownPlayer])

  const leave = useCallback(() => {
    setRoom(null); setPrompt(''); setScreen('lobby'); setPlayers([]); window.history.replaceState({}, '', '/')
  }, [])

  const addDemo = () => setPlayers((current) => {
    const next = SAMPLE_PLAYERS.find((sample) => !current.some((player) => player.id === sample.id))
    return next ? [...current, next] : current
  })

  const startGame = async () => {
    try {
      if (multiplayerConfigured) await updateRemoteRoom(room.code, hostToken, 'prompt')
      setScreen('prompt')
    } catch { setServiceError('無法開始遊戲，請重新建立房間。') }
  }

  const confirmPrompt = async (value) => {
    try {
      if (multiplayerConfigured) await updateRemoteRoom(room.code, hostToken, 'drawing', value)
      setPrompt(value); setScreen('draw')
      if (!multiplayerConfigured) createGameBus(() => {}).send({ type: 'PROMPT', roomCode: room.code, prompt: value })
    } catch { setServiceError('題目發布失敗，請稍後再試。') }
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
  const showHeader = screen !== 'draw'
  return (
    <div className="app-shell">
      {showHeader ? <AppHeader playerName={playerName} onHome={leave} /> : null}
      {screen === 'lobby' ? <Lobby playerName={playerName} rooms={publicRooms} loading={lobbyLoading} multiplayerReady={multiplayerConfigured} error={serviceError} onRefresh={refreshRooms} onCreate={createRoom} onJoin={joinRoom} /> : null}
      {screen === 'room' ? <Room room={room} players={players} isHost={isHost} qrUrl={qrUrl} onAddDemo={multiplayerConfigured ? null : addDemo} onLeave={leave} onStart={startGame} /> : null}
      {screen === 'prompt' ? <PromptStage isHost={isHost} onConfirm={confirmPrompt} /> : null}
      {screen === 'draw' ? <DrawingCanvas prompt={prompt} onSubmit={submitDrawing} /> : null}
      {screen === 'scoring' ? <Scoring /> : null}
      {screen === 'results' ? <Results prompt={prompt} results={results} onReplay={() => setScreen('prompt')} onHome={leave} /> : null}
    </div>
  )
}
