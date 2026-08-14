import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

export function QRScanner({ onClose, onResult }) {
  const videoRef = useRef(null)
  const [message, setMessage] = useState('正在開啟相機…')

  useEffect(() => {
    let stream
    let timer
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        if (!('BarcodeDetector' in window)) {
          setMessage('這個瀏覽器暫不支援自動辨識，請改用房間代碼加入。')
          return
        }
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        setMessage('將 QR Code 放進框框內')
        timer = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return
          const codes = await detector.detect(videoRef.current)
          if (codes[0]) onResult(codes[0].rawValue)
        }, 600)
      } catch {
        setMessage('無法使用相機，請允許權限或改用房間代碼。')
      }
    }
    start()
    return () => {
      window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onResult])

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="掃描 QR Code">
      <div className="scanner-modal">
        <button className="icon-button scanner-close" onClick={onClose} aria-label="關閉"><X /></button>
        <div className="scanner-title"><Camera /> 掃描 QR Code</div>
        <div className="scanner-frame"><video ref={videoRef} muted playsInline /></div>
        <p>{message}</p>
      </div>
    </div>
  )
}
