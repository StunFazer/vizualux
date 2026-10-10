import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const GRID_VS = `
uniform float u_time;
uniform vec3 u_impacts[8]; // x, y = pos, z = intensity / age
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vDisplacement;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Compute 3D ripple displacement from interactive foot/hand impacts
  float disp = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 imp = u_impacts[i];
    if (imp.z > 0.0) {
      float d = distance(pos.xy, imp.xy);
      float wave = sin(d * 4.0 - u_time * 8.0) * exp(-d * 0.8);
      disp += wave * imp.z * 0.45;
    }
  }

  // Subtle ambient background sine wave
  disp += sin(pos.x * 0.5 + u_time * 1.5) * cos(pos.y * 0.5 + u_time * 1.5) * 0.12;

  pos.z += disp;
  vDisplacement = disp;
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
}
`

const GRID_FS = `
uniform float u_time;
uniform vec3 u_impacts[8];
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vDisplacement;

void main() {
  // Grid lines coordinate
  vec2 gridCoord = abs(fract(vWorldPos.xy * 0.8 - 0.5) - 0.5) / fwidth(vWorldPos.xy * 0.8);
  float line = min(gridCoord.x, gridCoord.y);
  float gridLine = 1.0 - min(line, 1.0);

  // Hexagonal/dot accents at grid intersections
  vec2 dotCoord = abs(fract(vWorldPos.xy * 0.8) - 0.5);
  float centerDot = smoothstep(0.08, 0.02, length(dotCoord));

  // Cyberpunk Palette: deep void floor, cyan grid lines, magenta peaks, electric gold energy
  vec3 baseColor = vec3(0.01, 0.02, 0.05); // Void dark navy
  vec3 cyanLine = vec3(0.0, 0.95, 1.0);    // Tron Cyan
  vec3 magentaPeak = vec3(1.0, 0.1, 0.6); // Hot Magenta
  vec3 goldPulse = vec3(1.0, 0.8, 0.2);   // Energy Gold

  // Color gradient based on wave height
  vec3 lineColor = mix(cyanLine, magentaPeak, clamp(vDisplacement * 2.0 + 0.3, 0.0, 1.0));

  // Proximity glow near impacts
  float impactGlow = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 imp = u_impacts[i];
    if (imp.z > 0.0) {
      float d = distance(vWorldPos.xy, imp.xy);
      impactGlow += exp(-d * 1.8) * imp.z;
    }
  }

  vec3 col = baseColor;
  col += lineColor * gridLine * 1.6;
  col += goldPulse * centerDot * 2.0;
  col += mix(cyanLine, magentaPeak, sin(u_time * 3.0) * 0.5 + 0.5) * impactGlow * 1.5;

  // Add subtle horizon/depth vignette
  float distFromCenter = length(vWorldPos.xy * 0.06);
  col *= clamp(1.6 - distFromCenter, 0.1, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`

interface HexGlyph {
  pos: THREE.Vector3
  scale: number
  rotation: number
  opacity: number
}

