import { playChime, throttledPlay } from './audio.js';

export const PIXIE_PALETTES = {
  magical: ['#ffd700', '#ffdf00', '#ffeb73'], // gold and champagne colors
  cosmic: ['#ffeaa7', '#a29bfe', '#fd79a8', '#0984e3', '#00cec9'],  // apricot, lilac, rose, sky, mint
  aurora: ['#00ffaa', '#00f3ff', '#ff00ff', '#ffe3a8', '#ffffff']   // neon green, cyan, magenta, light gold, white
};

export class PixieDust {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    this.mainParticles = [];
    this.trailParticles = [];
    this.presetName = 'magical';
    this.colors = PIXIE_PALETTES[this.presetName];
    
    // Sliders / customization parameters
    this.gravity = 0.0; // remove gravity
    this.drift = 0.0;   // tight spawn

    this.particleCountLimit = 600;

    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  destroy() {
    const win = this.canvas.ownerDocument.defaultView || window;
    win.removeEventListener('resize', this.resizeHandler);
  }

  resize() {
    const win = this.canvas.ownerDocument.defaultView || window;
    this.canvas.width = win.innerWidth;
    this.canvas.height = win.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  init() {
    this.mainParticles = [];
    this.trailParticles = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  setPreset(presetName) {
    if (PIXIE_PALETTES[presetName]) {
      this.presetName = presetName;
      this.colors = PIXIE_PALETTES[presetName];
    }
  }

  update(motionData) {
    const { centroids = [], points = [], timeScale = 1.0 } = motionData;
    const motionPoints = centroids.length > 0 ? centroids : points;

    // 1. Fade screen slightly to leave glowing trails
    this.ctx.globalCompositeOperation = 'source-over';
    // Dark transparent overlay
    this.ctx.fillStyle = 'rgba(10, 8, 15, 0.08)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Set additive blending for glowing effect
    this.ctx.globalCompositeOperation = 'lighter';
    const timestamp = performance.now();

    // 2. Spawn main stardust cores from motion centroids/points
    if (motionPoints.length > 0 && this.mainParticles.length + this.trailParticles.length < this.particleCountLimit) {
      // play a chime on interaction
      throttledPlay(playChime, 250);

      motionPoints.forEach(p => {
        // Spawn 2-4 main particles per motion source per frame
        const count = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < count; i++) {
          this.mainParticles.push({
            x: p.x * this.width + (Math.random() - 0.5) * 4,
            y: p.y * this.height + (Math.random() - 0.5) * 4,
            vx: 0,
            vy: 0,
            size: Math.random() * 4.0 + 2.5,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            alpha: 1.0,
            decay: 0.008 + Math.random() * 0.012,
            phase: Math.random() * Math.PI * 2
          });
        }
      });
    }

    // 3. Update main stardust cores
    for (let i = this.mainParticles.length - 1; i >= 0; i--) {
      const p = this.mainParticles[i];
      
      // Physics: gravity + brownian horizontal drift
      p.vy += this.gravity * 0.15 * timeScale;
      p.vx += (Math.random() - 0.5) * this.drift * 0.4 * timeScale;
      // Drag/friction
      p.vx *= Math.pow(0.98, timeScale);
      p.vy *= Math.pow(0.98, timeScale);

      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;
      p.alpha -= p.decay * timeScale;

      if (p.alpha <= 0 || p.x < 0 || p.x > this.width || p.y > this.height) {
        this.mainParticles.splice(i, 1);
        continue;
      }

      // Draw main particle
      const osc = (Math.sin(timestamp * 0.005 + p.phase) + 1) * 0.5;
      this.ctx.globalAlpha = p.alpha * osc;
      this.ctx.fillStyle = p.color;
      
      const oscSize = p.size * (0.5 + 0.5 * osc);
      
      // Draw a soft glowing stardust circle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, oscSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Spawn trail sparkles
      if (Math.random() < 0.65 * timeScale) {
        this.trailParticles.push({
          x: p.x + (Math.random() - 0.5) * 4,
          y: p.y + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.6 + 0.2, // falls slowly
          size: p.size * (0.3 + Math.random() * 0.3),
          color: p.color,
          alpha: p.alpha * 0.9,
          decay: 0.015 + Math.random() * 0.02,
          twinkleSpeed: 0.01 + Math.random() * 0.02,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    // 4. Update trail sparkles with twinkling effect
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i];
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;
      p.alpha -= p.decay * timeScale;

      if (p.alpha <= 0 || p.y > this.height) {
        this.trailParticles.splice(i, 1);
        continue;
      }

      // Twinkle calculation: oscillate alpha based on phase
      const twinkle = 0.4 + 0.6 * Math.sin(timestamp * p.twinkleSpeed + p.phase);
      const renderAlpha = Math.max(0, Math.min(1.0, p.alpha * twinkle));

      this.ctx.globalAlpha = renderAlpha;
      this.ctx.fillStyle = p.color;

      // Draw star/glitter shape or small circle
      this.ctx.beginPath();
      // Draw cross/star shapes for larger sparkles, standard circles for smaller
      if (p.size > 2.0 && Math.random() < 0.2) {
        // Draw 4-point star
        const r = p.size;
        this.ctx.moveTo(p.x, p.y - r);
        this.ctx.lineTo(p.x + r * 0.3, p.y - r * 0.3);
        this.ctx.lineTo(p.x + r, p.y);
        this.ctx.lineTo(p.x + r * 0.3, p.y + r * 0.3);
        this.ctx.lineTo(p.x, p.y + r);
        this.ctx.lineTo(p.x - r * 0.3, p.y + r * 0.3);
        this.ctx.lineTo(p.x - r, p.y);
        this.ctx.lineTo(p.x - r * 0.3, p.y - r * 0.3);
        this.ctx.closePath();
        this.ctx.fill();
      } else {
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Reset rendering states for context purity
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}
