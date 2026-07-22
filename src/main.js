import { MotionDetector } from './motion.js';
import { MediaPipeDetector } from './mediapipe.js';
import { MotionReveal } from './reveal.js';
import { PaintSplatter } from './paint.js';
import { LiquidRipples } from './ripples.js';
import { FloorPong } from './pong.js';
import { AsteroidsDefense } from './asteroids.js';
import { Homography } from './homography.js';
import { ScatterEffect } from './scatter.js';
import { KoiPond } from './koi.js';
import { SmokeTrails } from './smoke.js';
import { ZenGarden } from './garden.js';
import { FootprintsEffect } from './footprints.js';
import { BreakingIce } from './breaking_ice.js';
import { LiquidSand } from './sand.js';
import { HarmonographEffect } from './harmonograph.js';
import { BioluminescentStorm } from './storm.js';
import { PixieDust } from './pixie_dust.js';
import { setEnabled as setAudioEnabled, getEnabled as getAudioEnabled, setVolume as setAudioVolume, getVolume as getAudioVolume, getAnalyser } from './audio.js';

// Safe Local Storage access wrappers to prevent crashes if storage/cookies are blocked/disabled
function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("Storage read blocked for key:", key, e);
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("Storage write blocked for key:", key, e);
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("Storage delete blocked for key:", key, e);
  }
}

function safeAddListener(elementOrId, event, callback) {
  try {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) {
      el.addEventListener(event, callback);
      return el;
    }
  } catch (e) {
    console.warn("Failed to bind event listener:", event, elementOrId, e);
  }
  return null;
}

function setValText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

let lastFpsTime = performance.now();
let lastFrameTime = performance.now();
let frameCount = 0;
// Motion Tracking
let motionDetector = null;
let mediaPipeDetector = null;
let activeDetectionMode = 'classic';
let aiDebugEnabled = false;
let motionReveal = null;
let paintSplatter = null;
let liquidRipples = null;
let floorPong = null;
let asteroidsDefense = null;
let scatterEffect = null;
let koiPond = null;
let smokeTrails = null;
let zenGarden = null;
let footprintsEffect = null;
let breakingIce = null;
let liquidSand = null;
let harmonograph = null;
let bioluminescentStorm = null;
let pixieDust = null;

// Dynamic parameters state tracking
let dynamicDamping = 0.98;
let dynamicRippleSize = 3;
let dynamicFishCount = 18;
let dynamicLilyPadCount = 6;
let dynamicMaxParticles = 300;
let dynamicSmokeLifetime = 150;
let dynamicSmokeWind = 0;
let dynamicPongBallSpeed = 8;
let dynamicPongPaddleSize = 140;
let dynamicAsteroidsSpawnRate = 60;
let dynamicAsteroidsSpeed = 1.0;
let dynamicGardenBloomSize = 1.0;
let dynamicGardenLifetime = 1.0;
let dynamicGardenBloomSpeed = 1.0;
let dynamicPixieGravity = 0.4;
let dynamicPixieDrift = 0.8;
let dynamicPixieLimit = 600;
let dynamicSandFlowRate = 4;
let dynamicSandGravity = 1;
let dynamicHarmonoFriction = 0.005;
let dynamicHarmonoSpeed = 1.0;
let dynamicHarmonoThickness = 2.0;
let dynamicStormRainDensity = 150;
let dynamicStormLightningFrequency = 35;
let dynamicStormLightningIntensity = 70;
let homography = new Homography();

let activeEffect = 'koi';
let currentSensitivity = 30;
let isRunning = true;
let isBlackout = false;
let autoRotateEnabled = false;
let autoRotateInterval = 30; // seconds
let lastRotateTime = 0;
let topImageObj = null;
let bgImageObj = null;
let projectorWindow = null;
let scatterObjectURL = null;

let projectorCanvas1 = null;
let projectorCanvas2 = null;
let isHostPresentationActive = false;
let prevProjectorWindow = null;
let prevProjectorCanvas1 = null;
let prevProjectorCanvas2 = null;
let wakeLock = null;
let activeCanvasIndex = 1;
let currentEffectObj = null;

let transitionState = {
  active: false,
  fromEffect: null,
  fromCanvasIndex: 0,
  toEffect: null,
  toCanvasIndex: 0,
  startTime: 0,
  fromEffectName: null,
  toEffectName: null
};

function instantiateEffect(effectName, canvas) {
  let effect = null;
  switch (effectName) {
    case 'reveal':
      effect = new MotionReveal(canvas);
      effect.setImages(topImageObj, bgImageObj);
      motionReveal = effect;
      break;
    case 'paint':
      effect = new PaintSplatter(canvas);
      paintSplatter = effect;
      break;
    case 'ripples':
      effect = new LiquidRipples(canvas);
      effect.damping = dynamicDamping;
      effect.rippleSize = dynamicRippleSize;
      liquidRipples = effect;
      break;
    case 'pong':
      effect = new FloorPong(canvas);
      if (effect.ball) {
        effect.ball.baseSpeed = dynamicPongBallSpeed;
        effect.ball.maxSpeed = dynamicPongBallSpeed * 3;
      }
      if (effect.paddles) {
        effect.paddles.height = dynamicPongPaddleSize;
      }
      floorPong = effect;
      break;
    case 'asteroids':
      effect = new AsteroidsDefense(canvas);
      effect.spawnRate = dynamicAsteroidsSpawnRate;
      effect.asteroidSpeedScale = dynamicAsteroidsSpeed;
      asteroidsDefense = effect;
      break;
    case 'scatter':
      effect = new ScatterEffect(canvas, getAssetUrl('leaf.svg'));
      scatterEffect = effect;
      applyScatterSettings();
      break;
    case 'smoke':
      effect = new SmokeTrails(canvas);
      if (smokePresetSelect) {
        effect.setPalette(smokePresetSelect.value);
      }
      effect.maxParticles = dynamicMaxParticles;
      effect.particleLifetime = dynamicSmokeLifetime;
      effect.windX = dynamicSmokeWind;
      smokeTrails = effect;
      break;
    case 'koi':
      effect = new KoiPond(canvas);
      if (koiPresetSelect) {
        effect.applyPreset(koiPresetSelect.value);
      }
      effect.setFishCount(dynamicFishCount);
      effect.setLilyPadCount(dynamicLilyPadCount);
      koiPond = effect;
      break;
    case 'garden':
      effect = new ZenGarden(canvas);
      effect.bloomSize = dynamicGardenBloomSize;
      effect.flowerLifetime = dynamicGardenLifetime;
      effect.bloomSpeed = dynamicGardenBloomSpeed;
      zenGarden = effect;
      break;
    case 'footprints':
      effect = new FootprintsEffect(canvas);
      if (footprintsPresetSelect) {
        effect.setPreset(footprintsPresetSelect.value);
      }
      footprintsEffect = effect;
      break;
    case 'ice':
      effect = new BreakingIce(canvas);
      if (icePresetSelect) {
        effect.setPreset(icePresetSelect.value);
      }
      breakingIce = effect;
      break;
    case 'sand':
      effect = new LiquidSand(canvas);
      if (sandPresetSelect) {
        effect.setPreset(sandPresetSelect.value);
      }
      effect.setFlowRate(dynamicSandFlowRate);
      effect.setGravity(dynamicSandGravity);
      liquidSand = effect;
      break;
    case 'harmonograph':
      effect = new HarmonographEffect(canvas);
      if (harmonographPresetSelect) {
        effect.setPreset(harmonographPresetSelect.value);
      }
      effect.setCurveFriction(dynamicHarmonoFriction);
      effect.setPendulumSpeed(dynamicHarmonoSpeed);
      effect.setLineThickness(dynamicHarmonoThickness);
      harmonograph = effect;
      break;
    case 'storm':
      effect = new BioluminescentStorm(canvas);
      if (stormPresetSelect) {
        effect.setPreset(stormPresetSelect.value);
      }
      effect.setRainDensity(dynamicStormRainDensity);
      effect.setLightningFrequency(dynamicStormLightningFrequency);
      effect.setLightningIntensity(dynamicStormLightningIntensity);
      bioluminescentStorm = effect;
      break;
    case 'pixie':
      effect = new PixieDust(canvas);
      effect.gravity = dynamicPixieGravity;
      effect.drift = dynamicPixieDrift;
      effect.particleCountLimit = dynamicPixieLimit;
      pixieDust = effect;
      break;
  }
  return effect;
}

function destroyEffect(effectName) {
  switch (effectName) {
    case 'reveal':
      if (motionReveal) { motionReveal.destroy(); motionReveal = null; }
      break;
    case 'paint':
      if (paintSplatter) { paintSplatter.destroy(); paintSplatter = null; }
      break;
    case 'ripples':
      if (liquidRipples) { liquidRipples.destroy(); liquidRipples = null; }
      break;
    case 'pong':
      if (floorPong) { floorPong.destroy(); floorPong = null; }
      break;
    case 'asteroids':
      if (asteroidsDefense) { asteroidsDefense.destroy(); asteroidsDefense = null; }
      break;
    case 'scatter':
      if (scatterEffect) { scatterEffect.destroy(); scatterEffect = null; }
      break;
    case 'smoke':
      if (smokeTrails) { smokeTrails.destroy(); smokeTrails = null; }
      break;
    case 'koi':
      if (koiPond) { koiPond.destroy(); koiPond = null; }
      break;
    case 'garden':
      if (zenGarden) { zenGarden.destroy(); zenGarden = null; }
      break;
      if (footprintsEffect) { footprintsEffect.destroy(); footprintsEffect = null; }
      break;
      if (liquidSand) { liquidSand.destroy(); liquidSand = null; }
      break;
      if (pixieDust) { pixieDust.destroy(); pixieDust = null; }
      break;
  }
}

function changeEffectWithTransition(nextEffect) {
  if (activeEffect === nextEffect) return;
  
  if (transitionState.active) {
    completeTransitionImmediately();
  }
  
  if (!projectorWindow || projectorWindow.closed || !projectorCanvas1 || !projectorCanvas2) {
    activeEffect = nextEffect;
    if (effectSelect) effectSelect.value = activeEffect;
    updateVisibility();
    renderDynamicParameters();
    saveSettings();
    return;
  }

  const fromEffectName = activeEffect;
  const toEffectName = nextEffect;
  const fromCanvasIndex = activeCanvasIndex;
  const toCanvasIndex = activeCanvasIndex === 1 ? 2 : 1;
  const toCanvas = toCanvasIndex === 1 ? projectorCanvas1 : projectorCanvas2;

  // Clear target canvas before initializing to prevent visual pops
  const toCtx = toCanvas.getContext('2d');
  toCtx.clearRect(0, 0, toCanvas.width, toCanvas.height);

  const fromEffect = currentEffectObj;
  const toEffect = instantiateEffect(toEffectName, toCanvas);
  if (toEffect && typeof toEffect.init === 'function') {
    toEffect.init();
  }

  activeEffect = nextEffect;
  if (effectSelect) effectSelect.value = activeEffect;
  updateVisibility();
  renderDynamicParameters();
  saveSettings();

  transitionState = {
    active: true,
    fromEffect: fromEffect,
    fromCanvasIndex: fromCanvasIndex,
    toEffect: toEffect,
    toCanvasIndex: toCanvasIndex,
    startTime: performance.now(),
    fromEffectName: fromEffectName,
    toEffectName: toEffectName
  };

  activeCanvasIndex = toCanvasIndex;
  currentEffectObj = toEffect;

  if (typeof projectorWindow.triggerTransition === 'function') {
    projectorWindow.triggerTransition(toCanvasIndex);
  }
}

function completeTransitionImmediately() {
  if (!transitionState.active) return;
  
  destroyEffect(transitionState.fromEffectName);
  
  // Ensure clean final opacities
  if (projectorCanvas1) projectorCanvas1.style.opacity = activeCanvasIndex === 1 ? '1' : '0';
  if (projectorCanvas2) projectorCanvas2.style.opacity = activeCanvasIndex === 2 ? '1' : '0';
  
  transitionState.active = false;
  transitionState.fromEffect = null;
  transitionState.toEffect = null;
}

function getProjectorUrl() {
  const scripts = document.getElementsByTagName('script');
  let isRawMode = false;
  let isViteDev = false;
  
  for (let s of scripts) {
    const src = s.getAttribute('src') || '';
    if (src.includes('src/main.js')) {
      isRawMode = true;
    }
    if (src.includes('@vite/client') || s.src.includes('@vite/client')) {
      isViteDev = true;
    }
  }

  if (!isViteDev) {
    isViteDev = !!document.querySelector('script[src*="/@vite/client"]') || 
                !!document.querySelector('script[src*="vite"]');
  }

  const pathParts = window.location.pathname.split('/');
  pathParts.pop();
  const basePath = pathParts.join('/');
  const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';

  if (isRawMode && !isViteDev) {
    return normalizedBase + 'public/projector.html';
  }
  return normalizedBase + 'projector.html';
}

function getAssetUrl(path) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const scripts = document.getElementsByTagName('script');
  let isRawMode = false;
  let isViteDev = false;
  
  for (let s of scripts) {
    const src = s.getAttribute('src') || '';
    if (src.includes('src/main.js')) {
      isRawMode = true;
    }
    if (src.includes('@vite/client') || s.src.includes('@vite/client')) {
      isViteDev = true;
    }
  }

  if (!isViteDev) {
    isViteDev = !!document.querySelector('script[src*="/@vite/client"]') || 
                !!document.querySelector('script[src*="vite"]');
  }

  const pathParts = window.location.pathname.split('/');
  pathParts.pop();
  const basePath = pathParts.join('/');
  const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';

  if (isRawMode && !isViteDev) {
    return normalizedBase + 'public/' + cleanPath;
  }
  return normalizedBase + cleanPath;
}

// DOM Elements
let videoEl = null;
let debugCanvas = null;
let adminPanel = null;
let cameraSelect = null;
let isCalibScreenActive = false;
let projectorCanvas = null;
let startCameraBtn = null;
let captureBgBtn = null;
let openProjectorBtn = null;
let blackoutBtn = null;
let undoWarpBtn = null;
let redoWarpBtn = null;
let calibrationHistory = [];
let historyIndex = -1;
let effectSelect = null;
let topLayerUpload = null;
let bgLayerUpload = null;
let scatterUpload = null;
let revealControls = null;
let scatterControls = null;
let scatterPresetSelect = null;
let scatterPresetGroup = null;
let smokePresetSelect = null;
let smokePresetGroup = null;
let koiPresetSelect = null;
let koiPresetGroup = null;
let footprintsPresetSelect = null;
let footprintsPresetGroup = null;
let icePresetSelect = null;
let icePresetGroup = null;
let sandPresetSelect = null;
let sandPresetGroup = null;
let harmonographPresetSelect = null;
let harmonographPresetGroup = null;
let stormPresetSelect = null;
let stormPresetGroup = null;

let scatterQtyInput = null;
let scatterQtyVal = null;
let scatterSizeInput = null;
let scatterSizeVal = null;
let scatterMovementInput = null;
let scatterMovementVal = null;

// Automation Elements
let autoRotateCheckbox = null;
let rotateIntervalInput = null;
let rotateIntervalVal = null;
let playlistScrollContainer = null;

// Performance & Optimization
let renderResolutionScale = 1.0;
let fpsLimit = 'uncapped';
let resolutionScaleSelect = null;
let fpsLimitSelect = null;

// Simulated Auto-Motion Input
let autoMotionEnabled = false;
let autoMotionCheckbox = null;
let playlist = [
  { name: 'koi', label: 'Koi Pond', enabled: true, duration: 30 },
  { name: 'garden', label: 'Zen Garden', enabled: true, duration: 30 },
  { name: 'ripples', label: 'Ripples', enabled: true, duration: 30 },
  { name: 'harmonograph', label: 'Harmonograph', enabled: true, duration: 30 },
  { name: 'storm', label: 'Bioluminescent Storm', enabled: true, duration: 30 },
  { name: 'pixie', label: 'Pixie Dust', enabled: true, duration: 30 },
  { name: 'paint', label: 'Paint', enabled: true, duration: 30 },
  { name: 'reveal', label: 'Reveal', enabled: true, duration: 30 },
  { name: 'pong', label: 'Pong', enabled: true, duration: 30 },
  { name: 'asteroids', label: 'Asteroids', enabled: true, duration: 30 },
  { name: 'footprints', label: 'Footprints', enabled: true, duration: 30 },
  { name: 'ice', label: 'Breaking Ice', enabled: true, duration: 30 }
];

