import { useEffect } from 'react'
import { useStore } from '../store/useStore'

// @ts-ignore
import '../utils/perspective-transform'
const PerspT = (window as any).PerspT

export interface Point3D {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface TrackingData {
  is_tracking: boolean
  center_of_mass: Point3D | null
  left_hand: Point3D | null
  right_hand: Point3D | null
  left_foot: Point3D | null
  right_foot: Point3D | null
  frame?: string
  auto_calibrate_result?: { x: number, y: number }[]
}

const defaultData: TrackingData = {
  is_tracking: false,
  center_of_mass: null,
  left_hand: null,
  right_hand: null,
  left_foot: null,
  right_foot: null,
}

const globalTrackingDataRef = { current: { ...defaultData } }
let wsConnected = false

export function useTracker() {
  const setTrackingStatus = useStore((state) => state.setTrackingStatus)
  const activeCamera = useStore((state) => state.activeCamera)

  useEffect(() => {
    if (wsConnected) return
    wsConnected = true

    let ws: WebSocket | null = null
    let reconnectTimeout: number

    const setEmitMessage = useStore.getState().setEmitMessage

    const connect = () => {
      ws = new WebSocket('ws://' + window.location.hostname + ':8765')

      ws.onopen = () => {
        console.log('Connected to tracking server')
        setEmitMessage((msg: any) => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg))
          }
        })
      }

      ws.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data)
          if (rawData.type === 'camera_list') {
            useStore.getState().setCameras(rawData.cameras)
            return
          }
          const state = useStore.getState()
          
          // Clone the data so we can mutate the coordinates
          const data = { ...rawData }

          // Apply homography matrix unless we are in calibration mode
          if (!state.isCalibrating && data.is_tracking) {
            const corners = state.calibrationCorners
            const srcPts = [
              corners[0].x, corners[0].y,
              corners[1].x, corners[1].y,
              corners[2].x, corners[2].y,
              corners[3].x, corners[3].y,
            ]
            // We map the raw source corners to a perfect square [0,1]
            const dstPts = [0, 0, 1, 0, 1, 1, 0, 1]
            const transform = PerspT(srcPts, dstPts)

            const mapPoint = (pt: Point3D | null) => {
              if (!pt) return null
              const [newX, newY] = transform.transform(pt.x, pt.y)
              // Zone clipping: discard landmarks outside the calibrated area
              if (newX < 0 || newX > 1 || newY < 0 || newY > 1) return null
              return { ...pt, x: newX, y: newY }
            }

            data.center_of_mass = mapPoint(data.center_of_mass)
            data.left_hand = mapPoint(data.left_hand)
            data.right_hand = mapPoint(data.right_hand)
            data.left_foot = mapPoint(data.left_foot)
            data.right_foot = mapPoint(data.right_foot)
            
            // If all limbs clipped, mark as not tracking
            if (!data.center_of_mass && !data.left_hand && !data.right_hand && !data.left_foot && !data.right_foot) {
              data.is_tracking = false
            }
          }

          // Handle auto-calibration result from backend
          if (data.auto_calibrate_result) {
            const corners = data.auto_calibrate_result
            if (corners.length === 4) {
              useStore.getState().setCalibrationCorners(corners)
              console.log('Auto-calibration applied:', corners)
            }
          }

          globalTrackingDataRef.current = data
          
          // Update zustand store for UI indicator if tracking status changes
          // Use store.getState() to avoid unnecessary hook dependency
          if (state.trackingStatus !== data.is_tracking) {
             setTrackingStatus(data.is_tracking)
          }
        } catch (error) {
          console.error('Error parsing tracking data:', error)
        }
      }

      ws.onclose = () => {
        console.log('Disconnected from tracking server, reconnecting...')
        setTrackingStatus(false)
        reconnectTimeout = window.setTimeout(connect, 1000)
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        ws?.close()
      }
    }

    connect()

    return () => {
      wsConnected = false
      clearTimeout(reconnectTimeout)
      if (ws) {
        ws.close()
      }
    }
  }, [setTrackingStatus])

  useEffect(() => {
    const emit = useStore.getState().emitMessage
    if (emit) {
      emit({ type: 'set_camera', index: activeCamera })
    }
  }, [activeCamera])

  return globalTrackingDataRef
}
