import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const MAX_PARTICLES = 150
const SPAWN_SPEED_THRESHOLD = 0.5 // Speed threshold to trigger sparkles

interface SparkleParticle {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  scale: number
  maxScale: number
  opacity: number
  life: number
  maxLife: number
  twinkleFreq: number
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

export function Sparkles() {
  const trackingDataRef = useTracker()
  const sparkleTexture = useTexture('/textures/sparkle.png')

  const particlesRef = useRef<SparkleParticle[]>([])
  const [renderParticles, setRenderParticles] = useState<SparkleParticle[]>([])
  const frameCounter = useRef(0)

  // Track previous tracking positions to calculate velocity
  const prevPositions = useRef<{ [key: string]: THREE.Vector3 | null }>({
    lh: null, rh: null, lf: null, rf: null
  })

  // Mapping function for tracking points
  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const activePoints = [
      { key: 'lh', pt: toWorld(data.left_hand) },
      { key: 'rh', pt: toWorld(data.right_hand) },
      { key: 'lf', pt: toWorld(data.left_foot) },
      { key: 'rf', pt: toWorld(data.right_foot) },
    ]

    // 1. Check velocities and spawn sparkles
    activePoints.forEach(({ key, pt }) => {
      if (!pt) {
        prevPositions.current[key] = null
        return
      }

      const prevPt = prevPositions.current[key]
      if (prevPt) {
        const velocity = pt.distanceTo(prevPt)
        // If movement is fast, spawn a burst of sparkles
        if (velocity > SPAWN_SPEED_THRESHOLD && particlesRef.current.length < MAX_PARTICLES) {
          const spawnCount = Math.min(5, Math.ceil(velocity * 8))
          for (let i = 0; i < spawnCount; i++) {
            particlesRef.current.push({
              id: Date.now() + Math.random(),
              pos: pt.clone().add(new THREE.Vector3(
                randomRange(-0.3, 0.3),
                randomRange(-0.3, 0.3),
                0
              )),
              vel: new THREE.Vector3(
                randomRange(-0.5, 0.5),
                randomRange(0.2, 1.2), // Sparkles float upward
                0
              ),
              scale: 0.1,
              maxScale: randomRange(0.4, 0.8),
              opacity: 1.0,
              life: randomRange(0.8, 1.5), // Lifespan in seconds
              maxLife: 1.5,
              twinkleFreq: randomRange(10, 25),
            })
          }
        }
      }
      prevPositions.current[key] = pt.clone()
    })

    // 2. Update active sparkles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i]
      p.life -= delta

      if (p.life <= 0) {
        particlesRef.current.splice(i, 1)
        continue
      }

      // Update position (apply velocity + float upward)
      p.pos.addScaledVector(p.vel, delta)
      p.vel.multiplyScalar(0.95) // Slow down lateral velocity

      // Twinkle scale effect (oscillating scale)
      const twinkle = Math.sin(state.clock.elapsedTime * p.twinkleFreq) * 0.25
      p.scale = THREE.MathUtils.lerp(p.scale, p.maxScale * (0.75 + twinkle), 0.1)

      // Fade out opacity over time
      p.opacity = Math.max(0, p.life / p.maxLife)
    }

    // Throttle React renders to save CPU
    frameCounter.current++
    if (frameCounter.current % 2 === 0) {
      setRenderParticles([...particlesRef.current])
    }
  })

  return (
    <group>
      {/* Deep Indigo/Black Cosmic Background */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#020108" />
      </mesh>

      {/* Sparkling Twinkles */}
      {renderParticles.map((p) => (
        <sprite 
          key={p.id} 
          position={p.pos} 
          scale={[p.scale, p.scale, 1]}
        >
          <spriteMaterial 
            map={sparkleTexture} 
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
