import { create } from 'zustand'

export type AppMode = 
  | 'Asteroids' 
  | 'FluidSimulation' 
  | 'KoiPond' 
  | 'MotionReveal' 
  | 'ScatterLeaves' 
  | 'Sparkles' 
  | 'ParticleTrail' 
  | 'SandyShore' 
  | 'SilhouetteFX'
  | 'CosmicNebula'
  | 'NeonGrid'
  | 'ElectricPlasma'
  | 'LavaEmbers'

export interface Point2D {
  x: number
  y: number
}

export type TrackingMode = 'pose' | 'motion'
export type SilhouetteEngine = 'human' | 'object'
export type SilhouetteResolution = 'performance' | 'hd'
export type SilhouetteEffect = 'aura' | 'cosmic' | 'echo' | 'sparks' | 'combined'

interface TrackerThresholds {
  detection: number
  presence: number
  tracking: number
}

export interface CameraItem {
  id: string
  name: string
  type: 'device' | 'host'
  deviceId?: string
  index?: number
}

interface AppState {
  currentMode: AppMode
  setMode: (mode: AppMode) => void
  trackingStatus: boolean
  setTrackingStatus: (status: boolean) => void
  activeCamera: number
  activeCameraId: string
  setActiveCamera: (index: number) => void
  setActiveCameraId: (id: string) => void
  hostCameras: CameraItem[]
  setHostCameras: (cams: CameraItem[]) => void
  deviceCameras: CameraItem[]
  setDeviceCameras: (cams: CameraItem[]) => void
  emitMessage: ((msg: any) => void) | null
  setEmitMessage: (fn: (msg: any) => void) => void
  emitBinary: ((data: ArrayBuffer | Blob) => void) | null
  setEmitBinary: (fn: (data: ArrayBuffer | Blob) => void) => void
  isPhoneStreaming: boolean
  setIsPhoneStreaming: (val: boolean) => void
  streamResolution: { width: number; height: number }
  setStreamResolution: (res: { width: number; height: number }) => void
  streamFps: number
  setStreamFps: (fps: number) => void
  streamMirror: boolean
  setStreamMirror: (val: boolean) => void
  streamFpsDisplay: number
  setStreamFpsDisplay: (val: number) => void
  streamError: string | null
  setStreamError: (err: string | null) => void
  isCalibrating: boolean
  setIsCalibrating: (val: boolean) => void
  calibrationStep: number // -1 = manual/inactive, 0 = ambient baseline, 1 = TL, 2 = TR, 3 = BR, 4 = BL, 5 = solving
  setCalibrationStep: (step: number) => void
  calibrationCorners: Point2D[]
  setCalibrationCorners: (corners: Point2D[]) => void
  uiVisible: boolean
  toggleUiVisible: () => void
  trackingMode: TrackingMode
  setTrackingMode: (mode: TrackingMode) => void
  trackerThresholds: TrackerThresholds
  setTrackerThresholds: (thresholds: TrackerThresholds) => void
  advancedOpen: boolean
  toggleAdvanced: () => void
  cameras: { index: number, name: string }[]
  setCameras: (cameras: { index: number, name: string }[]) => void
  
  // Silhouette FX State
  silhouetteEngine: SilhouetteEngine
  setSilhouetteEngine: (engine: SilhouetteEngine) => void
  silhouetteResolution: SilhouetteResolution
  setSilhouetteResolution: (res: SilhouetteResolution) => void
  silhouetteEffect: SilhouetteEffect
  setSilhouetteEffect: (effect: SilhouetteEffect) => void
  silhouetteColor: string
  setSilhouetteColor: (color: string) => void
  silhouetteRainbow: boolean
  setSilhouetteRainbow: (val: boolean) => void
  silhouetteTrailDecay: number
  setSilhouetteTrailDecay: (val: number) => void
}

const defaultCorners: Point2D[] = [
  { x: 0.1, y: 0.1 }, // Top Left
  { x: 0.9, y: 0.1 }, // Top Right
  { x: 0.9, y: 0.9 }, // Bottom Right
  { x: 0.1, y: 0.9 }, // Bottom Left
]

