import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'
import type { Point3D } from '../../hooks/useTracker'

const MAX_FISH = 5
const BOUNDS = 10
const WANDER_SPEED = 2
const SEEK_SPEED = 4
const FLEE_SPEED = 8

// --- Helper Functions ---
const wrap = (val: number, max: number) => {
  if (val > max) return -max
  if (val < -max) return max
  return val
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

// --- Types ---
interface Ripple {
  id: number
  x: number
  y: number
  scale: number
  opacity: number
}

interface Food {
  id: number
  x: number
  y: number
  age: number
}

interface Fish {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  target: THREE.Vector3 | null
  state: 'wander' | 'seek' | 'flee'
  tailAngle: number
  color: string
}

// --- Procedural Koi Component ---
const KoiMesh = ({ fish }: { fish: Fish }) => {
  const groupRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Group>(null)
  const finLRef = useRef<THREE.Mesh>(null)
  const finRRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!groupRef.current || !tailRef.current) return
    
    // Smoothly update position
    groupRef.current.position.lerp(fish.pos, 0.2)
    
    // Smoothly look at velocity direction
    if (fish.vel.lengthSq() > 0.01) {
      // Top-down view: rotate around Z axis based on X/Y velocity
      const angle = Math.atan2(fish.vel.y, fish.vel.x)
      
      // Handle wrap-around for lerping angle smoothly
      let currentAngle = groupRef.current.rotation.z
      let diff = angle - currentAngle
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      
      groupRef.current.rotation.z += diff * 0.1
    }

    // Animate Tail based on speed
    const swimFreq = fish.state === 'flee' ? 20 : (fish.state === 'seek' ? 15 : 5)
    const swimAmp = fish.state === 'flee' ? 0.8 : 0.4
    
    // Update internal animation state
    fish.tailAngle += delta * swimFreq
    // Tail swings in the XY plane (around Z axis)
    tailRef.current.rotation.z = Math.sin(fish.tailAngle) * swimAmp

    // Optional: Flapping fins (rotating around X axis to dip into Z)
    if (finLRef.current && finRRef.current) {
      finLRef.current.rotation.x = Math.sin(fish.tailAngle) * 0.2
      finRRef.current.rotation.x = -Math.sin(fish.tailAngle) * 0.2
    }
  })

  // Material setup: Emissive glowing koi
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: fish.color, 
    emissive: fish.color,
    emissiveIntensity: 0.5,
    roughness: 0.1
  }), [fish.color])

  // Dispose GPU material on unmount
  useEffect(() => {
    return () => { bodyMaterial.dispose() }
  }, [bodyMaterial])

  return (
    <group ref={groupRef}>
      {/* Main Body (Aligned along X axis) */}
      <mesh material={bodyMaterial} scale={[1.2, 0.4, 0.3]} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 16, 16]} />
      </mesh>
      
      {/* Pectoral Fins (Extending along Y axis) */}
      <mesh ref={finLRef} material={bodyMaterial} position={[-0.3, 0.4, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.2, 0.8, 3]} />
      </mesh>
      <mesh ref={finRRef} material={bodyMaterial} position={[-0.3, -0.4, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.2, 0.8, 3]} />
      </mesh>

      {/* Tail Assembly */}
      <group ref={tailRef} position={[-1.0, 0, 0]}>
        <mesh material={bodyMaterial} position={[-0.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.4, 1.2, 3]} />
        </mesh>
      </group>
    </group>
  )
}

