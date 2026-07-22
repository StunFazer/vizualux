import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const MAX_SHELLS = 20
const BOUNDS_X = 10
const BOUNDS_Y = 5
const KICK_RADIUS = 1.5
const KICK_FORCE = 10

interface Shell {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: THREE.Euler
  rotVel: THREE.Vector3
  scale: number
  color: string
}

interface Ripple {
  id: number
  pos: THREE.Vector3
  scale: number
  opacity: number
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

export function SandyShore() {
  const trackingDataRef = useTracker()
  const sandTexture = useTexture('/textures/sandy_shore.png')

  // Generate seashells
  const initialShells = useMemo(() => {
    const colors = ['#f5ebe0', '#e3d5ca', '#d5bdaf', '#f3e9dc', '#e0afa0']
    return Array.from({ length: MAX_SHELLS }).map((_, i) => ({
      id: i,
      pos: new THREE.Vector3(randomRange(-BOUNDS_X, BOUNDS_X), randomRange(-BOUNDS_Y, BOUNDS_Y), -0.1),
      vel: new THREE.Vector3(0, 0, 0),
      rot: new THREE.Euler(randomRange(0, Math.PI), randomRange(0, Math.PI), randomRange(0, Math.PI)),
      rotVel: new THREE.Vector3(0, 0, 0),
      scale: randomRange(0.2, 0.4),
      color: colors[Math.floor(Math.random() * colors.length)]
    }))
  }, [])

  const shellsRef = useRef<Shell[]>(initialShells)
  const ripplesRef = useRef<Ripple[]>([])

  const [renderShells, setRenderShells] = useState<Shell[]>(initialShells)
  const [renderRipples, setRenderRipples] = useState<Ripple[]>([])
  const frameCounter = useRef(0)

  // Tracking history for foot stepping to trigger ripples
  const lastFootPos = useRef<{ L: THREE.Vector3 | null, R: THREE.Vector3 | null }>({ L: null, R: null })

  // Mapping function for tracking points
  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  useFrame((_, delta) => {
    const data = trackingDataRef.current
    const activePoints: THREE.Vector3[] = []

    const lFoot = toWorld(data.left_foot)
    const rFoot = toWorld(data.right_foot)
    const lHand = toWorld(data.left_hand)
    const rHand = toWorld(data.right_hand)

    if (data.is_tracking) {
      if (lHand) activePoints.push(lHand)
      if (rHand) activePoints.push(rHand)
      if (lFoot) activePoints.push(lFoot)
      if (rFoot) activePoints.push(rFoot)
    }

    // 1. Spawning water ripples on steps
    const checkFootStep = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (!prev || curr.distanceTo(prev) > 0.6) {
          ripplesRef.current.push({
            id: Date.now() + Math.random(),
            pos: curr.clone().setZ(-0.05),
            scale: 0.1,
            opacity: 0.8
          })
          lastFootPos.current[key] = curr.clone()
        }
      }
    }
    checkFootStep(lFoot, lastFootPos.current.L, 'L')
    checkFootStep(rFoot, lastFootPos.current.R, 'R')

    // 2. Simulate ripples
    for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
      const r = ripplesRef.current[i]
      r.scale += delta * 2.5
      r.opacity -= delta * 0.4
      if (r.opacity <= 0) {
        ripplesRef.current.splice(i, 1)
      }
    }

    // 3. Simulate seashells physics
    shellsRef.current.forEach((shell) => {
      activePoints.forEach((pt) => {
        const dist = shell.pos.distanceTo(pt)
        if (dist < KICK_RADIUS) {
          const forceDirection = shell.pos.clone().sub(pt).normalize()
          const intensity = (1.0 - dist / KICK_RADIUS) * KICK_FORCE
          shell.vel.addScaledVector(forceDirection, intensity * delta)
          // Add spin
          shell.rotVel.add(new THREE.Vector3(randomRange(-5, 5), randomRange(-5, 5), randomRange(-5, 5)))
        }
      })

      // Physics updates
      shell.vel.multiplyScalar(0.92)
      shell.rotVel.multiplyScalar(0.92)

      shell.pos.addScaledVector(shell.vel, delta)
      shell.rot.x += shell.rotVel.x * delta
      shell.rot.y += shell.rotVel.y * delta
      shell.rot.z += shell.rotVel.z * delta

      // Boundary clamp & bounce
      if (shell.pos.x > BOUNDS_X) {
        shell.pos.x = BOUNDS_X
        shell.vel.x *= -0.4
      } else if (shell.pos.x < -BOUNDS_X) {
        shell.pos.x = -BOUNDS_X
        shell.vel.x *= -0.4
      }

      if (shell.pos.y > BOUNDS_Y) {
        shell.pos.y = BOUNDS_Y
        shell.vel.y *= -0.4
      } else if (shell.pos.y < -BOUNDS_Y) {
        shell.pos.y = -BOUNDS_Y
        shell.vel.y *= -0.4
      }
    })

    // Throttle React renders
    frameCounter.current++
    if (frameCounter.current % 3 === 0) {
      setRenderShells([...shellsRef.current])
      setRenderRipples([...ripplesRef.current])
    }
  })

  return (
    <group>
      {/* Sandy Beach Background */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial map={sandTexture} />
      </mesh>

      {/* Interactive Ripples */}
      {renderRipples.map((r) => (
        <mesh key={r.id} position={r.pos}>
          <ringGeometry args={[r.scale, r.scale + 0.1, 32]} />
          <meshBasicMaterial 
            color="#e0f2fe" 
            transparent={true} 
            opacity={r.opacity} 
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Interactive 3D Seashells */}
      {renderShells.map((shell) => (
        <mesh 
          key={shell.id} 
          position={shell.pos}
          rotation={shell.rot}
          scale={[shell.scale, shell.scale * 0.7, shell.scale * 1.3]}
        >
          {/* Procedural shell shape using a cone */}
          <coneGeometry args={[0.6, 1.2, 5]} />
          <meshStandardMaterial 
            color={shell.color} 
            roughness={0.6}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  )
}