// Audio Elements
let soundToggle = null;
let volumeSlider = null;
let volumeVal = null;
let equalizerBars = null;

// Active Effect Details Card Elements
let detailEffectName = null;
let detailEffectDesc = null;
let detailEffectInteraction = null;
let detailShortcutBadge = null;

// Calibration Points
let calibPoints = [];

function queryElements() {
  videoEl = document.getElementById('camera-feed');
  debugCanvas = document.getElementById('motion-debug-canvas');
  adminPanel = document.getElementById('admin-panel');
  cameraSelect = document.getElementById('camera-select');
  // calibScreen removed — using isCalibScreenActive boolean instead
  startCameraBtn = document.getElementById('start-camera-btn');
  captureBgBtn = document.getElementById('capture-bg-btn');
  openProjectorBtn = document.getElementById('open-projector-btn');
  blackoutBtn = document.getElementById('blackout-btn');
  undoWarpBtn = document.getElementById('undo-warp-btn');
  redoWarpBtn = document.getElementById('redo-warp-btn');
  effectSelect = document.getElementById('effect-select');
  topLayerUpload = document.getElementById('top-layer-upload');
  bgLayerUpload = document.getElementById('bg-layer-upload');
  scatterUpload = document.getElementById('scatter-upload');
  revealControls = document.getElementById('reveal-controls');
  scatterControls = document.getElementById('scatter-controls');
  scatterPresetSelect = document.getElementById('scatter-preset-select');
  scatterPresetGroup = document.getElementById('scatter-preset-group');
  smokePresetSelect = document.getElementById('smoke-preset-select');
  smokePresetGroup = document.getElementById('smoke-preset-group');
  koiPresetSelect = document.getElementById('koi-preset-select');
  koiPresetGroup = document.getElementById('koi-preset-group');
  footprintsPresetSelect = document.getElementById('footprints-preset-select');
  footprintsPresetGroup = document.getElementById('footprints-preset-group');
  icePresetSelect = document.getElementById('ice-preset-select');
  icePresetGroup = document.getElementById('ice-preset-group');
  sandPresetSelect = document.getElementById('sand-preset-select');
  sandPresetGroup = document.getElementById('sand-preset-group');
  harmonographPresetSelect = document.getElementById('harmonograph-preset-select');
  harmonographPresetGroup = document.getElementById('harmonograph-preset-group');
  stormPresetSelect = document.getElementById('storm-preset-select');
  stormPresetGroup = document.getElementById('storm-preset-group');

  scatterQtyInput = document.getElementById('scatter-qty');
  scatterQtyVal = document.getElementById('scatter-qty-val');
  scatterSizeInput = document.getElementById('scatter-size');
  scatterSizeVal = document.getElementById('scatter-size-val');
  scatterMovementInput = document.getElementById('scatter-movement');
  scatterMovementVal = document.getElementById('scatter-movement-val');

  autoRotateCheckbox = document.getElementById('auto-rotate-checkbox');
  playlistScrollContainer = document.getElementById('playlist-scroll-container');

  resolutionScaleSelect = document.getElementById('resolution-scale-select');
  fpsLimitSelect = document.getElementById('fps-limit-select');
  autoMotionCheckbox = document.getElementById('auto-motion-checkbox');

  soundToggle = document.getElementById('sound-toggle');
  volumeSlider = document.getElementById('volume-slider');
  volumeVal = document.getElementById('volume-val');
  equalizerBars = document.querySelectorAll('#audio-visualizer-mini .equalizer-bar');

  if (soundToggle) {
    soundToggle.checked = getAudioEnabled();
  }
  if (volumeSlider) {
    volumeSlider.value = Math.round(getAudioVolume() * 100);
  }
  if (volumeVal) {
    volumeVal.textContent = Math.round(getAudioVolume() * 100) + '%';
  }

  detailEffectName = document.getElementById('detail-effect-name');
  detailEffectDesc = document.getElementById('detail-effect-desc');
  detailEffectInteraction = document.getElementById('detail-effect-interaction');
  detailShortcutBadge = document.getElementById('detail-shortcut-badge');

  calibPoints = document.querySelectorAll('.calibration-point');
}
let calibData = [
  {x: 10, y: 10},
  {x: 90, y: 10},
  {x: 90, y: 90},
  {x: 10, y: 90}
];

function applyScatterSettings() {
  if (!scatterEffect) return;
  if (scatterQtyInput) scatterEffect.setQuantity(parseInt(scatterQtyInput.value));
  if (scatterSizeInput) scatterEffect.setSize(parseFloat(scatterSizeInput.value));
  if (scatterMovementInput) scatterEffect.setMovement(parseInt(scatterMovementInput.value));
  if (scatterObjectURL) {
    scatterEffect.setImage(scatterObjectURL);
  }
}

function initializeProjectorEffects(c1, c2) {
  destroyProjectorEffects();
  
  projectorCanvas1 = c1;
  projectorCanvas2 = c2;

  // Apply the width/height property patches to both canvases so we prevent duplicate clear flushes!
  [projectorCanvas1, projectorCanvas2].forEach(canvas => {
    if (canvas && !canvas._patched) {
      canvas._patched = true;
      try {
        const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

        Object.defineProperty(canvas, 'width', {
          get() {
            return widthDescriptor.get.call(this);
          },
          set(val) {
            const current = widthDescriptor.get.call(this);
            if (current !== val) {
              widthDescriptor.set.call(this, val);
            }
          },
          configurable: true
        });

        Object.defineProperty(canvas, 'height', {
          get() {
            return heightDescriptor.get.call(this);
          },
          set(val) {
            const current = heightDescriptor.get.call(this);
            if (current !== val) {
              heightDescriptor.set.call(this, val);
            }
          },
          configurable: true
        });
      } catch (e) {
        console.warn("Could not patch canvas size properties:", e);
      }
    }
  });

  activeCanvasIndex = 1;
  currentEffectObj = instantiateEffect(activeEffect, projectorCanvas1);
  if (currentEffectObj && typeof currentEffectObj.init === 'function') {
    currentEffectObj.init();
  }
  
  updateVisibility();
}

function destroyProjectorEffects() {
  const effectsList = ['reveal', 'paint', 'ripples', 'pong', 'asteroids', 'scatter', 'smoke', 'koi', 'garden', 'footprints', 'ice', 'sand'];
  effectsList.forEach(name => destroyEffect(name));
  
  currentEffectObj = null;
  projectorCanvas1 = null;
  projectorCanvas2 = null;
  transitionState = {
    active: false,
    fromEffect: null,
    fromCanvasIndex: 0,
    toEffect: null,
    toCanvasIndex: 0,
    startTime: 0,
    fromEffectName: null,
    toEffectName: null
  };
}

