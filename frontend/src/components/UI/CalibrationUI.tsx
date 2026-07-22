import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { useTracker } from '../../hooks/useTracker'

const HANDLE_SIZE = 24

export function CalibrationUI() {
  const { calibrationCorners, setCalibrationCorners, setIsCalibrating } = useStore()
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const trackerRef = useTracker()
  const imgRef = useRef<HTMLImageElement>(null)
  const [hasStream, setHasStream] = useState(false)

  // Poll the tracker ref every frame to get the live video stream directly to the DOM
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

  const handlePointerDown = (idx: number) => (e: React.PointerEvent) => {
    setDraggingIdx(idx)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    
    let x = (e.clientX - rect.left) / rect.width
    let y = (e.clientY - rect.top) / rect.height
    
    // Clamp to image bounds
    x = Math.max(0, Math.min(1, x))
    y = Math.max(0, Math.min(1, y))

    const newCorners = [...calibrationCorners]
    newCorners[draggingIdx] = { x, y }
    setCalibrationCorners(newCorners)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingIdx(null)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, 
        backgroundColor: '#050505',
        cursor: draggingIdx !== null ? 'grabbing' : 'default',
        touchAction: 'none'
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 4 Corner Markers for the Physical Projector Floor */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '20vmin', height: '20vmin', background: '#ef4444' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '20vmin', height: '20vmin', background: '#3b82f6' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20vmin', height: '20vmin', background: '#22c55e' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20vmin', height: '20vmin', background: '#eab308' }} />

      <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 30, display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => {
            const emit = useStore.getState().emitMessage
            if (emit) emit({ type: 'start_auto_calibrate' })
          }}
          style={{ 
            padding: '15px 30px', 
            background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', 
            cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
          }}
        >
          ⟳ Auto Calibrate
        </button>
        <button 
          onClick={() => setIsCalibrating(false)}
          style={{ 
            padding: '15px 30px', 
            background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', 
            cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
          }}
        >
          Save & Exit Calibration
        </button>
      </div>

      <div style={{ position: 'absolute', top: 30, left: 30, color: 'white', maxWidth: 400, textShadow: '0 2px 4px rgba(0,0,0,0.8)', zIndex: 30 }}>
        <h1 style={{ margin: '0 0 10px 0' }}>Calibration Mode</h1>
        <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.5' }}>
          Look at the camera feed below. Drag the 4 corner handles so they align with the 4 bright colored squares currently projected on your floor!
        </p>
      </div>

      {/* Centered Camera Panel */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: '#1a1a1a', padding: '15px', borderRadius: '12px', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)', zIndex: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Live Camera View</h2>
          <span style={{ color: hasStream ? '#4ade80' : '#f87171', fontSize: '0.9rem' }}>
            {hasStream ? '● Receiving Stream' : '○ Waiting for stream...'}
          </span>
        </div>

        <div 
          ref={containerRef}
          style={{ position: 'relative', width: '640px', height: '360px', background: '#000', borderRadius: '4px', overflow: 'hidden' }}
        >
          <img ref={imgRef} style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', display: hasStream ? 'block' : 'none' }} />
          {!hasStream && (
             <div style={{ color: '#666', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               Connecting to tracking backend...
             </div>
          )}

          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <polygon 
              points={calibrationCorners.map(c => `${c.x * 640},${c.y * 360}`).join(' ')} 
              fill="rgba(59, 130, 246, 0.2)" 
              stroke="#3b82f6" 
              strokeWidth="2" 
            />
          </svg>

          {calibrationCorners.map((corner, idx) => {
            const labels = ["Top Left (Red)", "Top Right (Blue)", "Bottom Right (Green)", "Bottom Left (Yellow)"]
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
                  boxShadow: '0 4px 10px rgba(0,0,0,0.8)',
                  border: draggingIdx === idx ? '3px solid white' : '2px solid white',
                  zIndex: 10
                }}
              >
                <div style={{ 
                  position: 'absolute', top: -25, left: '50%', transform: 'translateX(-50%)', 
                  color: 'white', textShadow: '1px 1px 3px black', whiteSpace: 'nowrap', 
                  pointerEvents: 'none', fontWeight: 'bold', fontSize: '0.9rem'
                }}>
                  {labels[idx]}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
