import { useState } from 'react'
import { ArrowRight, PencilLine, UsersRound } from 'lucide-react'
import { Brand } from './Brand'

export function NameGate({ onContinue }) {
  const [name, setName] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const clean = name.trim().slice(0, 12)
    if (clean) onContinue(clean)
  }

  return (
    <main className="welcome-page">
      <div className="welcome-doodle welcome-doodle--one" />
      <div className="welcome-doodle welcome-doodle--two" />
      <section className="welcome-copy">
        <Brand />
        <h1>畫得像不像，<br /><em>讓 AI 來揭曉。</em></h1>
        <p>開一間房、出一道題，三分鐘後一起看看誰最懂老師的心。</p>
        <div className="welcome-points">
          <span><PencilLine size={18} /> 不用下載 App</span>
          <span><UsersRound size={18} /> 最多 6 人同樂</span>
        </div>
      </section>
      <form className="name-sheet" onSubmit={submit}>
        <span className="tape" aria-hidden="true" />
        <div className="step-number">1</div>
        <h2>先取一個響亮的名字</h2>
        <p>等等同學會用這個名字認出你。</p>
        <label htmlFor="player-name">玩家名稱</label>
        <input id="player-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={12} autoFocus placeholder="例如：小美" />
        <button className="primary-button primary-button--wide" disabled={!name.trim()}>準備好了 <ArrowRight size={19} /></button>
        <small>進入即代表你同意友善作畫，不輸入個人資料。</small>
      </form>
    </main>
  )
}