function updateSensitivityUI(val) {
  const roundedVal = Math.round(val / 10) * 10;
  
  const thresholdValLabel = document.getElementById('motion-threshold-val');
  if (thresholdValLabel) thresholdValLabel.textContent = roundedVal;
  
  const buttons = document.querySelectorAll('.btn-sens');
  buttons.forEach(btn => {
    const btnVal = parseInt(btn.getAttribute('data-value'));
    if (btnVal === roundedVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function updatePlaylistBtnState() {
  const playlistBtn = document.getElementById('playlist-btn');
  if (playlistBtn) {
    if (autoRotateEnabled) {
      playlistBtn.classList.add('active');
      playlistBtn.setAttribute('aria-pressed', 'true');
    } else {
      playlistBtn.classList.remove('active');
      playlistBtn.setAttribute('aria-pressed', 'false');
    }
  }
}

function renderDynamicParameters() {
  const container = document.getElementById('active-parameters');
  if (!container) return;

  container.innerHTML = '';

  if (activeEffect === 'ripples') {
    // 1. Damping
    const labelDamping = document.createElement('label');
    labelDamping.innerHTML = `Ripple Damping: <span id="param-damping-val">${dynamicDamping}</span>`;
    
    const sliderDamping = document.createElement('input');
    sliderDamping.type = 'range';
    sliderDamping.min = '90';
    sliderDamping.max = '99';
    sliderDamping.value = Math.round(dynamicDamping * 100);
    
    sliderDamping.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 100;
      setValText('param-damping-val', val.toFixed(2));
      dynamicDamping = val;
      if (liquidRipples) {
        liquidRipples.damping = val;
      }
      saveSettings();
    });

    // 2. Ripple Size
    const labelSize = document.createElement('label');
    labelSize.innerHTML = `Ripple Size: <span id="param-ripplesize-val">${dynamicRippleSize}</span>`;
    
    const sliderSize = document.createElement('input');
    sliderSize.type = 'range';
    sliderSize.min = '1';
    sliderSize.max = '8';
    sliderSize.value = dynamicRippleSize;
    
    sliderSize.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-ripplesize-val', val);
      dynamicRippleSize = val;
      if (liquidRipples) {
        liquidRipples.rippleSize = val;
      }
      saveSettings();
    });

    container.appendChild(labelDamping);
    container.appendChild(sliderDamping);
    container.appendChild(labelSize);
    container.appendChild(sliderSize);

  } else if (activeEffect === 'koi') {
    // Fish Count
    const labelFish = document.createElement('label');
    labelFish.innerHTML = `Fish Count: <span id="param-fish-val">${dynamicFishCount}</span>`;
    
    const sliderFish = document.createElement('input');
    sliderFish.type = 'range';
    sliderFish.min = '5';
    sliderFish.max = '40';
    sliderFish.value = dynamicFishCount;
    
    sliderFish.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-fish-val', val);
      dynamicFishCount = val;
      if (koiPond) {
        koiPond.setFishCount(val);
      }
      saveSettings();
    });

    // Lily Pad Count
    const labelLily = document.createElement('label');
    labelLily.innerHTML = `Lily Pad Count: <span id="param-lily-val">${dynamicLilyPadCount}</span>`;
    
    const sliderLily = document.createElement('input');
    sliderLily.type = 'range';
    sliderLily.min = '0';
    sliderLily.max = '15';
    sliderLily.value = dynamicLilyPadCount;
    
    sliderLily.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-lily-val', val);
      dynamicLilyPadCount = val;
      if (koiPond) {
        koiPond.setLilyPadCount(val);
      }
      saveSettings();
    });

    container.appendChild(labelFish);
    container.appendChild(sliderFish);
    container.appendChild(labelLily);
    container.appendChild(sliderLily);

  } else if (activeEffect === 'smoke') {
    // Lifetime
    const labelLifetime = document.createElement('label');
    labelLifetime.innerHTML = `Particle Lifetime: <span id="param-lifetime-val">${dynamicSmokeLifetime} frames</span>`;
    
    const sliderLifetime = document.createElement('input');
    sliderLifetime.type = 'range';
    sliderLifetime.min = '50';
    sliderLifetime.max = '300';
    sliderLifetime.value = dynamicSmokeLifetime;
    
    sliderLifetime.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-lifetime-val', val + ' frames');
      dynamicSmokeLifetime = val;
      if (smokeTrails) {
        smokeTrails.particleLifetime = val;
      }
      saveSettings();
    });

    // Wind
    const labelWind = document.createElement('label');
    labelWind.innerHTML = `Wind Drift: <span id="param-wind-val">${dynamicSmokeWind.toFixed(1)}</span>`;
    
    const sliderWind = document.createElement('input');
    sliderWind.type = 'range';
    sliderWind.min = '-15';
    sliderWind.max = '15';
    sliderWind.step = '1';
    sliderWind.value = Math.round(dynamicSmokeWind * 10);
    
    sliderWind.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 10;
      setValText('param-wind-val', val.toFixed(1));
      dynamicSmokeWind = val;
      if (smokeTrails) {
        smokeTrails.windX = val;
      }
      saveSettings();
    });

    container.appendChild(labelLifetime);
    container.appendChild(sliderLifetime);
    container.appendChild(labelWind);
    container.appendChild(sliderWind);

  } else if (activeEffect === 'pong') {
    // Ball Speed
    const labelBallSpeed = document.createElement('label');
    labelBallSpeed.innerHTML = `Ball Speed: <span id="param-ballspeed-val">${dynamicPongBallSpeed}</span>`;
    
    const sliderBallSpeed = document.createElement('input');
    sliderBallSpeed.type = 'range';
    sliderBallSpeed.min = '4';
    sliderBallSpeed.max = '20';
    sliderBallSpeed.value = dynamicPongBallSpeed;
    
    sliderBallSpeed.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-ballspeed-val', val);
      dynamicPongBallSpeed = val;
      if (floorPong && floorPong.ball) {
        floorPong.ball.baseSpeed = val;
        floorPong.ball.maxSpeed = val * 3;
      }
      saveSettings();
    });

    // Paddle Size
    const labelPaddleSize = document.createElement('label');
    labelPaddleSize.innerHTML = `Paddle Size: <span id="param-paddlesize-val">${dynamicPongPaddleSize}px</span>`;
    
    const sliderPaddleSize = document.createElement('input');
    sliderPaddleSize.type = 'range';
    sliderPaddleSize.min = '60';
    sliderPaddleSize.max = '240';
    sliderPaddleSize.value = dynamicPongPaddleSize;
    
    sliderPaddleSize.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-paddlesize-val', val + 'px');
      dynamicPongPaddleSize = val;
      if (floorPong && floorPong.paddles) {
        floorPong.paddles.height = val;
      }
      saveSettings();
    });

    container.appendChild(labelBallSpeed);
    container.appendChild(sliderBallSpeed);
    container.appendChild(labelPaddleSize);
    container.appendChild(sliderPaddleSize);

  } else if (activeEffect === 'asteroids') {
    // Asteroid Spawn Interval (labeled as Spawn Frequency)
    const labelSpawnRate = document.createElement('label');
    const displayVal = Math.round(135 - dynamicAsteroidsSpawnRate);
    labelSpawnRate.innerHTML = `Spawn Frequency: <span id="param-spawnrate-val">${displayVal}</span>`;
    
    const sliderSpawnRate = document.createElement('input');
    sliderSpawnRate.type = 'range';
    sliderSpawnRate.min = '15';
    sliderSpawnRate.max = '120';
    sliderSpawnRate.value = displayVal;
    
    sliderSpawnRate.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-spawnrate-val', val);
      dynamicAsteroidsSpawnRate = 135 - val;
      if (asteroidsDefense) {
        asteroidsDefense.spawnRate = 135 - val;
      }
      saveSettings();
    });

    // Asteroid Speed Scale
    const labelSpeed = document.createElement('label');
    labelSpeed.innerHTML = `Asteroid Speed: <span id="param-asteroids-speed-val">${dynamicAsteroidsSpeed.toFixed(1)}x</span>`;
    
    const sliderSpeed = document.createElement('input');
    sliderSpeed.type = 'range';
    sliderSpeed.min = '5';
    sliderSpeed.max = '30';
    sliderSpeed.step = '1';
    sliderSpeed.value = Math.round(dynamicAsteroidsSpeed * 10);
    
    sliderSpeed.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 10;
      setValText('param-asteroids-speed-val', val.toFixed(1) + 'x');
      dynamicAsteroidsSpeed = val;
      if (asteroidsDefense) {
        asteroidsDefense.asteroidSpeedScale = val;
      }
      saveSettings();
    });

    container.appendChild(labelSpawnRate);
    container.appendChild(sliderSpawnRate);
    container.appendChild(labelSpeed);
    container.appendChild(sliderSpeed);

  } else if (activeEffect === 'garden') {
    // Bloom Size
    const labelBloom = document.createElement('label');
    labelBloom.innerHTML = `Bloom Size: <span id="param-bloomsize-val">${dynamicGardenBloomSize.toFixed(1)}x</span>`;

    const sliderBloom = document.createElement('input');
    sliderBloom.type = 'range';
    sliderBloom.min = '5';
    sliderBloom.max = '25';
    sliderBloom.step = '1';
    sliderBloom.value = Math.round(dynamicGardenBloomSize * 10);

    sliderBloom.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 10;
      setValText('param-bloomsize-val', val.toFixed(1) + 'x');
      dynamicGardenBloomSize = val;
      if (zenGarden) zenGarden.bloomSize = val;
      saveSettings();
    });

    // Flower Lifetime
    const labelLife = document.createElement('label');
    labelLife.innerHTML = `Flower Lifetime: <span id="param-gardenlife-val">${dynamicGardenLifetime.toFixed(1)}x</span>`;

    const sliderLife = document.createElement('input');
    sliderLife.type = 'range';
    sliderLife.min = '3';
    sliderLife.max = '30';
    sliderLife.step = '1';
    sliderLife.value = Math.round(dynamicGardenLifetime * 10);

    sliderLife.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 10;
      setValText('param-gardenlife-val', val.toFixed(1) + 'x');
      dynamicGardenLifetime = val;
      if (zenGarden) zenGarden.flowerLifetime = val;
      saveSettings();
    });

    // Bloom Speed
    const labelSpeed = document.createElement('label');
    labelSpeed.innerHTML = `Bloom Speed: <span id="param-gardenspeed-val">${dynamicGardenBloomSpeed.toFixed(1)}x</span>`;

    const sliderSpeed = document.createElement('input');
    sliderSpeed.type = 'range';
    sliderSpeed.min = '3';
    sliderSpeed.max = '30';
    sliderSpeed.step = '1';
    sliderSpeed.value = Math.round(dynamicGardenBloomSpeed * 10);

    sliderSpeed.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 10;
      setValText('param-gardenspeed-val', val.toFixed(1) + 'x');
      dynamicGardenBloomSpeed = val;
      if (zenGarden) zenGarden.bloomSpeed = val;
      saveSettings();
    });

    container.appendChild(labelBloom);
    container.appendChild(sliderBloom);
    container.appendChild(labelLife);
    container.appendChild(sliderLife);
    container.appendChild(labelSpeed);
    container.appendChild(sliderSpeed);

  } else if (activeEffect === 'sand') {
    const labelFlow = document.createElement('label');
    labelFlow.innerHTML = `Sand Flow Rate: <span id="param-sandflow-val">${dynamicSandFlowRate}</span>`;
    
    const sliderFlow = document.createElement('input');
    sliderFlow.type = 'range';
    sliderFlow.min = '1';
    sliderFlow.max = '15';
    sliderFlow.value = dynamicSandFlowRate;
    
    sliderFlow.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-sandflow-val', val);
      dynamicSandFlowRate = val;
      if (liquidSand) {
        liquidSand.setFlowRate(val);
      }
      saveSettings();
    });

    const labelGravity = document.createElement('label');
    labelGravity.innerHTML = `Sand Flow Gravity: <span id="param-sandgravity-val">${dynamicSandGravity}</span>`;
    
    const sliderGravity = document.createElement('input');
    sliderGravity.type = 'range';
    sliderGravity.min = '1';
    sliderGravity.max = '5';
    sliderGravity.value = dynamicSandGravity;
    
    sliderGravity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-sandgravity-val', val);
      dynamicSandGravity = val;
      if (liquidSand) {
        liquidSand.setGravity(val);
      }
      saveSettings();
    });

    container.appendChild(labelFlow);
    container.appendChild(sliderFlow);
    container.appendChild(labelGravity);
    container.appendChild(sliderGravity);


  } else if (activeEffect === 'harmonograph') {
    const labelFriction = document.createElement('label');
    labelFriction.innerHTML = `Curve Friction: <span id="param-friction-val">${dynamicHarmonoFriction.toFixed(3)}</span>`;
    
    const sliderFriction = document.createElement('input');
    sliderFriction.type = 'range';
    sliderFriction.min = '0.001';
    sliderFriction.max = '0.020';
    sliderFriction.step = '0.001';
    sliderFriction.value = dynamicHarmonoFriction.toString();
    
    sliderFriction.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setValText('param-friction-val', val.toFixed(3));
      dynamicHarmonoFriction = val;
      if (harmonograph) {
        harmonograph.setCurveFriction(val);
      }
      saveSettings();
    });

    const labelSpeed = document.createElement('label');
    labelSpeed.innerHTML = `Pendulum Speed: <span id="param-speed-val">${dynamicHarmonoSpeed.toFixed(1)}x</span>`;
    
    const sliderSpeed = document.createElement('input');
    sliderSpeed.type = 'range';
    sliderSpeed.min = '0.2';
    sliderSpeed.max = '3.0';
    sliderSpeed.step = '0.1';
    sliderSpeed.value = dynamicHarmonoSpeed.toString();
    
    sliderSpeed.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setValText('param-speed-val', val.toFixed(1) + 'x');
      dynamicHarmonoSpeed = val;
      if (harmonograph) {
        harmonograph.setPendulumSpeed(val);
      }
      saveSettings();
    });

    const labelThickness = document.createElement('label');
    labelThickness.innerHTML = `Line Thickness: <span id="param-thickness-val">${dynamicHarmonoThickness.toFixed(1)}px</span>`;
    
    const sliderThickness = document.createElement('input');
    sliderThickness.type = 'range';
    sliderThickness.min = '0.5';
    sliderThickness.max = '8.0';
    sliderThickness.step = '0.5';
    sliderThickness.value = dynamicHarmonoThickness.toString();
    
    sliderThickness.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setValText('param-thickness-val', val.toFixed(1) + 'px');
      dynamicHarmonoThickness = val;
      if (harmonograph) {
        harmonograph.setLineThickness(val);
      }
      saveSettings();
    });

    container.appendChild(labelFriction);
    container.appendChild(sliderFriction);
    container.appendChild(labelSpeed);
    container.appendChild(sliderSpeed);
    container.appendChild(labelThickness);
    container.appendChild(sliderThickness);

  } else if (activeEffect === 'storm') {
    const labelRain = document.createElement('label');
    labelRain.innerHTML = `Rain Density: <span id="param-rain-val">${dynamicStormRainDensity}</span>`;
    
    const sliderRain = document.createElement('input');
    sliderRain.type = 'range';
    sliderRain.min = '20';
    sliderRain.max = '400';
    sliderRain.value = dynamicStormRainDensity;
    
    sliderRain.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-rain-val', val);
      dynamicStormRainDensity = val;
      if (bioluminescentStorm) {
        bioluminescentStorm.setRainDensity(val);
      }
      saveSettings();
    });

    const labelFreq = document.createElement('label');
    labelFreq.innerHTML = `Lightning Frequency: <span id="param-freq-val">${dynamicStormLightningFrequency}%</span>`;
    
    const sliderFreq = document.createElement('input');
    sliderFreq.type = 'range';
    sliderFreq.min = '5';
    sliderFreq.max = '90';
    sliderFreq.value = dynamicStormLightningFrequency;
    
    sliderFreq.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-freq-val', val + '%');
      dynamicStormLightningFrequency = val;
      if (bioluminescentStorm) {
        bioluminescentStorm.setLightningFrequency(val);
      }
      saveSettings();
    });

    const labelIntensity = document.createElement('label');
    labelIntensity.innerHTML = `Lightning Power: <span id="param-intensity-val">${dynamicStormLightningIntensity}%</span>`;
    
    const sliderIntensity = document.createElement('input');
    sliderIntensity.type = 'range';
    sliderIntensity.min = '10';
    sliderIntensity.max = '100';
    sliderIntensity.value = dynamicStormLightningIntensity;
    
    sliderIntensity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-intensity-val', val + '%');
      dynamicStormLightningIntensity = val;
      if (bioluminescentStorm) {
        bioluminescentStorm.setLightningIntensity(val);
      }
      saveSettings();
    });

    container.appendChild(labelRain);
    container.appendChild(sliderRain);
    container.appendChild(labelFreq);
    container.appendChild(sliderFreq);
    container.appendChild(labelIntensity);
    container.appendChild(sliderIntensity);

  } else if (activeEffect === 'pixie') {
    const labelGravity = document.createElement('label');
    labelGravity.innerHTML = `Pixie Gravity: <span id="param-pixie-gravity-val">${dynamicPixieGravity.toFixed(2)}</span>`;
    
    const sliderGravity = document.createElement('input');
    sliderGravity.type = 'range';
    sliderGravity.min = '0.05';
    sliderGravity.max = '1.50';
    sliderGravity.step = '0.05';
    sliderGravity.value = dynamicPixieGravity.toString();
    
    sliderGravity.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setValText('param-pixie-gravity-val', val.toFixed(2));
      dynamicPixieGravity = val;
      if (pixieDust) {
        pixieDust.gravity = val;
      }
      saveSettings();
    });

    const labelDrift = document.createElement('label');
    labelDrift.innerHTML = `Turbulence Drift: <span id="param-pixie-drift-val">${dynamicPixieDrift.toFixed(2)}</span>`;
    
    const sliderDrift = document.createElement('input');
    sliderDrift.type = 'range';
    sliderDrift.min = '0.1';
    sliderDrift.max = '3.0';
    sliderDrift.step = '0.1';
    sliderDrift.value = dynamicPixieDrift.toString();
    
    sliderDrift.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setValText('param-pixie-drift-val', val.toFixed(2));
      dynamicPixieDrift = val;
      if (pixieDust) {
        pixieDust.drift = val;
      }
      saveSettings();
    });

    const labelLimit = document.createElement('label');
    labelLimit.innerHTML = `Max Particles: <span id="param-pixie-limit-val">${dynamicPixieLimit}</span>`;
    
    const sliderLimit = document.createElement('input');
    sliderLimit.type = 'range';
    sliderLimit.min = '100';
    sliderLimit.max = '1500';
    sliderLimit.step = '50';
    sliderLimit.value = dynamicPixieLimit.toString();
    
    sliderLimit.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setValText('param-pixie-limit-val', val.toString());
      dynamicPixieLimit = val;
      if (pixieDust) {
        pixieDust.particleCountLimit = val;
      }
      saveSettings();
    });

    container.appendChild(labelGravity);
    container.appendChild(sliderGravity);
    container.appendChild(labelDrift);
    container.appendChild(sliderDrift);
    container.appendChild(labelLimit);
    container.appendChild(sliderLimit);
  } else {
    container.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic;">No dynamic parameters for active effect.</span>';
  }

  // Post-process to automatically assign accessible ARIA labels to dynamically generated inputs
  const inputs = container.querySelectorAll('input[type="range"]');
  inputs.forEach(input => {
    const label = input.previousElementSibling;
    if (label && label.tagName === 'LABEL') {
      const cleanLabel = label.textContent.split(':')[0].trim();
      input.setAttribute('aria-label', cleanLabel);
    }
  });

  initializeAllSliderFills();
}

// Initialization
const updateProjectorCalibState = () => {
  const show = isCalibScreenActive && !isBlackout;

  // 1. Update Projector Window (if active)
  if (projectorWindow && !projectorWindow.closed) {
    const projCalibScreen = projectorWindow.document.getElementById('calibration-output-screen');
    if (projCalibScreen) {
      projCalibScreen.style.display = show ? 'block' : 'none';
    }
  }

  // 2. Update Local Presentation Overlay (Single Screen Mode)
  const localCalibScreen = document.getElementById('local-calibration-output-screen');
  if (localCalibScreen) {
    localCalibScreen.style.display = show ? 'block' : 'none';
  }
};

function init() {
  queryElements();
  loadSettings();
  renderPlaylistUI();
  setupUI();
  setupCalibration();
  updateSensitivityUI(currentSensitivity);
  updatePlaylistBtnState();
  updateVisibility();
  updateHomography();
  setupAmbientBackground();
  initializeAllSliderFills();
  setupHostPresentationMode();
  if (adminPanel) adminPanel.classList.remove('hidden');

  // Guard getUserMedia call to prevent crashes in insecure HTTP/IP contexts
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      stream.getTracks().forEach(track => track.stop());
      populateCameras();
      // Auto start if permission is already there
      startCamera();
    }).catch(() => {});
  } else {
    console.warn("navigator.mediaDevices.getUserMedia is not supported in this browser context (e.g. insecure IP address access).");
  }

  requestAnimationFrame(gameLoop);
}

