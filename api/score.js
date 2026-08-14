const jsonSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    description: { type: 'string' },
  },
  required: ['score', 'description'],
  additionalProperties: false,
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const { prompt, image } = request.body || {}
  if (!prompt || !image || !image.startsWith('data:image/')) return response.status(400).json({ error: 'Invalid drawing' })
  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({ error: 'AI scoring is not configured', code: 'OPENAI_KEY_MISSING' })
  }

  try {
    const requestedModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'
    const models = requestedModel === 'gpt-4o-mini' ? [requestedModel] : [requestedModel, 'gpt-4o-mini']
    let result
    let data

    for (const model of models) {
      result = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          input: [{ role: 'user', content: [
            { type: 'input_text', text: `你是鼓勵學生的美術遊戲評審。題目是「${String(prompt).slice(0, 30)}」。判斷作品與題目的相似度，依可辨識度、關鍵特徵、構圖給 0 到 100 的整數分數。描述限 35 個繁體中文字，具體、友善，不要提及你是 AI。` },
            { type: 'input_image', image_url: image, detail: 'low' },
          ] }],
          text: { format: { type: 'json_schema', name: 'drawing_score', strict: true, schema: jsonSchema } },
          max_output_tokens: 180,
        }),
      })
      data = await result.json().catch(() => ({}))
      if (result.ok || result.status !== 403) break
    }

    if (!result.ok) {
      const upstreamCode = data?.error?.code || ''
      if (result.status === 401) return response.status(502).json({ error: 'OpenAI API key is invalid', code: 'OPENAI_AUTH_FAILED' })
      if (result.status === 403) return response.status(502).json({ error: 'OpenAI project has no model access', code: 'OPENAI_PERMISSION_DENIED' })
      if (result.status === 429 && upstreamCode === 'insufficient_quota') return response.status(502).json({ error: 'OpenAI API quota is unavailable', code: 'OPENAI_QUOTA_EXCEEDED' })
      if (result.status === 429) return response.status(502).json({ error: 'OpenAI rate limit reached', code: 'OPENAI_RATE_LIMITED' })
      throw new Error(`OpenAI ${result.status}`)
    }
    const output = data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
    if (!output) throw new Error('OpenAI returned no score')
    return response.status(200).json(JSON.parse(output))
  } catch (error) {
    console.error('AI scoring failed:', error)
    return response.status(502).json({ error: 'Scoring failed', code: 'SCORING_FAILED' })
  }
}
