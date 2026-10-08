import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const MAX_EMBERS = 300

const LAVA_VS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const LAVA_FS = `
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_lFoot;
uniform vec2 u_rFoot;
uniform vec2 u_lHand;
uniform vec2 u_rHand;
uniform float u_tracking;

varying vec2 vUv;

// Procedural Voronoi / cellular noise for volcanic rock fissures
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float m = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g - f + (0.5 + 0.5 * sin(u_time * 0.8 + 6.2831 * o));
      float d = dot(r, r);
      if (d < m) m = d;
    }
  }
  return sqrt(m);
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  vec2 uv = st * vec2(u_resolution.x / u_resolution.y, 1.0) * 3.5;

  float v = voronoi(uv);
  float cracks = smoothstep(0.02, 0.28, v);

  // Molten Magma palette
  vec3 magmaCore = vec3(1.0, 0.95, 0.4);  // Blinding white-yellow
  vec3 magmaGlow = vec3(1.0, 0.35, 0.05); // Molten orange
  vec3 crustDeep = vec3(0.08, 0.04, 0.03); // Scorched basalt rock
  vec3 crustRock = vec3(0.02, 0.01, 0.01); // Dark volcanic stone

  // Pulsing heat flow through the fissures
  float pulse = sin(u_time * 2.5 + v * 12.0) * 0.5 + 0.5;
  vec3 lavaColor = mix(magmaGlow, magmaCore, pulse * (1.0 - cracks));
  vec3 col = mix(lavaColor, mix(crustDeep, crustRock, cracks), cracks);

  // Interactive Foot / Hand Magma Flash
  if (u_tracking > 0.5) {
    float d1 = distance(st, u_lFoot);
    float d2 = distance(st, u_rFoot);
    float d3 = distance(st, u_lHand);
    float d4 = distance(st, u_rHand);

    float heat1 = exp(-d1 * 6.5);
    float heat2 = exp(-d2 * 6.5);
    float heat3 = exp(-d3 * 8.0);
    float heat4 = exp(-d4 * 8.0);

    float totalHeat = heat1 + heat2 + heat3 + heat4;
    col += mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.9, 0.3), totalHeat) * totalHeat * 2.2;
  }

  gl_FragColor = vec4(col, 1.0);
}
`

interface Ember {
  pos: THREE.Vector3
  vel: THREE.Vector3
  size: number
  life: number
  maxLife: number
  swirlOffset: number
}

interface MagmaRing {
  pos: THREE.Vector3
  radius: number
  opacity: number
}