function setupUI() {
  // Fullscreen double-click toggle (applied globally)
  try {
    document.addEventListener('dblclick', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'OPTION') return;
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      } else {
        document.exitFullscreen();
      }
    });
  } catch (e) {
    console.warn("Failed to bind fullscreen dblclick:", e);
  }

  const toggleCalibBtn = document.getElementById('toggle-calib-screen-btn');
  const warpBtn = document.getElementById('warp-btn');
  const toggleDiagnosticsBtn = document.getElementById('toggle-diagnostics-btn');
  const cameraSection = document.querySelector('.camera-section');
  if (toggleDiagnosticsBtn && cameraSection) {
    safeAddListener(toggleDiagnosticsBtn, 'click', () => {
      const isCollapsed = cameraSection.classList.toggle('collapsed');
      toggleDiagnosticsBtn.textContent = isCollapsed ? 'Show Diagnostics' : 'Minimize Diagnostics';
      // Sync active tab underline since grid dimensions changed
      const activeTab = document.querySelector('.gallery-tabs .btn-tab.active');
      const slidingBar = document.getElementById('tab-sliding-bar');
      if (activeTab && slidingBar) {
        setTimeout(() => {
          slidingBar.style.left = activeTab.offsetLeft + 'px';
          slidingBar.style.width = activeTab.offsetWidth + 'px';
        }, 150);
      }
    });
  }

  // Define global callback for projector window ready signal
  window.onProjectorReady = (projWin) => {
    projectorWindow = projWin;
    projectorWindow.renderResolutionScale = renderResolutionScale;
    const projCanvas1 = projectorWindow.document.getElementById('projector-canvas-1');
    const projCanvas2 = projectorWindow.document.getElementById('projector-canvas-2');
    if (projCanvas1 && projCanvas2) {
      initializeProjectorEffects(projCanvas1, projCanvas2);
      
      if (openProjectorBtn) {
        openProjectorBtn.textContent = 'Projector Active';
        openProjectorBtn.classList.add('btn--success');
      }

      // Sync initial calibration screen display state and pattern from admin panel settings
      const projCalibScreen = projectorWindow.document.getElementById('calibration-output-screen');
      if (projCalibScreen) {
        const activePatternBtn = document.querySelector('.btn-pattern.active');
        const pattern = activePatternBtn ? activePatternBtn.getAttribute('data-pattern') : 'corners';
        projCalibScreen.className = '';
        projCalibScreen.classList.add(`pattern-${pattern}`);

        const isCalibActive = (isCalibScreenActive ||
                              (warpBtn && warpBtn.classList.contains('active')) || 
                              (toggleCalibBtn && toggleCalibBtn.classList.contains('active'))) && !isBlackout;
        projCalibScreen.style.display = isCalibActive ? 'block' : 'none';
      }
    }

    // Handle unload of the projector window to clean up
    projectorWindow.addEventListener('unload', () => {
      if (openProjectorBtn) {
        openProjectorBtn.textContent = 'Open Projector';
        openProjectorBtn.classList.remove('btn--success');
      }
      destroyProjectorEffects();
    });
  };

  safeAddListener(startCameraBtn, 'click', startCamera);

  const exportBtn = document.getElementById('export-settings-btn');
  const importBtn = document.getElementById('import-settings-btn');
  const importFile = document.getElementById('import-settings-file');

  safeAddListener(exportBtn, 'click', () => {
    const exportData = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('visualux') || key.startsWith('lumo')) {
          exportData[key] = localStorage.getItem(key);
        }
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visualux-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Configuration exported successfully', 'success');
    } catch (e) {
      showToast('Failed to export configuration');
      console.error(e);
    }
  });

  safeAddListener(importBtn, 'click', () => {
    if (importFile) importFile.click();
  });

  if (importFile) {
    safeAddListener(importFile, 'change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const importData = JSON.parse(evt.target.result);
          if (importData && typeof importData === 'object') {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key.startsWith('visualux') || key.startsWith('lumo')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            
            for (const [key, val] of Object.entries(importData)) {
              if (key.startsWith('visualux') || key.startsWith('lumo')) {
                localStorage.setItem(key, val);
              }
            }
            
            loadSettings();
            renderDynamicParameters();
            
            const savedPins = localStorage.getItem('visualuxProjectorPins');
            if (savedPins && projectorWindow && !projectorWindow.closed) {
              projectorWindow.pins = JSON.parse(savedPins);
              if (typeof projectorWindow.updateMarkerPositions === 'function') {
                projectorWindow.updateMarkerPositions();
              }
              if (typeof projectorWindow.updateWarp === 'function') {
                projectorWindow.updateWarp();
              }
            }
            
            showToast('Configuration imported successfully!', 'success');
          } else {
            showToast('Invalid backup file format');
          }
        } catch (err) {
          showToast('Failed to parse backup JSON');
          console.error(err);
        }
      };
      reader.readAsText(file);
      importFile.value = '';
    });
  }

  safeAddListener(captureBgBtn, 'click', () => {
    if (motionDetector) {
      motionDetector.captureBackground();
      if (captureBgBtn) {
        captureBgBtn.textContent = 'Reference Captured!';
        captureBgBtn.classList.add('btn--confirmed');
        setTimeout(() => {
          captureBgBtn.textContent = 'Set Reference';
          captureBgBtn.classList.remove('btn--confirmed');
        }, 2000);
      }
    }
  });

  safeAddListener(openProjectorBtn, 'click', () => {
    if (!projectorWindow || projectorWindow.closed) {
      const url = getProjectorUrl();
      projectorWindow = window.open(url, 'VIZUALUX_Projector', 'width=800,height=600');
    } else {
      projectorWindow.focus();
    }
  });

  safeAddListener(resolutionScaleSelect, 'change', (e) => {
    renderResolutionScale = parseFloat(e.target.value);
    if (projectorWindow && !projectorWindow.closed && typeof projectorWindow.updateResolutionScale === 'function') {
      projectorWindow.updateResolutionScale(renderResolutionScale);
    }
    saveSettings();
  });

  safeAddListener(fpsLimitSelect, 'change', (e) => {
    fpsLimit = e.target.value;
    saveSettings();
  });

  safeAddListener(autoMotionCheckbox, 'change', (e) => {
    autoMotionEnabled = e.target.checked;
    saveSettings();
  });



  safeAddListener(blackoutBtn, 'click', () => {
    isBlackout = !isBlackout;
    if (isBlackout) {
      if (blackoutBtn) {
        blackoutBtn.style.background = '#e74c3c';
        blackoutBtn.classList.add('active');
        blackoutBtn.textContent = 'Blackout: ON';
        blackoutBtn.setAttribute('aria-pressed', 'true');
      }
    } else {
      if (blackoutBtn) {
        blackoutBtn.style.background = '';
        blackoutBtn.classList.remove('active');
        blackoutBtn.textContent = 'Blackout';
        blackoutBtn.setAttribute('aria-pressed', 'false');
      }
    }
    updateProjectorCalibState();
  });

  const toggleWarpGrid = () => {
    isCalibScreenActive = !isCalibScreenActive;
    const show = isCalibScreenActive;

    updateProjectorCalibState();

    if (show) {
      if (toggleCalibBtn) {
        toggleCalibBtn.style.background = '#4cd137';
        toggleCalibBtn.classList.add('active');
        toggleCalibBtn.setAttribute('aria-pressed', 'true');
      }
      if (warpBtn) {
        warpBtn.classList.add('active');
        warpBtn.setAttribute('aria-pressed', 'true');
      }
    } else {
      if (toggleCalibBtn) {
        toggleCalibBtn.style.background = '#555';
        toggleCalibBtn.classList.remove('active');
        toggleCalibBtn.setAttribute('aria-pressed', 'false');
      }
      if (warpBtn) {
        warpBtn.classList.remove('active');
        warpBtn.setAttribute('aria-pressed', 'false');
      }
    }
  };

  safeAddListener(toggleCalibBtn, 'click', toggleWarpGrid);
  safeAddListener(warpBtn, 'click', toggleWarpGrid);

  safeAddListener(effectSelect, 'change', (e) => {
    changeEffectWithTransition(e.target.value);
  });

  safeAddListener(scatterPresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (scatterEffect) {
      if (preset === 'leaf') scatterEffect.setImage(getAssetUrl('leaf.svg'));
      else if (preset === 'petal') scatterEffect.setImage(getAssetUrl('petal.svg'));
      else if (preset === 'snowflake') scatterEffect.setImage(getAssetUrl('snowflake.svg'));
      else if (preset === 'star') scatterEffect.setImage(getAssetUrl('star.svg'));
    }
    saveSettings();
  });

  safeAddListener(smokePresetSelect, 'change', (e) => {
    const palette = e.target.value;
    if (smokeTrails) {
      smokeTrails.setPalette(palette);
    }
    saveSettings();
  });

  safeAddListener(koiPresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (koiPond) {
      koiPond.applyPreset(preset);
    }
    saveSettings();
  });


  safeAddListener(footprintsPresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (footprintsEffect) {
      footprintsEffect.setPreset(preset);
    }
    saveSettings();
  });

  safeAddListener(icePresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (breakingIce) {
      breakingIce.setPreset(preset);
    }
    saveSettings();
  });

  safeAddListener(sandPresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (liquidSand) {
      liquidSand.setPreset(preset);
    }
    saveSettings();
  });

  safeAddListener(harmonographPresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (harmonograph) {
      harmonograph.setPreset(preset);
    }
    saveSettings();
  });

  safeAddListener(stormPresetSelect, 'change', (e) => {
    const preset = e.target.value;
    if (bioluminescentStorm) {
      bioluminescentStorm.setPreset(preset);
    }
    saveSettings();
  });

  safeAddListener(autoRotateCheckbox, 'change', (e) => {
    autoRotateEnabled = e.target.checked;
    lastRotateTime = performance.now();
    updatePlaylistBtnState();
    saveSettings();
  });

  const playlistBtn = document.getElementById('playlist-btn');
  safeAddListener(playlistBtn, 'click', () => {
    if (autoRotateCheckbox) {
      autoRotateCheckbox.checked = !autoRotateCheckbox.checked;
      autoRotateCheckbox.dispatchEvent(new Event('change'));
    }
  });

  const detectionModeSelect = document.getElementById('detection-mode-select');
  const aiDebugContainer = document.getElementById('ai-debug-container');
  const aiDebugCheckbox = document.getElementById('ai-debug-checkbox');
  const classicSensitivityContainer = document.getElementById('classic-sensitivity-container');

  if (detectionModeSelect) {
    safeAddListener(detectionModeSelect, 'change', (e) => {
      activeDetectionMode = e.target.value;
      const captureBgContainer = document.getElementById('capture-bg-btn-container');
      if (activeDetectionMode === 'ai') {
        aiDebugContainer.style.display = 'block';
        classicSensitivityContainer.style.display = 'none';
        if (captureBgContainer) captureBgContainer.style.display = 'none';
      } else {
        aiDebugContainer.style.display = 'none';
        classicSensitivityContainer.style.display = 'block';
        if (captureBgContainer) captureBgContainer.style.display = 'block';
      }
      saveSettings();
    });
  }

  if (aiDebugCheckbox) {
    safeAddListener(aiDebugCheckbox, 'change', (e) => {
      aiDebugEnabled = e.target.checked;
      if (mediaPipeDetector) {
        mediaPipeDetector.setVisualization(aiDebugEnabled);
      }
      saveSettings();
    });
  }




  const sensButtons = document.querySelectorAll('.btn-sens');
  sensButtons.forEach(btn => {
    safeAddListener(btn, 'click', () => {
      const val = parseInt(btn.getAttribute('data-value')); // 10 to 100
      currentSensitivity = val;
      const thresholdVal = 101 - currentSensitivity;
      if (motionDetector) {
        motionDetector.setThreshold(thresholdVal);
      }
      updateSensitivityUI(currentSensitivity);
      saveSettings();
    });
  });

  // Camera source change
  safeAddListener(cameraSelect, 'change', () => {
    if (isRunning || (videoEl && videoEl.srcObject)) {
      startCamera();
    }
  });

  // Reveal Uploads
  let topObjectURL = null;
  let bgObjectURL = null;

  const handleUpload = (input, isTop) => {
    if (!input) return;
    safeAddListener(input, 'change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (isTop) {
          topImageObj = img;
          if (topObjectURL) URL.revokeObjectURL(topObjectURL);
          topObjectURL = url;
        } else {
          bgImageObj = img;
          if (bgObjectURL) {
            URL.revokeObjectURL(bgObjectURL);
            bgObjectURL = null;
          }
          bgObjectURL = url;
        }
        if (motionReveal) {
          motionReveal.setImages(topImageObj, bgImageObj);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.error("Failed to load image file.");
      };
      img.src = url;
    });
  };
  
  handleUpload(topLayerUpload, true);
  handleUpload(bgLayerUpload, false);

  // Scatter Upload
  safeAddListener(scatterUpload, 'change', (e) => {
    const file = e.target.files[0];
    if (file && scatterEffect) {
      if (scatterObjectURL) URL.revokeObjectURL(scatterObjectURL);
      scatterObjectURL = URL.createObjectURL(file);
      scatterEffect.setImage(scatterObjectURL);
    }
  });

  safeAddListener(scatterQtyInput, 'input', (e) => {
    const val = parseInt(e.target.value);
    if (scatterQtyVal) scatterQtyVal.textContent = val;
    if (scatterEffect) scatterEffect.setQuantity(val);
    saveSettings();
  });

  safeAddListener(scatterSizeInput, 'input', (e) => {
    const val = parseFloat(e.target.value);
    if (scatterSizeVal) scatterSizeVal.textContent = val.toFixed(1);
    if (scatterEffect) scatterEffect.setSize(val);
    saveSettings();
  });

  safeAddListener(scatterMovementInput, 'input', (e) => {
    const val = parseInt(e.target.value);
    if (scatterMovementVal) scatterMovementVal.textContent = val;
    if (scatterEffect) scatterEffect.setMovement(val);
    saveSettings();
  });

  // Audio Controls
  safeAddListener(soundToggle, 'change', (e) => {
    setAudioEnabled(e.target.checked);
  });

  safeAddListener(volumeSlider, 'input', (e) => {
    const val = parseInt(e.target.value);
    setAudioVolume(val / 100);
    if (volumeVal) volumeVal.textContent = val + '%';
  });

  // Welcome Guide Overlay Controls
  const welcomeOverlay = document.getElementById('welcome-guide-overlay');
  const closeGuideBtn = document.getElementById('close-guide-btn');
  const skipGuideCheckbox = document.getElementById('skip-guide-checkbox');
  const showGuideBtn = document.getElementById('show-guide-btn');

  if (welcomeOverlay && closeGuideBtn) {
    const showGuideVal = safeGetItem('visualuxShowGuide');
    if (showGuideVal !== 'false') {
      welcomeOverlay.classList.add('show');
      setTimeout(() => closeGuideBtn.focus(), 150);
    }

    safeAddListener(closeGuideBtn, 'click', () => {
      welcomeOverlay.classList.remove('show');
      if (skipGuideCheckbox && skipGuideCheckbox.checked) {
        safeSetItem('visualuxShowGuide', 'false');
      } else {
        safeSetItem('visualuxShowGuide', 'true');
      }
    });

    if (showGuideBtn) {
      safeAddListener(showGuideBtn, 'click', () => {
        if (skipGuideCheckbox) {
          skipGuideCheckbox.checked = safeGetItem('visualuxShowGuide') === 'false';
        }
        welcomeOverlay.classList.add('show');
        setTimeout(() => closeGuideBtn.focus(), 150);
      });
    }

    // Keyboard focus trap inside Welcome Guide modal for accessibility
    welcomeOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = welcomeOverlay.querySelectorAll('input, button, [tabindex="0"]');
        if (focusableElements.length === 0) return;
        
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    });
  }
}

function pushCalibrationState() {
  const currentState = JSON.parse(JSON.stringify(calibData));
  if (historyIndex >= 0) {
    const lastState = calibrationHistory[historyIndex];
    let changed = false;
    for (let i = 0; i < 4; i++) {
      if (currentState[i].x !== lastState[i].x || currentState[i].y !== lastState[i].y) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
  }
  calibrationHistory = calibrationHistory.slice(0, historyIndex + 1);
  calibrationHistory.push(currentState);
  if (calibrationHistory.length > 50) {
    calibrationHistory.shift();
  } else {
    historyIndex++;
  }
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  if (undoWarpBtn) {
    undoWarpBtn.disabled = (historyIndex <= 0);
  }
  if (redoWarpBtn) {
    redoWarpBtn.disabled = (historyIndex >= calibrationHistory.length - 1);
  }
}

function undoWarp() {
  if (historyIndex > 0) {
    historyIndex--;
    applyHistoryState();
  }
}

function redoWarp() {
  if (historyIndex < calibrationHistory.length - 1) {
    historyIndex++;
    applyHistoryState();
  }
}

function applyHistoryState() {
  const state = calibrationHistory[historyIndex];
  if (!state) return;
  
  for (let i = 0; i < 4; i++) {
    calibData[i] = { x: state[i].x, y: state[i].y };
    if (calibPoints[i]) {
      calibPoints[i].setAttribute('cx', state[i].x);
      calibPoints[i].setAttribute('cy', state[i].y);
    }
  }
  
  updatePoly();
  updateHomography();
  saveSettings();
  updateUndoRedoButtons();
}

function renderPlaylistUI() {
  if (!playlistScrollContainer) return;
  playlistScrollContainer.innerHTML = '';
  
  playlist.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'playlist-item-row' + (activeEffect === item.name ? ' active' : '');
    row.setAttribute('data-name', item.name);
    
    const left = document.createElement('div');
    left.className = 'playlist-item-left';
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.enabled;
    cb.addEventListener('change', () => {
      item.enabled = cb.checked;
      saveSettings();
    });
    
    const label = document.createElement('span');
    label.textContent = item.label;
    
    left.appendChild(cb);
    left.appendChild(label);
    
    const right = document.createElement('div');
    right.className = 'playlist-item-right';
    
    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.className = 'playlist-duration-input';
    durationInput.min = '5';
    durationInput.max = '3600';
    durationInput.value = item.duration;
    durationInput.addEventListener('change', () => {
      let val = parseInt(durationInput.value);
      if (isNaN(val) || val < 5) val = 5;
      item.duration = val;
      durationInput.value = val;
      saveSettings();
    });
    
    const secLabel = document.createElement('span');
    secLabel.className = 'playlist-duration-label';
    secLabel.textContent = 's';
    
    right.appendChild(durationInput);
    right.appendChild(secLabel);
    
    row.appendChild(left);
    row.appendChild(right);
    playlistScrollContainer.appendChild(row);
  });
}

