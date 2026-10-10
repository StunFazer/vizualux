import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, type Point2D } from '../../store/useStore'
import { useTracker } from '../../hooks/useTracker'
import { Homography } from '../../utils/homography'
import { CameraSelector } from './CameraSelector'

const HANDLE_SIZE = 26

/**
 * Computes the weighted centroid of the bright projected target spot
 * using adaptive local-contrast normalization to reject camera auto-exposure shifts.
 */
function calculateDifferenceCentroid(
  currPixels: Uint8ClampedArray,
  darkRefPixels: Uint8ClampedArray,
  w: number,
  h: number,
  stepSize = 2
): { x: number; y: number } | null {
  if (!currPixels || !darkRefPixels) return null

  // 1. Calculate global luminance difference to cancel camera auto-exposure drift
  let sumDiff = 0
  let sampleCount = 0

  for (let y = 0; y < h; y += stepSize * 2) {
    for (let x = 0; x < w; x += stepSize * 2) {
      const idx = (y * w + x) * 4
      const currLuma = 0.299 * currPixels[idx] + 0.587 * currPixels[idx + 1] + 0.114 * currPixels[idx + 2]
      const darkLuma = 0.299 * darkRefPixels[idx] + 0.587 * darkRefPixels[idx + 1] + 0.114 * darkRefPixels[idx + 2]
      sumDiff += (currLuma - darkLuma)
      sampleCount++
    }
  }

  const globalExposureShift = sampleCount > 0 ? (sumDiff / sampleCount) : 0

  // 2. Compute local positive difference and find peak illumination
  let maxLocalDiff = 0

  for (let y = 0; y < h; y += stepSize) {
    for (let x = 0; x < w; x += stepSize) {
      const idx = (y * w + x) * 4
      const currLuma = 0.299 * currPixels[idx] + 0.587 * currPixels[idx + 1] + 0.114 * currPixels[idx + 2]
      const darkLuma = 0.299 * darkRefPixels[idx] + 0.587 * darkRefPixels[idx + 1] + 0.114 * darkRefPixels[idx + 2]
      const localDiff = (currLuma - darkLuma) - globalExposureShift
      if (localDiff > maxLocalDiff) {
        maxLocalDiff = localDiff
      }
    }
  }

  // Reject if no distinct bright projection target spot was observed
  if (maxLocalDiff < 22) {
    return null
  }

  // 3. Cluster around the local peak (top 35% of peak intensity)
  const peakThreshold = maxLocalDiff * 0.65
  let sumWeight = 0
  let sumX = 0
  let sumY = 0

  for (let y = 0; y < h; y += stepSize) {
    for (let x = 0; x < w; x += stepSize) {
      const idx = (y * w + x) * 4
      const currLuma = 0.299 * currPixels[idx] + 0.587 * currPixels[idx + 1] + 0.114 * currPixels[idx + 2]
      const darkLuma = 0.299 * darkRefPixels[idx] + 0.587 * darkRefPixels[idx + 1] + 0.114 * darkRefPixels[idx + 2]
      const localDiff = (currLuma - darkLuma) - globalExposureShift

      if (localDiff > peakThreshold) {
        const weight = Math.pow(localDiff - peakThreshold, 2)
        sumWeight += weight
        sumX += x * weight
        sumY += y * weight
      }
    }
  }

  if (sumWeight < 40) {
    return null
  }

  return {
    x: sumX / sumWeight,
    y: sumY / sumWeight
  }
}

