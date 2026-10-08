import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store/useStore'

interface VideoDevice {
  deviceId: string
  label: string
}

export function PhoneCameraStreamer() {
  const { 
    setActiveCamera, 
    emitBinary, 
    emitMessage,
    isPhoneStreaming, 
    setIsPhoneStreaming 
  } = useStore()

  const [devices, setDevices] = useState<VideoDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [resolution, setResolution] = useState<{ width: number; height: number }>({ width: 1280, height: 720 })
  const [fps, setFps] = useState<number>(30)
  const [mirror, setMirror] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fpsDisplay, setFpsDisplay] = useState<number>(0)
  const [isSecure, setIsSecure] = useState<boolean>(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wakeLockRef = useRef<any>(null)
  const isSendingRef = useRef<boolean>(false)
  const frameCountRef = useRef<number>(0)
  const animFrameIdRef = useRef<number | null>(null)
  const lastSendTimeRef = useRef<number>(0)

  // Verify secure context (browsers require HTTPS or localhost for getUserMedia)
  useEffect(() => {
    const secure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    setIsSecure(secure)
  }, [])

  // Create offscreen canvas
  useEffect(() => {
    canvasRef.current = document.createElement('canvas')
  }, [])

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || (d.deviceId ? `Camera ${i + 1}` : `Camera Lens ${i + 1}`)
        }))
      setDevices(videoInputs)
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId)
      }
    } catch (e: any) {
      console.warn('Could not enumerate camera devices:', e)
    }
  }, [selectedDeviceId])

  // Request Wake Lock to prevent phone screen from sleeping during streaming
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {}
  }

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    } catch {}
  }

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    releaseWakeLock()
    setIsPhoneStreaming(false)
    if (emitMessage) {
      emitMessage({ type: 'client_camera_status', streaming: false })
    }
  }, [emitMessage, setIsPhoneStreaming])

  // Start phone camera stream
  const startCamera = async () => {
    setErrorMsg(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Camera access is not supported by this browser. HTTPS is required on mobile.')
      return
    }

    try {
      // Constraints prioritizing environment/rear lens
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : { ideal: facingMode },
          width: { ideal: resolution.width, max: 1920 },
          height: { ideal: resolution.height, max: 1080 },
          frameRate: { ideal: fps, max: 60 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Re-enumerate to get actual hardware labels if previously ungranted
      await refreshDevices()
      await requestWakeLock()

      setIsPhoneStreaming(true)
      setActiveCamera(-1)
      if (emitMessage) {
        emitMessage({ type: 'client_camera_status', streaming: true })
      }

      // Start frame capture loop
      startCaptureLoop()
    } catch (err: any) {
      console.error('Error starting camera stream:', err)
      setErrorMsg(err.message || 'Could not access device camera. Please check permissions.')
      stopCamera()
    }
  }

  // Frame capture and transmission loop
  const startCaptureLoop = () => {
    const targetInterval = 1000 / fps

    const sendLoop = (timestamp: number) => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (video && canvas && video.readyState >= 2 && !isSendingRef.current) {
        const elapsed = timestamp - lastSendTimeRef.current
        if (elapsed >= targetInterval) {
          lastSendTimeRef.current = timestamp

          const w = resolution.width
          const h = resolution.height

          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }

          const ctx = canvas.getContext('2d')
          if (ctx) {
            if (mirror) {
              ctx.save()
              ctx.translate(w, 0)
              ctx.scale(-1, 1)
              ctx.drawImage(video, 0, 0, w, h)
              ctx.restore()
            } else {
              ctx.drawImage(video, 0, 0, w, h)
            }

            isSendingRef.current = true
            canvas.toBlob(
              (blob) => {
                if (blob && emitBinary) {
                  blob.arrayBuffer().then((buffer) => {
                    emitBinary(buffer)
                    frameCountRef.current++
                    isSendingRef.current = false
                  }).catch(() => {
                    isSendingRef.current = false
                  })
                } else {
                  isSendingRef.current = false
                }
              },
              'image/jpeg',
              0.65
            )
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(sendLoop)
    }

    animFrameIdRef.current = requestAnimationFrame(sendLoop)
  }

  // FPS calculation timer
  useEffect(() => {
    let prev = 0
    const interval = setInterval(() => {
      const current = frameCountRef.current
      setFpsDisplay(current - prev)
      prev = current
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const switchToHttps = () => {
    const secureUrl = `https://${window.location.hostname}:5173${window.location.search}`
    window.location.href = secureUrl
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: isPhoneStreaming ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📱 Phone Camera Streamer
        </span>
        {isPhoneStreaming ? (
          <span style={{ 
            fontSize: '0.75rem', 
            background: 'rgba(16, 185, 129, 0.2)', 
            color: '#34d399', 
            padding: '2px 8px', 
            borderRadius: '999px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            LIVE {fpsDisplay} FPS
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inactive</span>
        )}
      </div>

      {/* Non-secure origin warning */}
      {!isSecure && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '0.8rem',
          color: '#fca5a5'
        }}>
          <div>Mobile browsers restrict camera permissions to HTTPS.</div>
          <button
            onClick={switchToHttps}
            style={{
              marginTop: '6px',
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Switch to HTTPS (Port 5173)
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '0.8rem',
          color: '#fca5a5'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Video Viewfinder Preview */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: isPhoneStreaming ? '160px' : '0px',
        maxHeight: '180px',
        backgroundColor: '#000',
        borderRadius: '6px',
        overflow: 'hidden',
        transition: 'height 0.2s ease',
        display: isPhoneStreaming ? 'block' : 'none'
      }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: mirror ? 'scaleX(-1)' : 'none'
          }}
        />
        <div style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          background: 'rgba(0,0,0,0.65)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#cbd5e1'
        }}>
          {resolution.width}x{resolution.height}
        </div>
      </div>

      {/* Lens & Device Controls */}
      {!isPhoneStreaming && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Camera Lens</label>
            <select
              value={selectedDeviceId || facingMode}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'environment' || val === 'user') {
                  setFacingMode(val)
                  setSelectedDeviceId('')
                } else {
                  setSelectedDeviceId(val)
                }
              }}
              onFocus={refreshDevices}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            >
              {devices.length === 0 ? (
                <>
                  <option value="environment" style={{ color: 'black' }}>Rear Camera (Environment)</option>
                  <option value="user" style={{ color: 'black' }}>Front Camera (User)</option>
                </>
              ) : (
                devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} style={{ color: 'black' }}>
                    {d.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Resolution</label>
              <select
                value={`${resolution.width}x${resolution.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number)
                  setResolution({ width: w, height: h })
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              >
                <option value="1280x720" style={{ color: 'black' }}>720p HD (Optimal)</option>
                <option value="854x480" style={{ color: 'black' }}>480p Fast</option>
                <option value="640x360" style={{ color: 'black' }}>360p Low-Bandwidth</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target FPS</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              >
                <option value={30} style={{ color: 'black' }}>30 FPS (Standard)</option>
                <option value={60} style={{ color: 'black' }}>60 FPS (Smooth)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="mirror-toggle"
              checked={mirror}
              onChange={(e) => setMirror(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="mirror-toggle" style={{ fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
              Mirror camera image horizontally
            </label>
          </div>
        </div>
      )}

      {/* Stream Action Buttons */}
      {!isPhoneStreaming ? (
        <button
          onClick={startCamera}
          style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: '#06b6d4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 2px 10px rgba(6, 182, 212, 0.3)'
          }}
        >
          <span>▶</span> Start Streaming Phone Camera
        </button>
      ) : (
        <button
          onClick={stopCamera}
          style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>⏹</span> Stop Phone Camera Stream
        </button>
      )}
    </div>
  )
}
