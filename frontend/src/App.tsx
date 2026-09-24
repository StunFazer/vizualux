import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/UI/ControlPanel'
import './index.css'

import { useStore } from './store/useStore'
import { CalibrationUI } from './components/UI/CalibrationUI'

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

            {/* Manual Alignment Fallback (Step -1 or completed): 4 High-Visibility Corner Squares */}
            {(calibrationStep < 0 || calibrationStep > 4) && (
              <>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '20vmin', height: '20vmin', background: '#ef4444', border: '6px solid #ffffff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '2.5vmin' }}>TL (Red)</span>
                </div>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '20vmin', height: '20vmin', background: '#3b82f6', border: '6px solid #ffffff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '2.5vmin' }}>TR (Blue)</span>
                </div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20vmin', height: '20vmin', background: '#22c55e', border: '6px solid #ffffff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '2.5vmin' }}>BR (Green)</span>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20vmin', height: '20vmin', background: '#eab308', border: '6px solid #ffffff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '2.5vmin' }}>BL (Yellow)</span>
                </div>
              </>
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
      {isCalibrating ? <CalibrationUI /> : (uiVisible && <ControlPanel />)}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
        <h1 style={{ fontFamily: 'sans-serif' }}>Control Panel Active</h1>
      </div>
    </>
  )
}

export default App
