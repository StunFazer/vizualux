import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const MAX_PARTICLES = 250
const PARTICLE_LIFESPAN = 1.2

interface TrailParticle {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  color: THREE.Color
  scale: number
  opacity: number
  life: number
  maxLife: number
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

export function ParticleTrail() {
  const trackingDataRef = useTracker()
  const sparkleTexture = useTexture('/textures/sparkle.png')

  const particlesRef = useRef<TrailParticle[]>([])
  const [renderParticles, setRenderParticles] = useState<TrailParticle[]>([])
  const frameCounter = useRef(0)

  // Mapping function for tracking points
  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const activePoints = [
      toWorld(data.left_hand),
      toWorld(data.right_hand),
      toWorld(data.left_foot),
      toWorld(data.right_foot),
    ]

    // 1. Emit trail particles from active tracking points
    activePoints.forEach((pt) => {
      if (!pt) return

      // Emit 2 particles per point per frame
      if (particlesRef.current.length < MAX_PARTICLES) {
        for (let i = 0; i < 2; i++) {
          // Cycle through HSL colors based on elapsed time to create a rainbow effect
          const hue = (state.clock.elapsedTime * 0.15 + (i * 0.02)) % 1.0
          const color = new THREE.Color().setHSL(hue, 1.0, 0.6)

          particlesRef.current.push({
            id: Date.now() + Math.random(),
            pos: pt.clone().add(new THREE.Vector3(
              randomRange(-0.15, 0.15),
              randomRange(-0.15, 0.15),
              0
            )),
            vel: new THREE.Vector3(
              randomRange(-0.6, 0.6),
              randomRange(-0.6, 0.6),
              0
            ),
            color: color,
            scale: randomRange(0.4, 0.6),
            opacity: 1.0,
            life: PARTICLE_LIFESPAN,
            maxLife: PARTICLE_LIFESPAN
          })
        }
      }
    })

    // 2. Update active trail particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i]
      p.life -= delta

      if (p.life <= 0) {
        particlesRef.current.splice(i, 1)
        continue
      }

      // Physics: add slight organic turbulence/noise to velocity
      const timeScale = state.clock.elapsedTime * 3 + p.id
      p.vel.x += Math.sin(timeScale) * 0.25 * delta
      p.vel.y += Math.cos(timeScale) * 0.25 * delta

      // Move particle
      p.pos.addScaledVector(p.vel, delta)

      // Slow down velocity slightly
      p.vel.multiplyScalar(0.96)

      // Shrink and fade out particle over its lifetime
      const lifeRatio = p.life / p.maxLife
      p.scale = lifeRatio * 0.5
      p.opacity = lifeRatio
    }

    // Throttle React renders
    frameCounter.current++
    if (frameCounter.current % 2 === 0) {
      setRenderParticles([...particlesRef.current])
    }
  })

  return (
    <group>
      {/* Dark Void Background */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Colorful Particle Sprites */}
      {renderParticles.map((p) => (
        <sprite 
          key={p.id} 
          position={p.pos} 
          scale={[p.scale, p.scale, 1]}
        >
          <spriteMaterial 
            map={sparkleTexture} 
            color={p.color}
            transparent={true} 
            blending={THREE.AdditiveBlending}
            opacity={p.opacity}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}
