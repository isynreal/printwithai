import { useEffect, useState } from 'react'

export function useCountdown(active, initialSeconds, onEnd) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    if (!active || seconds <= 0) return
    const id = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(id)
          queueMicrotask(onEnd)
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [active, onEnd, seconds])

  return seconds
}
