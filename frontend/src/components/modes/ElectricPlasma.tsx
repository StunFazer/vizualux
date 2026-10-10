import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const MAX_SPARKS = 180
const BOLT_SEGMENTS = 18

interface Spark {
  pos: THREE.Vector3
  vel: THREE.Vector3
  color: THREE.Color
  size: number
  opacity: number
  life: number
}

interface PlasmaPulse {
  pos: THREE.Vector3
  radius: number
  opacity: number
  color: THREE.Color
}

/**
 * Generates jagged procedural lightning points between two 3D positions
 */
function createLightningPath(start: THREE.Vector3, end: THREE.Vector3, jitterScale = 0.4): THREE.Vector3[] {
  const points: THREE.Vector3[] = [start.clone()]
  const diff = new THREE.Vector3().subVectors(end, start)
  const len = diff.length()
  const normal = new THREE.Vector3(-diff.y, diff.x, 0).normalize()

  for (let i = 1; i < BOLT_SEGMENTS; i++) {
    const t = i / BOLT_SEGMENTS
    const basePoint = new THREE.Vector3().addVectors(start, diff.clone().multiplyScalar(t))
    // Jitter peaks around the middle of the arc
    const envelope = Math.sin(t * Math.PI)
    const jitter = (Math.random() - 0.5) * jitterScale * envelope * Math.max(1.0, len * 0.25)
    basePoint.addScaledVector(normal, jitter)
    basePoint.z += (Math.random() - 0.5) * 0.15
    points.push(basePoint)
  }

  points.push(end.clone())
  return points
}

