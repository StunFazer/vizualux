import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'
import { useStore } from '../../store/useStore'

const MAX_WAVES = 16

const WATER_VS = `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
}
`

const WATER_FS = `
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_waves[${MAX_WAVES}]; // xy: center (uv), z: birthTime, w: strength
uniform float u_intensity;
uniform float u_damping;

varying vec2 vUv;
varying vec3 vWorldPos;

// Fast noise for water caustic shimmer
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

// Procedural caustic pattern
float caustics(vec2 uv, float t) {
  vec2 p = uv * 6.0;
  float c1 = noise(p + vec2(t * 0.4, t * 0.25));
  float c2 = noise(p * 1.5 - vec2(t * 0.3, -t * 0.35));
  float c = min(c1, c2);
  return pow(c * 1.8, 3.0);
}

// Compute water wave height displacement at UV
float getWaveDisplacement(vec2 uv) {
  float totalDisp = 0.0;
  
  // Ambient gentle pool waves (smooth, calm undulation)
  float amb = sin(uv.x * 3.5 + u_time * 0.45) * cos(uv.y * 2.8 + u_time * 0.35) * 0.035;
  amb += sin((uv.x + uv.y) * 5.0 - u_time * 0.6) * 0.015;
  totalDisp += amb;

  // Concentric interactive ripples
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 wave = u_waves[i];
    float birth = wave.z;
    float strength = wave.w;
    
    if (strength > 0.001) {
      float age = u_time - birth;
      if (age >= 0.0 && age < 6.0) {
        // Adjust aspect ratio for circular concentric rings
        vec2 diff = (uv - wave.xy);
        diff.x *= 2.0; // standard 2:1 aspect compensation
        float dist = length(diff);
        
        float waveSpeed = 0.55;
        float waveRadius = age * waveSpeed;
        float distFromFront = dist - waveRadius;
        
        // Ring envelope: smooth wave packet with gentle crests and valleys
        float ring = sin(dist * 18.0 - age * 7.5) * exp(-abs(distFromFront) * 5.5);
        float timeDecay = exp(-age * (1.1 * u_damping));
        float spatialDecay = exp(-dist * 1.1);
        
        totalDisp += ring * strength * timeDecay * spatialDecay * 0.5;
      }
    }
  }

  return totalDisp * u_intensity;
}

void main() {
  vec2 uv = vUv;
  
  // Calculate surface normal via finite difference of displacement with wider sampling baseline
  float eps = 0.012;
  float hL = getWaveDisplacement(uv - vec2(eps, 0.0));
  float hR = getWaveDisplacement(uv + vec2(eps, 0.0));
  float hD = getWaveDisplacement(uv - vec2(0.0, eps));
  float hU = getWaveDisplacement(uv + vec2(0.0, eps));
  
  vec3 normal = normalize(vec3((hL - hR), (hD - hU), eps * 2.5));
  
  // Overhead light source
  vec3 lightDir = normalize(vec3(0.3, 0.5, 1.2));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  
  // Diffuse & Specular highlights
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 38.0);
  
  // Fresnel reflectivity
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  
  // Deep aquatic color palette
  vec3 deepNavy = vec3(0.01, 0.05, 0.15);     // Deep pool floor
  vec3 oceanBlue = vec3(0.0, 0.32, 0.65);     // Mid water depth
  vec3 aquaTurquoise = vec3(0.05, 0.85, 0.95); // High wave crests
  vec3 sunHighlight = vec3(0.95, 0.98, 1.0);   // Specular glint
  
  // Caustics on the pool bed
  vec2 refractedUv = uv + normal.xy * 0.06;
  float c = caustics(refractedUv, u_time);
  
  float disp = getWaveDisplacement(uv);
  vec3 waterColor = mix(deepNavy, oceanBlue, clamp(uv.y * 0.3 + 0.4 + disp * 1.5, 0.0, 1.0));
  waterColor += aquaTurquoise * clamp(disp * 2.8, 0.0, 1.0);
  waterColor += vec3(0.1, 0.45, 0.55) * c * 0.6; // subtle caustics
  
  // Blend in specular reflections & fresnel sky glow
  vec3 finalColor = waterColor + sunHighlight * (spec * 1.8 + fresnel * 0.4);
  
  // Vignette edges
  float vignette = smoothstep(1.3, 0.4, length((uv - 0.5) * 1.8));
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, 1.0);
}
`

