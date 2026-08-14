import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { AppHeader } from './components/Brand'
import { DrawingCanvas } from './components/DrawingCanvas'
import { Lobby } from './components/Lobby'
import { NameGate } from './components/NameGate'
import { PromptStage } from './components/PromptStage'
import { Results } from './components/Results'
import { Room } from './components/Room'
import { WaitingStage } from './components/WaitingStage'
import {
  createRemoteRoom,
  finishRemoteRound,
  getRemoteRoom,
  joinRemoteRoom,
  listPublicRooms,
  multiplayerConfigured,
  submitRemoteResult,
  subscribeToRoom,
  subscribeToRooms,
  updateRemoteRoom,
} from './lib/roomService'

const initialName = () => sessionStorage.getItem('draw-ai-name') || ''
const deepLinkCode = () => window.location.pathname.match(/\/room\/([^/]+)/)?.[1]?.toUpperCase() || ''
const storedHostToken = (code) => code ? sessionStorage.getItem(`draw-ai-host-${code}`) || '' : ''
const initialPlayerId = () => {
  const stored = sessionStorage.getItem('draw-ai-player-id')
  if (stored) return stored
  const created = crypto.randomUUID()
  sessionStorage.setItem('draw-ai-player-id', created)
  return created
}
const playerRecord = (name, id) => ({ id, name, avatar: name.slice(0, 1), color: '#4b72dd' })

function createThumbnail(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 360 / image.width, 260 / image.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.68))
    }
    image.onerror = reject
    image.src = dataUrl
  })
}

