import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useDeviceCameras } from '../hooks/useDeviceCameras'

export function DeviceCameraStreamer() {
  const activeCameraId = useStore((state) => state.activeCameraId)
  const streamResolution = useStore((state) => state.streamResolution)
  const streamFps = useStore((state) => state.streamFps)
  const streamMirror = useStore((state) => state.streamMirror)
  const emitBinary = useStore((state) => state.emitBinary)
  const emitMessage = useStore((state) => state.emitMessage)
  const setIsPhoneStreaming = useStore((state) => state.setIsPhoneStreaming)
  const setStreamFpsDisplay = useStore((state) => state.setStreamFpsDisplay)
  const setStreamError = useStore((state) => state.setStreamError)
  const { detectCameras } = useDeviceCameras()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wakeLockRef = useRef<any>(null)
  const isSendingRef = useRef<boolean>(false)
  const frameCountRef = useRef<number>(0)
  const animFrameIdRef = useRef<number | null>(null)
  const lastSendTimeRef = useRef<number>(0)

  // Initialize canvas
  useEffect(() => {
    canvasRef.current = document.createElement('canvas')
  }, [])

  // Wake lock management
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

  // Stop camera stream
  const stopStream = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    (window as any).__deviceCameraStream = null;
    window.dispatchEvent(new CustomEvent('device_camera_stream_change', { detail: null }));
    releaseWakeLock()
    setIsPhoneStreaming(false)
    if (emitMessage) {
      emitMessage({ type: 'client_camera_status', streaming: false })
    }
  }, [emitMessage, setIsPhoneStreaming])

  // Start frame capture loop
  const startCaptureLoop = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
    }

    const targetInterval = 1000 / streamFps

    const sendLoop = (timestamp: number) => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (video && canvas && video.readyState >= 2 && !isSendingRef.current) {
        const elapsed = timestamp - lastSendTimeRef.current
        if (elapsed >= targetInterval) {
          lastSendTimeRef.current = timestamp

          const w = streamResolution.width
          const h = streamResolution.height

          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }

          const ctx = canvas.getContext('2d')
          if (ctx) {
            if (streamMirror) {
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
  }, [emitBinary, streamFps, streamMirror, streamResolution.height, streamResolution.width])

  // Start camera stream for active device
  const startStream = useCallback(async (targetCameraId: string) => {
    stopStream()
    setStreamError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setStreamError('Camera API not accessible. Mobile browsers require HTTPS.')
      return
    }

    const idPart = targetCameraId.replace('device:', '')

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: streamResolution.width, max: 1920 },
        height: { ideal: streamResolution.height, max: 1080 },
        frameRate: { ideal: streamFps, max: 60 }
      }
    }

    if (idPart === 'environment') {
      (constraints.video as MediaTrackConstraints).facingMode = { ideal: 'environment' }
    } else if (idPart === 'user') {
      (constraints.video as MediaTrackConstraints).facingMode = { ideal: 'user' }
    } else if (idPart && !idPart.startsWith('device-')) {
      (constraints.video as MediaTrackConstraints).deviceId = { exact: idPart }
    } else {
      (constraints.video as MediaTrackConstraints).facingMode = { ideal: 'environment' }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setIsPhoneStreaming(true);
      (window as any).__deviceCameraStream = stream;
      window.dispatchEvent(new CustomEvent('device_camera_stream_change', { detail: stream }));
      if (emitMessage) {
        emitMessage({ type: 'client_camera_status', streaming: true })
      }

      await requestWakeLock()
      startCaptureLoop()

      // Refresh camera labels after permission granted
      setTimeout(() => {
        detectCameras(false)
      }, 500)
    } catch (err: any) {
      console.warn('Failed to start device camera:', err)
      setStreamError(err.message || 'Could not access device camera. Please check camera permissions.')
      stopStream()
    }
  }, [detectCameras, emitMessage, setIsPhoneStreaming, setStreamError, startCaptureLoop, stopStream, streamFps, streamResolution.height, streamResolution.width])

  // Watch activeCameraId and start/stop appropriately
  useEffect(() => {
    if (activeCameraId.startsWith('device:')) {
      startStream(activeCameraId)
    } else {
      stopStream()
    }

    return () => {
      // Don't kill stream immediately on re-renders, only if activeCameraId changes
    }
  }, [activeCameraId, startStream, stopStream])

  // FPS calculation counter
  useEffect(() => {
    let prev = 0
    const interval = setInterval(() => {
      const current = frameCountRef.current
      setStreamFpsDisplay(current - prev)
      prev = current
    }, 1000)
    return () => clearInterval(interval)
  }, [setStreamFpsDisplay])

  // Cleanup on final unmount
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  return (
    <div style={{ display: 'none' }} aria-hidden="true">
      <video
        ref={videoRef}
        id="device-camera-stream-video"
        playsInline
        muted
        autoPlay
      />
    </div>
  )
}
