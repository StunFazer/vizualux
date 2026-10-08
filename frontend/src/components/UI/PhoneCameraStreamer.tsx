import { useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'

export function PhoneCameraStreamer() {
  const activeCameraId = useStore((state) => state.activeCameraId)
  const isPhoneStreaming = useStore((state) => state.isPhoneStreaming)
  const streamResolution = useStore((state) => state.streamResolution)
  const setStreamResolution = useStore((state) => state.setStreamResolution)
  const streamFps = useStore((state) => state.streamFps)
  const setStreamFps = useStore((state) => state.setStreamFps)
  const streamMirror = useStore((state) => state.streamMirror)
  const setStreamMirror = useStore((state) => state.setStreamMirror)
  const streamFpsDisplay = useStore((state) => state.streamFpsDisplay)
  const streamError = useStore((state) => state.streamError)

  const videoRef = useRef<HTMLVideoElement>(null)

  const isUsingDevice = activeCameraId.startsWith('device:')

  // Attach live video preview whenever stream changes
  useEffect(() => {
    const attachStream = (stream: MediaStream | null) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    }

    if ((window as any).__deviceCameraStream) {
      attachStream((window as any).__deviceCameraStream)
    }

    const handleStreamChange = (e: any) => {
      attachStream(e.detail)
    }

    window.addEventListener('device_camera_stream_change', handleStreamChange)
    return () => {
      window.removeEventListener('device_camera_stream_change', handleStreamChange)
    }
  }, [])

  if (!isUsingDevice) {
    return null
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: isPhoneStreaming ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📱 Device Camera Viewfinder
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
            LIVE {streamFpsDisplay} FPS
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Connecting stream...</span>
        )}
      </div>

      {/* Stream Error Alert */}
      {streamError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '0.8rem',
          color: '#fca5a5'
        }}>
          {streamError}
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
            transform: streamMirror ? 'scaleX(-1)' : 'none'
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
          {streamResolution.width}x{streamResolution.height}
        </div>
      </div>

      {/* Resolution & FPS Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Resolution</label>
          <select
            value={`${streamResolution.width}x${streamResolution.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number)
              setStreamResolution({ width: w, height: h })
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
            value={streamFps}
            onChange={(e) => setStreamFps(Number(e.target.value))}
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
          id="stream-mirror-toggle"
          checked={streamMirror}
          onChange={(e) => setStreamMirror(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <label htmlFor="stream-mirror-toggle" style={{ fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
          Mirror camera image horizontally
        </label>
      </div>
    </div>
  )
}