function updatePlaylistUIRowHighlight() {
  const rows = document.querySelectorAll('.playlist-item-row');
  rows.forEach(row => {
    if (row.getAttribute('data-name') === activeEffect) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
}

function setupCalibration() {
  let activePoint = null;

  calibPoints.forEach((point, i) => {
    // Set initial positions based on loaded settings
    point.setAttribute('cx', calibData[i].x);
    point.setAttribute('cy', calibData[i].y);
    
    point.addEventListener('mousedown', (e) => {
      activePoint = i;
      const svg = document.getElementById('calibration-svg');
      if (svg) svg.classList.add('calibrating');
    });
    point.addEventListener('touchstart', (e) => {
      e.preventDefault();
      activePoint = i;
      const svg = document.getElementById('calibration-svg');
      if (svg) svg.classList.add('calibrating');
    }, { passive: false });
  });
  
  updatePoly();

  const handleMove = (clientX, clientY) => {
    if (activePoint === null) return;
    const svg = document.getElementById('calibration-svg');
    const rect = svg.getBoundingClientRect();
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    calibData[activePoint] = {x, y};
    calibPoints[activePoint].setAttribute('cx', x);
    calibPoints[activePoint].setAttribute('cy', y);
    updatePoly();
  };

  document.addEventListener('mousemove', (e) => {
    handleMove(e.clientX, e.clientY);
  });

  document.addEventListener('touchmove', (e) => {
    if (activePoint !== null) {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  let nudgeHappened = false;

  const handleUp = () => {
    if (activePoint !== null) {
      activePoint = null;
      const svg = document.getElementById('calibration-svg');
      if (svg) svg.classList.remove('calibrating');
      updateHomography();
      saveSettings();
      pushCalibrationState();
    }
  };

  document.addEventListener('mouseup', handleUp);
  document.addEventListener('touchend', handleUp);

  document.addEventListener('keydown', (e) => {
    if (activePoint !== null) {
      const step = e.shiftKey ? 1 : 0.1; // 0.1% nudge, 1% if shift is held
      let {x, y} = calibData[activePoint];
      let isArrow = false;
      if (e.key === 'ArrowUp') { y -= step; isArrow = true; }
      else if (e.key === 'ArrowDown') { y += step; isArrow = true; }
      else if (e.key === 'ArrowLeft') { x -= step; isArrow = true; }
      else if (e.key === 'ArrowRight') { x += step; isArrow = true; }
      else return;
      
      e.preventDefault();
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      calibData[activePoint] = {x, y};
      calibPoints[activePoint].setAttribute('cx', x);
      calibPoints[activePoint].setAttribute('cy', y);
      updatePoly();
      updateHomography();
      saveSettings();
      nudgeHappened = true;
    }
  });

  document.addEventListener('keyup', (e) => {
    if (nudgeHappened && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      pushCalibrationState();
      nudgeHappened = false;
    }
  });

  if (undoWarpBtn) {
    safeAddListener(undoWarpBtn, 'click', undoWarp);
  }
  if (redoWarpBtn) {
    safeAddListener(redoWarpBtn, 'click', redoWarp);
  }

  // Calibration Profile Save & Load Buttons
  const profileSelect = document.getElementById('profile-select');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const loadProfileBtn = document.getElementById('load-profile-btn');

  if (saveProfileBtn && profileSelect) {
    safeAddListener(saveProfileBtn, 'click', () => {
      const slot = profileSelect.value;
      try {
        let projPins = null;
        if (projectorWindow && !projectorWindow.closed && projectorWindow.pins) {
          projPins = projectorWindow.pins;
        } else {
          try {
            projPins = JSON.parse(localStorage.getItem('visualuxProjectorPins'));
          } catch (e) {}
        }
        
        const profileData = {
          calibData: calibData,
          sensitivity: currentSensitivity,
          projectorPins: projPins
        };
        
        localStorage.setItem(`visualuxProfile_${slot}`, JSON.stringify(profileData));
        showToast(`Profile "${slot}" saved successfully!`, 'success');
      } catch (e) {
        showToast('Failed to save profile.');
      }
    });
  }

  if (loadProfileBtn && profileSelect) {
    safeAddListener(loadProfileBtn, 'click', () => {
      const slot = profileSelect.value;
      try {
        const saved = localStorage.getItem(`visualuxProfile_${slot}`);
        if (saved) {
          const profileData = JSON.parse(saved);
          
          const loadedCalib = Array.isArray(profileData) ? profileData : profileData.calibData;
          const loadedSensitivity = profileData.sensitivity !== undefined ? profileData.sensitivity : null;
          const loadedProjPins = profileData.projectorPins !== undefined ? profileData.projectorPins : null;
          
          if (loadedCalib && Array.isArray(loadedCalib) && loadedCalib.length === 4) {
            calibData = loadedCalib;
            calibPoints.forEach((point, i) => {
              point.setAttribute('cx', calibData[i].x);
              point.setAttribute('cy', calibData[i].y);
            });
            updatePoly();
            updateHomography();
          }
          
          if (loadedSensitivity !== null) {
            currentSensitivity = loadedSensitivity;
            if (motionDetector) {
              motionDetector.setThreshold(101 - currentSensitivity);
            }
            const sensButtons = document.querySelectorAll('.btn-sens');
            sensButtons.forEach(btn => {
              const val = parseInt(btn.getAttribute('data-value'));
              if (val === currentSensitivity) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });
            const sensValEl = document.getElementById('motion-threshold-val');
            if (sensValEl) {
              sensValEl.textContent = currentSensitivity;
            }
          }
          
          if (loadedProjPins) {
            localStorage.setItem('visualuxProjectorPins', JSON.stringify(loadedProjPins));
            if (projectorWindow && !projectorWindow.closed) {
              projectorWindow.pins = loadedProjPins;
              if (typeof projectorWindow.updateMarkerPositions === 'function') {
                projectorWindow.updateMarkerPositions();
              }
              if (typeof projectorWindow.updateWarp === 'function') {
                projectorWindow.updateWarp();
              }
            }
          }
          
          saveSettings();
          showToast(`Profile "${slot}" loaded successfully!`, 'success');
        } else {
          showToast(`No saved data found for profile "${slot}".`);
        }
      } catch (e) {
        console.error(e);
        showToast('Failed to load profile.');
      }
    });
  }

  // Removed auto-load on profile dropdown change for better UX

  // Calibration Pattern Switcher
  const patternButtons = document.querySelectorAll('.btn-pattern');
  patternButtons.forEach(btn => {
    safeAddListener(btn, 'click', () => {
      patternButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pattern = btn.getAttribute('data-pattern');
      
      // Update projector calibration screen
      if (projectorWindow && !projectorWindow.closed) {
        const projCalib = projectorWindow.document.getElementById('calibration-output-screen');
        if (projCalib) {
          projCalib.className = '';
          projCalib.classList.add(`pattern-${pattern}`);
        }
      }

      // Update local calibration screen
      const localCalib = document.getElementById('local-calibration-output-screen');
      if (localCalib) {
        localCalib.className = '';
        localCalib.classList.add(`pattern-${pattern}`);
        
        // Hide all layers inside local screen, then show active
        const layers = localCalib.querySelectorAll('.calibration-pattern-layer');
        layers.forEach(l => l.style.display = 'none');
        const activeLayer = localCalib.querySelector(`.calibration-pattern-layer.pattern-${pattern}`);
        if (activeLayer) activeLayer.style.display = 'block';
      }
      
      saveSettings();
    });
  });

  // Interactive Content Gallery Tab Filters
  const galleryTabs = document.querySelectorAll('.gallery-tabs .btn-tab');
  const galleryCards = document.querySelectorAll('.gallery-grid .gallery-item-card');
  
  function updateSlidingTabHighlight() {
    const activeTab = document.querySelector('.gallery-tabs .btn-tab.active');
    const slidingBar = document.getElementById('tab-sliding-bar');
    if (activeTab && slidingBar) {
      slidingBar.style.left = activeTab.offsetLeft + 'px';
      slidingBar.style.width = activeTab.offsetWidth + 'px';
    }
  }

  galleryTabs.forEach(tab => {
    safeAddListener(tab, 'click', () => {
      galleryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateSlidingTabHighlight();
      
      const category = tab.getAttribute('data-category');
      galleryCards.forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  const win = window;
  win.addEventListener('resize', () => {
    updateSlidingTabHighlight();
    if (debugCanvas) {
      debugCanvas.width = debugCanvas.clientWidth;
      debugCanvas.height = debugCanvas.clientHeight;
    }
  });
  // Run once to initialize underline highlight offset and canvas size
  setTimeout(() => {
    updateSlidingTabHighlight();
    if (debugCanvas) {
      debugCanvas.width = debugCanvas.clientWidth;
      debugCanvas.height = debugCanvas.clientHeight;
    }
  }, 100);

  // Interactive Content Gallery Card Clicks
  galleryCards.forEach(card => {
    safeAddListener(card, 'click', () => {
      const effect = card.getAttribute('data-effect');
      if (effect) {
        changeEffectWithTransition(effect);
        if (effectSelect) {
          effectSelect.value = effect;
        }
      }
    });

    safeAddListener(card, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const effect = card.getAttribute('data-effect');
        if (effect) {
          changeEffectWithTransition(effect);
          if (effectSelect) {
            effectSelect.value = effect;
          }
        }
      }
    });
  });

  const autoCalibrateBtn = document.getElementById('auto-calibrate-btn');
  if (autoCalibrateBtn) {
    safeAddListener(autoCalibrateBtn, 'click', runAutoCalibration);
  }

  renderDynamicParameters();
}

// Helper for Webcam Auto-Calibration: computes the weighted centroid of the difference image.
function calculateDifferenceCentroid(currPixels, darkRefPixels, w, h, stepSize = 2, threshold = 25) {
  if (!currPixels || !darkRefPixels) return null;
  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < h; y += stepSize) {
    for (let x = 0; x < w; x += stepSize) {
      const idx = (y * w + x) * 4;
      const rDiff = Math.abs(currPixels[idx] - darkRefPixels[idx]);
      const gDiff = Math.abs(currPixels[idx + 1] - darkRefPixels[idx + 1]);
      const bDiff = Math.abs(currPixels[idx + 2] - darkRefPixels[idx + 2]);
      const diff = 0.299 * rDiff + 0.587 * gDiff + 0.114 * bDiff;

      if (diff > threshold) {
        const weight = diff * diff;
        sumWeight += weight;
        sumX += x * weight;
        sumY += y * weight;
      }
    }
  }

  if (sumWeight < 1000) {
    return null;
  }

  return {
    x: sumX / sumWeight,
    y: sumY / sumWeight
  };
}

// Webcam Auto-Calibration System
async function runAutoCalibration() {
  const overlay = document.getElementById('autocalib-overlay');
  const statusText = document.getElementById('autocalib-status-text');
  const debugCanvas = document.getElementById('autocalib-debug-canvas');
  const progressFill = document.getElementById('autocalib-progress-fill');
  const cancelBtn = document.getElementById('autocalib-cancel-btn');

  if (!projectorWindow || projectorWindow.closed) {
    showToast('Please open the projector window first.', 'error');
    return;
  }

  // Check camera status, try to start it if inactive
  if (!videoEl || !videoEl.srcObject) {
    showToast('Webcam is not active. Starting camera...', 'success');
    try {
      await startCamera();
    } catch (err) {
      showToast(`Failed to start camera: ${err.message || err}`, 'error');
      return;
    }
  }

  if (!videoEl || !videoEl.srcObject) {
    showToast('Failed to start camera. Auto-calibration aborted.', 'error');
    return;
  }

  overlay.style.display = 'block';
  overlay.classList.add('show');
  progressFill.style.width = '0%';
  statusText.textContent = 'Initializing auto-calibration...';

  // Store previous states to restore later
  const prevCalibScreenActive = isCalibScreenActive;
  const prevPattern = document.querySelector('.btn-pattern.active')?.getAttribute('data-pattern') || 'corners';
  
  // Set calibration screen to active and configure target pattern
  isCalibScreenActive = true;
  updateProjectorCalibState();
  
  if (projectorWindow && !projectorWindow.closed) {
    const projCalib = projectorWindow.document.getElementById('calibration-output-screen');
    if (projCalib) {
      projCalib.className = '';
      projCalib.classList.add('pattern-autocalib');
    }
  }

  const detectedPoints = [];
  let darkRefPixels = null;
  let currentCentroid = null;
  let step = 0;
  let calibrationTimer = null;
  let animFrameId = null;
  let isCancelled = false;

  const w = videoEl.videoWidth || 640;
  const h = videoEl.videoHeight || 480;
  
  // Offscreen canvas to capture webcam pixels
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = w;
  captureCanvas.height = h;
  const captureCtx = captureCanvas.getContext('2d');

  // Canvas to draw debug info in UI
  debugCanvas.width = debugCanvas.clientWidth || w;
  debugCanvas.height = debugCanvas.clientHeight || h;
  const ctx = debugCanvas.getContext('2d');

  // Cancel callback
  const handleCancel = () => {
    cleanup('Calibration cancelled by user.');
  };
  cancelBtn.addEventListener('click', handleCancel, { once: true });

  const localTargetLayer = document.getElementById('local-autocalib-target-layer');
  function showLocalTarget(step) {
    if (!localTargetLayer) return;
    if (step === 0) {
      localTargetLayer.style.display = 'none';
      return;
    }
    localTargetLayer.style.display = 'block';
    const dot = document.getElementById('local-autocalib-center-dot');
    const ring = document.getElementById('local-autocalib-pulsing-ring');
    if (!dot || !ring) return;
    
    let cx = -50, cy = -50;
    if (step === 1) { cx = 5; cy = 5; }      // Top Left
    else if (step === 2) { cx = 95; cy = 5; }  // Top Right
    else if (step === 3) { cx = 95; cy = 95; } // Bottom Right
    else if (step === 4) { cx = 5; cy = 95; }  // Bottom Left
    
    dot.setAttribute('cx', cx.toString());
    dot.setAttribute('cy', cy.toString());
    ring.setAttribute('cx', cx.toString());
    ring.setAttribute('cy', cy.toString());
  }

  function cleanup(msg, isSuccess = false) {
    isCancelled = true;
    if (calibrationTimer) clearTimeout(calibrationTimer);
    if (animFrameId) cancelAnimationFrame(animFrameId);
    
    // Close overlay
    overlay.style.display = 'none';
    overlay.classList.remove('show');
    
    // Restore projector screen state
    isCalibScreenActive = prevCalibScreenActive;
    updateProjectorCalibState();
    
    if (projectorWindow && !projectorWindow.closed) {
      const projCalib = projectorWindow.document.getElementById('calibration-output-screen');
      if (projCalib) {
        projCalib.className = '';
        projCalib.classList.add(`pattern-${prevPattern}`);
        projectorWindow.showAutoCalibTarget(0); // clear dots
        if (typeof projectorWindow.updateMarkerPositions === 'function') {
          projectorWindow.updateMarkerPositions();
        }
        if (typeof projectorWindow.updateWarp === 'function') {
          projectorWindow.updateWarp();
        }
      }
    } else {
      showLocalTarget(0);
    }
    
    cancelBtn.removeEventListener('click', handleCancel);
    
    if (isSuccess) {
      showToast(msg, 'success');
    } else {
      showToast(msg, 'error');
    }
  }

  // Live feedback draw loop
  function drawLoop() {
    if (isCancelled) return;
    
    // Draw raw webcam feed
    ctx.drawImage(videoEl, 0, 0, debugCanvas.width, debugCanvas.height);

    if (step >= 1 && step <= 4 && darkRefPixels) {
      // Compute centroid on the fly for real-time visualization
      try {
        captureCtx.drawImage(videoEl, 0, 0, w, h);
        const currPixels = captureCtx.getImageData(0, 0, w, h).data;
        const centroid = calculateDifferenceCentroid(currPixels, darkRefPixels, w, h, 4, 25);

        if (centroid) {
          currentCentroid = { x: centroid.x / w, y: centroid.y / h };
        } else {
          currentCentroid = null;
        }
      } catch (e) {
        console.warn("Real-time centroid estimation error:", e);
      }
    } else {
      currentCentroid = null;
    }

    // Draw crosshairs and labels
    if (currentCentroid) {
      const cx = currentCentroid.x * debugCanvas.width;
      const cy = currentCentroid.y * debugCanvas.height;
      
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const pulse = 15 + Math.sin(Date.now() / 100) * 4;
      ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#00f3ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 25, cy);
      ctx.lineTo(cx + 25, cy);
      ctx.moveTo(cx, cy - 25);
      ctx.lineTo(cx, cy + 25);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`Tracking: (${Math.round(currentCentroid.x * 100)}%, ${Math.round(currentCentroid.y * 100)}%)`, cx + 20, cy - 10);
    }

    animFrameId = requestAnimationFrame(drawLoop);
  }
  
  drawLoop();

  // Calibration sequence state machine
  function runNextStep() {
    if (isCancelled) return;

    if (step === 0) {
      statusText.textContent = 'Step 0/5: Capturing room ambient light...';
      progressFill.style.width = '10%';
      if (projectorWindow && !projectorWindow.closed) {
        projectorWindow.showAutoCalibTarget(0);
      } else {
        showLocalTarget(0);
      }

      calibrationTimer = setTimeout(() => {
        if (isCancelled) return;
        try {
          captureCtx.drawImage(videoEl, 0, 0, w, h);
          darkRefPixels = captureCtx.getImageData(0, 0, w, h).data;
          step = 1;
          runNextStep();
        } catch (e) {
          cleanup(`Capture failed: ${e.message}`);
        }
      }, 1200);

    } else if (step >= 1 && step <= 4) {
      const stepNames = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
      statusText.textContent = `Step ${step}/5: Calibrating ${stepNames[step - 1]} corner...`;
      progressFill.style.width = `${10 + step * 18}%`;

      if (projectorWindow && !projectorWindow.closed) {
        projectorWindow.showAutoCalibTarget(step);
      } else {
        showLocalTarget(step);
      }

      calibrationTimer = setTimeout(() => {
        if (isCancelled) return;
        try {
          captureCtx.drawImage(videoEl, 0, 0, w, h);
          const currPixels = captureCtx.getImageData(0, 0, w, h).data;
          const centroid = calculateDifferenceCentroid(currPixels, darkRefPixels, w, h, 2, 25);

          if (!centroid) {
            cleanup(`Target detection failed at ${stepNames[step - 1]} corner. Ensure the camera's view of the floor is unobstructed and the projector is visible.`);
            return;
          }

          detectedPoints.push({ x: centroid.x / w, y: centroid.y / h });

          step++;
          runNextStep();
        } catch (e) {
          cleanup(`Centroid calculation failed: ${e.message}`);
        }
      }, 1200);

    } else if (step === 5) {
      statusText.textContent = 'Step 5/5: Resolving perspective homography warp...';
      progressFill.style.width = '100%';

      calibrationTimer = setTimeout(() => {
        if (isCancelled) return;
        try {
          const targetPos = [
            { x: 0.05, y: 0.05 }, // TL
            { x: 0.95, y: 0.05 }, // TR
            { x: 0.95, y: 0.95 }, // BR
            { x: 0.05, y: 0.95 }  // BL
          ];

          const tempH = new Homography();
          tempH.calibrate(targetPos, detectedPoints);

          const c0 = tempH.transform(0, 0);
          const c1 = tempH.transform(1, 0);
          const c2 = tempH.transform(1, 1);
          const c3 = tempH.transform(0, 1);

          if (isNaN(c0.x) || isNaN(c0.y) || isNaN(c1.x) || isNaN(c1.y) ||
              isNaN(c2.x) || isNaN(c2.y) || isNaN(c3.x) || isNaN(c3.y)) {
            cleanup('Calibration matrix contains invalid math results (NaNs). Check camera alignment.');
            return;
          }

          calibData[0] = { x: Math.max(0, Math.min(100, c0.x * 100)), y: Math.max(0, Math.min(100, c0.y * 100)) };
          calibData[1] = { x: Math.max(0, Math.min(100, c1.x * 100)), y: Math.max(0, Math.min(100, c1.y * 100)) };
          calibData[2] = { x: Math.max(0, Math.min(100, c2.x * 100)), y: Math.max(0, Math.min(100, c2.y * 100)) };
          calibData[3] = { x: Math.max(0, Math.min(100, c3.x * 100)), y: Math.max(0, Math.min(100, c3.y * 100)) };

          calibPoints.forEach((point, idx) => {
            if (point) {
              point.setAttribute('cx', calibData[idx].x);
              point.setAttribute('cy', calibData[idx].y);
            }
          });

          updatePoly();
          updateHomography();
          saveSettings();
          pushCalibrationState();

          cleanup('Webcam Auto-Calibration complete!', true);
        } catch (e) {
          cleanup(`Calibration calculation failed: ${e.message}`);
        }
      }, 800);
    }
  }

  runNextStep();
}

function updatePoly() {
  const poly = document.getElementById('calibration-poly');
  if (poly) {
    poly.setAttribute('points', calibData.map(p => `${p.x},${p.y}`).join(' '));
  }
  
  // Update or create grid lines
  const svg = document.getElementById('calibration-svg');
  if (!svg) return;
  
  // Remove old grid lines
  const oldLines = svg.querySelectorAll('.grid-line');
  oldLines.forEach(l => l.remove());

  // Bilinear interpolation for 10x10 grid
  const lerp = (p1, p2, t) => ({
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t
  });

  const numLines = 10;
  for (let i = 1; i < numLines; i++) {
    const t = i / numLines;
    
    // Vertical lines
    const topP = lerp(calibData[0], calibData[1], t);
    const botP = lerp(calibData[3], calibData[2], t);
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', topP.x);
    vLine.setAttribute('y1', topP.y);
    vLine.setAttribute('x2', botP.x);
    vLine.setAttribute('y2', botP.y);
    vLine.setAttribute('class', 'grid-line');
    vLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.85)');
    vLine.setAttribute('stroke-width', '0.6');
    svg.insertBefore(vLine, svg.firstChild);

    // Horizontal lines
    const leftP = lerp(calibData[0], calibData[3], t);
    const rightP = lerp(calibData[1], calibData[2], t);
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', leftP.x);
    hLine.setAttribute('y1', leftP.y);
    hLine.setAttribute('x2', rightP.x);
    hLine.setAttribute('y2', rightP.y);
    hLine.setAttribute('class', 'grid-line');
    hLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.85)');
    hLine.setAttribute('stroke-width', '0.6');
    svg.insertBefore(hLine, svg.firstChild);
  }
}

function updateHomography() {
  // Source is camera points (the calib box, normalized 0-1)
  const src = calibData.map(p => ({ x: p.x / 100, y: p.y / 100 }));
  // Dest is fullscreen (0-1)
  const dst = [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 1, y: 1},
    {x: 0, y: 1}
  ];
  homography.calibrate(src, dst);
}

function loadSettings() {
  let saved = safeGetItem('visualuxSettings');
  if (!saved) {
    saved = safeGetItem('lumoSettings');
  }
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data) {
        if (data.activeEffect) {
          activeEffect = data.activeEffect === 'particles' ? 'koi' : data.activeEffect;
          if (effectSelect) effectSelect.value = activeEffect;
        }
        if (data.autoRotateEnabled !== undefined) {
          autoRotateEnabled = data.autoRotateEnabled;
          if (autoRotateCheckbox) autoRotateCheckbox.checked = autoRotateEnabled;
        }
        if (data.autoRotateInterval) {
          autoRotateInterval = data.autoRotateInterval;
          if (rotateIntervalInput) rotateIntervalInput.value = autoRotateInterval;
          if (rotateIntervalVal) rotateIntervalVal.textContent = autoRotateInterval;
        }
        if (data.threshold) {
          currentSensitivity = 101 - data.threshold;
        }
        if (data.scatterQty && scatterQtyInput) {
          scatterQtyInput.value = data.scatterQty;
          if (scatterQtyVal) scatterQtyVal.textContent = data.scatterQty;
        }
        if (data.scatterSize && scatterSizeInput) {
          scatterSizeInput.value = data.scatterSize;
          if (scatterSizeVal) scatterSizeVal.textContent = parseFloat(data.scatterSize).toFixed(1);
        }
        if (data.scatterMovement && scatterMovementInput) {
          scatterMovementInput.value = data.scatterMovement;
          if (scatterMovementVal) scatterMovementVal.textContent = data.scatterMovement;
        }
        if (data.calibData && Array.isArray(data.calibData) && data.calibData.length === 4) {
          const isValid = data.calibData.every(p => p && typeof p.x === 'number' && typeof p.y === 'number');
          if (isValid) {
            calibData = data.calibData;
          }
        }
        if (data.scatterPreset) {
          if (scatterPresetSelect) {
            scatterPresetSelect.value = data.scatterPreset;
          }
        }
        if (data.smokePalette) {
          if (smokePresetSelect) {
            smokePresetSelect.value = data.smokePalette;
          }
        }
        if (data.koiPreset) {
          if (koiPresetSelect) {
            koiPresetSelect.value = data.koiPreset;
          }
        }
        if (data.footprintsPreset && footprintsPresetSelect) {
          footprintsPresetSelect.value = data.footprintsPreset;
        }
        if (data.icePreset && icePresetSelect) {
          icePresetSelect.value = data.icePreset;
        }
        if (data.sandPreset && sandPresetSelect) {
          sandPresetSelect.value = data.sandPreset;
        }
        if (data.harmonographPreset && harmonographPresetSelect) {
          harmonographPresetSelect.value = data.harmonographPreset;
        }
        if (data.stormPreset && stormPresetSelect) {
          stormPresetSelect.value = data.stormPreset;
        }
        if (data.dynamicStormRainDensity !== undefined) {
          dynamicStormRainDensity = data.dynamicStormRainDensity;
        }
        if (data.dynamicStormLightningFrequency !== undefined) {
          dynamicStormLightningFrequency = data.dynamicStormLightningFrequency;
        }
        if (data.dynamicStormLightningIntensity !== undefined) {
          dynamicStormLightningIntensity = data.dynamicStormLightningIntensity;
        }
        if (data.dynamicDamping !== undefined) {
          dynamicDamping = data.dynamicDamping;
        }
        if (data.dynamicRippleSize !== undefined) {
          dynamicRippleSize = data.dynamicRippleSize;
        }
        if (data.dynamicFishCount !== undefined) {
          dynamicFishCount = data.dynamicFishCount;
        }
        if (data.dynamicLilyPadCount !== undefined) {
          dynamicLilyPadCount = data.dynamicLilyPadCount;
        }
        if (data.dynamicMaxParticles !== undefined) {
          dynamicMaxParticles = data.dynamicMaxParticles;
        }
        if (data.dynamicSmokeLifetime !== undefined) {
          dynamicSmokeLifetime = data.dynamicSmokeLifetime;
        }
        if (data.dynamicSmokeWind !== undefined) {
          dynamicSmokeWind = data.dynamicSmokeWind;
        }
        if (data.dynamicPongBallSpeed !== undefined) {
          dynamicPongBallSpeed = data.dynamicPongBallSpeed;
        }
        if (data.dynamicPongPaddleSize !== undefined) {
          dynamicPongPaddleSize = data.dynamicPongPaddleSize;
        }
        if (data.dynamicAsteroidsSpawnRate !== undefined) {
          dynamicAsteroidsSpawnRate = data.dynamicAsteroidsSpawnRate;
        }
        if (data.dynamicAsteroidsSpeed !== undefined) {
          dynamicAsteroidsSpeed = data.dynamicAsteroidsSpeed;
        }
        if (data.dynamicGardenBloomSize !== undefined) {
          dynamicGardenBloomSize = data.dynamicGardenBloomSize;
        }
        if (data.dynamicGardenLifetime !== undefined) {
          dynamicGardenLifetime = data.dynamicGardenLifetime;
        }
        if (data.dynamicGardenBloomSpeed !== undefined) {
          dynamicGardenBloomSpeed = data.dynamicGardenBloomSpeed;
        }
        if (data.dynamicSandFlowRate !== undefined) {
          dynamicSandFlowRate = data.dynamicSandFlowRate;
        }
        if (data.dynamicSandGravity !== undefined) {
          dynamicSandGravity = data.dynamicSandGravity;
        }
        if (data.harmonographPreset && harmonographPresetSelect) {
          harmonographPresetSelect.value = data.harmonographPreset;
        }
        if (data.dynamicHarmonoFriction !== undefined) {
          dynamicHarmonoFriction = data.dynamicHarmonoFriction;
        }
        if (data.dynamicHarmonoSpeed !== undefined) {
          dynamicHarmonoSpeed = data.dynamicHarmonoSpeed;
        }
        if (data.dynamicHarmonoThickness !== undefined) {
          dynamicHarmonoThickness = data.dynamicHarmonoThickness;
        }
        if (data.dynamicPixieGravity !== undefined) {
          dynamicPixieGravity = data.dynamicPixieGravity;
        }
        if (data.dynamicPixieDrift !== undefined) {
          dynamicPixieDrift = data.dynamicPixieDrift;
        }
        if (data.dynamicPixieLimit !== undefined) {
          dynamicPixieLimit = data.dynamicPixieLimit;
        }
        if (data.activePattern) {
          const btn = document.querySelector(`.btn-pattern[data-pattern="${data.activePattern}"]`);
          if (btn) {
            document.querySelectorAll('.btn-pattern').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // update local calibration class
            const localCalib = document.getElementById('local-calibration-output-screen');
            if (localCalib) {
              localCalib.className = '';
              localCalib.classList.add(`pattern-${data.activePattern}`);
              const layers = localCalib.querySelectorAll('.calibration-pattern-layer');
              layers.forEach(l => l.style.display = 'none');
              const activeLayer = localCalib.querySelector(`.calibration-pattern-layer.pattern-${data.activePattern}`);
              if (activeLayer) activeLayer.style.display = 'block';
            }
          }
        }
        if (data.playlist && Array.isArray(data.playlist)) {
          data.playlist.forEach(savedItem => {
            const item = playlist.find(p => p.name === savedItem.name);
            if (item) {
              item.enabled = savedItem.enabled;
              item.duration = savedItem.duration;
            }
          });
        }
        if (data.renderResolutionScale !== undefined) {
          renderResolutionScale = parseFloat(data.renderResolutionScale);
          if (resolutionScaleSelect) resolutionScaleSelect.value = renderResolutionScale;
        }
        if (data.fpsLimit !== undefined) {
          fpsLimit = data.fpsLimit;
          if (fpsLimitSelect) fpsLimitSelect.value = fpsLimit;
        }
        if (data.autoMotionEnabled !== undefined) {
          autoMotionEnabled = data.autoMotionEnabled;
          if (autoMotionCheckbox) autoMotionCheckbox.checked = autoMotionEnabled;
        }
        
        if (data.activeDetectionMode) {
          activeDetectionMode = data.activeDetectionMode;
          const detectionModeSelect = document.getElementById('detection-mode-select');
          if (detectionModeSelect) detectionModeSelect.value = activeDetectionMode;
          
          const aiDebugContainer = document.getElementById('ai-debug-container');
          const classicSensitivityContainer = document.getElementById('classic-sensitivity-container');
          const captureBgContainer = document.getElementById('capture-bg-btn-container');
          if (activeDetectionMode === 'ai') {
            if (aiDebugContainer) aiDebugContainer.style.display = 'block';
            if (classicSensitivityContainer) classicSensitivityContainer.style.display = 'none';
            if (captureBgContainer) captureBgContainer.style.display = 'none';
          }
        }
        
        if (data.aiDebugEnabled !== undefined) {
          aiDebugEnabled = data.aiDebugEnabled;
          const aiDebugCheckbox = document.getElementById('ai-debug-checkbox');
          if (aiDebugCheckbox) aiDebugCheckbox.checked = aiDebugEnabled;
          if (mediaPipeDetector) mediaPipeDetector.setVisualization(aiDebugEnabled);
        }
      }
    } catch (e) {
      console.warn('Failed to load settings, using defaults:', e);
      safeRemoveItem('visualuxSettings');
      safeRemoveItem('lumoSettings');
    }
  }
  
  // Initialize calibration history stack
  calibrationHistory = [JSON.parse(JSON.stringify(calibData))];
  historyIndex = 0;
  updateUndoRedoButtons();
}

