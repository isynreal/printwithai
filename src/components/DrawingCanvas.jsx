import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Clock3, Eraser, Paintbrush, RotateCcw, Trash2 } from 'lucide-react'
import { COLORS } from '../lib/data'
import { useCountdown } from '../hooks/useCountdown'

export function DrawingCanvas({ prompt, onSubmit }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const drawingRef = useRef(false)
  const historyRef = useRef([])
  const [color, setColor] = useState(COLORS[0])
  const [tool, setTool] = useState('brush')

  const submit = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) onSubmit(canvas.toDataURL('image/png'))
  }, [onSubmit])
  const seconds = useCountdown(true, 180, submit)

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    historyRef.current = [...historyRef.current.slice(-19), canvas.toDataURL()]
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const prior = canvas.width ? canvas.toDataURL() : null
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * ratio)
      canvas.height = Math.round(rect.height * ratio)
      const context = canvas.getContext('2d')
      context.scale(ratio, ratio)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      contextRef.current = context
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, rect.width, rect.height)
      if (prior) {
        const image = new Image()
        image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height)
        image.src = prior
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const source = event.touches?.[0] || event
    return { x: source.clientX - rect.left, y: source.clientY - rect.top }
  }
  const begin = (event) => {
    event.preventDefault()
    saveSnapshot()
    drawingRef.current = true
    const { x, y } = point(event)
    const context = contextRef.current
    context.beginPath()
    context.moveTo(x, y)
  }
  const move = (event) => {
    if (!drawingRef.current) return
    event.preventDefault()
    const { x, y } = point(event)
    const context = contextRef.current
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = color
    context.lineWidth = tool === 'eraser' ? 28 : 7
    context.lineTo(x, y)
    context.stroke()
  }
  const end = () => { drawingRef.current = false; contextRef.current?.closePath() }
  const clear = () => {
    saveSnapshot()
    const canvas = canvasRef.current
    const context = contextRef.current
    context.save(); context.globalCompositeOperation = 'source-over'; context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight); context.restore()
  }
  const undo = () => {
    const snapshot = historyRef.current.pop()
    if (!snapshot) return
    const image = new Image()
    image.onload = () => { const canvas = canvasRef.current; contextRef.current.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight); contextRef.current.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight) }
    image.src = snapshot
  }
  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <main className="drawing-page">
      <header className="drawing-header">
        <div className="drawing-prompt"><span>這一題請畫</span><strong>{prompt}</strong></div>
        <div className={`timer ${seconds <= 30 ? 'timer--urgent' : ''}`}><Clock3 size={19} /> {formatted}</div>
        <button className="primary-button submit-drawing" onClick={submit}><Check size={19} /> 完成並送出</button>
        <div className="timer-track"><span style={{ transform: `scaleX(${seconds / 180})` }} /></div>
      </header>
      <aside className="tool-rail">
        <button className={tool === 'brush' ? 'active' : ''} onClick={() => setTool('brush')} aria-label="畫筆"><Paintbrush /></button>
        <div className="color-list">{COLORS.map((item) => <button key={item} className={color === item && tool === 'brush' ? 'selected' : ''} style={{ '--swatch': item }} onClick={() => { setColor(item); setTool('brush') }} aria-label={`選擇顏色 ${item}`} />)}</div>
        <span className="tool-divider" />
        <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')} aria-label="橡皮擦"><Eraser /></button>
        <button onClick={undo} aria-label="復原"><RotateCcw /></button>
        <button onClick={clear} aria-label="全部清除"><Trash2 /></button>
      </aside>
      <section className="canvas-wrap"><canvas ref={canvasRef} aria-label={`畫出${prompt}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerLeave={end} /></section>
    </main>
  )
}
