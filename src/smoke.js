export const SMOKE_PALETTES = {
  purple: ['#a855f7', '#8b5cf6', '#6366f1', '#4f46e5'],
  cyan: ['#00f3ff', '#00cec9', '#81ecec', '#0984e3'],
  emerald: ['#10b981', '#059669', '#0284c7', '#06b6d4'],
  fire: ['#ef4444', '#f97316', '#f59e0b', '#e11d48'],
  mist: ['#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8']
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

export class SmokeTrails {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.particles = [];
    this.palette = 'purple';
    this.colors = SMOKE_PALETTES[this.palette];
    this.maxParticles = 300;
    this.particleLifetime = 150;
    this.windX = 0;
    
    this.spriteCanvases = [];
    this.preRenderSprites();
    
    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  preRenderSprites() {
    this.spriteCanvases = this.colors.map(color => {
      const win = this.canvas.ownerDocument.defaultView || window;
      const spriteCanvas = win.document.createElement('canvas');
      const size = 128;
      spriteCanvas.width = size;
      spriteCanvas.height = size;
      const ctx = spriteCanvas.getContext('2d');
      const half = size / 2;
      const rgb = hexToRgb(color);
      
      const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1.0)`);
      grad.addColorStop(0.35, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
      grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(half, half, half, 0, Math.PI * 2);
      ctx.fill();
      
      return spriteCanvas;
    });
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

  setPalette(paletteName) {
    if (SMOKE_PALETTES[paletteName]) {
      this.palette = paletteName;
      this.colors = SMOKE_PALETTES[paletteName];
      this.preRenderSprites();
    }
  }

  init() {
    this.particles = [];
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];

    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;

    // 1. Slow Fade Canvas
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.06)'; // Keeps trails short-lived and clean
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Use additive blending for bright glowing gas overlays
    this.ctx.globalCompositeOperation = 'lighter';

    // 2. Spawn Smoke cloud particles on active motion coordinates
    if (motionPoints.length > 0) {
      const sampleCount = Math.min(12, motionPoints.length);
      for (let i = 0; i < sampleCount; i++) {
        // Space coordinates evenly
        const m = motionPoints[Math.floor((i / sampleCount) * motionPoints.length)];
        const mx = m.x * this.width;
        const my = m.y * this.height;

        // Spawn particles if within limit
        if (this.particles.length < this.maxParticles) {
          const color = this.colors[Math.floor(Math.random() * this.colors.length)];
          const colorIndex = this.colors.indexOf(color);
          this.particles.push({
            x: mx + (Math.random() - 0.5) * 20,
            y: my + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5 - 0.5, // slightly drifting upwards on spawn
            size: Math.random() * 15 + 10,       // initial cloud radius
            growth: Math.random() * 0.8 + 0.4,   // cloud expands as it floats
            alpha: Math.random() * 0.35 + 0.2,   // initial opacity
            decay: (Math.random() * 0.006 + 0.004) * (150 / (this.particleLifetime || 150)),// how fast it fades
            color: color,
            colorIndex: colorIndex,
            rgb: hexToRgb(color),
            life: Math.random() * 100
          });
        }
      }
    }

    // 3. Update & Render Smoke Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Physics drift: slow upward float (buoyancy) + sinusoidal breeze
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.03; // buoyancy force
      p.vx += Math.sin(p.life * 0.04) * 0.1 + (this.windX || 0); // breeze vector + wind
      p.vx *= 0.98;
      p.vy *= 0.98;

      p.size += p.growth;
      p.alpha -= p.decay;
      p.life += 1;

      if (p.alpha <= 0 || p.size <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw pre-rendered soft glowing radial cloud
      const sprite = this.spriteCanvases[p.colorIndex];
      if (sprite) {
        this.ctx.globalAlpha = p.alpha;
        this.ctx.drawImage(sprite, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
    }

    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1.0;
  }
}