export default function App() {
  const [playerName, setPlayerName] = useState(initialName)
  const [playerId] = useState(initialPlayerId)
  const [screen, setScreen] = useState(() => initialName() && deepLinkCode() ? 'room' : 'lobby')
  const [room, setRoom] = useState(() => deepLinkCode() ? { code: deepLinkCode(), name: `房間 ${deepLinkCode()}`, host: '載入中…', count: 0 } : null)
  const [isHost, setIsHost] = useState(() => !deepLinkCode() || Boolean(storedHostToken(deepLinkCode())))
  const [hostToken, setHostToken] = useState(() => storedHostToken(deepLinkCode()))
  const [players, setPlayers] = useState([])
  const [publicRooms, setPublicRooms] = useState([])
  const [lobbyLoading, setLobbyLoading] = useState(multiplayerConfigured)
  const [serviceError, setServiceError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState([])
  const [qrUrl, setQrUrl] = useState('')
  const [pendingImage, setPendingImage] = useState('')
  const [isScoring, setIsScoring] = useState(false)
  const [submissionError, setSubmissionError] = useState('')

  const ownPlayer = useMemo(() => playerRecord(playerName, playerId), [playerId, playerName])
  const roomCode = room?.code

  const applyRoomState = useCallback((nextRoom) => {
    setRoom(nextRoom)
    setPlayers(nextRoom.players)
    setResults(nextRoom.results)
    if (nextRoom.prompt) setPrompt(nextRoom.prompt)
    if (nextRoom.state === 'lobby') setScreen('room')
    if (nextRoom.state === 'prompt') {
      setPendingImage('')
      setSubmissionError('')
      setScreen('prompt')
    }
    if (nextRoom.state === 'drawing') {
      const alreadySubmitted = nextRoom.results.some((result) => result.id === playerId)
      setScreen(isHost || alreadySubmitted ? 'waiting' : 'draw')
    }
    if (nextRoom.state === 'results') setScreen('results')
  }, [isHost, playerId])

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
    if (!roomCode) return
    QRCode.toDataURL(`${window.location.origin}/room/${roomCode}`, { width: 220, margin: 1 }).then(setQrUrl)
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || !multiplayerConfigured) return
    return subscribeToRoom(roomCode, applyRoomState)
  }, [applyRoomState, roomCode])

  useEffect(() => {
    if (!roomCode || !playerName || !multiplayerConfigured || players.length) return
    let active = true
    const request = isHost ? getRemoteRoom(roomCode) : joinRemoteRoom(roomCode, ownPlayer)
    request.then((loaded) => { if (active) applyRoomState(loaded) }).catch(() => {
      if (active) { setServiceError('找不到這個房間，可能已結束、已開始或超過 6 人。'); setScreen('lobby'); window.history.replaceState({}, '', '/') }
    })
    return () => { active = false }
  }, [applyRoomState, isHost, ownPlayer, playerName, players.length, roomCode])

  const saveName = (name) => {
    sessionStorage.setItem('draw-ai-name', name)
    setPlayerName(name)
    const code = deepLinkCode()
    if (code) {
      setRoom({ code, name: `房間 ${code}`, host: '載入中…', count: 0 })
      setIsHost(Boolean(storedHostToken(code)))
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
      setHostToken(token); setIsHost(true); applyRoomState(created); setScreen('room'); setServiceError('')
      window.history.replaceState({}, '', `/room/${code}`)
    } catch (error) {
      setServiceError(`房間建立失敗：${error.message || '請確認 Supabase SQL 已執行'}`)
    }
  }

  const joinRoom = useCallback(async (nextRoom) => {
    if (!multiplayerConfigured) { setServiceError('多人連線尚未設定，現在無法跨裝置加入房間。'); return }
    try {
      const joined = await joinRemoteRoom(nextRoom.code, ownPlayer)
      setIsHost(false); applyRoomState(joined); setServiceError('')
      window.history.replaceState({}, '', `/room/${joined.code}`)
    } catch {
      setServiceError('加入失敗：房間可能已開始、已滿或不存在。')
    }
  }, [applyRoomState, ownPlayer])

  const leave = useCallback(() => {
    setRoom(null); setIsHost(true); setPrompt(''); setResults([]); setPendingImage(''); setScreen('lobby'); setPlayers([]); window.history.replaceState({}, '', '/')
  }, [])

  useEffect(() => {
    if (!room?.expiresAt) return
    const remaining = new Date(room.expiresAt).getTime() - Date.now()
    const expire = () => {
      leave()
      setServiceError('這間房間已建立滿 20 分鐘，系統已自動關閉。')
    }
    if (remaining <= 0) {
      const timer = window.setTimeout(expire, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(expire, remaining)
    return () => window.clearTimeout(timer)
  }, [leave, room?.expiresAt])

  const startGame = async () => {
    try {
      const updated = await updateRemoteRoom(room.code, hostToken, 'prompt')
      applyRoomState(updated)
    } catch { setServiceError('無法開始遊戲，請重新建立房間。') }
  }

  const confirmPrompt = async (value) => {
    try {
      const updated = await updateRemoteRoom(room.code, hostToken, 'drawing', value)
      setPrompt(value)
      applyRoomState(updated)
    } catch { setServiceError('題目發布失敗，請稍後再試。') }
  }

  const scoreAndSubmit = useCallback(async (image) => {
    setIsScoring(true)
    setSubmissionError('')
    try {
      const thumbnail = await createThumbnail(image)
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image: thumbnail }),
      })
      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        const messages = {
          OPENAI_KEY_MISSING: 'Vercel 尚未設定 OPENAI_API_KEY，或設定後尚未重新部署',
          OPENAI_AUTH_FAILED: 'OpenAI API Key 無效，請在 Vercel 重新設定',
          OPENAI_PERMISSION_DENIED: '這組 OpenAI API Key 沒有模型權限，請確認 API Project 與地區設定',
          OPENAI_QUOTA_EXCEEDED: 'OpenAI API 尚未啟用計費或額度已用完',
          OPENAI_RATE_LIMITED: 'OpenAI 請求過多，請稍候一分鐘再試',
        }
        throw new Error(messages[details.code] || 'AI 目前無法評分，請稍後再試')
      }
      const aiResult = await response.json()
      const updated = await submitRemoteResult(roomCode, playerId, {
        name: playerName,
        score: aiResult.score,
        description: aiResult.description,
        image: thumbnail,
      })
      applyRoomState(updated)
    } catch (error) {
      setSubmissionError(error.message || '作品送出失敗，請稍後再試')
    } finally {
      setIsScoring(false)
    }
  }, [applyRoomState, playerId, playerName, prompt, roomCode])

  const submitDrawing = useCallback((image) => {
    setPendingImage(image)
    setScreen('waiting')
    scoreAndSubmit(image)
  }, [scoreAndSubmit])

  const finishRound = useCallback(async () => {
    if (!isHost || !roomCode) return
    try {
      applyRoomState(await finishRemoteRound(roomCode, hostToken))
    } catch { setServiceError('自動結算失敗，請重新整理後再試。') }
  }, [applyRoomState, hostToken, isHost, roomCode])

  const replay = async () => {
    if (!isHost) return
    try { applyRoomState(await updateRemoteRoom(room.code, hostToken, 'prompt')) }
    catch { setServiceError('無法開始下一題，請重新整理後再試。') }
  }

  if (!playerName) return <NameGate onContinue={saveName} />
  const showHeader = screen !== 'draw'
  return (
    <div className="app-shell">
      {showHeader ? <AppHeader playerName={playerName} onHome={leave} /> : null}
      {screen === 'lobby' ? <Lobby playerName={playerName} rooms={publicRooms} loading={lobbyLoading} multiplayerReady={multiplayerConfigured} error={serviceError} onRefresh={refreshRooms} onCreate={createRoom} onJoin={joinRoom} /> : null}
      {screen === 'room' ? <Room room={room} players={players} isHost={isHost} qrUrl={qrUrl} onAddDemo={null} onLeave={leave} onStart={startGame} /> : null}
      {screen === 'prompt' ? <PromptStage isHost={isHost} onConfirm={confirmPrompt} /> : null}
      {screen === 'draw' ? <DrawingCanvas prompt={prompt} onSubmit={submitDrawing} /> : null}
      {screen === 'waiting' ? <WaitingStage players={players} hostId={room.hostId} results={results} roundStartedAt={room.roundStartedAt} ownPlayerId={playerId} isHost={isHost} scoring={isScoring} error={submissionError} onRetry={() => pendingImage && scoreAndSubmit(pendingImage)} onExpire={finishRound} /> : null}
      {screen === 'results' ? <Results prompt={prompt} results={results} isHost={isHost} onReplay={replay} onHome={leave} /> : null}
    </div>
  )
}
