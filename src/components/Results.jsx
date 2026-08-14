import { Home, Medal, RefreshCw, Sparkles, Trophy } from 'lucide-react'

export function Scoring() {
  return (
    <main className="center-stage scoring-stage">
      <div className="ai-orb"><Sparkles /></div>
      <h1>AI 正在看大家的作品…</h1>
      <p>它正在比對題目、輪廓和畫面細節。</p>
      <div className="scoring-lines"><span /><span /><span /></div>
    </main>
  )
}

export function Results({ prompt, results, onReplay, onHome }) {
  const sorted = [...results].sort((a, b) => b.score - a.score)
  return (
    <main className="results-page">
      <header className="results-heading">
        <div className="result-icon"><Sparkles /></div>
        <div><span>題目：{prompt}</span><h1>AI 評分完成！</h1><p>每一筆都有自己的個性，來看看這回合的排名。</p></div>
      </header>
      <section className="winner-strip">
        <Medal /> <span>本輪畫王</span><strong>{sorted[0]?.name}</strong><em>{sorted[0]?.score} 分</em>
      </section>
      <section className="result-list">
        {sorted.map((result, index) => (
          <article className={`result-card ${index === 0 ? 'result-card--winner' : ''}`} key={result.name}>
            <div className="rank-number">{index + 1}</div>
            <div className="result-art">{result.image ? <img src={result.image} alt={`${result.name}的作品`} /> : <span>{result.emoji}</span>}</div>
            <div className="result-copy"><div><h2>{result.name}</h2>{index === 0 ? <span className="winner-label"><Trophy size={14} /> 畫王</span> : null}</div><p>{result.description}</p></div>
            <strong className="result-score">{result.score}<small>分</small></strong>
          </article>
        ))}
      </section>
      <footer className="results-actions"><button className="primary-button" onClick={onReplay}><RefreshCw size={18} /> 再玩一場</button><button className="secondary-button" onClick={onHome}><Home size={18} /> 回到大廳</button></footer>
    </main>
  )
}
