import { playSandStep, playSnowCrunch, playSplat, playChime, throttledPlay } from './audio.js';

class Footprint {
  constructor(x, y, angle, isLeft, type, size) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.isLeft = isLeft;
    this.type = type; // 'sand', 'snow', 'mud', 'magic'
    this.size = size; // length scale
    this.life = 1.0;  // fades out
    this.decay = 0.008; // fade speed
    this.hue = Math.random() * 360; // used for magic paw prints
  }

  update() {
    this.life -= this.decay;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;

    if (this.type === 'sand') {
      // 1. Barefoot imprint: Draw shadow overlay and highlighting rim
      // Shadow (indented)
      this.drawBarefoot(ctx, this.x + 2, this.y + 2, this.size, this.isLeft, 'rgba(70, 50, 30, 0.25)');
      // Highlights (displaced edge)
      this.drawBarefoot(ctx, this.x - 1, this.y - 1, this.size, this.isLeft, 'rgba(255, 240, 210, 0.12)');

    } else if (this.type === 'snow') {
      // 2. Hiking boot imprint in snow: draw dark blue shadow and treads
      this.drawBootprint(ctx, this.x, this.y, this.size, 'rgba(71, 85, 105, 0.45)', 'rgba(255, 255, 255, 0.15)');

    } else if (this.type === 'mud') {
      // 3. Mud splat footprint
      this.drawBootprint(ctx, this.x, this.y, this.size, 'rgba(69, 39, 15, 0.75)', 'rgba(39, 19, 5, 0.3)');

    } else if (this.type === 'magic') {
      // 4. Glowing paw prints with glow shadow
      ctx.shadowBlur = 18;
      const color = `hsla(${this.hue}, 100%, 70%, ${this.life})`;
      ctx.shadowColor = color;
      this.drawPawprint(ctx, this.x, this.y, this.size, color);
    }

    ctx.restore();
  }

  drawBarefoot(ctx, cx, cy, size, isLeft, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.fillStyle = color;

    // sole ball/arch
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.1, size * 0.38, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // heel
    ctx.beginPath();
    ctx.ellipse(isLeft ? -size * 0.05 : size * 0.05, size * 0.55, size * 0.26, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // toes
    const toeY = -size * 0.78;
    const toesCount = 5;
    for (let i = 0; i < toesCount; i++) {
      // Big toe inside, pinky toe outside
      const offsetIndex = isLeft ? (toesCount - 1 - i) : i;
      const tx = (offsetIndex - 2) * (size * 0.16) + (isLeft ? size * 0.05 : -size * 0.05);
      const ty = toeY + Math.abs(offsetIndex - 1.5) * (size * 0.04);
      const toeR = size * (0.06 + (4 - offsetIndex) * 0.018); // Big toe is biggest

      ctx.beginPath();
      ctx.arc(tx, ty, toeR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBootprint(ctx, cx, cy, size, color, treadColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.fillStyle = color;

    // Outer boot outline
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.1, size * 0.46, size * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Separate Heel block
    ctx.beginPath();
    ctx.ellipse(0, size * 0.58, size * 0.36, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner boots treads details
    ctx.strokeStyle = treadColor;
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    for (let i = -4; i <= 3; i++) {
      const ty = i * (size * 0.12) - size * 0.1;
      ctx.moveTo(-size * 0.32, ty);
      ctx.lineTo(size * 0.32, ty);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawPawprint(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.fillStyle = color;

    // Main paw pad (inverted bean shape)
    ctx.beginPath();
    ctx.ellipse(0, size * 0.15, size * 0.44, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4 toe pads
    for (let i = 0; i < 4; i++) {
      const ta = -Math.PI / 2 + (i - 1.5) * 0.52;
      const tx = Math.cos(ta) * size * 0.6;
      const ty = Math.sin(ta) * size * 0.6;
      ctx.beginPath();
      ctx.arc(tx, ty, size * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class FootprintsEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    this.preset = 'sand'; // Default: 'sand', 'snow', 'mud', 'magic'
    this.footprints = [];
    
    // Background static canvases
    this.bgCanvas = document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');

    // Keep track of last footprints spawned per centroid index
    this.trackers = new Map();

    // Sparkles for magic mode
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

    this.bgCanvas.width = this.width;
    this.bgCanvas.height = this.height;

    this.renderPresetBackground();
  }

  setPreset(preset) {
    this.preset = preset;
    this.footprints = [];
    this.particles = [];
    this.trackers.clear();
    this.renderPresetBackground();
  }

  init() {
    this.footprints = [];
    this.particles = [];
    this.trackers.clear();
  }

  renderPresetBackground() {
    const ctx = this.bgCtx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    if (this.preset === 'sand') {
      // 1. Golden Sand Beach with subtle ripples
      ctx.fillStyle = '#ffeaa7'; // golden sand color
      ctx.fillRect(0, 0, w, h);

      // Sand ripples lines
      ctx.strokeStyle = 'rgba(215, 175, 115, 0.28)';
      ctx.lineWidth = 4;
      for (let i = 0; i < h; i += 45) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 20) {
          const y = i + Math.sin(x * 0.02) * 8;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

    } else if (this.preset === 'snow') {
      // 2. Pure White Glacial Snow
      ctx.fillStyle = '#f8fafc'; // snow white
      ctx.fillRect(0, 0, w, h);

      // Subtle ice highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let i = 0; i < 15; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * w * 0.1, 3);
      }

    } else if (this.preset === 'mud') {
      // 3. Wet Mud/Lawn: Dark green grass base
      ctx.fillStyle = '#1b4d22'; // deep green
      ctx.fillRect(0, 0, w, h);

      // Procedural grass patches
      ctx.strokeStyle = 'rgba(46, 125, 50, 0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 400; i++) {
        const gx = Math.random() * w;
        const gy = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + (Math.random() - 0.5) * 4, gy - 6 - Math.random() * 8);
        ctx.stroke();
      }

    } else if (this.preset === 'magic') {
      // 4. Magic Space Grid: deep black space with stars
      ctx.fillStyle = '#05040a';
      ctx.fillRect(0, 0, w, h);

      // Starry night sky dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let i = 0; i < 80; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];

    // Clear main screen and draw backplate
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(this.bgCanvas, 0, 0);

    // ── 1. Process Footprint Spawning ──────────────────────────
    // Tracks active motion paths using map IDs or coordinate indices
    const currentActiveIds = new Set();

    motionPoints.forEach((m, idx) => {
      // Create a stable key mapping centroids
      const trackerKey = idx;
      currentActiveIds.add(trackerKey);

      const mx = m.x * this.width;
      const my = m.y * this.height;

      const tracker = this.trackers.get(trackerKey);

      if (tracker) {
        // Compute distance from last footprint
        const dist = Math.hypot(mx - tracker.lastX, my - tracker.lastY);
        // Minimum stride spacing before spawning next print
        const strideDistance = 95;

        if (dist > strideDistance) {
          // Determine vector direction angle
          const dy = my - tracker.lastY;
          const dx = mx - tracker.lastX;
          const angle = Math.atan2(dy, dx) + Math.PI / 2;
          const isLeft = !tracker.lastIsLeft;
          
          this.spawnFootprint(mx, my, angle, isLeft);

          tracker.lastX = mx;
          tracker.lastY = my;
          tracker.lastIsLeft = isLeft;
        }
      } else {
        // Initial footstep placement
        const angle = 0; // Default forward orientation
        this.spawnFootprint(mx, my, angle, true);

        this.trackers.set(trackerKey, {
          lastX: mx,
          lastY: my,
          lastIsLeft: true
        });
      }
    });

    // Clear trackers for centroids that left the viewport
    for (const [key] of this.trackers) {
      if (!currentActiveIds.has(key)) {
        this.trackers.delete(key);
      }
    }

    // ── 2. Update & Draw Footprints ────────────────────────────
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      const f = this.footprints[i];
      if (!f.update()) {
        this.footprints.splice(i, 1);
      } else {
        f.draw(this.ctx);
      }
    }

    // ── 3. Magic Spores Update ─────────────────────────────────
    if (this.preset === 'magic') {
      this.ctx.globalCompositeOperation = 'lighter';
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.y += p.vy;
        p.x += p.vx;
        p.life -= 0.015;

        if (p.life <= 0) {
          this.particles.splice(i, 1);
        } else {
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          this.ctx.fillStyle = p.color;
          this.ctx.fill();
        }
      }
      this.ctx.globalCompositeOperation = 'source-over';
    }
  }

  spawnFootprint(x, y, angle, isLeft) {
    const size = 48; // base print length
    
    // Instantiate new footprint
    const footprint = new Footprint(x, y, angle, isLeft, this.preset, size);
    this.footprints.push(footprint);

    // Limit array count to avoid overflow
    if (this.footprints.length > 200) {
      this.footprints.shift();
    }

    // Play footprint audio
    if (this.preset === 'sand') {
      throttledPlay(playSandStep, 100);
    } else if (this.preset === 'snow') {
      throttledPlay(playSnowCrunch, 100);
    } else if (this.preset === 'mud') {
      throttledPlay(playSplat, 100);
    } else if (this.preset === 'magic') {
      throttledPlay(playChime, 200);

      // Spawn rising neon magic sparks
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.5 - 0.5,
          size: Math.random() * 3 + 2,
          life: 1.0,
          color: `hsla(${footprint.hue}, 100%, 70%, 1.0)`
        });
      }
    }
  }
}
