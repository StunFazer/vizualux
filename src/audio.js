// Zero-dependency Web Audio API Synthesizer for Floor Projection Effects

let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;
let analyserNode = null;

let enabled = true;
let volume = 0.5;

// Load initial settings safely from localStorage
try {
  const savedEnabled = localStorage.getItem('visualuxAudioEnabled');
  if (savedEnabled !== null) {
    enabled = savedEnabled === 'true';
  }
  const savedVolume = localStorage.getItem('visualuxAudioVolume');
  if (savedVolume !== null) {
    volume = parseFloat(savedVolume);
  }
} catch (e) {
  console.warn("Could not read audio settings from localStorage:", e);
}

// Generate a white noise buffer
function createNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 0.5; // 0.5 seconds of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function getAnalyser() {
  return analyserNode;
}

// Lazy initialization of AudioContext and Master Gain
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.error("Web Audio API is not supported in this browser.");
      return null;
    }
    audioCtx = new AudioContextClass();
    
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
    
    // Create AnalyserNode for audio visualization
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 64; // Small fftSize for mini visualizer
    
    masterGain.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    
    noiseBuffer = createNoiseBuffer(audioCtx);
  }
  
  // Try to resume the context if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch((err) => console.warn("Failed to auto-resume AudioContext:", err));
  }
  
  return audioCtx;
}

function getNoiseBuffer() {
  const ctx = getAudioContext();
  if (!noiseBuffer && ctx) {
    noiseBuffer = createNoiseBuffer(ctx);
  }
  return noiseBuffer;
}

// Auto-resume on interaction
function initInteractionAutoResume() {
  const resume = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch((err) => console.warn("Failed to resume context on user gesture:", err));
    }
  };
  
  const win = typeof window !== 'undefined' ? window : null;
  if (win) {
    win.addEventListener('click', resume, { capture: true, passive: true });
    win.addEventListener('touchstart', resume, { capture: true, passive: true });
    win.addEventListener('keydown', resume, { capture: true, passive: true });
  }
}

initInteractionAutoResume();

// Volume/Enabled controller methods
export function setEnabled(val) {
  enabled = !!val;
  try {
    localStorage.setItem('visualuxAudioEnabled', enabled);
  } catch (e) {}
}

export function getEnabled() {
  return enabled;
}

export function setVolume(val) {
  volume = Math.max(0, Math.min(1, parseFloat(val)));
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
  }
  try {
    localStorage.setItem('visualuxAudioVolume', volume);
  } catch (e) {}
}

export function getVolume() {
  return volume;
}

let triggerTimestamps = [];

function getDensityDuckingFactor() {
  const now = Date.now();
  triggerTimestamps = triggerTimestamps.filter(t => now - t < 400);
  triggerTimestamps.push(now);
  const count = triggerTimestamps.length;
  if (count <= 3) {
    return 1.0;
  }
  return Math.min(1.0, 3.2 / count);
}

// Synthesizer Triggers

// 1. Water Bubble Sound
function playBubble(timeOffset = 0) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const startTime = now + timeOffset;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sine';
  
  // Bubble pitch sweep: low frequency rising to high frequency
  const startFreq = 150 + Math.random() * 80;
  const endFreq = 600 + Math.random() * 200;
  const duration = 0.08 + Math.random() * 0.08;
  
  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
  
  const duck = getDensityDuckingFactor();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.25 * duck, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  
  osc.connect(gainNode);
  if (masterGain) gainNode.connect(masterGain);
  
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// Play multiple bubble sounds stacked to form a splash
export function playSplash() {
  const numBubbles = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numBubbles; i++) {
    const delay = i * 0.035 + Math.random() * 0.025;
    playBubble(delay);
  }
}

// 2. Splat Squish
export function playSplat() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;
  
  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();
  
  // Squishy wet bandpass noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.14);
  filter.Q.setValueAtTime(2.5, now);
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.35 * duck, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  if (masterGain) noiseGain.connect(masterGain);
  
  // Low-frequency splat impact thud
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
  
  oscGain.gain.setValueAtTime(0.45 * duck, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  
  osc.connect(oscGain);
  if (masterGain) oscGain.connect(masterGain);
  
  noise.start(now);
  osc.start(now);
  
  noise.stop(now + 0.2);
  osc.stop(now + 0.2);
}

