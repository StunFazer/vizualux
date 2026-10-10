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



export function Scatter() {
  const trackingDataRef = useTracker()
  const preset = useStore((s) => s.scatterPreset)
  const customImgUrl = useStore((s) => s.scatterCustomImage)

  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Pre-load transparent PNG textures for presets
  const leafTexture = useTexture('/textures/maple_leaf.png')
  const snowflakeTexture = useTexture('/textures/snowflake.png')
  const petalTexture = useTexture('/textures/sakura_petal.png')
  const coinTexture = useTexture('/textures/gold_coin.png')

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
    const repulsionRadius = preset === 'snowflakes' ? 2.4 : preset === 'petals' ? 2.2 : preset === 'coins' ? 1.6 : 2.0
    const baseKick = preset === 'coins' ? 12 : preset === 'snowflakes' ? 8 : preset === 'petals' ? 9 : 10
    const drag = preset === 'coins' ? 0.90 : preset === 'snowflakes' ? 0.96 : 0.94
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

      // Fluid interaction from tracked limbs: proximity-based repulsion, speed boost, and swirl
      activePoints.forEach(({ pt, speed }) => {
        const dist = item.pos.distanceTo(pt)
        if (dist < repulsionRadius && dist > 0.001) {
          const forceDir = item.pos.clone().sub(pt).normalize()
          const proximity = Math.pow(1.0 - dist / repulsionRadius, 1.3)

          // Dynamic impulse: combines proximity push with limb momentum
          const dynamicForce = (1.8 + Math.min(speed, 5.0) * 1.5) * baseKick
          item.vel.addScaledVector(forceDir, dynamicForce * proximity * dt)

          // Tangential vortex / swirl for realistic disturbance
          const tangent = new THREE.Vector3(-forceDir.y, forceDir.x, 0)
          item.vel.addScaledVector(tangent, Math.sin(i * 1.7) * 2.5 * proximity * dt)

          // Angular spin
          item.rotVel += (randomRange(-6, 6) + speed * 2.0) * proximity * dt * 10
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
