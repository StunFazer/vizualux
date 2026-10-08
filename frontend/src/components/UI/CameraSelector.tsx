import { useStore } from '../../store/useStore'
import { useDeviceCameras } from '../../hooks/useDeviceCameras'

interface CameraSelectorProps {
  compact?: boolean
  showHttpsNotice?: boolean
}

export function CameraSelector({ compact = false, showHttpsNotice = true }: CameraSelectorProps) {
  const activeCameraId = useStore((state) => state.activeCameraId)
  const setActiveCameraId = useStore((state) => state.setActiveCameraId)
  const deviceCameras = useStore((state) => state.deviceCameras)
  const hostCameras = useStore((state) => state.hostCameras)
  const isPhoneStreaming = useStore((state) => state.isPhoneStreaming)
  const streamFpsDisplay = useStore((state) => state.streamFpsDisplay)
  const streamError = useStore((state) => state.streamError)

  const { detectCameras, isDetecting } = useDeviceCameras()

  const isSecure = typeof window !== 'undefined' && 
    (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const handleSwitchToHttps = () => {
    const port = window.location.port ? `:${window.location.port}` : ''
    const secureUrl = `https://${window.location.hostname}${port}${window.location.pathname}${window.location.search}`
    window.location.href = secureUrl
  }

  // Ensure fallback items exist if deviceCameras is empty
  const effectiveDeviceCameras = deviceCameras.length > 0 ? deviceCameras : [
    { id: 'device:environment', name: '📷 Rear Camera (Environment)', type: 'device' as const },
    { id: 'device:user', name: '📷 Front Camera (User)', type: 'device' as const },
  ]

  const isUsingDevice = activeCameraId.startsWith('device:')

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Camera:</label>
        
        <select
          value={activeCameraId}
          onChange={(e) => setActiveCameraId(e.target.value)}
          style={{
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            outline: 'none',
            maxWidth: '240px'
          }}
        >
          <optgroup label="📱 This Device (Local Cameras)">
            {effectiveDeviceCameras.map((cam) => (
              <option key={cam.id} value={cam.id} style={{ background: '#0f172a', color: 'white' }}>
                {cam.name}
              </option>
            ))}
          </optgroup>

          {hostCameras.length > 0 && (
            <optgroup label="🖥️ Host PC Hardware">
              {hostCameras.map((cam) => (
                <option key={cam.id} value={cam.id} style={{ background: '#0f172a', color: 'white' }}>
                  {cam.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <button
          onClick={() => detectCameras(true)}
          disabled={isDetecting}
          title="Detect device camera lenses"
          style={{
            backgroundColor: '#334155',
            color: '#e2e8f0',
            border: '1px solid #475569',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.8rem',
            cursor: isDetecting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isDetecting ? '⏳' : '🔄'} Detect
        </button>

        {isUsingDevice && isPhoneStreaming && (
          <span style={{
            fontSize: '0.75rem',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '2px 8px',
            borderRadius: '999px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
            LIVE {streamFpsDisplay} FPS
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Insecure HTTP Warning Banner on mobile */}
      {!isSecure && showHttpsNotice && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '0.8rem',
          color: '#fca5a5'
        }}>
          <div>Mobile browsers restrict camera access to HTTPS.</div>
          <button
            onClick={handleSwitchToHttps}
            style={{
              marginTop: '6px',
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Switch to HTTPS
          </button>
        </div>
      )}

      {/* Stream Error Alert */}
      {streamError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '0.8rem',
          color: '#fca5a5'
        }}>
          {streamError}
        </div>
      )}

      {/* Unified Camera Dropdown */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select
          value={activeCameraId}
          onChange={(e) => setActiveCameraId(e.target.value)}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            outline: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          <optgroup label="📱 This Device (Detected Camera Inputs)">
            {effectiveDeviceCameras.map((cam) => (
              <option key={cam.id} value={cam.id} style={{ color: 'black' }}>
                {cam.name}
              </option>
            ))}
          </optgroup>

          {hostCameras.length > 0 && (
            <optgroup label="🖥️ Host PC Hardware">
              {hostCameras.map((cam) => (
                <option key={cam.id} value={cam.id} style={{ color: 'black' }}>
                  {cam.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <button
          onClick={() => detectCameras(true)}
          disabled={isDetecting}
          title="Detect / Allow device camera inputs"
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(255,255,255,0.12)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '6px',
            cursor: isDetecting ? 'wait' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          {isDetecting ? 'Detecting...' : '🔄 Detect'}
        </button>
      </div>

      {/* Streaming Status Pill */}
      {isUsingDevice && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '2px' }}>
          <span style={{ color: '#94a3b8' }}>
            Streaming from this device to tracking engine
          </span>
          {isPhoneStreaming ? (
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              STREAMING ({streamFpsDisplay} FPS)
            </span>
          ) : (
            <span style={{ color: '#f59e0b' }}>Connecting stream...</span>
          )}
        </div>
      )}
    </div>
  )
}