export function ElectricPlasma() {
  const trackingDataRef = useTracker()
  const sparksRef = useRef<Spark[]>([])
  const pulsesRef = useRef<PlasmaPulse[]>([])
  const lastFootPos = useRef<{ L: THREE.Vector3 | null; R: THREE.Vector3 | null }>({ L: null, R: null })

  // Line geometries for dynamic lightning bolts
  const bolt1GeoRef = useRef<THREE.BufferGeometry>(null)
  const bolt2GeoRef = useRef<THREE.BufferGeometry>(null)
  const bolt3GeoRef = useRef<THREE.BufferGeometry>(null)

  // Instanced sparks
  const sparkMeshRef = useRef<THREE.InstancedMesh>(null)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])

  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  const smoothedNodes = useRef({
    lFoot: new THREE.Vector3(0, 0, 0),
    rFoot: new THREE.Vector3(0, 0, 0),
    lHand: new THREE.Vector3(0, 0, 0),
    rHand: new THREE.Vector3(0, 0, 0),
  })

  useFrame((_, delta) => {
    const data = trackingDataRef.current
    const isTracking = data.is_tracking
    const dt = Math.min(delta, 0.05)
    const smoothFactor = 1.0 - Math.exp(-24.0 * dt)

    const rawLF = toWorld(data.left_foot)
    const rawRF = toWorld(data.right_foot)
    const rawLH = toWorld(data.left_hand)
    const rawRH = toWorld(data.right_hand)

    if (rawLF) smoothedNodes.current.lFoot.lerp(rawLF, smoothFactor)
    if (rawRF) smoothedNodes.current.rFoot.lerp(rawRF, smoothFactor)
    if (rawLH) smoothedNodes.current.lHand.lerp(rawLH, smoothFactor)
    if (rawRH) smoothedNodes.current.rHand.lerp(rawRH, smoothFactor)

    const lFoot = rawLF ? smoothedNodes.current.lFoot : null
    const rFoot = rawRF ? smoothedNodes.current.rFoot : null
    const lHand = rawLH ? smoothedNodes.current.lHand : null
    const rHand = rawRH ? smoothedNodes.current.rHand : null

    const activeNodes: THREE.Vector3[] = []
    if (isTracking) {
      if (lFoot) activeNodes.push(lFoot)
      if (rFoot) activeNodes.push(rFoot)
      if (lHand) activeNodes.push(lHand)
      if (rHand) activeNodes.push(rHand)
    }

    // 1. Spawning plasma shockwaves on foot impact with velocity smoothing
    const checkStep = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (prev) {
          const speed = curr.distanceTo(prev) / Math.max(dt, 0.001)
          if (speed > 4.0) {
            pulsesRef.current.push({
              pos: curr.clone().setZ(0.04),
              radius: 0.15,
              opacity: 1.0,
              color: new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 1.0, 0.7) // Electric blue/cyan
            })

            // Spawn burst of sparks
            for (let s = 0; s < 12; s++) {
              if (sparksRef.current.length < MAX_SPARKS) {
                const angle = Math.random() * Math.PI * 2
                const speed = Math.random() * 4.0 + 1.0
                sparksRef.current.push({
                  pos: curr.clone().setZ(0.05),
                  vel: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.random() - 0.5) * 1.5),
                  color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 1.0, 0.8),
                  size: Math.random() * 0.08 + 0.04,
                  opacity: 1.0,
                  life: 0.8
                })
              }
            }
          }
        }
        lastFootPos.current[key] = curr.clone()
      } else {
        lastFootPos.current[key] = null
      }
    }
    checkStep(lFoot, lastFootPos.current.L, 'L')
    checkStep(rFoot, lastFootPos.current.R, 'R')

    // 2. Procedural Lightning Arcs
    // Arc 1: Left Hand to Right Hand (Tesla Bridge)
    if (lHand && rHand && bolt1GeoRef.current) {
      const path1 = createLightningPath(lHand, rHand, 0.5)
      bolt1GeoRef.current.setFromPoints(path1)
    } else if (lFoot && rFoot && bolt1GeoRef.current) {
      const path1 = createLightningPath(lFoot, rFoot, 0.45)
      bolt1GeoRef.current.setFromPoints(path1)
    } else if (bolt1GeoRef.current) {
      bolt1GeoRef.current.setFromPoints([new THREE.Vector3(0, 0, -20), new THREE.Vector3(0, 0, -20)])
    }

    // Arc 2: Left Foot to Ground Node
    if (lFoot && bolt2GeoRef.current) {
      const groundNode = lFoot.clone().add(new THREE.Vector3(Math.sin(Date.now() * 0.005) * 0.8, -1.8, 0))
      const path2 = createLightningPath(lFoot, groundNode, 0.35)
      bolt2GeoRef.current.setFromPoints(path2)
    } else if (bolt2GeoRef.current) {
      bolt2GeoRef.current.setFromPoints([new THREE.Vector3(0, 0, -20), new THREE.Vector3(0, 0, -20)])
    }

    // Arc 3: Right Foot to Ground Node
    if (rFoot && bolt3GeoRef.current) {
      const groundNode = rFoot.clone().add(new THREE.Vector3(Math.cos(Date.now() * 0.005) * 0.8, -1.8, 0))
      const path3 = createLightningPath(rFoot, groundNode, 0.35)
      bolt3GeoRef.current.setFromPoints(path3)
    } else if (bolt3GeoRef.current) {
      bolt3GeoRef.current.setFromPoints([new THREE.Vector3(0, 0, -20), new THREE.Vector3(0, 0, -20)])
    }

    // 3. Emit ambient plasma sparks from active limbs
    if (isTracking && Math.random() < 0.6) {
      activeNodes.forEach((node) => {
        if (sparksRef.current.length < MAX_SPARKS) {
          sparksRef.current.push({
            pos: node.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0)),
            vel: new THREE.Vector3((Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 2.0, 0),
            color: new THREE.Color('#00f5ff'),
            size: Math.random() * 0.06 + 0.03,
            opacity: 1.0,
            life: 0.6
          })
        }
      })
    }

    // 4. Update Sparks physics
    for (let i = sparksRef.current.length - 1; i >= 0; i--) {
      const s = sparksRef.current[i]
      s.life -= delta
      if (s.life <= 0) {
        sparksRef.current.splice(i, 1)
        continue
      }
      s.pos.addScaledVector(s.vel, delta)
      s.vel.multiplyScalar(0.92)
      s.opacity = s.life / 0.8
    }

    // Render sparks
    if (sparkMeshRef.current) {
      const mesh = sparkMeshRef.current
      for (let i = 0; i < MAX_SPARKS; i++) {
        const s = sparksRef.current[i]
        if (s) {
          tempMatrix.makeTranslation(s.pos.x, s.pos.y, s.pos.z)
          const sz = s.size * s.opacity
          tempMatrix.scale(new THREE.Vector3(sz, sz, sz))
          mesh.setMatrixAt(i, tempMatrix)
          mesh.setColorAt(i, s.color)
        } else {
          tempMatrix.makeTranslation(0, 0, -50)
          mesh.setMatrixAt(i, tempMatrix)
        }
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    // 5. Update Plasma pulses
    for (let i = pulsesRef.current.length - 1; i >= 0; i--) {
      const p = pulsesRef.current[i]
      p.radius += delta * 3.8
      p.opacity -= delta * 1.4
      if (p.opacity <= 0) {
        pulsesRef.current.splice(i, 1)
      }
    }
  })

  return (
    <group>
      {/* Dark Ambient Ground Plane */}
      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[26, 16]} />
        <meshBasicMaterial color="#04060c" />
      </mesh>

      {/* Main Lightning Bolt 1 (Tesla Bridge) */}
      <line>
        <bufferGeometry ref={bolt1GeoRef} />
        <lineBasicMaterial
          color="#a855f7"
          linewidth={3}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.9}
        />
      </line>

      {/* Core Highlight for Bolt 1 (Hot White) */}
      <line>
        <bufferGeometry ref={bolt1GeoRef} />
        <lineBasicMaterial
          color="#ffffff"
          linewidth={1}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={1.0}
        />
      </line>

      {/* Left Ground Bolt */}
      <line>
        <bufferGeometry ref={bolt2GeoRef} />
        <lineBasicMaterial
          color="#06b6d4"
          linewidth={2}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.85}
        />
      </line>

      {/* Right Ground Bolt */}
      <line>
        <bufferGeometry ref={bolt3GeoRef} />
        <lineBasicMaterial
          color="#06b6d4"
          linewidth={2}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.85}
        />
      </line>

      {/* Instanced High-Voltage Sparks */}
      <instancedMesh
        ref={sparkMeshRef}
        args={[undefined, undefined, MAX_SPARKS]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* Plasma Shockwave Rings */}
      {pulsesRef.current.map((pulse, i) => (
        <mesh key={i} position={pulse.pos}>
          <ringGeometry args={[pulse.radius * 0.88, pulse.radius, 32]} />
          <meshBasicMaterial
            color={pulse.color}
            transparent
            opacity={pulse.opacity}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}