function saveSettings() {
  const data = {
    activeEffect,
    autoRotateEnabled,
    autoRotateInterval,
    threshold: 101 - currentSensitivity,
    scatterQty: scatterQtyInput ? scatterQtyInput.value : 150,
    scatterSize: scatterSizeInput ? scatterSizeInput.value : 1.0,
    scatterMovement: scatterMovementInput ? scatterMovementInput.value : 10,
    scatterPreset: scatterPresetSelect ? scatterPresetSelect.value : 'leaf',
    smokePalette: smokePresetSelect ? smokePresetSelect.value : 'purple',
    koiPreset: koiPresetSelect ? koiPresetSelect.value : 'lagoon',
    footprintsPreset: footprintsPresetSelect ? footprintsPresetSelect.value : 'sand',
    icePreset: icePresetSelect ? icePresetSelect.value : 'ice',
    sandPreset: sandPresetSelect ? sandPresetSelect.value : 'bioluminescent',
    stormPreset: stormPresetSelect ? stormPresetSelect.value : 'bioluminescent',
    calibData,
    dynamicDamping,
    dynamicRippleSize,
    dynamicFishCount,
    dynamicLilyPadCount,
    dynamicMaxParticles,
    dynamicSmokeLifetime,
    dynamicSmokeWind,
    dynamicPongBallSpeed,
    dynamicPongPaddleSize,
    dynamicAsteroidsSpawnRate,
    dynamicAsteroidsSpeed,
    dynamicGardenBloomSize,
    dynamicGardenLifetime,
    dynamicGardenBloomSpeed,
    dynamicSandFlowRate,
    dynamicSandGravity,
    harmonographPreset: harmonographPresetSelect ? harmonographPresetSelect.value : 'vector',
    dynamicHarmonoFriction,
    dynamicHarmonoSpeed,
    dynamicHarmonoThickness,
    dynamicStormRainDensity,
    dynamicPixieGravity,
    dynamicPixieDrift,
    dynamicPixieLimit,
    dynamicStormLightningFrequency,
    dynamicStormLightningIntensity,
    activePattern: document.querySelector('.btn-pattern.active')?.getAttribute('data-pattern') || 'corners',
    playlist,
    renderResolutionScale,
    fpsLimit,
    autoMotionEnabled,
    activeDetectionMode,
    aiDebugEnabled
  };
  safeSetItem('visualuxSettings', JSON.stringify(data));
}

