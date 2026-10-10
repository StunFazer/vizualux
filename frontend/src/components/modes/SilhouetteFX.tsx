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
uniform int u_effect;
uniform bool u_rainbow;

varying vec2 vUv;

// Simple procedural hash and noise
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

vec2 voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash(n + g + vec2(1.23, 4.56)) * 0.5 + 0.25;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mg = g;
      }
    }
  }
  return vec2(sqrt(md), hash(n + mg));
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

  // Zone clipping & soft vignette margin: fade smoothly at boundary
  if (camUv.x < -0.05 || camUv.x > 1.05 || camUv.y < -0.05 || camUv.y > 1.05) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float margin = 0.02;
  float edgeX = smoothstep(0.0, margin, camUv.x) * (1.0 - smoothstep(1.0 - margin, 1.0, camUv.x));
  float edgeY = smoothstep(0.0, margin, camUv.y) * (1.0 - smoothstep(1.0 - margin, 1.0, camUv.y));
  float edgeMask = clamp(edgeX * edgeY, 0.0, 1.0);

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

  // 6. Liquid Chrome / Molten Mercury
  vec3 chromeColor = vec3(0.0);
  if (maskVal > 0.2) {
    vec3 normal = normalize(vec3((right - left) * 5.0, (top - bottom) * 5.0, 1.0));
    vec3 viewDir = normalize(vec3(camUv - 0.5, 0.8));
    vec3 refl = reflect(-viewDir, normal);
    float spec = pow(max(0.0, dot(refl, vec3(0.577))), 16.0);
    float sheen = sin(refl.x * 10.0 + u_time * 2.0) * cos(refl.y * 10.0 - u_time * 2.0);
    vec3 metallic = mix(vec3(0.85, 0.9, 1.0), baseColor, 0.3) * (0.6 + 0.4 * sheen) + vec3(spec * 1.5);
    chromeColor = metallic * maskVal;
  }

  // 7. Digital Matrix Rain
  vec3 matrixColor = vec3(0.0);
  if (maskVal > 0.2) {
    vec2 mGrid = floor(camUv * vec2(45.0, 30.0));
    float speed = hash(vec2(mGrid.x, 3.14)) * 3.0 + 1.5;
    float drop = fract(camUv.y * 1.8 - u_time * speed * 0.15 + hash(vec2(mGrid.x, 7.89)));
    float head = smoothstep(0.88, 1.0, drop);
    float body = pow(drop, 3.5);
    vec3 greenPhosphor = mix(vec3(0.0, 1.0, 0.3), vec3(0.8, 1.0, 0.9), head);
    matrixColor = (greenPhosphor * head * 2.2 + vec3(0.0, 0.8, 0.2) * body) * maskVal;
    matrixColor *= (0.8 + 0.2 * sin(camUv.y * 380.0));
  }

  // 8. Plasma Forcefield
  vec3 forcefieldColor = vec3(0.0);
  if (maskVal > 0.15) {
    float wave = sin(length(camUv - 0.5) * 22.0 - u_time * 6.0);
    float hexGrid = sin(camUv.x * 50.0) * sin(camUv.y * 50.0 + camUv.x * 25.0);
    float fieldMesh = smoothstep(0.4, 0.9, hexGrid);
    vec3 shield = mix(baseColor, vec3(0.1, 0.9, 1.0), wave * 0.5 + 0.5);
    forcefieldColor = (shield * fieldMesh * 0.8 + baseColor * edge * 2.2) * maskVal;
  }

  // 9. Spectral X-Ray & Ghost
  vec3 xrayColor = vec3(0.0);
  if (maskVal > 0.15) {
    float innerGlow = pow(1.0 - edge, 3.5) * maskVal;
    vec3 rimGlow = mix(vec3(0.1, 0.8, 1.0), vec3(0.9, 0.2, 1.0), edge);
    xrayColor = (vec3(0.02, 0.08, 0.25) * innerGlow + rimGlow * pow(edge, 0.6) * 2.5);
  }

  // 10. Stained Glass Voronoi
  vec3 stainedGlassColor = vec3(0.0);
  if (maskVal > 0.2) {
    vec2 vData = voronoi(camUv * 16.0);
    float cellBorder = smoothstep(0.08, 0.14, vData.x);
    vec3 cellHue = hsv2rgb(vec3(fract(vData.y + u_time * 0.03), 0.85, 0.95));
    stainedGlassColor = (cellHue * cellBorder + vec3(0.05, 0.05, 0.08) * (1.0 - cellBorder)) * maskVal + baseColor * edge * 1.5;
  }

  // 11. Prismatic RGB Chrono Dispersion Trails
  vec3 prismaticTrail = vec3(0.0);
  if (trailVal > 0.03) {
    float split = 0.012;
    float rT = texture2D(u_trail, camUv + vec2(split, 0.0)).r;
    float gT = texture2D(u_trail, camUv).r;
    float bT = texture2D(u_trail, camUv - vec2(split, 0.0)).r;
    prismaticTrail = vec3(rT * 1.2, gT * 1.0, bT * 1.4) * 0.9;
  }

  // 12. Thermal Flame & Billowing Smoke
  vec3 flameTrail = vec3(0.0);
  if (trailVal > 0.03) {
    float heat = clamp(trailVal * 1.4, 0.0, 1.0);
    vec3 fire = mix(vec3(0.1, 0.0, 0.05), vec3(1.0, 0.2, 0.0), smoothstep(0.05, 0.45, heat));
    fire = mix(fire, vec3(1.0, 0.95, 0.3), smoothstep(0.45, 0.85, heat));
    flameTrail = fire * (0.8 + 0.2 * noise(camUv * 15.0 + vec2(0.0, -u_time * 3.0)));
  }

  // 13. Cyber Glitch & Hologram Scanline Trails
  vec3 glitchTrail = vec3(0.0);
  if (trailVal > 0.03) {
    float slice = floor(camUv.y * 40.0);
    float j = (hash(vec2(slice, floor(u_time * 16.0))) - 0.5) * 0.035;
    float gVal = texture2D(u_trail, camUv + vec2(j, 0.0)).r;
    vec3 gTint = mix(vec3(0.0, 1.0, 0.8), vec3(1.0, 0.0, 0.5), fract(slice * 0.1));
    glitchTrail = gTint * gVal * (0.6 + 0.4 * sin(camUv.y * 280.0));
  }

  // 14. Luminous Light Ribbons
  vec3 ribbonTrail = vec3(0.0);
  if (trailVal > 0.02) {
    float rib = pow(trailVal, 0.7);
    vec3 ribColor = hsv2rgb(vec3(fract(camUv.x * 0.5 + camUv.y * 0.5 + u_time * 0.1), 0.8, 1.0));
    ribbonTrail = ribColor * rib * 1.2;
  }

  // Combine active visual effects according to preset
  vec3 finalColor = vec3(0.0);

  if (u_effect == 0) { // Neon Aura
    finalColor = auraColor + (baseColor * maskVal * 0.15);
  } else if (u_effect == 1) { // Cosmic Fill
    finalColor = cosmicColor + auraColor * 0.5;
  } else if (u_effect == 2) { // Motion Echo Trails
    finalColor = echoColor + (auraColor * 0.7);
  } else if (u_effect == 3) { // Edge Sparks
    finalColor = auraColor * 1.5 + (baseColor * edge);
  } else if (u_effect == 4) { // Combined
    finalColor = auraColor + cosmicColor + echoColor;
  } else if (u_effect == 5) { // Liquid Chrome
    finalColor = chromeColor + auraColor * 0.8;
  } else if (u_effect == 6) { // Digital Matrix Rain
    finalColor = matrixColor + auraColor * 0.7;
  } else if (u_effect == 7) { // Plasma Forcefield
    finalColor = forcefieldColor;
  } else if (u_effect == 8) { // Spectral X-Ray
    finalColor = xrayColor;
  } else if (u_effect == 9) { // Stained Glass Mosaic
    finalColor = stainedGlassColor;
  } else if (u_effect == 10) { // Prismatic RGB Dispersion Trails
    finalColor = prismaticTrail + auraColor * 0.7;
  } else if (u_effect == 11) { // Thermal Flame & Smoke Trails
    finalColor = flameTrail + auraColor * 0.5;
  } else if (u_effect == 12) { // Cyber Glitch Scanline Trails
    finalColor = glitchTrail + auraColor * 0.6;
  } else if (u_effect == 13) { // Luminous Light Ribbons
    finalColor = ribbonTrail + auraColor * 0.6;
  } else {
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
  }), [maskTexture, trailTexture, silhouetteColor])

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
      combined: 4,
      chrome: 5,
      matrix: 6,
      forcefield: 7,
      xray: 8,
      stainedglass: 9,
      prismatic: 10,
      flame: 11,
      glitch: 12,
      ribbon: 13
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
