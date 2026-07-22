import { playChime, throttledPlay } from './audio.js';

export const HARMONO_PRESETS = {
  vector: {
    colors: ['#ff007f', '#00f3ff', '#fffb00'],
    bg: '#030206',
    sparkles: false
  },
  orbit: {
    colors: ['#ffeaa7', '#a29bfe', '#e84393'],
    bg: '#020108',
    sparkles: true
  },
  laser: {
    colors: ['#00ffaa', '#00f3ff', '#ff00ff'],
    bg: '#000402',
    sparkles: false
  }
};

class HarmonicPen {
  constructor(x, y, colors) {
    this.x = x;
    this.y = y;
    this.prevTargetX = x;
    this.prevTargetY = y;
    this.colors = colors;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    
    // Set up unique pendulum parameters (frequencies, phases, damping)
    this.f1 = 2 + Math.random() * 3;
    this.f2 = 1.5 + Math.random() * 2;
    this.f3 = 2.5 + Math.random() * 3;
    this.f4 = 1.8 + Math.random() * 2.5;

    this.p1 = Math.random() * Math.PI * 2;
    this.p2 = Math.random() * Math.PI * 2;
    this.p3 = Math.random() * Math.PI * 2;
    this.p4 = Math.random() * Math.PI * 2;

    this.t = 0;
    this.amp = 0;       // target amplitude driven by motion speed
    this.currentAmp = 0;// smoothed amplitude
  }

  update(tx, ty, speed, friction, speedMult, timeScale) {
    // Smoothly interpolate center position
    this.x = this.x * (1 - 0.1 * timeScale) + tx * (0.1 * timeScale);
    this.y = this.y * (1 - 0.1 * timeScale) + ty * (0.1 * timeScale);

    // Speed increases amplitude of oscillations
    this.amp = Math.min(180, this.amp * (1 - 0.05 * timeScale) + (speed * 450) * (0.05 * timeScale));
    this.currentAmp = this.currentAmp * (1 - 0.08 * timeScale) + this.amp * (0.08 * timeScale);

    // Evolve time variable
    this.t += 0.04 * speedMult * timeScale;
  }

  getPoint() {
    // Harmonograph equations (two joint virtual 2D pendulums)
    const amp = this.currentAmp;
    
    // Add dampening/decay based on virtual pendulum physics
    const decay = Math.exp(-0.01 * this.t);
    
    const dx = (Math.sin(this.t * this.f1 + this.p1) + Math.sin(this.t * this.f2 + this.p2)) * 0.5 * amp * decay;
    const dy = (Math.sin(this.t * this.f3 + this.p3) + Math.sin(this.t * this.f4 + this.p4)) * 0.5 * amp * decay;

    return {
      x: this.x + dx,
      y: this.y + dy
    };
  }
}

export class HarmonographEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    this.presetName = 'vector';
    this.colors = HARMONO_PRESETS[this.presetName].colors;
    this.bg = HARMONO_PRESETS[this.presetName].bg;
    this.sparkles = HARMONO_PRESETS[this.presetName].sparkles;

    // Adjustable from UI
    this.curveFriction = 0.005; 
    this.pendulumSpeed = 1.0;
    this.lineThickness = 2.0;

    this.pens = new Map();
    this.particles = [];

    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
    this.init();
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
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.pens.clear();
    this.particles = [];
  }

  setPreset(presetName) {
    if (HARMONO_PRESETS[presetName]) {
      this.presetName = presetName;
      this.colors = HARMONO_PRESETS[presetName].colors;
      this.bg = HARMONO_PRESETS[presetName].bg;
      this.sparkles = HARMONO_PRESETS[presetName].sparkles;
      
      // Update color palette of existing pens
      for (const [key, pen] of this.pens) {
        pen.colors = this.colors;
        pen.color = this.colors[Math.floor(Math.random() * this.colors.length)];
      }
    }
  }

  setCurveFriction(val) {
    this.curveFriction = val;
  }

  setPendulumSpeed(val) {
    this.pendulumSpeed = val;
  }

  setLineThickness(val) {
    this.lineThickness = val;
  }

  update(motionData) {
    const { centroids = [], points = [], timeScale = 1.0 } = motionData;
    const activeCentroids = centroids || [];

    // 1. Slow decay overlay to create glowing mathematical trails
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = this.bg;
    // Lower alpha keeps trails longer and more intense
    this.ctx.globalAlpha = 0.035;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Reset alpha and set drawing parameters
    this.ctx.globalAlpha = 1.0;
    this.ctx.lineWidth = this.lineThickness;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    const currentKeys = new Set();

    activeCentroids.forEach((c, idx) => {
      const key = idx;
      currentKeys.add(key);

      const cx = c.x * this.width;
      const cy = c.y * this.height;

      let pen = this.pens.get(key);
      let speed = 0.05;

      if (!pen) {
        pen = new HarmonicPen(cx, cy, this.colors);
        this.pens.set(key, pen);
      } else {
        // Compute speed for amplitude injection
        const dx = cx - pen.x;
        const dy = cy - pen.y;
        speed = Math.hypot(dx, dy) / Math.hypot(this.width, this.height);
      }

      const SUB_STEPS = 8;
      const subTimeScale = timeScale / SUB_STEPS;
      const startTargetX = pen.prevTargetX !== undefined ? pen.prevTargetX : cx;
      const startTargetY = pen.prevTargetY !== undefined ? pen.prevTargetY : cy;

      this.ctx.strokeStyle = pen.color;
      this.ctx.beginPath();
      
      let p1 = pen.getPoint();
      this.ctx.moveTo(p1.x, p1.y);

      for (let i = 1; i <= SUB_STEPS; i++) {
        const ratio = i / SUB_STEPS;
        const tx = startTargetX + (cx - startTargetX) * ratio;
        const ty = startTargetY + (cy - startTargetY) * ratio;
        
        pen.update(tx, ty, speed, this.curveFriction, this.pendulumSpeed, subTimeScale);
        
        const p2 = pen.getPoint();
        this.ctx.lineTo(p2.x, p2.y);

        // Spawn sparkles inside sub-stepping loop
        if (this.sparkles && Math.random() < 0.35 * subTimeScale) {
          this.particles.push({
            x: p2.x,
            y: p2.y,
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8 - 0.2,
            size: Math.random() * 2 + 1.2,
            color: pen.color,
            alpha: 1.0,
            decay: 0.018 * timeScale
          });
        }
      }
      this.ctx.stroke();

      pen.prevTargetX = cx;
      pen.prevTargetY = cy;

      // Play soft sounds when user is drawing large loops
      if (speed > 0.015) {
        throttledPlay(playChime, 180);
      }
    });

    // Remove expired pens
    for (const [key] of this.pens) {
      if (!currentKeys.has(key)) {
        this.pens.delete(key);
      }
    }

    // Update & render dust particles (sparkles)
    if (this.particles.length > 0) {
      this.ctx.globalCompositeOperation = 'lighter';
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        } else {
          this.ctx.globalAlpha = p.alpha;
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
    }
  }
}
