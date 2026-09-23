import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'
import { useTracker } from '../../hooks/useTracker'

// @ts-ignore
import '../../utils/perspective-transform'
const PerspT = (window as any).PerspT

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D u_mask;
uniform sampler2D u_trail;
uniform vec3 u_coeffsX;
uniform vec3 u_coeffsY;
uniform vec3 u_coeffsW;
uniform vec3 u_color;
uniform float u_time;
uniform int u_effect; // 0: aura, 1: cosmic, 2: echo, 3: sparks, 4: combined
uniform bool u_rainbow;

varying vec2 vUv;

// Simple procedural hash and noise for cosmic stars
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // 1. Homography perspective mapping from Screen UV to Camera Mask UV
  float w = dot(u_coeffsW, vec3(vUv, 1.0));
  if (abs(w) < 0.0001) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec2 camUv = vec2(dot(u_coeffsX, vec3(vUv, 1.0)), dot(u_coeffsY, vec3(vUv, 1.0))) / w;

  // Zone clipping & soft vignette margin: fade smoothly to pure black at edges
  if (camUv.x < 0.0 || camUv.x > 1.0 || camUv.y < 0.0 || camUv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float margin = 0.08;
  float edgeX = smoothstep(0.0, margin, camUv.x) * (1.0 - smoothstep(1.0 - margin, 1.0, camUv.x));
  float edgeY = smoothstep(0.0, margin, camUv.y) * (1.0 - smoothstep(1.0 - margin, 1.0, camUv.y));
  float edgeMask = edgeX * edgeY;

  // 2. Sample current mask and echo trail
  float maskVal = texture2D(u_mask, camUv).r;
  float trailVal = texture2D(u_trail, camUv).r;

  // Active theme color (static or dynamic rainbow cycle)
  vec3 baseColor = u_rainbow ? hsv2rgb(vec3(fract(u_time * 0.15), 0.9, 1.0)) : u_color;

  // 3. Neon Aura: Sobel edge gradient detection
  vec2 texel = vec2(1.0 / 320.0, 1.0 / 180.0);
  float left   = texture2D(u_mask, camUv - vec2(texel.x * 2.0, 0.0)).r;
  float right  = texture2D(u_mask, camUv + vec2(texel.x * 2.0, 0.0)).r;
  float top    = texture2D(u_mask, camUv + vec2(0.0, texel.y * 2.0)).r;
  float bottom = texture2D(u_mask, camUv - vec2(0.0, texel.y * 2.0)).r;
  float edge = clamp(length(vec2(right - left, top - bottom)) * 2.5, 0.0, 1.0);

  // Soft pulsating bloom breathing
  float pulse = 0.85 + 0.15 * sin(u_time * 4.0);
  vec3 auraColor = baseColor * edge * 2.0 * pulse;

  // 4. Cosmic Fill (stars, flowing energy nebula inside silhouette)
  vec3 cosmicColor = vec3(0.0);
  if (maskVal > 0.3) {
    float n = noise(camUv * 12.0 + vec2(u_time * 0.1, -u_time * 0.08));
    float stars = pow(hash(camUv * 60.0 + floor(u_time * 2.0)), 18.0) * 2.5;
    vec3 nebulaColor = hsv2rgb(vec3(fract(n + u_time * 0.05), 0.8, 0.9));
    cosmicColor = (nebulaColor * 0.6 + vec3(stars)) * maskVal;
  }

  // 5. Motion Echo Trail color
  vec3 echoColor = vec3(0.0);
  if (trailVal > 0.05) {
    vec3 trailTint = u_rainbow ? hsv2rgb(vec3(fract(u_time * 0.1 + 0.3), 0.85, 0.85)) : baseColor * 0.7;
    echoColor = trailTint * trailVal * 0.8;
  }

  // 6. Combine active visual effects according to preset
  vec3 finalColor = vec3(0.0);

  if (u_effect == 0) { // Neon Aura
    finalColor = auraColor + (baseColor * maskVal * 0.15);
  } else if (u_effect == 1) { // Cosmic Fill
    finalColor = cosmicColor + auraColor * 0.5;
  } else if (u_effect == 2) { // Motion Echo Trails
    finalColor = echoColor + (auraColor * 0.7);
  } else if (u_effect == 3) { // Edge Sparks
    finalColor = auraColor * 1.5 + (baseColor * edge);
  } else { // Combined
    finalColor = auraColor + cosmicColor + echoColor;
  }

  gl_FragColor = vec4(finalColor * edgeMask, 1.0);
}
`

export function SilhouetteFX() {
  const trackingDataRef = useTracker()
  const { viewport } = useThree()

  const calibrationCorners = useStore((state) => state.calibrationCorners)
  const silhouetteEffect = useStore((state) => state.silhouetteEffect)
  const silhouetteColor = useStore((state) => state.silhouetteColor)
  const silhouetteRainbow = useStore((state) => state.silhouetteRainbow)
  const silhouetteTrailDecay = useStore((state) => state.silhouetteTrailDecay)

  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Offscreen canvas for immediate mask updates
  const maskCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 180
    return c
  }, [])

  // Offscreen canvas for decaying echo trails
  const trailCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 180
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, c.width, c.height)
    }
    return c
  }, [])

  const maskTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(maskCanvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    return tex
  }, [maskCanvas])

  const trailTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(trailCanvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    return tex
  }, [trailCanvas])

  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastMaskSrc = useRef<string>('')
  const lastBitmap = useRef<ImageBitmap | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const ctx = maskCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height)
        maskTexture.needsUpdate = true
      }
    }
    imgRef.current = img
  }, [maskCanvas, maskTexture])

  // Shader Uniforms Memo
  const uniforms = useMemo(() => ({
    u_mask: { value: maskTexture },
    u_trail: { value: trailTexture },
    u_coeffsX: { value: new THREE.Vector3(1, 0, 0) },
    u_coeffsY: { value: new THREE.Vector3(0, 1, 0) },
    u_coeffsW: { value: new THREE.Vector3(0, 0, 1) },
    u_color: { value: new THREE.Color(silhouetteColor) },
    u_time: { value: 0 },
    u_effect: { value: 4 }, // 4: combined
    u_rainbow: { value: false }
  }), [maskTexture, trailTexture])

  // Update Homography projection coefficients
  useFrame((state, delta) => {
    if (!materialRef.current) return

    materialRef.current.uniforms.u_time.value = state.clock.elapsedTime
    materialRef.current.uniforms.u_color.value.set(silhouetteColor)
    materialRef.current.uniforms.u_rainbow.value = silhouetteRainbow

    const effectMap: { [key: string]: number } = {
      aura: 0,
      cosmic: 1,
      echo: 2,
      sparks: 3,
      combined: 4
    }
    materialRef.current.uniforms.u_effect.value = effectMap[silhouetteEffect] ?? 4

    // Calculate screen-to-camera homography mapping
    if (calibrationCorners && calibrationCorners.length === 4) {
      const srcPts = [
        calibrationCorners[0].x, calibrationCorners[0].y,
        calibrationCorners[1].x, calibrationCorners[1].y,
        calibrationCorners[2].x, calibrationCorners[2].y,
        calibrationCorners[3].x, calibrationCorners[3].y
      ]
      const dstPts = [0, 0, 1, 0, 1, 1, 0, 1]
      const p = PerspT(dstPts, srcPts)
      if (p && p.coeffs) {
        materialRef.current.uniforms.u_coeffsX.value.set(p.coeffs[0], p.coeffs[1], p.coeffs[2])
        materialRef.current.uniforms.u_coeffsY.value.set(p.coeffs[3], p.coeffs[4], p.coeffs[5])
        materialRef.current.uniforms.u_coeffsW.value.set(p.coeffs[6], p.coeffs[7], p.coeffs[8])
      }
    }

    // Process incoming mask (prefer binary ImageBitmap, fallback to base64 mask)
    const currentBitmap = trackingDataRef.current.maskBitmap
    const currentMask = trackingDataRef.current.mask

    if (currentBitmap && currentBitmap !== lastBitmap.current) {
      lastBitmap.current = currentBitmap
      const mCtx = maskCanvas.getContext('2d')
      if (mCtx) {
        mCtx.drawImage(currentBitmap, 0, 0, maskCanvas.width, maskCanvas.height)
        maskTexture.needsUpdate = true
      }

      // Decay and stamp on trail canvas
      const tCtx = trailCanvas.getContext('2d')
      if (tCtx) {
        tCtx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.02, 1.0 - silhouetteTrailDecay)})`
        tCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)

        tCtx.globalCompositeOperation = 'lighter'
        tCtx.drawImage(maskCanvas, 0, 0)
        tCtx.globalCompositeOperation = 'source-over'
        trailTexture.needsUpdate = true
      }
    } else if (currentMask && currentMask !== lastMaskSrc.current && imgRef.current) {
      lastMaskSrc.current = currentMask
      imgRef.current.src = currentMask

      // Decay and stamp on trail canvas
      const tCtx = trailCanvas.getContext('2d')
      if (tCtx) {
        tCtx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.02, 1.0 - silhouetteTrailDecay)})`
        tCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)

        tCtx.globalCompositeOperation = 'lighter'
        tCtx.drawImage(maskCanvas, 0, 0)
        tCtx.globalCompositeOperation = 'source-over'
        trailTexture.needsUpdate = true
      }
    } else {
      // Continue fading trail even when no new frame arrives
      const tCtx = trailCanvas.getContext('2d')
      if (tCtx) {
        tCtx.fillStyle = `rgba(0, 0, 0, ${delta * 1.5 * (1.0 - silhouetteTrailDecay + 0.05)})`
        tCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)
        trailTexture.needsUpdate = true
      }
    }
  })

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={false}
        depthWrite={false}
      />
    </mesh>
  )
}
