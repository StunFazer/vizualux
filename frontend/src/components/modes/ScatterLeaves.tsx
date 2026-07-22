import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const MAX_LEAVES = 80
const BOUNDS_X = 10
const BOUNDS_Y = 5
const REPULSION_RADIUS = 2.0
const KICK_FORCE = 12

interface Leaf {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: number
  rotVel: number
  scale: number
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

export function ScatterLeaves() {
  const trackingDataRef = useTracker()
  const leafTexture = useTexture('/textures/maple_leaf.png')

  // Generate initial leaves
  const initialLeaves = useMemo(() => {
    return Array.from({ length: MAX_LEAVES }).map((_, i) => ({
      id: i,
      pos: new THREE.Vector3(randomRange(-BOUNDS_X, BOUNDS_X), randomRange(-BOUNDS_Y, BOUNDS_Y), 0),
      vel: new THREE.Vector3(0, 0, 0),
      rot: randomRange(0, Math.PI * 2),
      rotVel: 0,
      scale: randomRange(0.6, 1.0),
    }))
  }, [])

  const leavesRef = useRef<Leaf[]>(initialLeaves)

  // Track leaves via state so React can render them
  const [renderLeaves, setRenderLeaves] = useState<Leaf[]>(initialLeaves)
  const frameCounter = useRef(0)

  // Mapping function for tracking points
  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  useFrame((_, delta) => {
    const data = trackingDataRef.current
    const activePoints: THREE.Vector3[] = []

    if (data.is_tracking) {
      const p1 = toWorld(data.left_hand)
      const p2 = toWorld(data.right_hand)
      const p3 = toWorld(data.left_foot)
      const p4 = toWorld(data.right_foot)
      if (p1) activePoints.push(p1)
      if (p2) activePoints.push(p2)
      if (p3) activePoints.push(p3)
      if (p4) activePoints.push(p4)
    }

    leavesRef.current.forEach((leaf) => {
      // 1. Calculate repulsion from all active tracking points
      activePoints.forEach((pt) => {
        const dist = leaf.pos.distanceTo(pt)
        if (dist < REPULSION_RADIUS) {
          const forceDirection = leaf.pos.clone().sub(pt).normalize()
          // Stronger force the closer the footprint is
          const intensity = (1.0 - dist / REPULSION_RADIUS) * KICK_FORCE
          leaf.vel.addScaledVector(forceDirection, intensity * delta)
          // Add some spin when kicked
          leaf.rotVel += randomRange(-5, 5) * (1.0 - dist / REPULSION_RADIUS)
        }
      })

      // 2. Physics updates: Apply drag/friction
      leaf.vel.multiplyScalar(0.94) // Slow down leaves gradually
      leaf.rotVel *= 0.92 // Slow down leaf spin

      // 3. Move leaves
      leaf.pos.addScaledVector(leaf.vel, delta)
      leaf.rot += leaf.rotVel * delta

      // 4. Wrap around boundaries with basic bounce dampening
      if (leaf.pos.x > BOUNDS_X) {
        leaf.pos.x = BOUNDS_X
        leaf.vel.x *= -0.5
      } else if (leaf.pos.x < -BOUNDS_X) {
        leaf.pos.x = -BOUNDS_X
        leaf.vel.x *= -0.5
      }

      if (leaf.pos.y > BOUNDS_Y) {
        leaf.pos.y = BOUNDS_Y
        leaf.vel.y *= -0.5
      } else if (leaf.pos.y < -BOUNDS_Y) {
        leaf.pos.y = -BOUNDS_Y
        leaf.vel.y *= -0.5
      }
    })

    // Throttle React renders to every 3rd frame to optimize performance
    frameCounter.current++
    if (frameCounter.current % 3 === 0) {
      setRenderLeaves([...leavesRef.current])
    }
  })

  return (
    <group>
      {/* Dark Forest Background */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#050805" />
      </mesh>

      {/* Scattered Leaf Sprites */}
      {renderLeaves.map((leaf) => (
        <sprite 
          key={leaf.id} 
          position={leaf.pos} 
          scale={[leaf.scale, leaf.scale, 1]}
        >
          <spriteMaterial 
            map={leafTexture} 
            rotation={leaf.rot} 
            transparent={true} 
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}
