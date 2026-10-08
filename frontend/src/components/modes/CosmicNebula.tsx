import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const STAR_COUNT = 600

const nebulaVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const nebulaFragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_lFoot;
uniform vec2 u_rFoot;
uniform vec2 u_lHand;
uniform vec2 u_rHand;
uniform float u_tracking;

varying vec2 vUv;

// Fractional Brownian Motion for cosmic gas
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  vec2 aspectSt = st;
  aspectSt.x *= (u_resolution.x / u_resolution.y);

  // Slow moving nebula cloud coordinates
  vec2 q = vec2(fbm(aspectSt + 0.05 * u_time), fbm(aspectSt + vec2(5.2, 1.3) + 0.04 * u_time));
  vec2 r = vec2(fbm(aspectSt + 4.0 * q + vec2(1.7, 9.2) + 0.08 * u_time), fbm(aspectSt + 4.0 * q + vec2(8.3, 2.8) + 0.06 * u_time));
  float f = fbm(aspectSt + 4.0 * r);

  // Celestial palette: cosmic violet, deep nebula cyan, magenta, and void black
  vec3 colorA = vec3(0.02, 0.01, 0.08); // Void black/indigo
  vec3 colorB = vec3(0.25, 0.05, 0.45); // Cosmic violet
  vec3 colorC = vec3(0.05, 0.45, 0.75); // Electric cyan nebula
  vec3 colorD = vec3(0.85, 0.25, 0.65); // Hot magenta core

  vec3 col = mix(colorA, colorB, clamp(f * f * 3.0, 0.0, 1.0));
  col = mix(col, colorC, clamp(length(q), 0.0, 1.0));
  col = mix(col, colorD, clamp(length(r.x), 0.0, 1.0) * f * 1.5);

  // Interactive gravity wells
  if (u_tracking > 0.5) {
    float d1 = distance(st, u_lFoot);
    float d2 = distance(st, u_rFoot);
    float d3 = distance(st, u_lHand);
    float d4 = distance(st, u_rHand);

    float well1 = exp(-d1 * 7.0);
    float well2 = exp(-d2 * 7.0);
    float well3 = exp(-d3 * 9.0);
    float well4 = exp(-d4 * 9.0);

    col += vec3(0.1, 0.8, 1.0) * well1 * (1.2 + sin(u_time * 6.0 - d1 * 25.0));
    col += vec3(0.3, 1.0, 0.6) * well2 * (1.2 + sin(u_time * 6.0 - d2 * 25.0));
    col += vec3(1.0, 0.4, 0.8) * well3 * (1.4 + sin(u_time * 8.0 - d3 * 30.0));
    col += vec3(1.0, 0.8, 0.2) * well4 * (1.4 + sin(u_time * 8.0 - d4 * 30.0));
  }

  gl_FragColor = vec4(col, 1.0);
}
`

interface SupernovaRing {
  pos: THREE.Vector3
  radius: number
  opacity: number
  color: THREE.Color
}

export function CosmicNebula() {
  const { size } = useThree()
  const trackingDataRef = useTracker()
  const nebulaMatRef = useRef<THREE.ShaderMaterial>(null)
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)

  // Star particles data
  const starsData = useMemo(() => {
    return Array.from({ length: STAR_COUNT }).map(() => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 2
      ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        0
      ),
      baseColor: new THREE.Color().setHSL(Math.random() * 0.3 + 0.55, 0.9, 0.75),
      scale: Math.random() * 0.12 + 0.04,
      angle: Math.random() * Math.PI * 2,
      orbitSpeed: (Math.random() - 0.5) * 3.5
    }))
  }, [])

  const ringsRef = useRef<SupernovaRing[]>([])
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

    // Update nebula shader uniforms
    if (nebulaMatRef.current) {
      nebulaMatRef.current.uniforms.u_time.value = state.clock.elapsedTime
      nebulaMatRef.current.uniforms.u_resolution.value.set(size.width, size.height)
      nebulaMatRef.current.uniforms.u_tracking.value = isTracking ? 1.0 : 0.0

      if (isTracking) {
        nebulaMatRef.current.uniforms.u_lFoot.value = toScreen(data.left_foot)
        nebulaMatRef.current.uniforms.u_rFoot.value = toScreen(data.right_foot)
        nebulaMatRef.current.uniforms.u_lHand.value = toScreen(data.left_hand)
        nebulaMatRef.current.uniforms.u_rHand.value = toScreen(data.right_hand)
      }
    }

    const attractors: THREE.Vector3[] = []
    const lFWorld = toWorld(data.left_foot)
    const rFWorld = toWorld(data.right_foot)
    const lHWorld = toWorld(data.left_hand)
    const rHWorld = toWorld(data.right_hand)

    if (isTracking) {
      if (lFWorld) attractors.push(lFWorld)
      if (rFWorld) attractors.push(rFWorld)
      if (lHWorld) attractors.push(lHWorld)
      if (rHWorld) attractors.push(rHWorld)
    }

    // Step burst check for supernovas
    const checkBurst = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (!prev || curr.distanceTo(prev) > 0.5) {
          ringsRef.current.push({
            pos: curr.clone().setZ(0.05),
            radius: 0.2,
            opacity: 1.0,
            color: new THREE.Color().setHSL((state.clock.elapsedTime * 0.2) % 1.0, 1.0, 0.6)
          })
          lastFootPos.current[key] = curr.clone()
        }
      }
    }
    checkBurst(lFWorld, lastFootPos.current.L, 'L')
    checkBurst(rFWorld, lastFootPos.current.R, 'R')

    // Animate rings
    for (let i = ringsRef.current.length - 1; i >= 0; i--) {
      const ring = ringsRef.current[i]
      ring.radius += delta * 3.5
      ring.opacity -= delta * 1.2
      if (ring.opacity <= 0) {
        ringsRef.current.splice(i, 1)
      }
    }

    // Update Star particle physics
    if (instancedMeshRef.current) {
      const mesh = instancedMeshRef.current

      for (let i = 0; i < STAR_COUNT; i++) {
        const star = starsData[i]

        // Attractor gravitational pull + tangential orbital swirl
        if (attractors.length > 0) {
          let closestDist = Infinity
          let closestAttr: THREE.Vector3 | null = null

          for (const attr of attractors) {
            const d = star.pos.distanceTo(attr)
            if (d < closestDist) {
              closestDist = d
              closestAttr = attr
            }
          }

          if (closestAttr && closestDist < 6.0) {
            const dir = new THREE.Vector3().subVectors(closestAttr, star.pos).normalize()
            const force = (1.0 - closestDist / 6.0) * 12.0
            star.vel.addScaledVector(dir, force * delta)

            // Orbital swirl perpendicular to radial pull
            const tangent = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(star.orbitSpeed)
            star.vel.addScaledVector(tangent, force * 0.8 * delta)
          }
        }

        // Apply friction & update position
        star.vel.multiplyScalar(0.96)
        star.pos.addScaledVector(star.vel, delta)

        // Screen boundary wrap
        if (star.pos.x > 11) star.pos.x = -11
        if (star.pos.x < -11) star.pos.x = 11
        if (star.pos.y > 6) star.pos.y = -6
        if (star.pos.y < -6) star.pos.y = 6

        // Twinkle scale pulse
        const twinkle = star.scale * (1.0 + 0.35 * Math.sin(state.clock.elapsedTime * 4.0 + i))

        tempMatrix.makeTranslation(star.pos.x, star.pos.y, star.pos.z)
        tempMatrix.scale(new THREE.Vector3(twinkle, twinkle, twinkle))
        mesh.setMatrixAt(i, tempMatrix)

        // Color shift near attractors
        if (attractors.length > 0) {
          mesh.setColorAt(i, star.baseColor)
        } else {
          mesh.setColorAt(i, tempColor.setHSL(0.6, 0.8, 0.8))
        }
      }

      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Background Cosmic Nebula Mesh */}
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[26, 15]} />
        <shaderMaterial
          ref={nebulaMatRef}
          vertexShader={nebulaVertexShader}
          fragmentShader={nebulaFragmentShader}
          uniforms={uniforms}
          depthWrite={false}
        />
      </mesh>

      {/* Orbiting Celestial Stars */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, STAR_COUNT]}
      >
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Supernova Shockwave Rings */}
      {ringsRef.current.map((ring, idx) => (
        <mesh key={idx} position={ring.pos}>
          <ringGeometry args={[ring.radius * 0.85, ring.radius, 32]} />
          <meshBasicMaterial
            color={ring.color}
            transparent
            opacity={ring.opacity}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