export function LavaEmbers() {
  const { size } = useThree()
  const trackingDataRef = useTracker()
  const lavaMatRef = useRef<THREE.ShaderMaterial>(null)
  const embersMeshRef = useRef<THREE.InstancedMesh>(null)

  const embersRef = useRef<Ember[]>([])
  const ringsRef = useRef<MagmaRing[]>([])
  const lastFootPos = useRef<{ L: THREE.Vector3 | null; R: THREE.Vector3 | null }>({ L: null, R: null })

  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null
  const toScreen = (pt: any) => pt ? new THREE.Vector2(pt.x, 1.0 - pt.y) : new THREE.Vector2(-10, -10)

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_lFoot: { value: new THREE.Vector2(-10, -10) },
      u_rFoot: { value: new THREE.Vector2(-10, -10) },
      u_lHand: { value: new THREE.Vector2(-10, -10) },
      u_rHand: { value: new THREE.Vector2(-10, -10) },
      u_tracking: { value: 0.0 }
    }),
    [size]
  )

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const isTracking = data.is_tracking

    // Update Lava floor shader
    if (lavaMatRef.current) {
      lavaMatRef.current.uniforms.u_time.value = state.clock.elapsedTime
      lavaMatRef.current.uniforms.u_resolution.value.set(size.width, size.height)
      lavaMatRef.current.uniforms.u_tracking.value = isTracking ? 1.0 : 0.0

      if (isTracking) {
        lavaMatRef.current.uniforms.u_lFoot.value = toScreen(data.left_foot)
        lavaMatRef.current.uniforms.u_rFoot.value = toScreen(data.right_foot)
        lavaMatRef.current.uniforms.u_lHand.value = toScreen(data.left_hand)
        lavaMatRef.current.uniforms.u_rHand.value = toScreen(data.right_hand)
      }
    }

    const lFoot = toWorld(data.left_foot)
    const rFoot = toWorld(data.right_foot)
    const lHand = toWorld(data.left_hand)
    const rHand = toWorld(data.right_hand)

    const activeNodes: THREE.Vector3[] = []
    if (isTracking) {
      if (lFoot) activeNodes.push(lFoot)
      if (rFoot) activeNodes.push(rFoot)
      if (lHand) activeNodes.push(lHand)
      if (rHand) activeNodes.push(rHand)
    }

    // Step check for magma shockwaves and ember fountain
    const checkStep = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (!prev || curr.distanceTo(prev) > 0.45) {
          ringsRef.current.push({
            pos: curr.clone().setZ(0.04),
            radius: 0.2,
            opacity: 1.0
          })

          // Spawn burst of rising embers
          for (let e = 0; e < 18; e++) {
            if (embersRef.current.length < MAX_EMBERS) {
              const angle = Math.random() * Math.PI * 2
              const spread = Math.random() * 2.2 + 0.5
              embersRef.current.push({
                pos: curr.clone().add(new THREE.Vector3(
                  (Math.random() - 0.5) * 0.4,
                  (Math.random() - 0.5) * 0.4,
                  Math.random() * 0.2
                )),
                vel: new THREE.Vector3(
                  Math.cos(angle) * spread,
                  Math.sin(angle) * spread + Math.random() * 1.5, // Natural upward heat draft
                  Math.random() * 0.5
                ),
                size: Math.random() * 0.12 + 0.05,
                life: 1.8,
                maxLife: 1.8,
                swirlOffset: Math.random() * 10
              })
            }
          }

          lastFootPos.current[key] = curr.clone()
        }
      }
    }
    checkStep(lFoot, lastFootPos.current.L, 'L')
    checkStep(rFoot, lastFootPos.current.R, 'R')

    // Continuous ambient embers emitted from active points
    if (isTracking && Math.random() < 0.75) {
      activeNodes.forEach((node) => {
        if (embersRef.current.length < MAX_EMBERS) {
          embersRef.current.push({
            pos: node.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0)),
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 1.2 + 0.4, 0),
            size: Math.random() * 0.09 + 0.04,
            life: 1.4,
            maxLife: 1.4,
            swirlOffset: Math.random() * 10
          })
        }
      })
    }

    // Update Embers physics
    for (let i = embersRef.current.length - 1; i >= 0; i--) {
      const ember = embersRef.current[i]
      ember.life -= delta
      if (ember.life <= 0) {
        embersRef.current.splice(i, 1)
        continue
      }

      // Heat convection + swirling turbulent air
      const timeScale = state.clock.elapsedTime * 2.5 + ember.swirlOffset
      ember.vel.x += Math.sin(timeScale) * 0.8 * delta
      ember.vel.y += (0.9 + Math.cos(timeScale) * 0.4) * delta // Buoyant thermal lift

      ember.pos.addScaledVector(ember.vel, delta)
      ember.vel.multiplyScalar(0.96)
    }

    // Update Magma shockwave rings
    for (let i = ringsRef.current.length - 1; i >= 0; i--) {
      const r = ringsRef.current[i]
      r.radius += delta * 2.8
      r.opacity -= delta * 1.0
      if (r.opacity <= 0) {
        ringsRef.current.splice(i, 1)
      }
    }

    // Render Instanced Embers
    if (embersMeshRef.current) {
      const mesh = embersMeshRef.current
      for (let i = 0; i < MAX_EMBERS; i++) {
        const ember = embersRef.current[i]
        if (ember) {
          const lifeRatio = ember.life / ember.maxLife
          const currentSize = ember.size * lifeRatio

          tempMatrix.makeTranslation(ember.pos.x, ember.pos.y, ember.pos.z)
          tempMatrix.scale(new THREE.Vector3(currentSize, currentSize, currentSize))
          mesh.setMatrixAt(i, tempMatrix)

          // Color cooling transition: hot white-yellow -> intense orange -> deep glowing red
          if (lifeRatio > 0.6) {
            tempColor.setRGB(1.0, 0.9, 0.3)
          } else if (lifeRatio > 0.3) {
            tempColor.setRGB(1.0, 0.4, 0.05)
          } else {
            tempColor.setRGB(0.8, 0.1, 0.02)
          }
          mesh.setColorAt(i, tempColor)
        } else {
          tempMatrix.makeTranslation(0, 0, -50)
          mesh.setMatrixAt(i, tempMatrix)
        }
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Volcanic Magma Floor Plane */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[26, 16]} />
        <shaderMaterial
          ref={lavaMatRef}
          vertexShader={LAVA_VS}
          fragmentShader={LAVA_FS}
          uniforms={uniforms}
        />
      </mesh>

      {/* Instanced Rising Embers */}
      <instancedMesh
        ref={embersMeshRef}
        args={[undefined, undefined, MAX_EMBERS]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* Magma Splash Rings */}
      {ringsRef.current.map((ring, i) => (
        <mesh key={i} position={ring.pos}>
          <ringGeometry args={[ring.radius * 0.85, ring.radius, 32]} />
          <meshBasicMaterial
            color="#ff5400"
            transparent
            opacity={ring.opacity}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}