function updateVisibility() {
  // Update Active Content Gallery selection
  const galleryCards = document.querySelectorAll('.gallery-grid .gallery-item-card');
  galleryCards.forEach(card => {
    if (card.getAttribute('data-effect') === activeEffect) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Highlight playlist row in sync
  updatePlaylistUIRowHighlight();

  // Clear the projector canvas when switching effects to avoid artifacts
  if (projectorWindow && !projectorWindow.closed) {
    if (projectorCanvas1 && !transitionState.active) {
      const ctx = projectorCanvas1.getContext('2d');
      ctx.clearRect(0, 0, projectorCanvas1.width, projectorCanvas1.height);
    }
    if (projectorCanvas2 && !transitionState.active) {
      const ctx = projectorCanvas2.getContext('2d');
      ctx.clearRect(0, 0, projectorCanvas2.width, projectorCanvas2.height);
    }
  }

  if (revealControls) revealControls.style.display = 'none';
  if (scatterControls) scatterControls.style.display = 'none';
  
  if (scatterPresetGroup) {
    scatterPresetGroup.style.display = activeEffect === 'scatter' ? 'block' : 'none';
  }
  if (smokePresetGroup) {
    smokePresetGroup.style.display = activeEffect === 'smoke' ? 'block' : 'none';
  }
  if (koiPresetGroup) {
    koiPresetGroup.style.display = activeEffect === 'koi' ? 'block' : 'none';
  }
  if (footprintsPresetGroup) {
    footprintsPresetGroup.style.display = activeEffect === 'footprints' ? 'block' : 'none';
  }
  if (icePresetGroup) {
    icePresetGroup.style.display = activeEffect === 'ice' ? 'block' : 'none';
  }
  if (sandPresetGroup) {
    sandPresetGroup.style.display = activeEffect === 'sand' ? 'block' : 'none';
  }
  if (harmonographPresetGroup) {
    harmonographPresetGroup.style.display = activeEffect === 'harmonograph' ? 'block' : 'none';
  }
  if (stormPresetGroup) {
    stormPresetGroup.style.display = activeEffect === 'storm' ? 'block' : 'none';
  }

  if (activeEffect === 'reveal') {
    if (revealControls) revealControls.style.display = 'block';
    if (motionReveal) motionReveal.init();
  } else if (activeEffect === 'scatter') {
    if (scatterControls) scatterControls.style.display = 'block';
    if (scatterEffect) scatterEffect.init();
  } else if (activeEffect === 'koi') {
    if (koiPond) koiPond.init();
  } else if (activeEffect === 'smoke') {
    if (smokeTrails) smokeTrails.init();
  } else if (activeEffect === 'garden') {
    if (zenGarden) zenGarden.init();
  } else if (activeEffect === 'pong') {
    if (floorPong) floorPong.init();
  } else if (activeEffect === 'asteroids') {
    if (asteroidsDefense) asteroidsDefense.init();
  } else if (activeEffect === 'paint') {
    if (paintSplatter) paintSplatter.init();
  } else if (activeEffect === 'storm') {
    if (bioluminescentStorm) bioluminescentStorm.init();
  } else if (activeEffect === 'ripples') {
    if (liquidRipples) liquidRipples.init();
  } else if (activeEffect === 'footprints') {
    if (footprintsEffect) footprintsEffect.init();
  } else if (activeEffect === 'ice') {
    if (breakingIce) breakingIce.init();
  } else if (activeEffect === 'sand') {
    if (liquidSand) liquidSand.init();
  } else if (activeEffect === 'harmonograph') {
    if (harmonograph) harmonograph.init();
  } else if (activeEffect === 'pixie') {
    if (pixieDust) pixieDust.init();
  }

  updateEffectInfoCard();
}

// Active Effect Information Dictionary
const EFFECT_INFO = {
  koi: {
    name: 'Bioluminescent Koi Pond',
    shortcut: 'KEY 1',
    desc: 'A dark pond with glowing Koi fish. The fish react and swim away from your movements.',
    interaction: 'Walk on the floor to generate water ripples. Koi fish will naturally avoid or flock to your movements, leaving bioluminescent caustics.'
  },
  garden: {
    name: 'Bioluminescent Zen Garden',
    shortcut: 'KEY 2',
    desc: 'A neon garden where glowing flowers bloom. Your movements draw paths and stimulate growth.',
    interaction: 'Sweep or step on the floor to draw glowing sand paths and trigger the blooming of colorful neon flowers that slowly decay.'
  },
  ripples: {
    name: 'Liquid Ripples',
    shortcut: 'KEY 3',
    desc: 'A realistic fluid simulation where your movements create splashing waves. The water bounces and refracts light.',
    interaction: 'Step or sweep your hands over the camera area to drop stones in the fluid, causing waves that bounce off borders and refract light.'
  },
  scatter: {
    name: 'Scatter Objects',
    shortcut: 'KEY 4',
    desc: 'A physics simulation of falling objects. Use your movement to blow the objects around like wind.',
    interaction: 'Walk or wave to generate dynamic wind currents that blow objects around. Toggle presets to change themes (Autumn, Winter, etc.).'
  },
  smoke: {
    name: 'Smoke Trails',
    shortcut: 'KEY 5',
    desc: 'A fluid simulation of glowing smoke. Your movements create swirling, colorful vapors.',
    interaction: 'Swipe quickly to release thick, glowing smoke trails. Change color palettes or speed parameters using the preset sidebar controls.'
  },
  paint: {
    name: 'Paint Splatter',
    shortcut: 'KEY 6',
    desc: 'An interactive canvas for virtual paint splatters. Move rapidly to throw neon paint across the screen.',
    interaction: 'Stomp or wave rapidly to trigger paint splatters of random neon colors. Let trails bleed or decay slowly over time.'
  },
  reveal: {
    name: 'Motion Reveal',
    shortcut: 'KEY 7',
    desc: 'A motion mask that peels back the darkness. Move around to reveal the hidden scene underneath.',
    interaction: 'Move to wipe away the dark shroud, exposing parts of the canvas. The exposed areas slowly fade back into black over time.'
  },
  pong: {
    name: 'Floor Pong',
    shortcut: 'KEY 8',
    desc: 'A giant interactive game of Pong. Move around to control your paddle and score!',
    interaction: 'Move up/down or left/right in the camera view to reposition your player paddle. Bounce the energy ball past the opponent to score!'
  },
  asteroids: {
    name: 'Asteroids Defense',
    shortcut: 'KEY 9',
    desc: 'A space defense game. Move around to aim and shoot lasers at falling meteors.',
    interaction: 'Move left/right or wave to aim and automatically fire lasers. Keep the base safe from colliding meteors to maximize your survival score.'
  },
  footprints: {
    name: 'Footprints Walk',
    shortcut: 'KEY W',
    desc: 'A simulation of glowing footprints. Walk around to leave boot prints or magic paw prints.',
    interaction: 'Walk or step to leave left and right aligned footprints. Magic mode leaves glowing paw prints and rising neon sparkles.'
  },
  sand: {
    name: 'Interactive Liquid Sand',
    shortcut: 'KEY T',
    desc: 'A simulation of falling sand grains. Use your body as an obstacle to block and pile up the sand.',
    interaction: 'Move or step in front of the projection to act as a solid barrier. Grains of sand will stack up, slide off, or get cleared by your motion.'
  },
  harmonograph: {
    name: 'Dynamic Harmonograph',
    shortcut: 'KEY U',
    desc: 'A geometric drawing simulation. Your movements push pendulums to create beautiful spiral patterns.',
    interaction: 'Move or step to inject velocity into drawing pens, creating gorgeous overlapping spiral designs.'
  },
  pixie: {
    name: 'Pixie Dust',
    shortcut: 'KEY H',
    desc: 'A magical particle simulation. Move around to spawn falling, twinkling stardust trails.',
    interaction: 'Step or sweep to spawn glowing stardust cores. Cores fall under gentle gravity and leave twinkling, glittering trails.'
  }
};

function updateEffectInfoCard() {
  const info = EFFECT_INFO[activeEffect];
  if (!info) return;

  if (detailEffectName) detailEffectName.textContent = info.name;
  if (detailEffectDesc) detailEffectDesc.textContent = info.desc;
  if (detailEffectInteraction) detailEffectInteraction.textContent = info.interaction;
  if (detailShortcutBadge) detailShortcutBadge.textContent = info.shortcut;
}

  // Hardware Camera Selection
  
  async function populateCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (cameraSelect) {
        cameraSelect.innerHTML = '<option value="">Default Camera</option>';
        videoDevices.forEach(device => {
          const option = document.createElement('option');
          option.value = device.deviceId;
          option.text = device.label || `Camera ${cameraSelect.length}`;
          cameraSelect.appendChild(option);
        });
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }

  // Guard getUserMedia call to prevent crashes in insecure HTTP/IP contexts


  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Camera access is not supported in this browser context (likely insecure HTTP/IP access).");
      if (startCameraBtn) {
        startCameraBtn.textContent = 'Insecure Context';
        startCameraBtn.classList.add('btn--error');
      }
      return;
    }
    if (startCameraBtn) {
      startCameraBtn.textContent = 'Starting...';
    }
    try {
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => track.stop());
      }
      const selectedDeviceId = cameraSelect ? cameraSelect.value : '';
      const constraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play().catch(err => {
          console.warn("videoEl.play() was prevented or interrupted:", err);
        });

        const initMotionDetector = () => {
          if (videoEl.videoWidth && videoEl.videoHeight) {
            const wrapper = videoEl.closest('.camera-wrapper');
            if (wrapper) {
              wrapper.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
            }
            if (debugCanvas) {
              debugCanvas.width = debugCanvas.clientWidth || videoEl.videoWidth;
              debugCanvas.height = debugCanvas.clientHeight || videoEl.videoHeight;
            }
            const hudRes = document.getElementById('hud-camera-resolution');
            if (hudRes) {
              const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
              const divisor = gcd(videoEl.videoWidth, videoEl.videoHeight);
              const aspectW = videoEl.videoWidth / divisor;
              const aspectH = videoEl.videoHeight / divisor;
              hudRes.textContent = `RES: ${videoEl.videoWidth} x ${videoEl.videoHeight} (${aspectW}:${aspectH})`;
            }
          }
          motionDetector = new MotionDetector(videoEl, debugCanvas);
          if (!mediaPipeDetector) {
            mediaPipeDetector = new MediaPipeDetector(videoEl, debugCanvas);
            mediaPipeDetector.setVisualization(aiDebugEnabled);
          }
          motionDetector.setThreshold(101 - currentSensitivity);
          if (!isRunning) {
            isRunning = true;
            requestAnimationFrame(gameLoop);
          }
          if (startCameraBtn) {
            startCameraBtn.textContent = 'Camera Active';
            startCameraBtn.classList.add('btn--success');
          }
          
          // Repopulate with labels now that we definitely have permission
          populateCameras();
        };

        if (videoEl.readyState >= 1) {
          initMotionDetector();
        } else {
          videoEl.addEventListener('loadedmetadata', initMotionDetector, { once: true });
        }
      }
      
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (startCameraBtn) {
        startCameraBtn.textContent = 'Error (Retry)';
        startCameraBtn.classList.add('btn--error');
      }
      showToast(`Camera error: ${err.message || 'Permission denied'}`);
    }
  }

function switchToNextEffect() {
  const enabledItems = playlist.filter(p => p.enabled);
  if (enabledItems.length > 0) {
    let idx = enabledItems.findIndex(p => p.name === activeEffect);
    let nextItem;
    if (idx === -1) {
      nextItem = enabledItems[0];
    } else {
      let nextIdx = idx + 1;
      if (nextIdx >= enabledItems.length) nextIdx = 0;
      nextItem = enabledItems[nextIdx];
    }
    changeEffectWithTransition(nextItem.name);
  } else {
    const effects = ['koi', 'garden', 'ripples', 'scatter', 'smoke', 'paint', 'reveal', 'pong', 'asteroids', 'footprints', 'ice'];
    let nextIdx = effects.indexOf(activeEffect) + 1;
    if (nextIdx >= effects.length) nextIdx = 0;
    changeEffectWithTransition(effects[nextIdx]);
  }
}

function updateProjectorStatus() {
  const dot = document.getElementById('projector-dot');
  const text = document.getElementById('projector-text');
  const cardDot = document.getElementById('projector-card-dot');
  const cardText = document.getElementById('projector-card-text');
  
  const isConnected = (projectorWindow && !projectorWindow.closed) || isHostPresentationActive;
  if (isConnected) {
    if (dot) {
      dot.style.backgroundColor = '#55efc4';
      dot.style.boxShadow = '0 0 8px #55efc4';
    }
    if (text) {
      text.textContent = isHostPresentationActive ? 'Host Mode Active' : 'Projector Connected';
    }
    if (cardDot) {
      cardDot.className = 'status-dot connected';
      cardDot.style.backgroundColor = '';
      cardDot.style.boxShadow = '';
    }
    if (cardText) {
      cardText.textContent = isHostPresentationActive ? 'Host Mode Active' : 'Projector Connected';
    }
  } else {
    if (dot) {
      dot.style.backgroundColor = '#ff7675';
      dot.style.boxShadow = '0 0 8px #ff7675';
    }
    if (text) {
      text.textContent = 'Projector Disconnected';
    }
    if (cardDot) {
      cardDot.className = 'status-dot disconnected';
      cardDot.style.backgroundColor = '';
      cardDot.style.boxShadow = '';
    }
    if (cardText) {
      cardText.textContent = 'Projector Disconnected';
    }
  }
}

