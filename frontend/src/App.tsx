import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/UI/ControlPanel'
import './index.css'

import { useStore } from './store/useStore'
import { CalibrationUI } from './components/UI/CalibrationUI'
import { DeviceCameraStreamer } from './components/DeviceCameraStreamer'

import { useTracker } from './hooks/useTracker'

function App() {
  const isCalibrating = useStore((state) => state.isCalibrating)
  const calibrationStep = useStore((state) => state.calibrationStep)
  const uiVisible = useStore((state) => state.uiVisible)
  const toggleUiVisible = useStore((state) => state.toggleUiVisible)

  // Ensure the WebSocket connection is always established regardless of the current view
  useTracker()

  const isProjector = new URLSearchParams(window.location.search).get('view') === 'projector'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle UI on 'h' or 'H' keypress
      if (e.key.toLowerCase() === 'h') {
        toggleUiVisible()
      }
    }
    
    const handleDoubleClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err))
      } else {
        document.exitFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('dblclick', handleDoubleClick)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [toggleUiVisible])

  if (isProjector) {
    let targetCX = -50
    let targetCY = -50
    if (calibrationStep === 1) { targetCX = 5; targetCY = 5 } // Top-Left
    else if (calibrationStep === 2) { targetCX = 95; targetCY = 5 } // Top-Right
    else if (calibrationStep === 3) { targetCX = 95; targetCY = 95 } // Bottom-Right
    else if (calibrationStep === 4) { targetCX = 5; targetCY = 95 } // Bottom-Left

    return (
      <>
        <DeviceCameraStreamer />
        {isCalibrating && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#000000', overflow: 'hidden' }}>
            {/* Step 0: Ambient darkness capture */}
            {calibrationStep === 0 && (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#000000' }} />
            )}

            {/* Steps 1 to 4: High-contrast structured light flashing target */}
            {calibrationStep >= 1 && calibrationStep <= 4 && (
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Target crosshair guide lines */}
                <line x1={targetCX - 15} y1={targetCY} x2={targetCX + 15} y2={targetCY} stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
                <line x1={targetCX} y1={targetCY - 15} x2={targetCX} y2={targetCY + 15} stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
                
                {/* Bright white solid center core */}
                <circle cx={targetCX} cy={targetCY} r="3.5" fill="#ffffff" />
                
                {/* Pulsing targeting ring for camera auto-focus & difference detection */}
                <circle cx={targetCX} cy={targetCY} r="7" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.9">
                  <animate attributeName="r" values="3.5;10;3.5" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.2s" repeatCount="indefinite" />
                </circle>
              </svg>
            )}

            {/* Step 10: ArUco 4x4 Marker Display Mode */}
            {calibrationStep === 10 && (
              <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#ffffff' }}>
                {/* ArUco Marker 0: Top-Left */}
                <div style={{ position: 'absolute', top: '4vmin', left: '4vmin', width: '22vmin', height: '22vmin', background: '#000', padding: '2vmin', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(6, 1fr)' }}>
                    {/* Standard DICT_4X4_50 marker 0 layout */}
                    <div style={{ gridColumn: '2 / 4', gridRow: '2 / 4', background: '#000' }} />
                    <div style={{ gridColumn: '4 / 6', gridRow: '3 / 5', background: '#000' }} />
                  </div>
                </div>
                {/* ArUco Marker 1: Top-Right */}
                <div style={{ position: 'absolute', top: '4vmin', right: '4vmin', width: '22vmin', height: '22vmin', background: '#000', padding: '2vmin', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(6, 1fr)' }}>
                    <div style={{ gridColumn: '3 / 5', gridRow: '2 / 4', background: '#000' }} />
                    <div style={{ gridColumn: '2 / 4', gridRow: '4 / 6', background: '#000' }} />
                  </div>
                </div>
                {/* ArUco Marker 2: Bottom-Right */}
                <div style={{ position: 'absolute', bottom: '4vmin', right: '4vmin', width: '22vmin', height: '22vmin', background: '#000', padding: '2vmin', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(6, 1fr)' }}>
                    <div style={{ gridColumn: '2 / 5', gridRow: '2 / 3', background: '#000' }} />
                    <div style={{ gridColumn: '3 / 5', gridRow: '4 / 6', background: '#000' }} />
                  </div>
                </div>
                {/* ArUco Marker 3: Bottom-Left */}
                <div style={{ position: 'absolute', bottom: '4vmin', left: '4vmin', width: '22vmin', height: '22vmin', background: '#000', padding: '2vmin', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(6, 1fr)' }}>
                    <div style={{ gridColumn: '2 / 4', gridRow: '2 / 5', background: '#000' }} />
                    <div style={{ gridColumn: '4 / 6', gridRow: '3 / 6', background: '#000' }} />
                  </div>
                </div>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#000', fontSize: '3vmin', fontWeight: 'bold' }}>
                  ArUco Marker Calibration Mode
                </div>
              </div>
            )}

            {/* Manual Alignment Mode (Step -1 or completed): High-Visibility Checkerboard Grid + Color-Coded Targets */}
            {(calibrationStep < 0 || calibrationStep > 4) && calibrationStep !== 10 && (
              <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#05070f' }}>
                {/* Full-Screen Alignment Grid SVG */}
                <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                  <defs>
                    <pattern id="calib-grid" width="10%" height="10%" patternUnits="userSpaceOnUse">
                      <rect width="100%" height="100%" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#calib-grid)" />

                  {/* Diagonal perspective guide lines */}
                  <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(0, 245, 255, 0.15)" strokeWidth="1.5" strokeDasharray="6 4" />
                  <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(0, 245, 255, 0.15)" strokeWidth="1.5" strokeDasharray="6 4" />

                  {/* Outer Viewport Calibration Border */}
                  <rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" fill="none" stroke="#00f5ff" strokeWidth="4" />

                  {/* Center Crosshair & Concentric Leveling Rings */}
                  <circle cx="50%" cy="50%" r="4%" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <circle cx="50%" cy="50%" r="8%" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                  <circle cx="50%" cy="50%" r="16%" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  <line x1="45%" y1="50%" x2="55%" y2="50%" stroke="#ffffff" strokeWidth="2" />
                  <line x1="50%" y1="45%" x2="50%" y2="55%" stroke="#ffffff" strokeWidth="2" />
                </svg>

                {/* Top-Left Target (Red) */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '22vmin', height: '22vmin', borderBottomRightRadius: '16px', background: 'rgba(239, 68, 68, 0.92)', border: '4px solid #ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(239, 68, 68, 0.8)' }}>
                  <div style={{ width: '4vmin', height: '4vmin', borderRadius: '50%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '1vmin', height: '1vmin', borderRadius: '50%', background: '#fff' }} />
                  </div>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '2.4vmin', letterSpacing: '1px' }}>TL 1 (RED)</span>
                </div>

                {/* Top-Right Target (Blue) */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: '22vmin', height: '22vmin', borderBottomLeftRadius: '16px', background: 'rgba(59, 130, 246, 0.92)', border: '4px solid #ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)' }}>
                  <div style={{ width: '4vmin', height: '4vmin', borderRadius: '50%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '1vmin', height: '1vmin', borderRadius: '50%', background: '#fff' }} />
                  </div>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '2.4vmin', letterSpacing: '1px' }}>TR 2 (BLUE)</span>
                </div>

                {/* Bottom-Right Target (Green) */}
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '22vmin', height: '22vmin', borderTopLeftRadius: '16px', background: 'rgba(16, 185, 129, 0.92)', border: '4px solid #ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16, 185, 129, 0.8)' }}>
                  <div style={{ width: '4vmin', height: '4vmin', borderRadius: '50%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '1vmin', height: '1vmin', borderRadius: '50%', background: '#fff' }} />
                  </div>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '2.4vmin', letterSpacing: '1px' }}>BR 3 (GREEN)</span>
                </div>

                {/* Bottom-Left Target (Yellow) */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '22vmin', height: '22vmin', borderTopRightRadius: '16px', background: 'rgba(245, 158, 11, 0.92)', border: '4px solid #ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(245, 158, 11, 0.8)' }}>
                  <div style={{ width: '4vmin', height: '4vmin', borderRadius: '50%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '1vmin', height: '1vmin', borderRadius: '50%', background: '#fff' }} />
                  </div>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '2.4vmin', letterSpacing: '1px' }}>BL 4 (YELLOW)</span>
                </div>
              </div>
            )}
          </div>
        )}
        {!isCalibrating && <Scene />}
      </>
    )
  }

  // Control Panel View
  return (
    <>
      <DeviceCameraStreamer />
      {isCalibrating ? <CalibrationUI /> : (uiVisible && <ControlPanel />)}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
        <h1 style={{ fontFamily: 'sans-serif' }}>Control Panel Active</h1>
      </div>
    </>
  )
}

export default App