const loadCorners = (): Point2D[] => {
  const saved = localStorage.getItem('calibrationCorners')
  if (saved) {
    try { return JSON.parse(saved) } catch (e) {}
  }
  return defaultCorners
}

const loadActiveCameraId = (): string => {
  const saved = localStorage.getItem('activeCameraId')
  if (saved) return saved
  const savedIndex = localStorage.getItem('activeCamera')
  if (savedIndex !== null) {
    const idx = parseInt(savedIndex, 10)
    if (!isNaN(idx)) {
      return idx === -1 ? 'device:environment' : `host:${idx}`
    }
  }
  if (typeof window !== 'undefined' && (/android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 768)) {
    return 'device:environment'
  }
  return 'host:0'
}

const loadActiveCamera = (): number => {
  const savedId = localStorage.getItem('activeCameraId')
  if (savedId) {
    if (savedId.startsWith('device:')) return -1
    if (savedId.startsWith('host:')) {
      const idx = parseInt(savedId.replace('host:', ''), 10)
      if (!isNaN(idx)) return idx
    }
  }
  const saved = localStorage.getItem('activeCamera')
  if (saved !== null) {
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed)) return parsed
  }
  return 0
}

export const useStore = create<AppState>((set) => ({
  currentMode: 'Asteroids',
  setMode: (mode) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ 
        type: 'set_segmentation_config', 
        enabled: mode === 'SilhouetteFX',
        engine: state.silhouetteEngine,
        resolution: state.silhouetteResolution
      })
    }
    return { currentMode: mode }
  }),
  trackingStatus: false,
  setTrackingStatus: (status) => set({ trackingStatus: status }),
  activeCameraId: loadActiveCameraId(),
  activeCamera: loadActiveCamera(),
  hostCameras: [],
  deviceCameras: [
    {
      id: 'device:environment',
      name: '📷 Rear Camera (Environment)',
      type: 'device',
      deviceId: ''
    },
    {
      id: 'device:user',
      name: '📷 Front Camera (User)',
      type: 'device',
      deviceId: ''
    }
  ],
  setHostCameras: (cams) => set({ hostCameras: cams }),
  setDeviceCameras: (cams) => set({ deviceCameras: cams }),
  setActiveCameraId: (id) => {
    localStorage.setItem('activeCameraId', id)
    let index = 0
    if (id.startsWith('device:')) {
      index = -1
    } else if (id.startsWith('host:')) {
      index = parseInt(id.replace('host:', ''), 10)
      if (isNaN(index)) index = 0
    }
    localStorage.setItem('activeCamera', String(index))
    set((state) => {
      if (state.emitMessage) {
        state.emitMessage({ type: 'set_camera', index })
      }
      return { activeCameraId: id, activeCamera: index }
    })
  },
  setActiveCamera: (index) => {
    const id = index === -1 ? (localStorage.getItem('activeCameraId')?.startsWith('device:') ? localStorage.getItem('activeCameraId')! : 'device:environment') : `host:${index}`
    localStorage.setItem('activeCamera', String(index))
    localStorage.setItem('activeCameraId', id)
    set((state) => {
      if (state.emitMessage) {
        state.emitMessage({ type: 'set_camera', index })
      }
      return { activeCamera: index, activeCameraId: id }
    })
  },
  emitMessage: null,
  setEmitMessage: (fn) => set({ emitMessage: fn }),
  emitBinary: null,
  setEmitBinary: (fn) => set({ emitBinary: fn }),
  isPhoneStreaming: false,
  setIsPhoneStreaming: (val) => set({ isPhoneStreaming: val }),
  streamResolution: { width: 1280, height: 720 },
  setStreamResolution: (res) => set({ streamResolution: res }),
  streamFps: 30,
  setStreamFps: (fps) => set({ streamFps: fps }),
  streamMirror: false,
  setStreamMirror: (val) => set({ streamMirror: val }),
  streamFpsDisplay: 0,
  setStreamFpsDisplay: (val) => set({ streamFpsDisplay: val }),
  streamError: null,
  setStreamError: (err) => set({ streamError: err }),
  isCalibrating: false,
  setIsCalibrating: (val) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ type: 'set_calibrating', value: val })
    }
    return { isCalibrating: val, calibrationStep: val ? state.calibrationStep : -1 }
  }),
  calibrationStep: -1,
  setCalibrationStep: (step) => set({ calibrationStep: step }),
  calibrationCorners: loadCorners(),
  setCalibrationCorners: (corners) => {
    localStorage.setItem('calibrationCorners', JSON.stringify(corners))
    set({ calibrationCorners: corners })
  },
  uiVisible: true,
  toggleUiVisible: () => set((state) => ({ uiVisible: !state.uiVisible })),
  trackingMode: 'pose',
  setTrackingMode: (mode) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ type: 'set_tracking_mode', mode })
    }
    return { trackingMode: mode }
  }),
  trackerThresholds: { detection: 0.3, presence: 0.3, tracking: 0.3 },
  setTrackerThresholds: (thresholds) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ type: 'set_thresholds', ...thresholds })
    }
    return { trackerThresholds: thresholds }
  }),
  advancedOpen: false,
  toggleAdvanced: () => set((state) => ({ advancedOpen: !state.advancedOpen })),
  cameras: [
    { index: -1, name: '📱 Phone / Browser Camera (Live Stream)' },
    ...Array.from({ length: 10 }).map((_, i) => ({ index: i, name: `Camera ${i}` }))
  ],
  setCameras: (cameras) => set({ cameras }),

  // Silhouette FX State Implementation
  silhouetteEngine: 'human',
  setSilhouetteEngine: (engine) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ type: 'set_segmentation_config', engine })
    }
    return { silhouetteEngine: engine }
  }),
  silhouetteResolution: 'performance',
  setSilhouetteResolution: (res) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ type: 'set_segmentation_config', resolution: res })
    }
    return { silhouetteResolution: res }
  }),
  silhouetteEffect: 'combined',
  setSilhouetteEffect: (effect) => set({ silhouetteEffect: effect }),
  silhouetteColor: '#00f5ff',
  setSilhouetteColor: (color) => set({ silhouetteColor: color, silhouetteRainbow: false }),
  silhouetteRainbow: false,
  setSilhouetteRainbow: (val) => set({ silhouetteRainbow: val }),
  silhouetteTrailDecay: 0.94,
  setSilhouetteTrailDecay: (val) => set({ silhouetteTrailDecay: val }),
}))