export function CalibrationUI() {
  const { 
    calibrationCorners, 
    setCalibrationCorners, 
    setIsCalibrating,
    setCalibrationStep,
    emitMessage,
    activeCamera,
    activeCameraId,
    deviceCameras,
    hostCameras
  } = useStore()

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [selectedCornerIdx, setSelectedCornerIdx] = useState<number>(0)
  const [nudgeStepPx, setNudgeStepPx] = useState<number>(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const trackerRef = useTracker()
  const imgRef = useRef<HTMLImageElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hasStream, setHasStream] = useState(false)

  // Auto-Calibration State
  const [isAutoCalibrating, setIsAutoCalibrating] = useState(false)
  const [autoStatus, setAutoStatus] = useState<string>('')
  const [autoProgress, setAutoProgress] = useState<number>(0)
  const [autoError, setAutoError] = useState<string | null>(null)
  const [autoSuccess, setAutoSuccess] = useState<boolean>(false)
  const [lockedPoints, setLockedPoints] = useState<Point2D[]>([])
  const cancelRef = useRef<boolean>(false)

  // Offscreen canvas for grabbing camera pixel buffer
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    captureCanvasRef.current = document.createElement('canvas')
    captureCanvasRef.current.width = 640
    captureCanvasRef.current.height = 360
  }, [])

  // Ensure backend is in calibration mode so it streams the 640x360 frame
  useEffect(() => {
    setIsCalibrating(true)
    const sendCalib = () => {
      const emit = useStore.getState().emitMessage
      if (emit) {
        emit({ type: 'set_calibrating', value: true })
      }
    }
    sendCalib()
    const timer = setInterval(sendCalib, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [setIsCalibrating])

  // Reset stream status when camera switches
  useEffect(() => {
    setHasStream(false)
  }, [activeCamera])

  // Poll tracker ref every frame to pipe the base64 camera frame to imgRef
  useEffect(() => {
    let id: number
    const loop = () => {
      const frame = trackerRef.current.frame
      if (frame) {
        if (!hasStream) setHasStream(true)
        if (imgRef.current && imgRef.current.src !== frame) {
          imgRef.current.src = frame
        }
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [trackerRef, hasStream])

  // Helper to extract current frame pixel data from the live camera img
  const getCameraPixels = useCallback((): Uint8ClampedArray | null => {
    if (!imgRef.current || !captureCanvasRef.current) return null
    const ctx = captureCanvasRef.current.getContext('2d')
    if (!ctx) return null
    try {
      ctx.drawImage(imgRef.current, 0, 0, 640, 360)
      return ctx.getImageData(0, 0, 640, 360).data
    } catch {
      return null
    }
  }, [])

  // Update magnifying loupe preview
  const updateLoupe = useCallback((pt: Point2D) => {
    if (!loupeCanvasRef.current || !imgRef.current) return
    const ctx = loupeCanvasRef.current.getContext('2d')
    if (!ctx) return

    const srcW = imgRef.current.naturalWidth || 640
    const srcH = imgRef.current.naturalHeight || 360
    const pxX = pt.x * srcW
    const pxY = pt.y * srcH

    const zoom = 2.6
    const sampleW = 140 / zoom
    const sampleH = 140 / zoom

    ctx.clearRect(0, 0, 140, 140)
    ctx.imageSmoothingEnabled = false
    try {
      ctx.drawImage(
        imgRef.current,
        pxX - sampleW / 2, pxY - sampleH / 2, sampleW, sampleH,
        0, 0, 140, 140
      )
    } catch {}
  }, [])

  // Structured Light 5-step sequence with camera auto-exposure stabilization
  const startStructuredLightCalibration = async () => {
    if (!hasStream) {
      setAutoError('Camera feed is not ready. Please wait for the video stream to connect.')
      return
    }

    cancelRef.current = false
    setIsAutoCalibrating(true)
    setAutoError(null)
    setAutoSuccess(false)
    setAutoProgress(5)
    setLockedPoints([])

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

    try {
      // Step 0: Capture ambient dark baseline
      setAutoStatus('Step 0/5: Capturing room ambient baseline...')
      setCalibrationStep(0)
      setAutoProgress(10)
      await sleep(1500) // allow camera exposure to settle

      if (cancelRef.current) return

      const darkRefPixels = getCameraPixels()
      if (!darkRefPixels) {
        throw new Error('Failed to capture room ambient baseline pixels from camera.')
      }

      // Steps 1 to 4: Flashing corner targets
      const stepNames = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left']
      const detected: Point2D[] = []

      for (let s = 1; s <= 4; s++) {
        if (cancelRef.current) return

        setAutoStatus(`Step ${s}/5: Calibrating ${stepNames[s - 1]} corner...`)
        setCalibrationStep(s)
        setAutoProgress(15 + s * 18)
        await sleep(1500) // camera AE settling delay

        if (cancelRef.current) return

        // Take two samples to ensure stability
        const sample1 = getCameraPixels()
        await sleep(200)
        const sample2 = getCameraPixels()
        const currPixels = sample2 || sample1

        if (!currPixels) {
          throw new Error(`Failed to capture camera frame during ${stepNames[s - 1]} flash.`)
        }

        // Calculate adaptive difference centroid
        let centroid = calculateDifferenceCentroid(currPixels, darkRefPixels, 640, 360, 2)
        if (!centroid && sample1) {
          centroid = calculateDifferenceCentroid(sample1, darkRefPixels, 640, 360, 2)
        }

        if (!centroid) {
          throw new Error(
            `Target detection failed at ${stepNames[s - 1]} corner. Ensure the projector target is within camera view.`
          )
        }

        const normPt = { x: centroid.x / 640, y: centroid.y / 360 }
        detected.push(normPt)
        setLockedPoints([...detected])
      }

      // Step 5: Solve Homography
      setAutoStatus('Step 5/5: Resolving perspective homography matrix...')
      setAutoProgress(95)
      await sleep(400)

      if (cancelRef.current) return

      const targetPos: Point2D[] = [
        { x: 0.05, y: 0.05 }, // Top-Left
        { x: 0.95, y: 0.05 }, // Top-Right
        { x: 0.95, y: 0.95 }, // Bottom-Right
        { x: 0.05, y: 0.95 }  // Bottom-Left
      ]

      const H = new Homography()
      const solved = H.calibrate(targetPos, detected)
      if (!solved) {
        throw new Error('Singular matrix encountered during homography calculation. Please re-run.')
      }

      const c0 = H.transform(0, 0)
      const c1 = H.transform(1, 0)
      const c2 = H.transform(1, 1)
      const c3 = H.transform(0, 1)

      if ([c0, c1, c2, c3].some(p => isNaN(p.x) || isNaN(p.y))) {
        throw new Error('Homography matrix produced invalid math results (NaNs). Check camera angle.')
      }

      const newCorners: Point2D[] = [
        { x: Math.max(0, Math.min(1, c0.x)), y: Math.max(0, Math.min(1, c0.y)) },
        { x: Math.max(0, Math.min(1, c1.x)), y: Math.max(0, Math.min(1, c1.y)) },
        { x: Math.max(0, Math.min(1, c2.x)), y: Math.max(0, Math.min(1, c2.y)) },
        { x: Math.max(0, Math.min(1, c3.x)), y: Math.max(0, Math.min(1, c3.y)) }
      ]

      setCalibrationCorners(newCorners)
      if (emitMessage) {
        emitMessage({ type: 'set_calibration_corners', corners: newCorners })
      }

      setAutoProgress(100)
      setAutoStatus('Structured Light Auto-Calibration complete!')
      setAutoSuccess(true)
      setCalibrationStep(-1)
    } catch (err: any) {
      setCalibrationStep(-1)
      setAutoError(err.message || 'Calibration sequence failed.')
    } finally {
      if (cancelRef.current) {
        setCalibrationStep(-1)
        setAutoStatus('Calibration cancelled.')
      }
    }
  }

  // ArUco Marker One-Click Detection Sequence
  const startArucoCalibration = async () => {
    if (!hasStream) {
      setAutoError('Camera feed is not ready. Please wait for camera to connect.')
      return
    }

    cancelRef.current = false
    setIsAutoCalibrating(true)
    setAutoError(null)
    setAutoSuccess(false)
    setAutoStatus('Displaying ArUco markers on projector... Detecting markers 0, 1, 2, 3...')
    setAutoProgress(25)
    setCalibrationStep(10) // Show ArUco markers on projector

    const emit = useStore.getState().emitMessage
    if (emit) {
      emit({ type: 'start_auto_calibrate' })
    }

    const startTime = Date.now()
    const checkInterval = setInterval(() => {
      if (cancelRef.current) {
        clearInterval(checkInterval)
        return
      }

      const result = trackerRef.current.auto_calibrate_result
      if (result && Array.isArray(result) && result.length >= 4) {
        clearInterval(checkInterval)
        setCalibrationCorners(result)
        if (emit) {
          emit({ type: 'set_calibration_corners', corners: result })
        }
        setLockedPoints(result)
        setAutoProgress(100)
        setAutoStatus('ArUco auto-calibration successful! 4 corners locked.')
        setAutoSuccess(true)
        setIsAutoCalibrating(false)
        setCalibrationStep(-1)
        return
      }

      if (Date.now() - startTime > 12000) {
        clearInterval(checkInterval)
        setIsAutoCalibrating(false)
        setCalibrationStep(-1)
        setAutoError('ArUco markers not detected by camera within 12s. Check camera angle or use Optical Auto-Calibration.')
      }
    }, 250)
  }

  const cancelCalibration = () => {
    cancelRef.current = true
    setIsAutoCalibrating(false)
    setCalibrationStep(-1)
    setAutoStatus('')
    setAutoProgress(0)
    setAutoError(null)
  }

  // Pointer drag event handlers for manual corner fine-tuning
  const handlePointerDown = (idx: number) => (e: React.PointerEvent) => {
    setDraggingIdx(idx)
    setSelectedCornerIdx(idx)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateLoupe(calibrationCorners[idx])
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    
    let x = (e.clientX - rect.left) / rect.width
    let y = (e.clientY - rect.top) / rect.height
    
    x = Math.max(0, Math.min(1, x))
    y = Math.max(0, Math.min(1, y))

    const newCorners = [...calibrationCorners]
    newCorners[draggingIdx] = { x, y }
    setCalibrationCorners(newCorners)
    if (emitMessage) {
      emitMessage({ type: 'set_calibration_corners', corners: newCorners })
    }

    updateLoupe({ x, y })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingIdx(null)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // Handle precision nudge using D-pad buttons
  const nudgeCorner = (dxPx: number, dyPx: number) => {
    const newCorners = [...calibrationCorners]
    const cur = newCorners[selectedCornerIdx]
    const nx = Math.max(0, Math.min(1, cur.x + dxPx / 640))
    const ny = Math.max(0, Math.min(1, cur.y + dyPx / 360))
    newCorners[selectedCornerIdx] = { x: nx, y: ny }
    setCalibrationCorners(newCorners)
    if (emitMessage) {
      emitMessage({ type: 'set_calibration_corners', corners: newCorners })
    }
    updateLoupe({ x: nx, y: ny })
  }

  const cornerLabels = ['TL 1 (Red)', 'TR 2 (Blue)', 'BR 3 (Green)', 'BL 4 (Yellow)']
  const cornerColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, 
        backgroundColor: '#0a0a0c',
        cursor: draggingIdx !== null ? 'grabbing' : 'default',
        touchAction: 'none',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Header Bar */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '16px 24px', background: 'rgba(15, 17, 23, 0.95)', borderBottom: '1px solid #232733',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 30
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', color: '#00f5ff', letterSpacing: '0.05em' }}>
            Structured Light Calibration
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            Color-matched floor targets with precision magnifying loupe & auto-detection
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Camera Selection Dropdown */}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: 'rgba(255,255,255,0.06)', padding: '5px 10px', 
            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)' 
          }}>
            <CameraSelector compact={true} />
          </div>

          {!isAutoCalibrating ? (
            <>
              <button 
                onClick={startStructuredLightCalibration}
                title="Optical Flash Auto-Calibration"
                style={{ 
                  padding: '10px 18px', 
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', 
                  color: 'white', border: 'none', borderRadius: '8px', 
                  cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)'
                }}
              >
                Optical Auto-Calibrate
              </button>

              <button 
                onClick={startArucoCalibration}
                title="Instant ArUco Marker Auto-Calibration"
                style={{ 
                  padding: '10px 18px', 
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', 
                  color: 'white', border: 'none', borderRadius: '8px', 
                  cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                }}
              >
                ArUco Auto-Detect
              </button>
            </>
          ) : (
            <button 
              onClick={cancelCalibration}
              style={{ 
                padding: '10px 20px', 
                background: '#ef4444', 
                color: 'white', border: 'none', borderRadius: '8px', 
                cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
              }}
            >
              Cancel
            </button>
          )}

          <button 
            onClick={() => {
              setCalibrationStep(-1)
              setIsCalibrating(false)
              const emit = useStore.getState().emitMessage
              if (emit) {
                emit({ type: 'set_calibrating', value: false })
              }
            }}
            style={{ 
              padding: '10px 20px', 
              background: '#1e293b', color: '#e2e8f0', 
              border: '1px solid #334155', borderRadius: '8px', 
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
            }}
          >
            Save & Exit
          </button>
        </div>
      </div>

      {/* Main Body Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative', gap: '20px' }}>
        
        {/* Camera Feed Card */}
        <div style={{
          background: '#111318', border: '1px solid #232733', padding: '16px', borderRadius: '14px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '680px', width: '100%'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
              Camera Tracking View <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>({[...deviceCameras, ...hostCameras].find(c => c.id === activeCameraId)?.name || (activeCamera === -1 ? '📱 Phone / Device Camera' : `Camera ${activeCamera}`)})</span>
            </span>
            <span style={{ color: hasStream ? '#10b981' : '#f43f5e', fontSize: '0.8rem', fontWeight: 500 }}>
              {hasStream ? 'Stream Active (640x360)' : 'Waiting for camera feed...'}
            </span>
          </div>

          {/* Video Container */}
          <div 
            ref={containerRef}
            style={{ 
              position: 'relative', width: '640px', height: '360px', 
              background: '#050505', borderRadius: '8px', overflow: 'hidden',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
            }}
          >
            <img 
              ref={imgRef} 
              alt="Tracking Feed"
              style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', display: hasStream ? 'block' : 'none' }} 
            />

            {!hasStream && (
              <div style={{ color: '#64748b', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>
                Connecting to camera stream...
              </div>
            )}

            {/* Projection Quadrilateral Boundary */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <polygon 
                points={calibrationCorners.map(c => `${c.x * 640},${c.y * 360}`).join(' ')} 
                fill="rgba(0, 245, 255, 0.12)" 
                stroke="#00f5ff" 
                strokeWidth="2" 
                strokeDasharray="4 2"
              />
            </svg>

            {/* Locked Auto-Calibration Points */}
            {lockedPoints.map((pt, idx) => (
              <div 
                key={`locked-${idx}`}
                style={{
                  position: 'absolute',
                  left: pt.x * 640,
                  top: pt.y * 360,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 15
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `2px solid ${cornerColors[idx % 4]}`,
                  boxShadow: `0 0 12px ${cornerColors[idx % 4]}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                </div>
              </div>
            ))}

            {/* Manual Drag Handles (Color-coded to match projector floor targets) */}
            {calibrationCorners.map((corner, idx) => {
              const isSelected = selectedCornerIdx === idx
              const isDragging = draggingIdx === idx
              return (
                <div 
                  key={idx}
                  onPointerDown={handlePointerDown(idx)}
                  onClick={() => { setSelectedCornerIdx(idx); updateLoupe(corner); }}
                  style={{
                    position: 'absolute',
                    left: corner.x * 640,
                    top: corner.y * 360,
                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                    background: cornerColors[idx],
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    boxShadow: isSelected ? `0 0 16px ${cornerColors[idx]}, 0 4px 12px rgba(0,0,0,0.9)` : '0 4px 12px rgba(0,0,0,0.9)',
                    border: isSelected ? '3px solid white' : '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: isDragging ? 35 : (isSelected ? 30 : 20)
                  }}
                >
                  <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>{idx + 1}</span>
                  <div style={{ 
                    position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', 
                    color: '#ffffff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap', 
                    pointerEvents: 'none', fontWeight: 700, fontSize: '0.7rem',
                    background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px',
                    border: `1px solid ${cornerColors[idx]}`
                  }}>
                    {cornerLabels[idx]}
                  </div>
                </div>
              )
            })}

            {/* Floating Magnifying Loupe (Active while dragging any handle) */}
            {draggingIdx !== null && (
              <div 
                style={{
                  position: 'absolute',
                  left: Math.max(75, Math.min(565, calibrationCorners[draggingIdx].x * 640)),
                  top: Math.max(75, Math.min(285, calibrationCorners[draggingIdx].y * 360 - 90)),
                  transform: 'translate(-50%, -50%)',
                  width: 140, height: 140,
                  borderRadius: '50%',
                  border: `3px solid ${cornerColors[draggingIdx]}`,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.95), 0 0 20px rgba(0,245,255,0.4)',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                  zIndex: 50,
                  backgroundColor: '#000'
                }}
              >
                <canvas ref={loupeCanvasRef} width={140} height={140} style={{ width: '100%', height: '100%' }} />
                {/* Center Crosshair Reticle */}
                <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.85)' }} />
                <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: 'rgba(255,255,255,0.85)' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', border: '2px solid #ef4444' }} />
                <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#00f5ff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                  2.6x Precision Loupe
                </div>
              </div>
            )}
          </div>

          {/* Status & Progress Bar */}
          <div style={{ width: '100%', marginTop: '14px' }}>
            {isAutoCalibrating && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ color: '#00f5ff', fontSize: '0.8rem', fontWeight: 600 }}>{autoStatus}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{autoProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${autoProgress}%`, height: '100%', 
                      background: 'linear-gradient(90deg, #00f5ff, #8b5cf6)',
                      transition: 'width 0.3s ease' 
                    }} 
                  />
                </div>
              </div>
            )}

            {autoSuccess && (
              <div style={{ 
                padding: '8px 12px', background: 'rgba(16, 185, 129, 0.15)', 
                border: '1px solid #10b981', borderRadius: '6px', 
                color: '#34d399', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px'
              }}>
                Auto-calibration successfully solved and saved!
              </div>
            )}

            {autoError && (
              <div style={{ 
                padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', 
                border: '1px solid #ef4444', borderRadius: '6px', 
                color: '#f87171', fontSize: '0.8rem', marginBottom: '6px'
              }}>
                {autoError}
              </div>
            )}
          </div>
        </div>

        {/* Precision Nudge Keypad Card */}
        <div style={{
          background: '#111318', border: '1px solid #232733', padding: '18px', borderRadius: '14px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex', flexDirection: 'column', gap: '14px', width: '280px'
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Precision Nudge
          </div>

          {/* Corner Selector Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {cornerLabels.map((lbl, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedCornerIdx(idx); updateLoupe(calibrationCorners[idx]); }}
                style={{
                  padding: '7px 4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: selectedCornerIdx === idx ? cornerColors[idx] : 'rgba(255,255,255,0.06)',
                  border: selectedCornerIdx === idx ? '2px solid white' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Coordinate info */}
          <div style={{ background: '#0a0c10', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '0.75rem', color: '#94a3b8' }}>
            <div>Selected: <strong style={{ color: cornerColors[selectedCornerIdx] }}>{cornerLabels[selectedCornerIdx]}</strong></div>
            <div style={{ marginTop: '2px', fontFamily: 'monospace' }}>
              X: {(calibrationCorners[selectedCornerIdx].x * 640).toFixed(0)}px ({(calibrationCorners[selectedCornerIdx].x).toFixed(3)})
            </div>
            <div style={{ fontFamily: 'monospace' }}>
              Y: {(calibrationCorners[selectedCornerIdx].y * 360).toFixed(0)}px ({(calibrationCorners[selectedCornerIdx].y).toFixed(3)})
            </div>
          </div>

          {/* Step Size Selector */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Step:</span>
            <button
              onClick={() => setNudgeStepPx(1)}
              style={{
                flex: 1, padding: '4px', fontSize: '0.75rem',
                backgroundColor: nudgeStepPx === 1 ? '#06b6d4' : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer'
              }}
            >
              1px (Fine)
            </button>
            <button
              onClick={() => setNudgeStepPx(5)}
              style={{
                flex: 1, padding: '4px', fontSize: '0.75rem',
                backgroundColor: nudgeStepPx === 5 ? '#06b6d4' : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer'
              }}
            >
              5px (Coarse)
            </button>
          </div>

          {/* D-Pad Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <button
              onClick={() => nudgeCorner(0, -nudgeStepPx)}
              style={{
                width: '48px', height: '40px', background: '#1e293b', border: '1px solid #334155',
                borderRadius: '6px', color: '#e2e8f0', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              ▲
            </button>
            <div style={{ display: 'flex', gap: '24px' }}>
              <button
                onClick={() => nudgeCorner(-nudgeStepPx, 0)}
                style={{
                  width: '48px', height: '40px', background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '6px', color: '#e2e8f0', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                ◀
              </button>
              <button
                onClick={() => nudgeCorner(nudgeStepPx, 0)}
                style={{
                  width: '48px', height: '40px', background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '6px', color: '#e2e8f0', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                ▶
              </button>
            </div>
            <button
              onClick={() => nudgeCorner(0, nudgeStepPx)}
              style={{
                width: '48px', height: '40px', background: '#1e293b', border: '1px solid #334155',
                borderRadius: '6px', color: '#e2e8f0', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              ▼
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