// --- Main Koi Pond Scene ---
export function KoiPond() {
  const trackerRef = useTracker()
  
  // State refs for the simulation loops
  const ripples = useRef<Ripple[]>([])
  const foods = useRef<Food[]>([])
  const fishes = useRef<Fish[]>(
    Array.from({ length: MAX_FISH }).map((_, i) => ({
      id: i,
      pos: new THREE.Vector3(randomRange(-8, 8), randomRange(-8, 8), 0),
      vel: new THREE.Vector3(randomRange(-1, 1), randomRange(-1, 1), 0).normalize(),
      target: null,
      state: 'wander',
      tailAngle: Math.random() * Math.PI * 2,
      color: Math.random() > 0.5 ? '#ff7e00' : '#ffffff' // Orange or White koi
    }))
  )
  
  // To trigger re-renders only for visual elements that need React
  const [rippleData, setRippleData] = useState<Ripple[]>([])
  const [foodData, setFoodData] = useState<Food[]>([])
  const frameCounter = useRef(0)

  // Tracking history to spawn ripples/food
  const lastFootPos = useRef<{ L: THREE.Vector3 | null, R: THREE.Vector3 | null }>({ L: null, R: null })
  const lastHandPos = useRef<{ L: THREE.Vector3 | null, R: THREE.Vector3 | null }>({ L: null, R: null })
  const handHoverTime = useRef<{ L: number, R: number }>({ L: 0, R: 0 })

  // --- Simulation Loop ---
  useFrame((state, delta) => {
    const data = trackerRef.current

    // 1. Process Tracking Data (Convert 2D norm coords to 3D world space in XY plane)
    // Canvas bounds approx: x: -10 to 10, y: -5 to 5. 
    // y goes from 0 at top to 1 at bottom, so map it and invert for 3D coordinates
    const toWorld = (pt: Point3D | null) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

    const lFoot = toWorld(data.left_foot)
    const rFoot = toWorld(data.right_foot)
    const lHand = toWorld(data.left_hand)
    const rHand = toWorld(data.right_hand)

    // --- Generate Ripples from Feet ---
    const checkFootRipple = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (!prev || curr.distanceTo(prev) > 0.5) {
          ripples.current.push({ id: Date.now() + Math.random(), x: curr.x, y: curr.y, scale: 0.1, opacity: 1 })
          lastFootPos.current[key] = curr.clone()
        }
      }
    }
    checkFootRipple(lFoot, lastFootPos.current.L, 'L')
    checkFootRipple(rFoot, lastFootPos.current.R, 'R')

    // --- Generate Food from Hands ---
    const checkHandFeed = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (prev && curr.distanceTo(prev) < 0.2) {
          handHoverTime.current[key] += delta
          if (handHoverTime.current[key] > 0.5) {
            // Drop food!
            foods.current.push({ id: Date.now() + Math.random(), x: curr.x, y: curr.y, age: 0 })
            // Spawn tiny ripple
            ripples.current.push({ id: Date.now() + Math.random(), x: curr.x, y: curr.y, scale: 0.05, opacity: 0.5 })
            handHoverTime.current[key] = 0 // Reset timer
          }
        } else {
          handHoverTime.current[key] = 0
        }
        lastHandPos.current[key] = curr.clone()
      }
    }
    checkHandFeed(lHand, lastHandPos.current.L, 'L')
    checkHandFeed(rHand, lastHandPos.current.R, 'R')


    // --- Simulate Fish Boids ---
    fishes.current.forEach(fish => {
      // Avoid Feet (Flee)
      let fleeVector = new THREE.Vector3()
      let fleeing = false
      
      const checkFlee = (foot: THREE.Vector3 | null) => {
        if (!foot) return
        const dist = fish.pos.distanceTo(foot)
        if (dist < 4.0) {
          fleeVector.add(fish.pos.clone().sub(foot).normalize().divideScalar(dist)) // Stronger push when closer
          fleeing = true
        }
      }
      checkFlee(lFoot)
      checkFlee(rFoot)

      if (fleeing) {
        fish.state = 'flee'
        fish.target = null
        fish.vel.add(fleeVector.multiplyScalar(delta * FLEE_SPEED * 5))
      } else {
        // Not fleeing. Seek Food?
        if (foods.current.length > 0) {
          // Find closest food
          let closestFood = foods.current[0]
          let minDist = fish.pos.distanceTo(new THREE.Vector3(closestFood.x, closestFood.y, 0))
          
          for (let i = 1; i < foods.current.length; i++) {
            const f = foods.current[i]
            const dist = fish.pos.distanceTo(new THREE.Vector3(f.x, f.y, 0))
            if (dist < minDist) {
              minDist = dist
              closestFood = f
            }
          }

          if (minDist < 1.0) {
            // Eat the food
            foods.current = foods.current.filter(f => f.id !== closestFood.id)
          } else {
            // Swim towards food
            fish.state = 'seek'
            const foodPos = new THREE.Vector3(closestFood.x, closestFood.y, 0)
            const seekDir = foodPos.sub(fish.pos).normalize()
            fish.vel.add(seekDir.multiplyScalar(delta * SEEK_SPEED))
          }
        } else {
          // Wander
          fish.state = 'wander'
          if (!fish.target || fish.pos.distanceTo(fish.target) < 2) {
            fish.target = new THREE.Vector3(randomRange(-BOUNDS, BOUNDS), randomRange(-BOUNDS/2, BOUNDS/2), 0)
          }
          const seekDir = fish.target.clone().sub(fish.pos).normalize()
          // Add some noise to wandering
          seekDir.x += Math.sin(state.clock.elapsedTime * 2 + fish.id) * 0.5
          seekDir.y += Math.cos(state.clock.elapsedTime * 2 + fish.id) * 0.5
          seekDir.normalize()
          fish.vel.add(seekDir.multiplyScalar(delta * WANDER_SPEED))
        }
      }

      // Apply Velocity constraints
      const maxSpeed = fish.state === 'flee' ? FLEE_SPEED : (fish.state === 'seek' ? SEEK_SPEED : WANDER_SPEED)
      if (fish.vel.length() > maxSpeed) {
        fish.vel.normalize().multiplyScalar(maxSpeed)
      }

      // Update Position
      fish.pos.add(fish.vel.clone().multiplyScalar(delta))
      
      // Wrap around bounds
      fish.pos.x = wrap(fish.pos.x, 15)
      fish.pos.y = wrap(fish.pos.y, 10)
    })

    // --- Simulate Ripples ---
    for (let i = ripples.current.length - 1; i >= 0; i--) {
      const r = ripples.current[i]
      r.scale += delta * 3.0
      r.opacity -= delta * 0.5
      if (r.opacity <= 0) {
        ripples.current.splice(i, 1)
      }
    }

    // Cap ripples to prevent performance cliff
    while (ripples.current.length > 50) {
      ripples.current.shift()
    }

    // --- Simulate Food ---
    for (let i = foods.current.length - 1; i >= 0; i--) {
      const f = foods.current[i]
      f.age += delta
      if (f.age > 10) { // Food dissolves after 10 seconds
        foods.current.splice(i, 1)
      }
    }

    // Throttle React state updates to every 3rd frame
    frameCounter.current++
    if (frameCounter.current % 3 === 0) {
      setRippleData([...ripples.current])
      setFoodData([...foods.current])
    }
  })

  return (
    <group>
      {/* Dark Indigo Water Background Layer */}
      <mesh position={[0, 0, -2]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#02081a" />
      </mesh>

      {/* Bioluminescent Ripples */}
      {rippleData.map(r => (
        <mesh key={r.id} position={[r.x, r.y, -1.9]}>
          <ringGeometry args={[r.scale, r.scale + 0.1, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={r.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* Breadcrumb Food */}
      {foodData.map(f => (
        <mesh key={f.id} position={[f.x, f.y, -1.8]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#fcd34d" emissive="#f59e0b" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* The Koi Fish */}
      {fishes.current.map(fish => (
        <KoiMesh key={fish.id} fish={fish} />
      ))}
      
      {/* Post Processing Light */}
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#38bdf8" />
    </group>
  )
}
