import { create } from 'zustand'

export type AppMode = 'Asteroids' | 'FluidSimulation' | 'KoiPond' | 'MotionReveal' | 'ScatterLeaves' | 'Sparkles' | 'ParticleTrail' | 'SandyShore' | 'SilhouetteFX'

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

interface AppState {
  currentMode: AppMode
  setMode: (mode: AppMode) => void
  trackingStatus: boolean
  setTrackingStatus: (status: boolean) => void
  activeCamera: number
  setActiveCamera: (index: number) => void
  emitMessage: ((msg: any) => void) | null
  setEmitMessage: (fn: (msg: any) => void) => void
  isCalibrating: boolean
  setIsCalibrating: (val: boolean) => void
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
  activeCamera: 0,
  setActiveCamera: (index) => set({ activeCamera: index }),
  emitMessage: null,
  setEmitMessage: (fn) => set({ emitMessage: fn }),
  isCalibrating: false,
  setIsCalibrating: (val) => set((state) => {
    if (state.emitMessage) {
      state.emitMessage({ type: 'set_calibrating', value: val })
    }
    return { isCalibrating: val }
  }),
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
  cameras: Array.from({ length: 10 }).map((_, i) => ({ index: i, name: `Camera ${i}` })),
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
    useStore.setState(e.data.state)
    isReceiving = false
  }
}

useStore.subscribe((state) => {
  if (!isReceiving) {
    const syncableState = {
      currentMode: state.currentMode,
      isCalibrating: state.isCalibrating,
      calibrationCorners: state.calibrationCorners,
      activeCamera: state.activeCamera,
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
