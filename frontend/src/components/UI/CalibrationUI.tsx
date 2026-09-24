import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, type Point2D } from '../../store/useStore'
import { useTracker } from '../../hooks/useTracker'
import { Homography } from '../../utils/homography'

const HANDLE_SIZE = 24

/**
 * Computes the weighted centroid of the difference image between current frame and dark baseline.
 * Ported from the Interactive Projection Software architecture.
 */
function calculateDifferenceCentroid(
  currPixels: Uint8ClampedArray,
  darkRefPixels: Uint8ClampedArray,
  w: number,
  h: number,
  stepSize = 2,
  threshold = 25
): { x: number; y: number } | null {
  if (!currPixels || !darkRefPixels) return null
  let sumWeight = 0
  let sumX = 0
  let sumY = 0

  for (let y = 0; y < h; y += stepSize) {
    for (let x = 0; x < w; x += stepSize) {
      const idx = (y * w + x) * 4
      const rDiff = Math.abs(currPixels[idx] - darkRefPixels[idx])
      const gDiff = Math.abs(currPixels[idx + 1] - darkRefPixels[idx + 1])
      const bDiff = Math.abs(currPixels[idx + 2] - darkRefPixels[idx + 2])
      const diff = 0.299 * rDiff + 0.587 * gDiff + 0.114 * bDiff

      if (diff > threshold) {
        const weight = diff * diff
        sumWeight += weight
        sumX += x * weight
        sumY += y * weight
      }
    }
  }

  // Minimum weight threshold to reject noise
  if (sumWeight < 800) {
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
    emitMessage 
  } = useStore()

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trackerRef = useTracker()
  const imgRef = useRef<HTMLImageElement>(null)
  const [hasStream, setHasStream] = useState(false)

  // Structured Light Auto-Calibration State
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

  // Structured Light 5-step sequence
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
      await sleep(1300)

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
        await sleep(1300)

        if (cancelRef.current) return

        const currPixels = getCameraPixels()
        if (!currPixels) {
          throw new Error(`Failed to capture camera frame during ${stepNames[s - 1]} flash.`)
        }

        // Calculate difference centroid
        let centroid = calculateDifferenceCentroid(currPixels, darkRefPixels, 640, 360, 2, 25)
        // Fallback with lower threshold if room is dim
        if (!centroid) {
          centroid = calculateDifferenceCentroid(currPixels, darkRefPixels, 640, 360, 2, 15)
        }

        if (!centroid) {
          throw new Error(
            `Target detection failed at ${stepNames[s - 1]} corner. Ensure the projector is visible to the camera without physical obstruction.`
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

      // Normalized coordinates where the projector displayed the 4 target points
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

      // Extrapolate to projector screen bounds (0,0), (1,0), (1,1), (0,1)
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

      // Apply to store and localStorage
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
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
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
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingIdx(null)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

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
        padding: '20px 30px', background: 'rgba(15, 17, 23, 0.95)', borderBottom: '1px solid #232733',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 30
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#00f5ff', letterSpacing: '0.05em' }}>
            Structured Light Calibration
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Automatic 5-step optical difference mapping with manual corner override
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {!isAutoCalibrating ? (
            <button 
              onClick={startStructuredLightCalibration}
              style={{ 
                padding: '12px 24px', 
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', 
                color: 'white', border: 'none', borderRadius: '8px', 
                cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)',
                transition: 'transform 0.15s ease'
              }}
            >
              Start Auto-Calibration
            </button>
          ) : (
            <button 
              onClick={cancelCalibration}
              style={{ 
                padding: '12px 24px', 
                background: '#ef4444', 
                color: 'white', border: 'none', borderRadius: '8px', 
                cursor: 'pointer', fontSize: '1rem', fontWeight: 600
              }}
            >
              Cancel
            </button>
          )}

          <button 
            onClick={() => {
              setCalibrationStep(-1)
              setIsCalibrating(false)
            }}
            style={{ 
              padding: '12px 24px', 
              background: '#1e293b', color: '#e2e8f0', 
              border: '1px solid #334155', borderRadius: '8px', 
              cursor: 'pointer', fontSize: '1rem', fontWeight: 600
            }}
          >
            Save & Exit
          </button>
        </div>
      </div>

      {/* Main Body Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
        
        {/* Camera Feed Card */}
        <div style={{
          background: '#111318', border: '1px solid #232733', padding: '20px', borderRadius: '14px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '720px', width: '100%'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}>Camera Tracking View</span>
            <span style={{ color: hasStream ? '#10b981' : '#f43f5e', fontSize: '0.85rem', fontWeight: 500 }}>
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
                  width: 28, height: 28, borderRadius: '50%',
                  border: '2px solid #00ffaa',
                  boxShadow: '0 0 10px #00ffaa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0, 255, 170, 0.2)'
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                </div>
              </div>
            ))}

            {/* Manual Drag Handles */}
            {calibrationCorners.map((corner, idx) => {
              const labels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left']
              const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308']
              return (
                <div 
                  key={idx}
                  onPointerDown={handlePointerDown(idx)}
                  style={{
                    position: 'absolute',
                    left: corner.x * 640,
                    top: corner.y * 360,
                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                    background: colors[idx],
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    cursor: draggingIdx === idx ? 'grabbing' : 'grab',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.9)',
                    border: draggingIdx === idx ? '3px solid white' : '2px solid white',
                    zIndex: 20
                  }}
                >
                  <div style={{ 
                    position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', 
                    color: '#ffffff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap', 
                    pointerEvents: 'none', fontWeight: 600, fontSize: '0.75rem',
                    background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px'
                  }}>
                    {labels[idx]}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Status & Progress Bar Card */}
          <div style={{ width: '100%', marginTop: '16px' }}>
            {isAutoCalibrating && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#00f5ff', fontSize: '0.85rem', fontWeight: 600 }}>{autoStatus}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{autoProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${autoProgress}%`, height: '100%', 
                      background: 'linear-gradient(90deg, #00f5ff, #3b82f6)',
                      transition: 'width 0.3s ease' 
                    }} 
                  />
                </div>
              </div>
            )}

            {autoSuccess && (
              <div style={{ 
                padding: '10px 14px', background: 'rgba(16, 185, 129, 0.15)', 
                border: '1px solid #10b981', borderRadius: '6px', 
                color: '#34d399', fontSize: '0.85rem', fontWeight: 500, marginBottom: '8px'
              }}>
                Auto-calibration successful! Perspective homography matrix locked to floor surface.
              </div>
            )}

            {autoError && (
              <div style={{ 
                padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', 
                border: '1px solid #ef4444', borderRadius: '6px', 
                color: '#f87171', fontSize: '0.85rem', marginBottom: '8px'
              }}>
                {autoError}
              </div>
            )}

            <div style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: '1.4', marginTop: '6px' }}>
              Tip: Click <strong>Start Auto-Calibration</strong>. The system will flash 4 structured light points on the projector floor and lock on automatically. You can also drag the colored corner handles directly to fine-tune the calibration polygon.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