export function WaterRipples() {
  const { size } = useThree()
  const trackingDataRef = useTracker()
  const matRef = useRef<THREE.ShaderMaterial>(null)
  
  const intensity = useStore((s) => s.waterRippleIntensity)
  const damping = useStore((s) => s.waterRippleDamping)

  const waveIndexRef = useRef(0)
  
  const prevPositions = useRef<{ [key: string]: { x: number; y: number } | null }>({
    lh: null, rh: null, lf: null, rf: null
  })

  // Damped smooth tracking positions
  const smoothedPositions = useRef<{ [key: string]: { x: number; y: number } }>({
    lh: { x: 0.5, y: 0.5 },
    rh: { x: 0.5, y: 0.5 },
    lf: { x: 0.5, y: 0.5 },
    rf: { x: 0.5, y: 0.5 },
  })

  const wavesUniform = useMemo(() => {
    return Array.from({ length: MAX_WAVES }).map(() => new THREE.Vector4(0, 0, -100, 0))
  }, [])

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_waves: { value: wavesUniform },
      u_intensity: { value: 1.0 },
      u_damping: { value: 0.97 },
    }),
    [wavesUniform, size]
  )

  const addRipple = (x: number, y: number, time: number, strength: number) => {
    // Add wave into cyclic buffer
    const idx = waveIndexRef.current % MAX_WAVES
    waveIndexRef.current++
    wavesUniform[idx].set(x, 1.0 - y, time, Math.min(strength, 2.5))
  }

  const lastRippleTimes = useRef<{ [key: string]: number }>({
    lh: 0, rh: 0, lf: 0, rf: 0
  })

  useFrame((state, delta) => {
    const data = trackingDataRef.current
    const now = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)

    if (matRef.current) {
      matRef.current.uniforms.u_time.value = now
      matRef.current.uniforms.u_resolution.value.set(size.width, size.height)
      matRef.current.uniforms.u_intensity.value = intensity
      matRef.current.uniforms.u_damping.value = damping
    }

    if (data.is_tracking) {
      const points = [
        { key: 'lf', pt: data.left_foot, weight: 1.2 },
        { key: 'rf', pt: data.right_foot, weight: 1.2 },
        { key: 'lh', pt: data.left_hand, weight: 0.8 },
        { key: 'rh', pt: data.right_hand, weight: 0.8 },
      ]

      points.forEach(({ key, pt, weight }) => {
        if (!pt) {
          prevPositions.current[key] = null
          return
        }

        // Smooth position using exponential damping
        const smoothFactor = Math.min(1.0, dt * 16.0)
        smoothedPositions.current[key].x += (pt.x - smoothedPositions.current[key].x) * smoothFactor
        smoothedPositions.current[key].y += (pt.y - smoothedPositions.current[key].y) * smoothFactor

        const sx = smoothedPositions.current[key].x
        const sy = smoothedPositions.current[key].y

        const prev = prevPositions.current[key]
        if (prev) {
          const dx = sx - prev.x
          const dy = sy - prev.y
          const dist = Math.hypot(dx, dy)
          const speed = dist / Math.max(dt, 0.001)

          // Ripple trigger: requires deliberate movement (dist > 0.04) and step cooldown
          if (dist > 0.04 && speed > 0.15 && (now - lastRippleTimes.current[key] > 0.22)) {
            lastRippleTimes.current[key] = now
            const rippleStrength = Math.min(1.6, (speed * 0.5 + 0.35) * weight)
            addRipple(sx, sy, now, rippleStrength)
            prevPositions.current[key] = { x: sx, y: sy }
          }
        } else {
          // New contact point splash with cooldown
          if (now - lastRippleTimes.current[key] > 0.3) {
            lastRippleTimes.current[key] = now
            addRipple(sx, sy, now, 0.9 * weight)
          }
          prevPositions.current[key] = { x: sx, y: sy }
        }
      })
    }
  })

  return (
    <group>
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[20, 10]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={WATER_VS}
          fragmentShader={WATER_FS}
          uniforms={uniforms}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
