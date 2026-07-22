import { useStore } from '../../store/useStore'

const sliderStyle = {
  width: '100%',
  accentColor: '#3b82f6',
  cursor: 'pointer'
}

const labelStyle = {
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  fontSize: '0.8rem',
  color: '#a1a1aa',
  marginBottom: '4px'
}

export function ControlPanel() {
  const { 
    currentMode, setMode, trackingStatus, activeCamera, setActiveCamera,
    trackingMode, setTrackingMode, trackerThresholds, setTrackerThresholds,
    advancedOpen, toggleAdvanced, cameras
  } = useStore()

  const updateThreshold = (key: 'detection' | 'presence' | 'tracking', value: number) => {
    setTrackerThresholds({ ...trackerThresholds, [key]: value })
  }

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      zIndex: 10,
      background: 'rgba(20, 20, 25, 0.8)',
      backdropFilter: 'blur(10px)',
      padding: '20px',
      borderRadius: '12px',
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      maxHeight: '90vh',
      overflowY: 'auto'
    }}>
      <h2 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>Installation Control</h2>
      
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: trackingStatus ? '#4ade80' : '#f87171',
          boxShadow: trackingStatus ? '0 0 10px #4ade80' : 'none'
        }} />
        <span style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>
          Tracking: {trackingStatus ? 'Active' : 'Offline'} ({trackingMode === 'pose' ? 'Pose' : 'Motion'})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: '0', fontSize: '0.9rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px' }}>Mode Select</h3>
        
        <button 
          onClick={() => setMode('Asteroids')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'Asteroids' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Rigid Body Sandbox
        </button>
        
        <button 
          onClick={() => setMode('FluidSimulation')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'FluidSimulation' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Fluid Dynamics
        </button>

        <button 
          onClick={() => setMode('KoiPond')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'KoiPond' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Interactive Koi Pond
        </button>

        <button 
          onClick={() => setMode('MotionReveal')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'MotionReveal' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Forest Motion Reveal
        </button>

        <button 
          onClick={() => setMode('ScatterLeaves')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'ScatterLeaves' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Leaf Scatter
        </button>

        <button 
          onClick={() => setMode('Sparkles')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'Sparkles' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          twinkling Sparkles
        </button>

        <button 
          onClick={() => setMode('ParticleTrail')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'ParticleTrail' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Rainbow Particle Trail
        </button>

        <button 
          onClick={() => setMode('SandyShore')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'SandyShore' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left'
          }}
        >
          Sandy Shore ripples
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
        <h3 style={{ margin: '0', fontSize: '0.9rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px' }}>Camera Source</h3>
        <select 
          value={activeCamera}
          onChange={(e) => setActiveCamera(Number(e.target.value))}
          style={{
            padding: '10px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {cameras.map((cam) => (
            <option key={cam.index} value={cam.index} style={{ color: 'black' }}>
              {cam.name}
            </option>
          ))}
        </select>
      </div>

      {/* Collapsible Advanced Section */}
      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
        <button
          onClick={toggleAdvanced}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            color: '#a1a1aa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Advanced Settings
          <span style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </button>

        {advancedOpen && (
          <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* Tracking Mode Toggle */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px' }}>Tracking Mode</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setTrackingMode('pose')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: trackingMode === 'pose' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Pose (MediaPipe)
                </button>
                <button
                  onClick={() => setTrackingMode('motion')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: trackingMode === 'motion' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Motion (Frame Diff)
                </button>
              </div>
            </div>

            {/* Threshold Sliders (only relevant in Pose mode) */}
            {trackingMode === 'pose' && (
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px' }}>Detection Thresholds</h4>
                
                <div style={{ marginBottom: '10px' }}>
                  <div style={labelStyle}>
                    <span>Detection Confidence</span>
                    <span>{trackerThresholds.detection.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.05" max="1.0" step="0.05"
                    value={trackerThresholds.detection}
                    onChange={(e) => updateThreshold('detection', parseFloat(e.target.value))}
                    style={sliderStyle}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={labelStyle}>
                    <span>Presence Confidence</span>
                    <span>{trackerThresholds.presence.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.05" max="1.0" step="0.05"
                    value={trackerThresholds.presence}
                    onChange={(e) => updateThreshold('presence', parseFloat(e.target.value))}
                    style={sliderStyle}
                  />
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>Tracking Confidence</span>
                    <span>{trackerThresholds.tracking.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.05" max="1.0" step="0.05"
                    value={trackerThresholds.tracking}
                    onChange={(e) => updateThreshold('tracking', parseFloat(e.target.value))}
                    style={sliderStyle}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
        <button 
          onClick={() => {
            window.open(window.location.origin + '?view=projector', 'Projector', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no')
          }}
          style={{
            width: '100%',
            padding: '12px 15px',
            marginBottom: '10px',
            backgroundColor: '#8b5cf6',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: 'bold'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#7c3aed')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8b5cf6')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Launch Projector Window
        </button>

        <button 
          onClick={() => useStore.getState().setIsCalibrating(true)}
          style={{
            width: '100%',
            padding: '12px 15px',
            backgroundColor: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: 'bold'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v18H3zM3 9h18M9 21V9" />
          </svg>
          Calibrate Tracking
        </button>
      </div>
    </div>
  )
}

