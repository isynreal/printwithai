import { useState } from 'react'
import { ArrowRight, BookOpen, Lightbulb, LoaderCircle } from 'lucide-react'

const EXAMPLES = ['蘋果', '雨傘', '檯燈', '恐龍']

export function PromptStage({ isHost, onConfirm }) {
  const [prompt, setPrompt] = useState('')
  if (!isHost) {
    return (
      <main className="center-stage waiting-stage">
        <div className="orbit"><LoaderCircle /></div>
        <h1>老師正在出題中…</h1>
        <p>先甩甩手、準備你的神來一筆！</p>
        <div className="student-doodles"><span>✏️</span><span>☺</span><span>★</span></div>
      </main>
    )
  }

  const submit = (event) => {
    event.preventDefault()
    if (prompt.trim()) onConfirm(prompt.trim().slice(0, 20))
  }
  return (
    <main className="center-stage prompt-stage">
      <div className="step-number">2</div>
      <h1>這一題，要畫什麼？</h1>
      <p>輸入一個大家看得懂的物品，水果、文具、動物都可以。</p>
      <form className="prompt-sheet" onSubmit={submit}>
        <label htmlFor="drawing-prompt"><Lightbulb /> 本輪題目</label>
        <input id="drawing-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：蘋果" maxLength={20} autoFocus />
        <div className="example-row"><span><BookOpen size={16} /> 沒靈感？</span>{EXAMPLES.map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
        <button className="primary-button primary-button--wide" disabled={!prompt.trim()}>公布題目 <ArrowRight size={19} /></button>
      </form>
      <p className="host-note">公布後所有玩家會同時開始，限時 3 分鐘。</p>
    </main>
  )
}
