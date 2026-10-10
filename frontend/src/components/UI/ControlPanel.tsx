import { useStore } from '../../store/useStore'
import { PhoneCameraStreamer } from './PhoneCameraStreamer'
import { CameraSelector } from './CameraSelector'

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
    currentMode, setMode, trackingStatus,
    trackingMode, setTrackingMode, trackerThresholds, setTrackerThresholds,
    advancedOpen, toggleAdvanced,
    silhouetteEngine, setSilhouetteEngine,
    silhouetteResolution, setSilhouetteResolution,
    silhouetteEffect, setSilhouetteEffect,
    silhouetteColor, setSilhouetteColor,
    silhouetteRainbow, setSilhouetteRainbow,
    silhouetteTrailDecay, setSilhouetteTrailDecay,
    particleTrailStyle, setParticleTrailStyle,
    particleTrailSize, setParticleTrailSize,
    particleTrailTwinkle, setParticleTrailTwinkle,
    waterRippleIntensity, setWaterRippleIntensity,
    waterRippleDamping, setWaterRippleDamping,
    scatterPreset, setScatterPreset,
    scatterCustomImage, setScatterCustomImage,
    motionRevealPreset, setMotionRevealPreset,
    motionRevealCustomImage, setMotionRevealCustomImage,
    motionRevealBrushRadius, setMotionRevealBrushRadius,
    motionRevealFadeSpeed, setMotionRevealFadeSpeed
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
          onClick={() => setMode('ParticleTrail')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'ParticleTrail' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'ParticleTrail' ? '1px solid #60a5fa' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'ParticleTrail' ? 'bold' : 'normal'
          }}
        >
          Particle & Sparkle Trail
        </button>

        <button 
          onClick={() => setMode('WaterRipples')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'WaterRipples' ? '#0284c7' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'WaterRipples' ? '1px solid #38bdf8' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'WaterRipples' ? 'bold' : 'normal'
          }}
        >
          Interactive Water Ripples
        </button>

        <button 
          onClick={() => setMode('Scatter')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'Scatter' ? '#10b981' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'Scatter' ? '1px solid #34d399' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'Scatter' ? 'bold' : 'normal'
          }}
        >
          Object Scatter (Leaves/Snow)
        </button>

        <button 
          onClick={() => setMode('MotionReveal')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'MotionReveal' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'MotionReveal' ? '1px solid #a78bfa' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'MotionReveal' ? 'bold' : 'normal'
          }}
        >
          Motion Reveal (Gallery & Custom)
        </button>

        <button 
          onClick={() => setMode('FluidSimulation')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'FluidSimulation' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'FluidSimulation' ? '1px solid #60a5fa' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'FluidSimulation' ? 'bold' : 'normal'
          }}
        >
          Fluid Dynamics
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

        <button 
          onClick={() => setMode('CosmicNebula')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'CosmicNebula' ? '#6366f1' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'CosmicNebula' ? '1px solid #818cf8' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'CosmicNebula' ? 'bold' : 'normal'
          }}
        >
          Cosmic Nebula & Gravity
        </button>

        <button 
          onClick={() => setMode('NeonGrid')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'NeonGrid' ? '#06b6d4' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'NeonGrid' ? '1px solid #22d3ee' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'NeonGrid' ? 'bold' : 'normal'
          }}
        >
          Cyberpunk Neon Grid
        </button>

        <button 
          onClick={() => setMode('ElectricPlasma')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'ElectricPlasma' ? '#a855f7' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'ElectricPlasma' ? '1px solid #c084fc' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'ElectricPlasma' ? 'bold' : 'normal'
          }}
        >
          Tesla Electric Plasma
        </button>

        <button 
          onClick={() => setMode('LavaEmbers')}
          style={{
            padding: '10px 15px',
            backgroundColor: currentMode === 'LavaEmbers' ? '#ea580c' : 'rgba(255,255,255,0.1)',
            border: currentMode === 'LavaEmbers' ? '1px solid #fb923c' : 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
            fontWeight: currentMode === 'LavaEmbers' ? 'bold' : 'normal'
          }}
        >
          Volcanic Magma & Embers
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

          {/* Masking Effects */}
          <div>
            <div style={labelStyle}><span>🎭 Masking Effects</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {[
                { id: 'aura', label: 'Neon Aura' },
                { id: 'cosmic', label: 'Cosmic Galaxy' },
                { id: 'chrome', label: 'Liquid Chrome' },
                { id: 'matrix', label: 'Matrix Rain' },
                { id: 'forcefield', label: 'Forcefield' },
                { id: 'xray', label: 'Spectral X-Ray' },
                { id: 'stainedglass', label: 'Stained Glass' },
              ].map((fx) => (
                <button
                  key={fx.id}
                  onClick={() => setSilhouetteEffect(fx.id as any)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '0.7rem',
                    backgroundColor: silhouetteEffect === fx.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                    border: silhouetteEffect === fx.id ? '1px solid #c4b5fd' : 'none',
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

          {/* Trailing Effects */}
          <div>
            <div style={labelStyle}><span>✨ Trailing Effects</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {[
                { id: 'echo', label: 'Motion Echo' },
                { id: 'prismatic', label: 'RGB Chrono' },
                { id: 'flame', label: 'Flame Smoke' },
                { id: 'glitch', label: 'Cyber Glitch' },
                { id: 'ribbon', label: 'Light Ribbons' },
                { id: 'sparks', label: 'Edge Sparks' },
                { id: 'combined', label: 'Ultra Combined' },
              ].map((fx) => (
                <button
                  key={fx.id}
                  onClick={() => setSilhouetteEffect(fx.id as any)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '0.7rem',
                    backgroundColor: silhouetteEffect === fx.id ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                    border: silhouetteEffect === fx.id ? '1px solid #67e8f9' : 'none',
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

      {/* Particle Trail Contextual Controls */}
      {currentMode === 'ParticleTrail' && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Particle Trail & Sparkles
          </div>
          
          <div>
            <div style={labelStyle}><span>Trail Style</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {[
                { id: 'rainbow', label: 'Rainbow' },
                { id: 'fireflies', label: 'Fireflies' },
                { id: 'plasma', label: 'Plasma' },
                { id: 'embers', label: 'Embers' },
                { id: 'aurora', label: 'Aurora' },
                { id: 'stardust', label: 'Stardust' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setParticleTrailStyle(st.id as any)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '0.7rem',
                    backgroundColor: particleTrailStyle === st.id ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                    border: particleTrailStyle === st.id ? '1px solid #93c5fd' : 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setParticleTrailTwinkle(!particleTrailTwinkle)}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '0.75rem',
                backgroundColor: particleTrailTwinkle ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                border: particleTrailTwinkle ? '1px solid #c4b5fd' : 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {particleTrailTwinkle ? 'Twinkle FX: ON' : 'Twinkle FX: OFF'}
            </button>
          </div>

          <div>
            <div style={labelStyle}>
              <span>Particle Size</span>
              <span>{(particleTrailSize * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.5"
              step="0.05"
              value={particleTrailSize}
              onChange={(e) => setParticleTrailSize(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        </div>
      )}

      {/* Water Ripples Contextual Controls */}
      {currentMode === 'WaterRipples' && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: 'rgba(2, 132, 199, 0.12)',
          border: '1px solid rgba(2, 132, 199, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Water Ripple Physics
          </div>

          <div>
            <div style={labelStyle}>
              <span>Ripple Wave Intensity</span>
              <span>{(waterRippleIntensity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="2.5"
              step="0.1"
              value={waterRippleIntensity}
              onChange={(e) => setWaterRippleIntensity(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>

          <div>
            <div style={labelStyle}>
              <span>Wave Damping</span>
              <span>{Math.round(waterRippleDamping * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.90"
              max="0.99"
              step="0.01"
              value={waterRippleDamping}
              onChange={(e) => setWaterRippleDamping(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        </div>
      )}

      {/* Scatter Contextual Controls */}
      {currentMode === 'Scatter' && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Scatter Presets & Custom Sprite
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {[
              { id: 'leaves', label: 'Maple Leaves' },
              { id: 'snowflakes', label: 'Snowflakes' },
              { id: 'petals', label: 'Sakura Petals' },
              { id: 'coins', label: 'Gold Coins' },
              { id: 'custom', label: 'Custom Sprite' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setScatterPreset(p.id as any)}
                style={{
                  padding: '6px 4px',
                  fontSize: '0.7rem',
                  backgroundColor: scatterPreset === p.id ? '#10b981' : 'rgba(255,255,255,0.1)',
                  border: scatterPreset === p.id ? '1px solid #6ee7b7' : 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label
              style={{
                display: 'block',
                padding: '6px 10px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px dashed rgba(255,255,255,0.3)',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: '#6ee7b7'
              }}
            >
              {scatterCustomImage ? 'Replace Custom Sprite' : 'Upload Custom Sprite Image'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (evt) => {
                      const dataUrl = evt.target?.result as string
                      setScatterCustomImage(dataUrl)
                      setScatterPreset('custom')
                    }
                    reader.readAsDataURL(file)
                  }
                }}
              />
            </label>
            {scatterCustomImage && (
              <button
                onClick={() => { setScatterCustomImage(null); setScatterPreset('leaves'); }}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
              >
                Reset to Default
              </button>
            )}
          </div>
        </div>
      )}

      {/* Motion Reveal Contextual Controls */}
      {currentMode === 'MotionReveal' && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Motion Reveal Mask Gallery
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
            {[
              { id: 'nebula', label: 'Cosmic Nebula' },
              { id: 'garden', label: 'Forest Garden' },
              { id: 'lava', label: 'Lava Crust' },
              { id: 'custom', label: 'Custom Image' },
            ].map((pr) => (
              <button
                key={pr.id}
                onClick={() => setMotionRevealPreset(pr.id as any)}
                style={{
                  padding: '6px 4px',
                  fontSize: '0.7rem',
                  backgroundColor: motionRevealPreset === pr.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  border: motionRevealPreset === pr.id ? '1px solid #c4b5fd' : 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {pr.label}
              </button>
            ))}
          </div>

          <div>
            <label
              style={{
                display: 'block',
                padding: '6px 10px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px dashed rgba(255,255,255,0.3)',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: '#c4b5fd'
              }}
            >
              {motionRevealCustomImage ? 'Replace Hidden Image' : 'Upload Hidden Image to Reveal'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (evt) => {
                      const dataUrl = evt.target?.result as string
                      setMotionRevealCustomImage(dataUrl)
                      setMotionRevealPreset('custom')
                    }
                    reader.readAsDataURL(file)
                  }
                }}
              />
            </label>
            {motionRevealCustomImage && (
              <button
                onClick={() => { setMotionRevealCustomImage(null); setMotionRevealPreset('nebula'); }}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
              >
                Reset to Default
              </button>
            )}
          </div>

          <div>
            <div style={labelStyle}>
              <span>Brush Radius</span>
              <span>{motionRevealBrushRadius}px</span>
            </div>
            <input
              type="range"
              min="30"
              max="160"
              step="5"
              value={motionRevealBrushRadius}
              onChange={(e) => setMotionRevealBrushRadius(parseInt(e.target.value, 10))}
              style={sliderStyle}
            />
          </div>

          <div>
            <div style={labelStyle}>
              <span>Trail Fade Speed</span>
              <span>{motionRevealFadeSpeed.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={motionRevealFadeSpeed}
              onChange={(e) => setMotionRevealFadeSpeed(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
        <h3 style={{ margin: '0', fontSize: '0.9rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px' }}>Camera Source</h3>
        <CameraSelector />

        {/* Dedicated Phone / Device Camera Settings */}
        <PhoneCameraStreamer />
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

