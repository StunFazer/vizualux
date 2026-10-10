import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'
import { useStore } from '../../store/useStore'

// Procedural texture generators for presets
function createNebulaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Deep indigo/void space
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 512)
  bgGrad.addColorStop(0, '#05021a')
  bgGrad.addColorStop(0.5, '#0d0826')
  bgGrad.addColorStop(1, '#020014')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 1024, 512)

  // Glowing nebula dust clouds
  const clouds = [
    { x: 300, y: 200, r: 280, color: 'rgba(147, 51, 234, 0.45)' }, // violet
    { x: 700, y: 320, r: 320, color: 'rgba(6, 182, 212, 0.45)' },  // cyan
    { x: 500, y: 150, r: 240, color: 'rgba(236, 72, 153, 0.35)' }, // pink
    { x: 200, y: 380, r: 200, color: 'rgba(59, 130, 246, 0.4)' },  // blue
    { x: 820, y: 180, r: 220, color: 'rgba(168, 85, 247, 0.4)' },  // purple
  ]

  clouds.forEach((c) => {
    const rad = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.r)
    rad.addColorStop(0, c.color)
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
    ctx.fill()
  })

  // Twinkling star field
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 1024
    const y = Math.random() * 512
    const sz = Math.random() * 2.0 + 0.5
    const alpha = Math.random() * 0.8 + 0.2
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, sz, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createLavaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Deep volcanic rock background
  ctx.fillStyle = '#140804'
  ctx.fillRect(0, 0, 1024, 512)

  // Molten magma pools
  const magmaPools = [
    { x: 250, y: 180, r: 180, color: '#f97316' },
    { x: 750, y: 350, r: 220, color: '#ef4444' },
    { x: 500, y: 260, r: 150, color: '#eab308' },
  ]
  magmaPools.forEach((p) => {
    const g = ctx.createRadialGradient(p.x, p.y, 20, p.x, p.y, p.r)
    g.addColorStop(0, '#fef08a')
    g.addColorStop(0.3, p.color)
    g.addColorStop(0.7, '#7f1d1d')
    g.addColorStop(1, 'rgba(20, 8, 4, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  })

  // Fiery glowing fissure lines
  ctx.strokeStyle = '#ffedd5'
  ctx.lineWidth = 5
  ctx.shadowColor = '#f97316'
  ctx.shadowBlur = 15
  for (let j = 0; j < 14; j++) {
    ctx.beginPath()
    let cx = Math.random() * 1024
    let cy = Math.random() * 512
    ctx.moveTo(cx, cy)
    for (let k = 0; k < 6; k++) {
      cx += (Math.random() - 0.5) * 140
      cy += (Math.random() - 0.5) * 80
      ctx.lineTo(cx, cy)
    }
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function MotionReveal() {
  const trackingDataRef = useTracker()
  const forestFloorTexture = useTexture('/textures/forest_floor.png')

  const preset = useStore((s) => s.motionRevealPreset)
  const customImgUrl = useStore((s) => s.motionRevealCustomImage)
  const brushRadius = useStore((s) => s.motionRevealBrushRadius)
  const fadeSpeed = useStore((s) => s.motionRevealFadeSpeed)

  // Procedural preset textures
  const nebulaTexture = useMemo(() => createNebulaTexture(), [])
  const lavaTexture = useMemo(() => createLavaTexture(), [])

  // Custom user texture
  const customTextureRef = useRef<THREE.Texture | null>(null)
  useEffect(() => {
    if (customImgUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const tex = new THREE.Texture(img)
        tex.needsUpdate = true
        tex.colorSpace = THREE.SRGBColorSpace
        customTextureRef.current = tex
      }
      img.src = customImgUrl
    } else {
      customTextureRef.current = null
    }
  }, [customImgUrl])

  // Select reveal underlying texture
  const activeTexture = useMemo(() => {
    if (preset === 'custom' && customTextureRef.current) return customTextureRef.current
    if (preset === 'nebula') return nebulaTexture
    if (preset === 'lava') return lavaTexture
    return forestFloorTexture
  }, [preset, forestFloorTexture, nebulaTexture, lavaTexture, customImgUrl])

  // Reveal Alpha Canvas
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

  // Store previous pixel positions for continuous smooth stroke interpolation
  const prevPixels = useRef<{ [key: string]: { x: number; y: number } | null }>({
    lh: null, rh: null, lf: null, rf: null
  })

  useEffect(() => {
    return () => {
      maskTexture.dispose()
    }
  }, [maskTexture])

  useFrame((_, delta) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 1. Fade old revealed trails with black overlay
    const fadeAlpha = Math.min(1.0, delta * fadeSpeed)
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const data = trackingDataRef.current
    if (data.is_tracking) {
      const points = [
        { key: 'lf', pt: data.left_foot },
        { key: 'rf', pt: data.right_foot },
        { key: 'lh', pt: data.left_hand },
        { key: 'rh', pt: data.right_hand },
      ]

      points.forEach(({ key, pt }) => {
        if (!pt) {
          prevPixels.current[key] = null
          return
        }

        const currX = pt.x * canvas.width
        const currY = pt.y * canvas.height
        const prev = prevPixels.current[key]

        // Stroke line between previous and current to prevent dotted gaps during fast motion
        if (prev) {
          ctx.strokeStyle = 'white'
          ctx.lineWidth = brushRadius * 1.5
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(prev.x, prev.y)
          ctx.lineTo(currX, currY)
          ctx.stroke()
        }

        // Soft radial brush at current location
        const grad = ctx.createRadialGradient(currX, currY, 0, currX, currY, brushRadius)
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
        grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.7)')
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(currX, currY, brushRadius, 0, Math.PI * 2)
        ctx.fill()

        prevPixels.current[key] = { x: currX, y: currY }
      })
    }

    maskTexture.needsUpdate = true
  })

  return (
    <group>
      {/* Void Background Plane */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#020308" />
      </mesh>

      {/* Revealed Hidden Canvas / Image Plane */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial 
          map={activeTexture} 
          alphaMap={maskTexture} 
          transparent={true} 
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