export function NeonGrid() {
  const trackingDataRef = useTracker()
  const gridMatRef = useRef<THREE.ShaderMaterial>(null)
  const hexGlyphsRef = useRef<HexGlyph[]>([])
  const lastFootPos = useRef<{ L: THREE.Vector3 | null; R: THREE.Vector3 | null }>({ L: null, R: null })

  const toWorld = (pt: any) => pt ? new THREE.Vector3((pt.x - 0.5) * 20, -(pt.y - 0.5) * 10, 0) : null

  const smoothedLimbs = useRef({
    lFoot: new THREE.Vector3(0, 0, 0),
    rFoot: new THREE.Vector3(0, 0, 0),
    lHand: new THREE.Vector3(0, 0, 0),
    rHand: new THREE.Vector3(0, 0, 0),
  })

  // Uniform array for 8 active impacts (hands, feet, step echoes)
  const impactsArray = useMemo(() => {
    return Array.from({ length: 8 }).map(() => new THREE.Vector3(0, 0, 0))
  }, [])

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_impacts: { value: impactsArray }
    }),
    [impactsArray]
  )

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const isTracking = data.is_tracking
    const dt = Math.min(delta, 0.05)
    const smoothFactor = 1.0 - Math.exp(-22.0 * dt)

    const rawLF = toWorld(data.left_foot)
    const rawRF = toWorld(data.right_foot)
    const rawLH = toWorld(data.left_hand)
    const rawRH = toWorld(data.right_hand)

    if (rawLF) smoothedLimbs.current.lFoot.lerp(rawLF, smoothFactor)
    if (rawRF) smoothedLimbs.current.rFoot.lerp(rawRF, smoothFactor)
    if (rawLH) smoothedLimbs.current.lHand.lerp(rawLH, smoothFactor)
    if (rawRH) smoothedLimbs.current.rHand.lerp(rawRH, smoothFactor)

    const lFoot = rawLF ? smoothedLimbs.current.lFoot : null
    const rFoot = rawRF ? smoothedLimbs.current.rFoot : null
    const lHand = rawLH ? smoothedLimbs.current.lHand : null
    const rHand = rawRH ? smoothedLimbs.current.rHand : null

    // Check step impacts for hex glyph spawning with velocity smoothing
    const checkStep = (curr: THREE.Vector3 | null, prev: THREE.Vector3 | null, key: 'L' | 'R') => {
      if (curr) {
        if (prev) {
          const speed = curr.distanceTo(prev) / Math.max(dt, 0.001)
          if (speed > 4.2) {
            hexGlyphsRef.current.push({
              pos: curr.clone().setZ(0.08),
              scale: 0.2,
              rotation: Math.random() * Math.PI,
              opacity: 1.0
            })
          }
        }
        lastFootPos.current[key] = curr.clone()
      } else {
        lastFootPos.current[key] = null
      }
    }
    checkStep(lFoot, lastFootPos.current.L, 'L')
    checkStep(rFoot, lastFootPos.current.R, 'R')

    // Update active impacts with smooth intensity fade
    let idx = 0
    if (isTracking) {
      if (lFoot) {
        impactsArray[idx].x = lFoot.x
        impactsArray[idx].y = lFoot.y
        impactsArray[idx].z = THREE.MathUtils.lerp(impactsArray[idx].z, 1.0, smoothFactor)
        idx++
      }
      if (rFoot) {
        impactsArray[idx].x = rFoot.x
        impactsArray[idx].y = rFoot.y
        impactsArray[idx].z = THREE.MathUtils.lerp(impactsArray[idx].z, 1.0, smoothFactor)
        idx++
      }
      if (lHand) {
        impactsArray[idx].x = lHand.x
        impactsArray[idx].y = lHand.y
        impactsArray[idx].z = THREE.MathUtils.lerp(impactsArray[idx].z, 0.8, smoothFactor)
        idx++
      }
      if (rHand) {
        impactsArray[idx].x = rHand.x
        impactsArray[idx].y = rHand.y
        impactsArray[idx].z = THREE.MathUtils.lerp(impactsArray[idx].z, 0.8, smoothFactor)
        idx++
      }
    }
    while (idx < 8) {
      impactsArray[idx].z = THREE.MathUtils.lerp(impactsArray[idx].z, 0.0, smoothFactor * 0.5)
      idx++
    }

    // Update hex glyphs
    for (let i = hexGlyphsRef.current.length - 1; i >= 0; i--) {
      const g = hexGlyphsRef.current[i]
      g.scale += dt * 2.8
      g.rotation += dt * 1.5
      g.opacity -= dt * 0.9
      if (g.opacity <= 0) {
        hexGlyphsRef.current.splice(i, 1)
      }
    }

    if (gridMatRef.current) {
      gridMatRef.current.uniforms.u_time.value = state.clock.elapsedTime
      gridMatRef.current.uniforms.u_impacts.value = impactsArray
    }
  })

  return (
    <group>
      {/* 3D Reactive Deforming Cyber Grid */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[26, 16, 96, 64]} />
        <shaderMaterial
          ref={gridMatRef}
          vertexShader={GRID_VS}
          fragmentShader={GRID_FS}
          uniforms={uniforms}
          wireframe={false}
        />
      </mesh>

      {/* Cyber Hexagonal Ring Pulses */}
      {hexGlyphsRef.current.map((glyph, i) => (
        <group key={i} position={glyph.pos} rotation={[0, 0, glyph.rotation]}>
          <mesh>
            <ringGeometry args={[glyph.scale * 0.9, glyph.scale, 6]} />
            <meshBasicMaterial
              color="#00f5ff"
              transparent
              opacity={glyph.opacity}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 6]}>
            <ringGeometry args={[glyph.scale * 0.5, glyph.scale * 0.58, 6]} />
            <meshBasicMaterial
              color="#ff007f"
              transparent
              opacity={glyph.opacity * 0.8}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