function gameLoop(timestamp) {
  if (!isRunning) return;

  // Handle unexpected or manual closure of projector window
  if (projectorWindow && projectorWindow.closed) {
    projectorWindow = null;
    projectorCanvas = null;
    projectorCanvas1 = null;
    projectorCanvas2 = null;
    if (openProjectorBtn) {
      openProjectorBtn.textContent = 'Open Projector';
      openProjectorBtn.classList.remove('btn--success');
    }
    destroyProjectorEffects();
  }

  // Update projector connection status indicator
  updateProjectorStatus();

  // Handle target FPS limit throttling
  if (fpsLimit !== 'uncapped') {
    const targetFps = parseFloat(fpsLimit);
    const interval = 1000 / targetFps;
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;
    
    if (elapsed < interval) {
      requestAnimationFrame(gameLoop);
      return;
    }
  }

  // Update FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fpsVal = document.getElementById('fps-counter-val');
    if (fpsVal) {
      fpsVal.textContent = frameCount;
    }
    frameCount = 0;
    lastFpsTime = now;
  }

  if (isBlackout) {
    // If blackout is enabled, just clear both projector canvases to black and skip updates
    if (projectorCanvas1) {
      const ctx = projectorCanvas1.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, projectorCanvas1.width, projectorCanvas1.height);
    }
    if (projectorCanvas2) {
      const ctx = projectorCanvas2.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, projectorCanvas2.width, projectorCanvas2.height);
    }
    lastFrameTime = timestamp;
    requestAnimationFrame(gameLoop);
    return;
  }

  // Handle auto-rotate
  if (autoRotateEnabled) {
    if (!lastRotateTime) lastRotateTime = timestamp;
    const currentPlaylistItem = playlist.find(p => p.name === activeEffect);
    const duration = (currentPlaylistItem && currentPlaylistItem.enabled) ? currentPlaylistItem.duration : 30;
    if (timestamp - lastRotateTime > duration * 1000) {
      switchToNextEffect();
      lastRotateTime = timestamp;
    }
  }

  if (!lastFrameTime) lastFrameTime = timestamp;
  let elapsed = timestamp - lastFrameTime;
  if (fpsLimit !== 'uncapped') {
    const targetFps = parseFloat(fpsLimit);
    const interval = 1000 / targetFps;
    lastFrameTime = timestamp - (elapsed % interval);
  } else {
    lastFrameTime = timestamp;
  }
  const dt = Math.min(0.1, elapsed / 1000);
  const timeScale = dt * 60;

  const EMPTY_MOTION = { points: [], centroids: [], dir: {dx: 0, dy: 0}, dt: dt, timeScale: timeScale };

  let motionData = EMPTY_MOTION;
  if (activeDetectionMode === 'classic' && motionDetector) {
    motionData = motionDetector.update(homography, calibData);
  } else if (activeDetectionMode === 'ai' && mediaPipeDetector) {
    motionData = mediaPipeDetector.update(homography, calibData);
  }

  if (motionData !== EMPTY_MOTION) {
    motionData.dt = dt;
    motionData.timeScale = timeScale;
  }

  if (autoMotionEnabled) {
    const t = timestamp * 0.0015;
    const x = 0.5 + 0.38 * Math.sin(t * 1.7);
    const y = 0.5 + 0.38 * Math.cos(t * 1.2);
    const simCentroid = { x, y, mass: 50, count: 20 };
    if (!motionData.centroids) motionData.centroids = [];
    if (!motionData.points) motionData.points = [];
    motionData.centroids.push(simCentroid);
    motionData.points.push(simCentroid);
    const prevT = (timestamp - elapsed) * 0.0015;
    const prevX = 0.5 + 0.38 * Math.sin(prevT * 1.7);
    const prevY = 0.5 + 0.38 * Math.cos(prevT * 1.2);
    motionData.dir = { dx: x - prevX, dy: y - prevY };
  }


  
  const isProjectorActive = (projectorWindow && !projectorWindow.closed && (projectorCanvas1 || projectorCanvas2)) || (isHostPresentationActive && (projectorCanvas1 || projectorCanvas2));

  if (isProjectorActive) {
    if (transitionState.active) {
      const elapsed = performance.now() - transitionState.startTime;
      const progress = Math.min(1000, elapsed);
      
      const fromCanvas = transitionState.fromCanvasIndex === 1 ? projectorCanvas1 : projectorCanvas2;
      const toCanvas = transitionState.toCanvasIndex === 1 ? projectorCanvas1 : projectorCanvas2;
      
      if (progress < 500) {
        // Phase 1: Fade out old canvas to black
        if (fromCanvas) fromCanvas.style.opacity = (1 - progress / 500).toFixed(3);
        if (toCanvas) toCanvas.style.opacity = '0';
      } else {
        // Phase 2: Fade in new canvas from black
        if (fromCanvas) fromCanvas.style.opacity = '0';
        if (toCanvas) toCanvas.style.opacity = ((progress - 500) / 500).toFixed(3);
      }

      // Update both effects concurrently during transition
      if (transitionState.fromEffect && typeof transitionState.fromEffect.update === 'function') {
        transitionState.fromEffect.update(motionData);
      }
      if (transitionState.toEffect && typeof transitionState.toEffect.update === 'function') {
        transitionState.toEffect.update(motionData);
      }

      // Check transition duration (1000ms fixed)
      if (progress >= 1000) {
        completeTransitionImmediately();
        lastRotateTime = timestamp;
      }
    } else {
      if (projectorCanvas1) projectorCanvas1.style.opacity = activeCanvasIndex === 1 ? '1' : '0';
      if (projectorCanvas2) projectorCanvas2.style.opacity = activeCanvasIndex === 2 ? '1' : '0';
      if (currentEffectObj && typeof currentEffectObj.update === 'function') {
        currentEffectObj.update(motionData);
      }
    }
  }

  // Update mini audio equalizer visualizer
  if (equalizerBars && equalizerBars.length > 0) {
    const analyser = getAnalyser();
    const isAudioActive = getAudioEnabled() && soundToggle && soundToggle.checked;
    
    if (isAudioActive && analyser) {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      
      // Map frequencies to the 5 equalizer bars
      const sampleIndices = [2, 5, 8, 11, 14];
      equalizerBars.forEach((bar, index) => {
        const sampleValue = dataArray[sampleIndices[index]] || 0;
        // Map 0-255 to 3px-16px height
        const height = 3 + (sampleValue / 255) * 13;
        bar.style.height = `${height}px`;
      });
    } else {
      equalizerBars.forEach(bar => {
        bar.style.height = '3px';
      });
    }
  }

  requestAnimationFrame(gameLoop);
}

// Toast notification utility
function showToast(message, type = 'error') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast' + (type === 'success' ? ' toast-success' : '');
  // Force reflow then show
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Don't intercept if user is in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  
  const effects = ['koi', 'garden', 'ripples', 'scatter', 'smoke', 'paint', 'reveal', 'pong', 'asteroids', 'footprints', 'ice', 'sand', 'harmonograph', 'pixie'];
  
  switch (e.key) {
    case 'Escape':
      const welcomeOverlay = document.getElementById('welcome-guide-overlay');
      if (welcomeOverlay && welcomeOverlay.classList.contains('show')) {
        welcomeOverlay.classList.remove('show');
        const skipGuideCheckbox = document.getElementById('skip-guide-checkbox');
        if (skipGuideCheckbox && skipGuideCheckbox.checked) {
          safeSetItem('visualuxShowGuide', 'false');
        }
      }
      break;
    case 'z':
    case 'Z':
      if (e.ctrlKey) {
        e.preventDefault();
        undoWarp();
      }
      break;
    case 'y':
    case 'Y':
      if (e.ctrlKey) {
        e.preventDefault();
        redoWarp();
      }
      break;
    case 'f':
    case 'F':
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
      break;
    case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
      const idx = parseInt(e.key) - 1;
      if (idx < effects.length) {
        changeEffectWithTransition(effects[idx]);
      }
      break;
    case '0':
    case 'q':
    case 'Q':
    case 'w':
    case 'W':
      changeEffectWithTransition('footprints');
      break;
    case 'e':
    case 'E':
    case 'r':
    case 'R':
      changeEffectWithTransition('ice');
      break;
    case 't':
    case 'T':
      changeEffectWithTransition('sand');
      break;

    case 'u':
    case 'U':
      changeEffectWithTransition('harmonograph');
      break;
    case 'h':
    case 'H':
      changeEffectWithTransition('pixie');
      break;

    // Volume Control Hotkeys: [ to decrease, ] to increase
    case '[':
      if (volumeSlider) {
        let val = Math.max(0, parseInt(volumeSlider.value) - 5);
        volumeSlider.value = val;
        setAudioVolume(val / 100);
        if (volumeVal) volumeVal.textContent = val + '%';
        showToast(`Volume: ${val}%`, 'success');
      }
      break;
    case ']':
      if (volumeSlider) {
        let val = Math.min(100, parseInt(volumeSlider.value) + 5);
        volumeSlider.value = val;
        setAudioVolume(val / 100);
        if (volumeVal) volumeVal.textContent = val + '%';
        showToast(`Volume: ${val}%`, 'success');
      }
      break;

    // Motion Sensitivity Hotkeys: - (or _) to decrease, = (or +) to increase
    case '-':
    case '_': {
      let val = Math.max(10, Math.round((currentSensitivity - 10) / 10) * 10);
      currentSensitivity = val;
      if (motionDetector) {
        motionDetector.setThreshold(101 - currentSensitivity);
      }
      updateSensitivityUI(currentSensitivity);
      saveSettings();
      showToast(`Motion Sensitivity: ${currentSensitivity}`, 'success');
      break;
    }
    case '=':
    case '+': {
      let val = Math.min(100, Math.round((currentSensitivity + 10) / 10) * 10);
      currentSensitivity = val;
      if (motionDetector) {
        motionDetector.setThreshold(101 - currentSensitivity);
      }
      updateSensitivityUI(currentSensitivity);
      saveSettings();
      showToast(`Motion Sensitivity: ${currentSensitivity}`, 'success');
      break;
    }
  }
});

// Range slider track background color fills
function updateRangeSliderFill(slider) {
  if (!slider) return;
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value) || 0;
  const percent = ((val - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, rgba(255, 255, 255, 0.08) ${percent}%, rgba(255, 255, 255, 0.08) 100%)`;
}

function initializeAllSliderFills() {
  document.querySelectorAll('input[type="range"]').forEach(updateRangeSliderFill);
}

// Global listener for slider updates
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
    updateRangeSliderFill(e.target);
  }
});

// Ambient Particles Canvas Background
function setupAmbientBackground() {
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  
  const particles = [];
  const count = 35; // lightweight, zero impact on performance
  
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -Math.random() * 0.25 - 0.05,
      size: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.25 + 0.05
    });
  }

  let mx = -9999;
  let my = -9999;
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mx = -9999;
    my = -9999;
  });
  
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
  
  function drawParticles() {
    ctx.clearRect(0, 0, width, height);
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      // Screen wrap
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
      
      // Mouse magnetic drift
      if (mx !== -9999) {
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          p.x += (dx / dist) * 0.15;
          p.y += (dy / dist) * 0.15;
        }
      }
      
      ctx.fillStyle = `rgba(168, 85, 247, ${p.alpha})`; // soft neon violet dust
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    
    requestAnimationFrame(drawParticles);
  }
  drawParticles();
}

// --- Host Presentation Mode (Single-Device / Fullscreen) Functions ---
async function enterHostPresentationMode() {
  const overlay = document.getElementById('host-presentation-overlay');
  const hc1 = document.getElementById('host-canvas-1');
  const hc2 = document.getElementById('host-canvas-2');
  if (!overlay || !hc1 || !hc2) return;

  // Auto-start camera if it is not active
  const isCameraActive = videoEl && videoEl.srcObject && videoEl.srcObject.getTracks().some(t => t.readyState === 'live');
  if (!isCameraActive) {
    await startCamera();
  }

  // Backup existing projector variables
  prevProjectorWindow = projectorWindow;
  prevProjectorCanvas1 = projectorCanvas1;
  prevProjectorCanvas2 = projectorCanvas2;

  // Assign canvases to host canvases
  projectorCanvas1 = hc1;
  projectorCanvas2 = hc2;

  // Adjust size of the host canvases to match screen dimensions
  const scale = renderResolutionScale || 1.0;
  hc1.width = Math.round(window.innerWidth * scale);
  hc1.height = Math.round(window.innerHeight * scale);
  hc2.width = Math.round(window.innerWidth * scale);
  hc2.height = Math.round(window.innerHeight * scale);

  // Mark Host Presentation Mode as active
  isHostPresentationActive = true;

  // Show presentation overlay and fade out admin panel
  document.body.classList.add('presentation-mode');
  overlay.style.display = 'block';

  // Request fullscreen
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen request failed:", err);
  }

  // Request screen Wake Lock to prevent smartphone timeout
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock acquired.');
    } catch (err) {
      console.warn(`Screen Wake Lock request failed: ${err.message}`);
    }
  }

  // Initialize the effects loop on the new canvases
  initializeProjectorEffects(hc1, hc2);

  // Update status indicators and buttons
  updateProjectorStatus();
  const hostBtn = document.getElementById('host-presentation-btn');
  if (hostBtn) {
    hostBtn.textContent = 'Host Presentation Active';
    hostBtn.classList.add('btn--success');
  }

  showToast('Entered Host Presentation Mode', 'success');
}

async function exitHostPresentationMode() {
  if (!isHostPresentationActive) return;

  // Release screen Wake Lock
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Screen Wake Lock released.');
    } catch (err) {
      console.error('Failed to release wake lock:', err);
    }
  }

  // Reset Eco/Dim overlay state
  const dimOverlay = document.getElementById('presentation-dim-overlay');
  if (dimOverlay) dimOverlay.style.display = 'none';
  const dimBtn = document.getElementById('dim-presentation-btn');
  if (dimBtn) dimBtn.textContent = 'Eco Mode (Dim)';

  // Hide overlay, remove presentation class, and exit fullscreen if active
  document.body.classList.remove('presentation-mode');
  const overlay = document.getElementById('host-presentation-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  }

  // Mark as inactive
  isHostPresentationActive = false;

  // Restore previous projector window if active
  if (prevProjectorWindow && !prevProjectorWindow.closed) {
    projectorWindow = prevProjectorWindow;
    projectorCanvas1 = prevProjectorCanvas1;
    projectorCanvas2 = prevProjectorCanvas2;
    initializeProjectorEffects(projectorCanvas1, projectorCanvas2);
  } else {
    projectorWindow = null;
    destroyProjectorEffects();
  }

  // Clear prev backup state
  prevProjectorWindow = null;
  prevProjectorCanvas1 = null;
  prevProjectorCanvas2 = null;

  // Update status indicators and buttons
  updateProjectorStatus();
  const hostBtn = document.getElementById('host-presentation-btn');
  if (hostBtn) {
    hostBtn.textContent = 'Host Presentation Mode';
    hostBtn.classList.remove('btn--success');
  }

  showToast('Exited Host Presentation Mode');
}

// Global keydown for Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isHostPresentationActive) {
    exitHostPresentationMode();
  }
});

// Presentation Controls Inactivity Fade
let presentationControlsTimeout = null;
const presentationControls = document.getElementById('presentation-controls');

document.addEventListener('mousemove', (e) => {
  if (!isHostPresentationActive || !presentationControls) return;
  
  presentationControls.style.opacity = '1';
  presentationControls.style.transform = 'translateX(0)';
  
  clearTimeout(presentationControlsTimeout);
  presentationControlsTimeout = setTimeout(() => {
    presentationControls.style.opacity = '0';
    presentationControls.style.transform = 'translateX(20px)';
  }, 2500);
});

// Eco Mode (Dim Screen) toggle
function toggleEcoMode() {
  const dimOverlay = document.getElementById('presentation-dim-overlay');
  const dimBtn = document.getElementById('dim-presentation-btn');
  if (!dimOverlay || !dimBtn) return;

  if (dimOverlay.style.display === 'block') {
    dimOverlay.style.display = 'none';
    dimBtn.textContent = 'Eco Mode (Dim)';
    showToast('Eco Mode deactivated');
  } else {
    dimOverlay.style.display = 'block';
    dimBtn.textContent = 'Undim Screen';
    showToast('Eco Mode (Dim) activated to save battery', 'success');
  }
}

// Global Event Listeners for Host Presentation Mode
document.addEventListener('fullscreenchange', () => {
  if (isHostPresentationActive && !document.fullscreenElement) {
    exitHostPresentationMode();
  }
});

window.addEventListener('resize', () => {
  if (isHostPresentationActive) {
    const hc1 = document.getElementById('host-canvas-1');
    const hc2 = document.getElementById('host-canvas-2');
    const scale = renderResolutionScale || 1.0;
    if (hc1) {
      hc1.width = Math.round(window.innerWidth * scale);
      hc1.height = Math.round(window.innerHeight * scale);
    }
    if (hc2) {
      hc2.width = Math.round(window.innerWidth * scale);
      hc2.height = Math.round(window.innerHeight * scale);
    }
  }
});

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'hidden') {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Screen Wake Lock released due to visibility change.');
    } catch (err) {
      console.error('Failed to release wake lock on visibility change:', err);
    }
  } else if (isHostPresentationActive && document.visibilityState === 'visible' && wakeLock === null) {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock re-acquired.');
      } catch (err) {
        console.warn(`Screen Wake Lock re-acquisition failed: ${err.message}`);
      }
    }
  }
});

// Setup and Event Bindings
function setupHostPresentationMode() {
  safeAddListener('host-presentation-btn', 'click', enterHostPresentationMode);
  safeAddListener('exit-presentation-btn', 'click', exitHostPresentationMode);
  safeAddListener('dim-presentation-btn', 'click', toggleEcoMode);

  // Double click on host presentation overlay to exit
  safeAddListener('host-presentation-overlay', 'dblclick', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    exitHostPresentationMode();
  });

  // Double tap on host presentation overlay (mobile touch support) to exit
  let lastTap = 0;
  const overlay = document.getElementById('host-presentation-overlay');
  if (overlay) {
    overlay.addEventListener('touchend', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      if (tapLength < 500 && tapLength > 0) {
        exitHostPresentationMode();
        e.preventDefault();
      }
      lastTap = currentTime;
    });
  }
}

init();
