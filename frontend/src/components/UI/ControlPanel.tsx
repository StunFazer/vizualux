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

const COLOR_SWATCHES = [
  { name: 'Cyan', color: '#00f5ff' },
  { name: 'Magenta', color: '#ff007f' },
  { name: 'Gold', color: '#ffd700' },
  { name: 'Emerald', color: '#00ff66' },
  { name: 'Violet', color: '#9d4edd' },
  { name: 'Orange', color: '#ff5400' },
]

export function ControlPanel() {
  const { 
    currentMode, setMode, trackingStatus, activeCamera, setActiveCamera,
    trackingMode, setTrackingMode, trackerThresholds, setTrackerThresholds,
    advancedOpen, toggleAdvanced, cameras,
    silhouetteEngine, setSilhouetteEngine,
    silhouetteResolution, setSilhouetteResolution,
    silhouetteEffect, setSilhouetteEffect,
    silhouetteColor, setSilhouetteColor,
    silhouetteRainbow, setSilhouetteRainbow,
    silhouetteTrailDecay, setSilhouetteTrailDecay
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

        <button 
          onClick={() => setMode('SilhouetteFX')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'SilhouetteFX' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'SilhouetteFX' ? '1px solid #a78bfa' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'SilhouetteFX' ? 'bold' : 'normal'
          }}
        >
          Silhouette FX
        </button>
      </div>

      {/* Silhouette FX Contextual Controls */}
      {currentMode === 'SilhouetteFX' && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Silhouette FX Settings
          </div>

          {/* Engine Selector */}
          <div>
            <div style={labelStyle}><span>Segmentation Engine</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={() => setSilhouetteEngine('human')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: silhouetteEngine === 'human' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Human (AI 4-Pose)
              </button>
              <button
                onClick={() => setSilhouetteEngine('object')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: silhouetteEngine === 'object' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Object / Motion (MOG2)
              </button>
            </div>
          </div>

          {/* Resolution Selector */}
          <div>
            <div style={labelStyle}><span>Stream Quality</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={() => setSilhouetteResolution('performance')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: silhouetteResolution === 'performance' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Performance (320p)
              </button>
              <button
                onClick={() => setSilhouetteResolution('hd')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: silhouetteResolution === 'hd' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                HD (640p)
              </button>
            </div>
          </div>

          {/* Visual Effect Mode */}
          <div>
            <div style={labelStyle}><span>Visual Preset</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {[
                { id: 'aura', label: 'Neon Aura' },
                { id: 'cosmic', label: 'Cosmic Fill' },
                { id: 'echo', label: 'Motion Echo' },
                { id: 'sparks', label: 'Edge Sparks' },
                { id: 'combined', label: 'Combined' },
              ].map((fx) => (
                <button
                  key={fx.id}
                  onClick={() => setSilhouetteEffect(fx.id as any)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '0.7rem',
                    backgroundColor: silhouetteEffect === fx.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {fx.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Swatch Grid & Rainbow Toggle */}
          <div>
            <div style={labelStyle}>
              <span>Color Palette</span>
              <span style={{ color: silhouetteRainbow ? '#c4b5fd' : silhouetteColor, fontWeight: 'bold' }}>
                {silhouetteRainbow ? 'Rainbow' : silhouetteColor}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '8px' }}>
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.color}
                  onClick={() => setSilhouetteColor(swatch.color)}
                  title={swatch.name}
                  style={{
                    height: '24px',
                    backgroundColor: swatch.color,
                    border: (!silhouetteRainbow && silhouetteColor.toLowerCase() === swatch.color.toLowerCase()) ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: (!silhouetteRainbow && silhouetteColor.toLowerCase() === swatch.color.toLowerCase()) ? `0 0 8px ${swatch.color}` : 'none'
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setSilhouetteRainbow(!silhouetteRainbow)}
                style={{
                  flex: 1,
                  padding: '6px',
                  fontSize: '0.75rem',
                  background: silhouetteRainbow ? 'linear-gradient(90deg, #ff007f, #ffd700, #00f5ff)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontWeight: silhouetteRainbow ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                Rainbow Cycle
              </button>
              <input
                type="color"
                value={silhouetteColor}
                onChange={(e) => setSilhouetteColor(e.target.value)}
                title="Custom Color Picker"
                style={{
                  width: '32px',
                  height: '28px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>

          {/* Trail Decay Slider */}
          <div>
            <div style={labelStyle}>
              <span>Echo Trail Decay</span>
              <span>{Math.round(silhouetteTrailDecay * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.80"
              max="0.98"
              step="0.01"
              value={silhouetteTrailDecay}
              onChange={(e) => setSilhouetteTrailDecay(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        </div>
      )}

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

