import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTracker } from '../../hooks/useTracker'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_leftHand;
uniform vec2 u_rightHand;
uniform vec2 u_leftFoot;
uniform vec2 u_rightFoot;
uniform bool u_leftHandActive;
uniform bool u_rightHandActive;
uniform bool u_leftFootActive;
uniform bool u_rightFootActive;
uniform bool u_isTracking;

varying vec2 vUv;

// Simple noise function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  
  // Base color
  vec3 color = vec3(0.05, 0.05, 0.1);
  
  // Add some flowing noise
  float noise = random(st + u_time * 0.1) * 0.1;
  color += vec3(noise);
  
  // Interactive ripples based on hand & foot positions
  if (u_isTracking) {
    // Left hand influence (Blue)
    if (u_leftHandActive) {
      float distLeft = distance(st, u_leftHand);
      float rippleLeft = sin(distLeft * 20.0 - u_time * 5.0) * exp(-distLeft * 5.0);
      color += vec3(0.0, 0.5, 1.0) * max(0.0, rippleLeft);
    }
    
    // Right hand influence (Pink/Red)
    if (u_rightHandActive) {
      float distRight = distance(st, u_rightHand);
      float rippleRight = sin(distRight * 20.0 - u_time * 5.0) * exp(-distRight * 5.0);
      color += vec3(1.0, 0.2, 0.5) * max(0.0, rippleRight);
    }

    // Left foot influence (Teal/Green)
    if (u_leftFootActive) {
      float distLFoot = distance(st, u_leftFoot);
      float rippleLFoot = sin(distLFoot * 20.0 - u_time * 5.0) * exp(-distLFoot * 5.0);
      color += vec3(0.0, 0.8, 0.5) * max(0.0, rippleLFoot);
    }

    // Right foot influence (Yellow)
    if (u_rightFootActive) {
      float distRFoot = distance(st, u_rightFoot);
      float rippleRFoot = sin(distRFoot * 20.0 - u_time * 5.0) * exp(-distRFoot * 5.0);
      color += vec3(0.8, 0.8, 0.0) * max(0.0, rippleRFoot);
    }
  }
  
  gl_FragColor = vec4(color, 1.0);
}
`

export function FluidSimulation() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const trackingDataRef = useTracker()
  const { size, viewport } = useThree()

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_leftHand: { value: new THREE.Vector2(0.5, 0.5) },
      u_rightHand: { value: new THREE.Vector2(0.5, 0.5) },
      u_leftFoot: { value: new THREE.Vector2(0.5, 0.5) },
      u_rightFoot: { value: new THREE.Vector2(0.5, 0.5) },
      u_leftHandActive: { value: false },
      u_rightHandActive: { value: false },
      u_leftFootActive: { value: false },
      u_rightFootActive: { value: false },
      u_isTracking: { value: false },
    }),
    [size]
  )

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = state.clock.elapsedTime
      
      const data = trackingDataRef.current
      materialRef.current.uniforms.u_isTracking.value = data.is_tracking
      
      if (data.is_tracking) {
        // Set points and active flags (inverting Y because WebGL fragment shader goes 0 bottom to 1 top)
        const updateUniform = (pt: any, uPos: string, uActive: string) => {
          if (pt) {
            materialRef.current!.uniforms[uPos].value.set(pt.x, 1.0 - pt.y)
            materialRef.current!.uniforms[uActive].value = true
          } else {
            materialRef.current!.uniforms[uActive].value = false
          }
        }

        updateUniform(data.left_hand, 'u_leftHand', 'u_leftHandActive')
        updateUniform(data.right_hand, 'u_rightHand', 'u_rightHandActive')
        updateUniform(data.left_foot, 'u_leftFoot', 'u_leftFootActive')
        updateUniform(data.right_foot, 'u_rightFoot', 'u_rightFootActive')
      } else {
        materialRef.current.uniforms.u_leftHandActive.value = false
        materialRef.current.uniforms.u_rightHandActive.value = false
        materialRef.current.uniforms.u_leftFootActive.value = false
        materialRef.current.uniforms.u_rightFootActive.value = false
      }
    }
  })

  return (
    <mesh>
      {/* Plane covering the whole viewport */}
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
