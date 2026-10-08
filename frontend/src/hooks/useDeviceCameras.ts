import { useEffect, useCallback, useState } from 'react'
import { useStore, type CameraItem } from '../store/useStore'

export function useDeviceCameras() {
  const setDeviceCameras = useStore((state) => state.setDeviceCameras)
  const [hasPermission, setHasPermission] = useState<boolean>(false)
  const [isDetecting, setIsDetecting] = useState<boolean>(false)

  const formatCameraName = (device: MediaDeviceInfo, index: number): string => {
    const rawLabel = (device.label || '').trim()
    if (!rawLabel) {
      if (index === 0) return '📷 Rear Camera (Environment)'
      if (index === 1) return '📷 Front Camera (User)'
      return `📷 Camera Lens ${index + 1}`
    }

    const lower = rawLabel.toLowerCase()
    if (lower.includes('back') || lower.includes('rear') || lower.includes('environment')) {
      return `📷 Rear Camera (${rawLabel})`
    }
    if (lower.includes('front') || lower.includes('user') || lower.includes('selfie')) {
      return `📷 Front Camera (${rawLabel})`
    }
    return `📷 ${rawLabel}`
  }

  const detectCameras = useCallback(async (requestPermission = false) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return []
    }

    setIsDetecting(true)

    try {
      if (requestPermission && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          stream.getTracks().forEach((track) => track.stop())
          setHasPermission(true)
        } catch (permErr) {
          console.warn('Camera permission not granted during detection:', permErr)
        }
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')

      const items: CameraItem[] = videoDevices.map((d, index) => ({
        id: `device:${d.deviceId || `device-${index}`}`,
        name: formatCameraName(d, index),
        type: 'device',
        deviceId: d.deviceId
      }))

      // If no video devices were found via enumerateDevices, provide default Rear / Front options
      if (items.length === 0) {
        items.push(
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
        )
      }

      setDeviceCameras(items)
      return items
    } catch (err) {
      console.error('Failed to detect device cameras:', err)
      return []
    } finally {
      setIsDetecting(false)
    }
  }, [setDeviceCameras])

  useEffect(() => {
    detectCameras(false)

    const onDeviceChange = () => {
      detectCameras(false)
    }

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
    }
  }, [detectCameras])

  return {
    detectCameras,
    hasPermission,
    isDetecting
  }
}
