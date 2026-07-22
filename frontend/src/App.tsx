import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/UI/ControlPanel'
import './index.css'

import { useStore } from './store/useStore'
import { CalibrationUI } from './components/UI/CalibrationUI'

import { useTracker } from './hooks/useTracker'

function App() {
  const isCalibrating = useStore((state) => state.isCalibrating)
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
    return (
      <>
        {isCalibrating && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#050505' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '20vmin', height: '20vmin', background: '#fff', border: '5px solid #ef4444', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/aruco/marker_0.png" style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt="Marker 0" />
            </div>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '20vmin', height: '20vmin', background: '#fff', border: '5px solid #3b82f6', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/aruco/marker_1.png" style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt="Marker 1" />
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20vmin', height: '20vmin', background: '#fff', border: '5px solid #22c55e', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/aruco/marker_2.png" style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt="Marker 2" />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20vmin', height: '20vmin', background: '#fff', border: '5px solid #eab308', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/aruco/marker_3.png" style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt="Marker 3" />
            </div>
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
