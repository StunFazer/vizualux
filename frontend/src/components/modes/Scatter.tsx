import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'
import { useStore } from '../../store/useStore'

const MAX_ITEMS = 120
const BOUNDS_X = 11
const BOUNDS_Y = 5.5

interface ScatterItem {
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: number
  rotVel: number
  scale: number
  baseColor: THREE.Color
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

// Generate procedural textures for presets
function createProceduralTexture(type: 'snowflakes' | 'petals' | 'coins'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)

  if (type === 'snowflakes') {
    // 6-pointed detailed snowflake
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.shadowColor = '#80d8ff'
    ctx.shadowBlur = 10

    ctx.save()
    ctx.translate(64, 64)
    for (let arm = 0; arm < 6; arm++) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -48)
      // branches
      ctx.moveTo(0, -20)
      ctx.lineTo(-14, -30)
      ctx.moveTo(0, -20)
      ctx.lineTo(14, -30)
      ctx.moveTo(0, -35)
      ctx.lineTo(-10, -42)
      ctx.moveTo(0, -35)
      ctx.lineTo(10, -42)
      ctx.stroke()
      ctx.rotate(Math.PI / 3)
    }
    ctx.restore()
  } else if (type === 'petals') {
    // Sakura cherry blossom petal
    ctx.fillStyle = '#ffb7c5'
    ctx.shadowColor = '#ff69b4'
    ctx.shadowBlur = 8

    ctx.beginPath()
    ctx.moveTo(64, 20)
    ctx.bezierCurveTo(90, 20, 105, 55, 95, 85)
    ctx.bezierCurveTo(85, 110, 64, 115, 64, 115)
    ctx.bezierCurveTo(64, 115, 43, 110, 33, 85)
    ctx.bezierCurveTo(23, 55, 38, 20, 64, 20)
    ctx.fill()

    // Petal notch
    ctx.fillStyle = '#ff8da1'
    ctx.beginPath()
    ctx.arc(64, 30, 8, 0, Math.PI * 2)
    ctx.fill()
  } else if (type === 'coins') {
    // Gold arcade coin
    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    ctx.arc(64, 64, 52, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    ctx.arc(64, 64, 40, 0, Math.PI * 2)
    ctx.fill()

    // Inner embossed star
    ctx.fillStyle = '#d97706'
    ctx.font = 'bold 38px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('★', 64, 66)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function Scatter() {
  const trackingDataRef = useTracker()
  const leafTexture = useTexture('/textures/maple_leaf.png')

  const preset = useStore((s) => s.scatterPreset)
  const customImgUrl = useStore((s) => s.scatterCustomImage)

  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Procedural preset textures
  const snowflakeTexture = useMemo(() => createProceduralTexture('snowflakes'), [])
  const petalTexture = useMemo(() => createProceduralTexture('petals'), [])
  const coinTexture = useMemo(() => createProceduralTexture('coins'), [])

  // Custom texture loader if uploaded
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

  // Select active texture based on current preset
  const activeTexture = useMemo(() => {
    if (preset === 'custom' && customTextureRef.current) return customTextureRef.current
    if (preset === 'snowflakes') return snowflakeTexture
    if (preset === 'petals') return petalTexture
    if (preset === 'coins') return coinTexture
    return leafTexture
  }, [preset, leafTexture, snowflakeTexture, petalTexture, coinTexture, customImgUrl])

  // Initialize scatter items
  const items = useMemo<ScatterItem[]>(() => {
    return Array.from({ length: MAX_ITEMS }, () => ({
      pos: new THREE.Vector3(randomRange(-BOUNDS_X, BOUNDS_X), randomRange(-BOUNDS_Y, BOUNDS_Y), 0),
      vel: new THREE.Vector3(0, 0, 0),
      rot: randomRange(0, Math.PI * 2),
      rotVel: 0,
      scale: randomRange(0.65, 1.15),
      baseColor: new THREE.Color('#ffffff')
    }))
  }, [])

  // Smooth tracking positions
  const smoothedPoints = useRef<{ [key: string]: THREE.Vector3 }>({
    lh: new THREE.Vector3(),
    rh: new THREE.Vector3(),
    lf: new THREE.Vector3(),
    rf: new THREE.Vector3(),
  })

  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const dt = Math.min(delta, 0.1)
    const now = state.clock.elapsedTime

    const activePoints: { pt: THREE.Vector3; speed: number }[] = []
    if (data.is_tracking) {
      const targets = [
        { key: 'lf', pt: toWorld(data.left_foot) },
        { key: 'rf', pt: toWorld(data.right_foot) },
        { key: 'lh', pt: toWorld(data.left_hand) },
        { key: 'rh', pt: toWorld(data.right_hand) },
      ]
      targets.forEach(({ key, pt }) => {
        if (pt) {
          const smoothLerp = 1.0 - Math.exp(-22.0 * dt)
          const prev = smoothedPoints.current[key].clone()
          smoothedPoints.current[key].lerp(pt, smoothLerp)
          const curr = smoothedPoints.current[key]
          const distMoved = curr.distanceTo(prev)
          const speed = distMoved / Math.max(dt, 0.001)
          activePoints.push({ pt: curr, speed })
        }
      })
    }

    // Tuning parameters per preset
    const repulsionRadius = preset === 'snowflakes' ? 2.0 : preset === 'coins' ? 1.4 : 1.8
    const baseKick = preset === 'coins' ? 10 : preset === 'snowflakes' ? 5 : 8
    const drag = preset === 'coins' ? 0.90 : preset === 'snowflakes' ? 0.96 : 0.93
    const gravityY = preset === 'snowflakes' ? -0.35 : preset === 'petals' ? -0.18 : 0.0

    const mesh = instancedMeshRef.current
    if (!mesh) return

    for (let i = 0; i < MAX_ITEMS; i++) {
      const item = items[i]

      // Ambient drift per preset
      if (preset === 'snowflakes') {
        item.vel.y += gravityY * dt
        item.vel.x += Math.sin(now * 1.5 + i) * 0.35 * dt
      } else if (preset === 'petals') {
        item.vel.y += gravityY * dt
        item.vel.x += Math.cos(now * 1.2 + i * 2) * 0.25 * dt
      }

      // Interaction from tracked limbs: velocity-dependent kick + soft static parting
      activePoints.forEach(({ pt, speed }) => {
        const dist = item.pos.distanceTo(pt)
        if (dist < repulsionRadius && dist > 0.001) {
          const forceDir = item.pos.clone().sub(pt).normalize()
          const proximity = (1.0 - dist / repulsionRadius)

          if (speed > 1.2) {
            // Intentional kick
            const kickImpulse = proximity * Math.min(speed * 0.6, 6.0) * baseKick
            item.vel.addScaledVector(forceDir, kickImpulse * dt)
            item.rotVel += randomRange(-4, 4) * proximity
          } else {
            // Gentle static separation (soft nudge so items don't overlap feet)
            item.pos.addScaledVector(forceDir, proximity * 0.4 * dt)
          }
        }
      })

      // Drag & velocity update
      item.vel.multiplyScalar(drag)
      item.rotVel *= 0.92
      item.pos.addScaledVector(item.vel, dt)
      item.rot += item.rotVel * dt

      // Boundary bounce & wrapping
      if (item.pos.x > BOUNDS_X) {
        item.pos.x = BOUNDS_X
        item.vel.x *= -0.6
      } else if (item.pos.x < -BOUNDS_X) {
        item.pos.x = -BOUNDS_X
        item.vel.x *= -0.6
      }

      if (item.pos.y > BOUNDS_Y) {
        if (preset === 'snowflakes' || preset === 'petals') {
          item.pos.y = -BOUNDS_Y // wrap top
        } else {
          item.pos.y = BOUNDS_Y
          item.vel.y *= -0.6
        }
      } else if (item.pos.y < -BOUNDS_Y) {
        if (preset === 'snowflakes' || preset === 'petals') {
          item.pos.y = BOUNDS_Y // wrap bottom to top
          item.pos.x = randomRange(-BOUNDS_X, BOUNDS_X)
          item.vel.set(0, 0, 0)
        } else {
          item.pos.y = -BOUNDS_Y
          item.vel.y *= -0.6
        }
      }

      // Matrix update for instanced quad
      dummy.position.copy(item.pos)
      dummy.rotation.set(0, 0, item.rot)
      dummy.scale.set(item.scale, item.scale, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* Background Ambience */}
      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[26, 16]} />
        <meshBasicMaterial color="#030408" />
      </mesh>

      {/* Instanced Quads for Scatter Elements */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, MAX_ITEMS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={activeTexture}
          transparent={true}
          alphaTest={0.05}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}
