import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

export function MotionReveal() {
  const trackingDataRef = useTracker()
  const forestFloorTexture = useTexture('/textures/forest_floor.png')

  // Create an offscreen canvas to act as the reveal mask
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 512
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, c.width, c.height)
    }
    return c
  }, [])

  const maskTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [canvas])

  // Clean up texture on unmount
  useEffect(() => {
    return () => {
      maskTexture.dispose()
    }
  }, [maskTexture])

  useFrame((_, delta) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 1. Draw a semi-transparent black overlay to slowly fade old revealed trails
    // Fade rate of 0.3 means trails fade out completely in ~3-4 seconds
    ctx.fillStyle = `rgba(0, 0, 0, ${delta * 0.3})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const data = trackingDataRef.current
    if (data.is_tracking) {
      // 2. Draw soft white circles at active tracker positions (hands & feet)
      const activePoints = [
        data.left_hand,
        data.right_hand,
        data.left_foot,
        data.right_foot,
      ]

      activePoints.forEach((pt) => {
        if (!pt) return

        const cx = pt.x * canvas.width
        const cy = pt.y * canvas.height
        const radius = 80 // Soft brush size

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // 3. Signal to WebGL that the canvas has been updated
    maskTexture.needsUpdate = true
  })

  return (
    <group>
      {/* Black Background Plane */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#02040a" />
      </mesh>

      {/* Forest Floor Plane mapped via alpha mask */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial 
          map={forestFloorTexture} 
          alphaMap={maskTexture} 
          transparent={true} 
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
