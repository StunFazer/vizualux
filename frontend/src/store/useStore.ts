import { create } from 'zustand'

export type AppMode = 'Asteroids' | 'FluidSimulation' | 'KoiPond' | 'MotionReveal' | 'ScatterLeaves' | 'Sparkles' | 'ParticleTrail' | 'SandyShore'

export interface Point2D {
  x: number
  y: number
}

export type TrackingMode = 'pose' | 'motion'

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
  setMode: (mode) => set({ currentMode: mode }),
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
      trackingMode: state.trackingMode
    }
    bc.postMessage({ type: 'SYNC_STATE', state: syncableState })
  }
})