const bc = new BroadcastChannel('app-sync')
let isReceiving = false

bc.onmessage = (e) => {
  if (e.data.type === 'SYNC_STATE') {
    isReceiving = true
    if (e.data.state) {
      if (e.data.state.activeCamera !== undefined) {
        localStorage.setItem('activeCamera', String(e.data.state.activeCamera))
      }
      if (e.data.state.activeCameraId !== undefined) {
        localStorage.setItem('activeCameraId', String(e.data.state.activeCameraId))
      }
    }
    useStore.setState(e.data.state)
    isReceiving = false
  }
}

useStore.subscribe((state) => {
  if (!isReceiving) {
    const syncableState = {
      currentMode: state.currentMode,
      isCalibrating: state.isCalibrating,
      calibrationStep: state.calibrationStep,
      calibrationCorners: state.calibrationCorners,
      activeCamera: state.activeCamera,
      activeCameraId: state.activeCameraId,
      uiVisible: state.uiVisible,
      trackingMode: state.trackingMode,
      silhouetteEngine: state.silhouetteEngine,
      silhouetteResolution: state.silhouetteResolution,
      silhouetteEffect: state.silhouetteEffect,
      silhouetteColor: state.silhouetteColor,
      silhouetteRainbow: state.silhouetteRainbow,
      silhouetteTrailDecay: state.silhouetteTrailDecay
    }
    bc.postMessage({ type: 'SYNC_STATE', state: syncableState })
  }
})
