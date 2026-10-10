import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'
import { useStore } from '../../store/useStore'

const MAX_PARTICLES = 600

interface UnifiedParticle {
  active: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  color: THREE.Color
  baseScale: number
  opacity: number
  life: number
  maxLife: number
  isSparkle: boolean
  twinkleFreq: number
  twinklePhase: number
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

export function ParticleTrail() {
  const trackingDataRef = useTracker()
  const sparkleTexture = useTexture('/textures/sparkle.png')

  const trailStyle = useStore((s) => s.particleTrailStyle)
  const userScale = useStore((s) => s.particleTrailSize)
  const enableTwinkle = useStore((s) => s.particleTrailTwinkle)

  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  // Pre-allocate fixed pool of particles for zero GC overhead
  const particles = useMemo<UnifiedParticle[]>(() => {
    return Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      pos: new THREE.Vector3(0, 0, -100),
      vel: new THREE.Vector3(),
      color: new THREE.Color('#ffffff'),
      baseScale: 0.5,
      opacity: 0,
      life: 0,
      maxLife: 1.0,
      isSparkle: false,
      twinkleFreq: 15,
      twinklePhase: 0
    }))
  }, [])

  // Smooth position tracking
  const smoothedPoints = useRef<{ [key: string]: THREE.Vector3 }>({
    lh: new THREE.Vector3(),
    rh: new THREE.Vector3(),
    lf: new THREE.Vector3(),
    rf: new THREE.Vector3(),
  })

  const prevPoints = useRef<{ [key: string]: THREE.Vector3 | null }>({
    lh: null, rh: null, lf: null, rf: null
  })

  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  // Helper to spawn a particle from pool
  const spawnParticle = (
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.Color,
    scale: number,
    maxLife: number,
    isSparkle: boolean
  ) => {
    // Find inactive particle
    let p = particles.find((pt) => !pt.active)
    if (!p) {
      // Reuse oldest
      p = particles[0]
      let minLife = p.life
      for (let i = 1; i < particles.length; i++) {
        if (particles[i].life < minLife) {
          minLife = particles[i].life
          p = particles[i]
        }
      }
    }

    p.active = true
    p.pos.copy(pos)
    p.vel.copy(vel)
    p.color.copy(color)
    p.baseScale = scale
    p.life = maxLife
    p.maxLife = maxLife
    p.opacity = 1.0
    p.isSparkle = isSparkle
    p.twinkleFreq = randomRange(12, 28)
    p.twinklePhase = randomRange(0, Math.PI * 2)
  }

  // Smoothed speeds and burst cooldowns per limb
  const smoothedSpeeds = useRef<{ [key: string]: number }>({
    lh: 0, rh: 0, lf: 0, rf: 0
  })
  const lastBurstTimes = useRef<{ [key: string]: number }>({
    lh: 0, rh: 0, lf: 0, rf: 0
  })

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const now = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05) // clamp delta against hitching

    const targets = [
      { key: 'lf', pt: toWorld(data.left_foot) },
      { key: 'rf', pt: toWorld(data.right_foot) },
      { key: 'lh', pt: toWorld(data.left_hand) },
      { key: 'rh', pt: toWorld(data.right_hand) },
    ]

    // 1. Process tracking inputs & spawn both trails and sparkle bursts
    targets.forEach(({ key, pt }) => {
      if (!pt) {
        prevPoints.current[key] = null
        smoothedSpeeds.current[key] = 0
        return
      }

      // Smooth point using exponential lerp
      const smoothLerp = 1.0 - Math.exp(-20.0 * dt)
      smoothedPoints.current[key].lerp(pt, smoothLerp)
      const currentPt = smoothedPoints.current[key]

      const prev = prevPoints.current[key]
      let dist = 0
      let rawSpeed = 0
      if (prev) {
        dist = currentPt.distanceTo(prev)
        rawSpeed = dist / Math.max(dt, 0.001)
      }
      prevPoints.current[key] = currentPt.clone()

      // Low-pass filter on speed to eliminate micro-jitter spikes
      const speedFilter = 1.0 - Math.exp(-12.0 * dt)
      smoothedSpeeds.current[key] += (rawSpeed - smoothedSpeeds.current[key]) * speedFilter
      const speed = smoothedSpeeds.current[key]

      // Noise deadzone: ignore micro-tremor under 0.035 units
      if (dist < 0.035 && speed < 0.6) {
        return
      }

      // Determine palette color based on current style
      const getColor = (offset: number) => {
        const c = new THREE.Color()
        if (trailStyle === 'fireflies') {
          c.setHSL(0.14 + randomRange(-0.03, 0.03), 1.0, 0.65)
        } else if (trailStyle === 'plasma') {
          c.setHSL(Math.random() < 0.5 ? 0.52 : 0.78, 1.0, 0.7)
        } else if (trailStyle === 'embers') {
          c.setHSL(randomRange(0.02, 0.08), 1.0, 0.6)
        } else if (trailStyle === 'aurora') {
          c.setHSL(randomRange(0.38, 0.62), 0.9, 0.65)
        } else if (trailStyle === 'stardust') {
          const isSilver = Math.random() < 0.6
          c.setHSL(isSilver ? 0.6 : 0.55, isSilver ? 0.3 : 0.8, 0.85)
        } else {
          // Rainbow
          const hue = (now * 0.18 + offset) % 1.0
          c.setHSL(hue, 1.0, 0.6)
        }
        return c
      }

      // Spawn continuous trail ribbon particles only when in active movement
      const spawnCount = speed > 1.0 ? 2 : 1
      for (let i = 0; i < spawnCount; i++) {
        const offset = new THREE.Vector3(
          randomRange(-0.08, 0.08),
          randomRange(-0.08, 0.08),
          0
        )
        const vel = new THREE.Vector3(
          randomRange(-0.3, 0.3),
          randomRange(-0.3, 0.3),
          0
        )
        const col = getColor(i * 0.05)
        const life = trailStyle === 'fireflies' ? 1.6 : 1.1
        spawnParticle(
          currentPt.clone().add(offset),
          vel,
          col,
          randomRange(0.35, 0.5) * userScale,
          life,
          false
        )
      }

      // Trigger sparkle bursts ONLY on intentional deliberate gestures (speed > 4.0) with cooldown
      if (enableTwinkle && speed > 4.0 && (now - lastBurstTimes.current[key]) > 0.22) {
        lastBurstTimes.current[key] = now
        const burstCount = Math.min(4, Math.max(2, Math.floor(speed * 0.7)))
        for (let b = 0; b < burstCount; b++) {
          const sparkVel = new THREE.Vector3(
            randomRange(-0.8, 0.8),
            randomRange(0.4, 1.2), // gentle float upward
            0
          )
          const sparkCol = Math.random() < 0.5
            ? new THREE.Color('#ffffff') // bright twinkle star
            : getColor(b * 0.1)

          spawnParticle(
            currentPt.clone().add(new THREE.Vector3(randomRange(-0.15, 0.15), randomRange(-0.15, 0.15), 0)),
            sparkVel,
            sparkCol,
            randomRange(0.4, 0.65) * userScale,
            randomRange(0.7, 1.2),
            true
          )
        }
      }
    })

    // 2. Physics & Particle Simulation Update
    const mesh = instancedMeshRef.current
    if (!mesh) return

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i]
      if (!p.active) {
        dummy.position.set(0, 0, -100)
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        continue
      }

      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        dummy.position.set(0, 0, -100)
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        continue
      }

      // Physics: turbulence and upward float for sparkles
      if (p.isSparkle) {
        p.vel.y += 0.3 * dt // gentle buoyancy
        p.vel.multiplyScalar(0.95)
      } else {
        const wave = Math.sin(now * 4.0 + i) * 0.4
        p.vel.x += wave * dt
        p.vel.multiplyScalar(0.94)
      }

      p.pos.addScaledVector(p.vel, dt)

      const lifeRatio = p.life / p.maxLife
      p.opacity = lifeRatio

      // Twinkle calculation: pulsating size & glint
      let twinkleScale = 1.0
      if (enableTwinkle && (p.isSparkle || trailStyle === 'stardust')) {
        const pulse = Math.sin(now * p.twinkleFreq + p.twinklePhase)
        twinkleScale = 0.6 + 0.7 * Math.max(0, pulse)
      }

      const finalScale = p.baseScale * lifeRatio * twinkleScale

      dummy.position.copy(p.pos)
      dummy.scale.set(finalScale, finalScale, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Apply opacity to instance color for additive glow
      tempColor.copy(p.color).multiplyScalar(p.opacity)
      mesh.setColorAt(i, tempColor)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Dark Ambient Void */}
      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[26, 16]} />
        <meshBasicMaterial color="#020308" />
      </mesh>

      {/* Instanced Particle & Sparkle Quads */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={sparkleTexture}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}