// 3. Retro Laser Shot
export function playShoot() {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  // Retro sawtooth pitch drop
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1100, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
  
  gainNode.gain.setValueAtTime(0.12 * duck, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  
  osc.connect(gainNode);
  if (masterGain) gainNode.connect(masterGain);
  
  osc.start(now);
  osc.stop(now + 0.22);
}

// 4. Lowpass Noise Explosion
export function playExplosion() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;
  
  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();
  
  // Rumbling noise
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(250, now);
  filter.frequency.exponentialRampToValueAtTime(12, now + 0.55);
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.55 * duck, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  if (masterGain) noiseGain.connect(masterGain);
  
  // Low-frequency impact oscillator
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(70, now);
  osc.frequency.linearRampToValueAtTime(15, now + 0.35);
  
  oscGain.gain.setValueAtTime(0.65 * duck, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  
  osc.connect(oscGain);
  if (masterGain) oscGain.connect(masterGain);
  
  noise.start(now);
  osc.start(now);
  
  noise.stop(now + 0.65);
  osc.stop(now + 0.65);
}

// 5. Retro Bleep (Square-wave)
export function playBleep(freq) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, now);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.08 * duck, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  
  osc.connect(gainNode);
  if (masterGain) gainNode.connect(masterGain);
  
  osc.start(now);
  osc.stop(now + 0.12);
}

// 6. Shimmering Chime Chord (Zen Garden)
export function playChime() {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();

  // Three layered sine tones forming a sparkly harmonic chord
  const freqs = [880, 1320, 1760];
  const decays = [0.6, 0.45, 0.3];
  const gains = [0.06, 0.04, 0.03];

  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqs[i] + (Math.random() - 0.5) * 8, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gains[i] * duck, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

    osc.connect(gainNode);
    if (masterGain) gainNode.connect(masterGain);

    osc.start(now);
    osc.stop(now + decays[i] + 0.05);
  }
}

const lastPlayed = new Map();

export function throttledPlay(fn, delay) {
  const lastTime = lastPlayed.get(fn) || 0;
  const now = Date.now();
  if (now - lastTime >= delay) {
    lastPlayed.set(fn, now);
    fn();
  }
}

// 7. Sharp Ice Crack
export function playCrack() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;

  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();

  // Short bandpassed noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3200 + Math.random() * 800, now);
  filter.Q.setValueAtTime(6.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.22 * duck, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  noise.connect(filter);
  filter.connect(gain);
  if (masterGain) gain.connect(masterGain);

  // Quick high-pitched oscillator pop
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);

  oscGain.gain.setValueAtTime(0.2 * duck, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  osc.connect(oscGain);
  if (masterGain) oscGain.connect(masterGain);

  noise.start(now);
  osc.start(now);
  noise.stop(now + 0.08);
  osc.stop(now + 0.08);
}

// 8. Heavy Shattering
export function playShatter() {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Trigger 4 rapid cracks
  for (let i = 0; i < 4; i++) {
    const delay = i * 0.035;
    setTimeout(() => {
      playCrack();
    }, delay * 1000);
  }

  // Trigger splash shortly after
  setTimeout(() => {
    playSplash();
  }, 60);
}

// 9. Frost Scratch
export function playIceScratch() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;

  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2500, now);
  filter.frequency.linearRampToValueAtTime(1200, now + 0.05);
  filter.Q.setValueAtTime(4.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.07 * duck, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  noise.connect(filter);
  filter.connect(gain);
  if (masterGain) gain.connect(masterGain);

  noise.start(now);
  noise.stop(now + 0.08);
}

// 10. Fog Whoosh
export function playWindWhoosh() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;

  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(350, now);
  filter.frequency.exponentialRampToValueAtTime(550, now + 0.3);
  filter.frequency.exponentialRampToValueAtTime(250, now + 0.8);
  filter.Q.setValueAtTime(1.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0, now);
  gain.gain.linearRampToValueAtTime(0.18 * duck, now + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

  noise.connect(filter);
  filter.connect(gain);
  if (masterGain) gain.connect(masterGain);

  noise.start(now);
  noise.stop(now + 0.9);
}

// 11. Snow Crunch
export function playSnowCrunch() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;

  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();

  // Layer 1: Crunch noise
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1500, now);
  filter.Q.setValueAtTime(5.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15 * duck, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  noise.connect(filter);
  filter.connect(gain);
  if (masterGain) gain.connect(masterGain);

  // Layer 2: Lower thud
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(90, now);
  oscGain.gain.setValueAtTime(0.25 * duck, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(oscGain);
  if (masterGain) oscGain.connect(masterGain);

  noise.start(now);
  osc.start(now);
  noise.stop(now + 0.15);
  osc.stop(now + 0.15);
}

// 12. Soft Sand Step
export function playSandStep() {
  if (!enabled) return;
  const ctx = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!ctx || !buffer) return;

  const now = ctx.currentTime;
  const duck = getDensityDuckingFactor();

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(220, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12 * duck, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  noise.connect(filter);
  filter.connect(gain);
  if (masterGain) gain.connect(masterGain);

  noise.start(now);
  noise.stop(now + 0.25);
}