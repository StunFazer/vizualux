import { playChime, throttledPlay } from './audio.js';

// Bioluminescent Flower Field — Zen Garden Interactive Effect
// Procedural canvas-based simulation of glowing flowers, sacred lotuses, and pollen dust

// ─── Color Palettes ────────────────────────────────────────────
const FLOWER_PALETTES = [
  { hue: 280, name: 'violet' },   // Deep violet
  { hue: 320, name: 'magenta' },  // Hot magenta
  { hue: 200, name: 'cyan' },     // Electric cyan
  { hue: 45,  name: 'gold' },     // Warm gold
  { hue: 160, name: 'emerald' },  // Neon emerald
  { hue: 350, name: 'rose' },     // Neon rose
  { hue: 30,  name: 'amber' },    // Amber fire
];

// ─── Pollen Dust Particle ──────────────────────────────────────
class PollenDust {
  constructor(x, y, width, height) {
    this.x = x !== undefined ? x : Math.random() * width;
    this.y = y !== undefined ? y : Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = -Math.random() * 0.4 - 0.1;
    this.size = Math.random() * 2.5 + 0.8;
    this.alpha = Math.random() * 0.5 + 0.3;
    this.hue = 50 + Math.random() * 40; // warm yellow-green glow
    this.life = 1.0;
    this.decay = 0.001 + Math.random() * 0.002;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.02 + Math.random() * 0.03;
    this.wobbleAmp = 0.3 + Math.random() * 0.5;
  }

  update(width, height, motionPoints) {
    this.wobblePhase += this.wobbleSpeed;
    this.x += this.vx + Math.sin(this.wobblePhase) * this.wobbleAmp;
    this.y += this.vy;
    this.life -= this.decay;

    // Breeze from motion
    for (const m of motionPoints) {
      const mx = m.x * width;
      const my = m.y * height;
      const dist = Math.hypot(this.x - mx, this.y - my);
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.6;
        this.vx += ((this.x - mx) / (dist + 1)) * force;
        this.vy += ((this.y - my) / (dist + 1)) * force;
      }
    }

    // Damping
    this.vx *= 0.98;
    this.vy *= 0.98;

    // Wrap around
    if (this.x < -10) this.x = width + 10;
    if (this.x > width + 10) this.x = -10;
    if (this.y < -10) this.y = height + 10;
    if (this.y > height + 10) this.y = -10;

    return this.life > 0;
  }

  draw(ctx) {
    const a = this.alpha * this.life;
    if (a < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 8;
    ctx.shadowColor = `hsla(${this.hue}, 100%, 75%, ${a})`;
    ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, ${a})`;
    ctx.beginPath();
    ctx.arc(Math.round(this.x), Math.round(this.y), this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Disintegration Spark ──────────────────────────────────────
class Spark {
  constructor(x, y, hue) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = 1.5 + Math.random() * 3;
    this.hue = hue + (Math.random() - 0.5) * 30;
    this.life = 1.0;
    this.decay = 0.015 + Math.random() * 0.02;
    this.gravity = 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= this.decay;
    return this.life > 0;
  }

  draw(ctx) {
    const a = this.life;
    if (a < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 10;
    ctx.shadowColor = `hsla(${this.hue}, 100%, 70%, ${a})`;
    ctx.fillStyle = `hsla(${this.hue}, 100%, 75%, ${a * 0.9})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Flower ────────────────────────────────────────────────────
class Flower {
  constructor(x, y, isLotus = false) {
    this.x = x;
    this.y = y;
    this.isLotus = isLotus;
    const palette = FLOWER_PALETTES[Math.floor(Math.random() * FLOWER_PALETTES.length)];
    this.hue = palette.hue;
    this.petalCount = isLotus ? 12 : (5 + Math.floor(Math.random() * 4));
    this.maxRadius = isLotus
      ? 55 + Math.random() * 35
      : 18 + Math.random() * 22;
    this.currentRadius = 0;
    this.growthRate = 0.015 + Math.random() * 0.01; // fraction per frame
    this.growthProgress = 0; // 0 to 1
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.003;
    this.lifetime = 1.0;
    this.maxLifetime = isLotus ? 600 : 300; // frames
    this.age = 0;
    this.mature = false;
    this.dying = false;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.innerHue = (this.hue + 40) % 360;
    this.stemSwayPhase = Math.random() * Math.PI * 2;
  }

  update() {
    this.age++;
    this.rotation += this.rotationSpeed;
    this.pulsePhase += 0.04;
    this.stemSwayPhase += 0.015;

    // Growth
    if (this.growthProgress < 1) {
      this.growthProgress = Math.min(1, this.growthProgress + this.growthRate);
      // Ease-out cubic for organic feel
      const t = this.growthProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      this.currentRadius = this.maxRadius * eased;
      if (this.growthProgress >= 1) {
        this.mature = true;
      }
    }

    // Fading after maturity
    if (this.mature && !this.dying) {
      if (this.age > this.maxLifetime * 0.7) {
        this.dying = true;
      }
    }

    if (this.dying) {
      this.lifetime -= 1 / (this.maxLifetime * 0.3);
    }

    return this.lifetime > 0;
  }

  draw(ctx) {
    const alpha = Math.min(1, this.lifetime) * Math.min(1, this.growthProgress * 3);
    if (alpha < 0.01) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const pulse = 1 + Math.sin(this.pulsePhase) * 0.05;
    const r = this.currentRadius * pulse;

    // Glow aura
    ctx.globalCompositeOperation = 'lighter';
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
    gradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, ${alpha * 0.15})`);
    gradient.addColorStop(0.5, `hsla(${this.hue}, 100%, 60%, ${alpha * 0.06})`);
    gradient.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Draw petals using Bezier curves
    ctx.globalCompositeOperation = 'source-over';
    const angleStep = (Math.PI * 2) / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      const angle = i * angleStep;
      const petalLen = r * (this.isLotus ? 0.9 : 0.85);
      const petalWidth = r * (this.isLotus ? 0.28 : 0.35);

      ctx.save();
      ctx.rotate(angle);

      // Petal shape via Bezier
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        petalWidth * 0.8, petalLen * 0.25,
        petalWidth, petalLen * 0.6,
        0, petalLen
      );
      ctx.bezierCurveTo(
        -petalWidth, petalLen * 0.6,
        -petalWidth * 0.8, petalLen * 0.25,
        0, 0
      );

      // Gradient fill for each petal
      const petalGrad = ctx.createLinearGradient(0, 0, 0, petalLen);
      const sat = this.isLotus ? '90%' : '100%';
      petalGrad.addColorStop(0, `hsla(${this.innerHue}, ${sat}, 75%, ${alpha * 0.9})`);
      petalGrad.addColorStop(0.5, `hsla(${this.hue}, ${sat}, 60%, ${alpha * 0.7})`);
      petalGrad.addColorStop(1, `hsla(${this.hue}, ${sat}, 45%, ${alpha * 0.5})`);
      ctx.fillStyle = petalGrad;

      ctx.shadowBlur = this.isLotus ? 18 : 10;
      ctx.shadowColor = `hsla(${this.hue}, 100%, 65%, ${alpha * 0.5})`;
      ctx.fill();

      // Petal veins (subtle)
      ctx.strokeStyle = `hsla(${this.innerHue}, 100%, 80%, ${alpha * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.1);
      ctx.lineTo(0, petalLen * 0.85);
      ctx.stroke();

      ctx.restore();
    }

    // Center pistil
    ctx.globalCompositeOperation = 'lighter';
    const centerR = r * (this.isLotus ? 0.18 : 0.22);
    const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, centerR);
    centerGrad.addColorStop(0, `hsla(${(this.hue + 60) % 360}, 100%, 90%, ${alpha * 0.9})`);
    centerGrad.addColorStop(0.6, `hsla(${(this.hue + 40) % 360}, 100%, 70%, ${alpha * 0.5})`);
    centerGrad.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);
    ctx.shadowBlur = 12;
    ctx.shadowColor = `hsla(${(this.hue + 60) % 360}, 100%, 80%, ${alpha * 0.6})`;
    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, centerR, 0, Math.PI * 2);
    ctx.fill();

    // Center dot highlight
    ctx.fillStyle = `hsla(60, 100%, 95%, ${alpha * 0.7})`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `hsla(60, 100%, 90%, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(0, 0, centerR * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Check if a motion point touches this flower
  isHit(px, py, hitRadius) {
    return Math.hypot(this.x - px, this.y - py) < (this.currentRadius + hitRadius);
  }
}

// ─── Zen Garden Effect ─────────────────────────────────────────
export class ZenGarden {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    // Simulation arrays
    this.flowers = [];
    this.sparks = [];
    this.pollen = [];

    // Caps
    this.maxFlowers = 60;
    this.maxSparks = 500;
    this.maxPollen = 120;

    // Exposed parameters for dashboard sliders
    this.bloomSize = 1.0;
    this.flowerLifetime = 1.0;
    this.bloomSpeed = 1.0;

    // Stillness (lotus) detection
    this.stillnessTracker = new Map(); // zone key -> { x, y, frames }
    this.stillnessThreshold = 72; // ~1.2s at 60fps

    // Spawn throttle
    this.spawnCooldown = 0;
    this.spawnInterval = 8; // frames between spawns

    // Time
    this.time = 0;

    // Resize handler
    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
    this.init();
  }

  init() {
    this.flowers = [];
    this.sparks = [];
    this.pollen = [];
    this.stillnessTracker.clear();
    this.time = 0;

    // Seed initial ambient pollen
    for (let i = 0; i < 60; i++) {
      this.pollen.push(new PollenDust(undefined, undefined, this.width, this.height));
    }
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

  // Spawn a normal flower at the given position
  spawnFlower(x, y) {
    if (this.flowers.length >= this.maxFlowers) {
      // Remove oldest non-lotus flower
      const idx = this.flowers.findIndex(f => !f.isLotus);
      if (idx !== -1) this.flowers.splice(idx, 1);
    }

    const flower = new Flower(x, y, false);
    flower.maxRadius *= this.bloomSize;
    flower.maxLifetime = Math.round(300 * this.flowerLifetime);
    flower.growthRate = (0.015 + Math.random() * 0.01) * this.bloomSpeed;
    this.flowers.push(flower);

    throttledPlay(playChime, 200);
  }

  // Spawn a sacred lotus at the given position
  spawnLotus(x, y) {
    if (this.flowers.length >= this.maxFlowers) {
      const idx = this.flowers.findIndex(f => !f.isLotus);
      if (idx !== -1) this.flowers.splice(idx, 1);
    }

    const lotus = new Flower(x, y, true);
    lotus.maxRadius *= this.bloomSize * 1.2;
    lotus.maxLifetime = Math.round(600 * this.flowerLifetime);
    lotus.growthRate = 0.008 * this.bloomSpeed;
    this.flowers.push(lotus);

    // Stronger chime for lotus
    playChime();
    setTimeout(() => playChime(), 150);
  }

  // Disintegrate a flower into sparks
  disintegrate(flower) {
    const numSparks = flower.isLotus ? 45 : 20;
    for (let i = 0; i < numSparks; i++) {
      if (this.sparks.length >= this.maxSparks) break;
      this.sparks.push(new Spark(flower.x, flower.y, flower.hue));
    }

    // Also release pollen
    const pollenCount = flower.isLotus ? 12 : 5;
    for (let i = 0; i < pollenCount; i++) {
      if (this.pollen.length < this.maxPollen) {
        this.pollen.push(new PollenDust(
          flower.x + (Math.random() - 0.5) * 30,
          flower.y + (Math.random() - 0.5) * 30,
          this.width, this.height
        ));
      }
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];
    this.time++;

    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;
    this.spawnCooldown = Math.max(0, this.spawnCooldown - 1);

    const ctx = this.ctx;

    // ── 1. Clear with subtle dark trail ──────────────────────
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 3, 8, 0.12)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle ground glow
    if (this.time % 3 === 0) {
      const gx = this.width / 2;
      const gy = this.height / 2;
      const gr = Math.max(this.width, this.height) * 0.55;
      const groundGlow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      groundGlow.addColorStop(0, 'rgba(20, 40, 30, 0.008)');
      groundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = groundGlow;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // ── 2. Process motion: spawn flowers & detect stillness ──
    const activeZones = new Set();

    for (const m of motionPoints) {
      const mx = m.x * this.width;
      const my = m.y * this.height;

      // Check for hits on mature flowers → disintegrate
      for (let i = this.flowers.length - 1; i >= 0; i--) {
        const f = this.flowers[i];
        if (f.mature && f.isHit(mx, my, 25)) {
          this.disintegrate(f);
          this.flowers.splice(i, 1);
        }
      }

      // Spawn flower at motion point (throttled)
      if (this.spawnCooldown <= 0) {
        // Don't spawn too close to existing flowers
        const tooClose = this.flowers.some(f =>
          Math.hypot(f.x - mx, f.y - my) < f.maxRadius * 1.5
        );
        if (!tooClose) {
          this.spawnFlower(mx, my);
          this.spawnCooldown = this.spawnInterval;
        }
      }

      // Stillness tracking for Lotus
      const zoneKey = `${Math.round(mx / 80)}_${Math.round(my / 80)}`;
      activeZones.add(zoneKey);

      if (this.stillnessTracker.has(zoneKey)) {
        const tracker = this.stillnessTracker.get(zoneKey);
        tracker.frames++;
        // Weighted average position
        tracker.x = tracker.x * 0.9 + mx * 0.1;
        tracker.y = tracker.y * 0.9 + my * 0.1;

        if (tracker.frames >= this.stillnessThreshold) {
          // Check if there's already a lotus nearby
          const lotusNearby = this.flowers.some(f =>
            f.isLotus && Math.hypot(f.x - tracker.x, f.y - tracker.y) < 100
          );
          if (!lotusNearby) {
            this.spawnLotus(tracker.x, tracker.y);
          }
          tracker.frames = 0; // Reset after spawn
        }
      } else {
        this.stillnessTracker.set(zoneKey, { x: mx, y: my, frames: 1 });
      }
    }

    // Clear stale stillness zones
    for (const [key] of this.stillnessTracker) {
      if (!activeZones.has(key)) {
        this.stillnessTracker.delete(key);
      }
    }

    // ── 3. Update & draw pollen ──────────────────────────────
    for (let i = this.pollen.length - 1; i >= 0; i--) {
      if (!this.pollen[i].update(this.width, this.height, motionPoints)) {
        this.pollen.splice(i, 1);
      }
    }

    // Replenish ambient pollen
    while (this.pollen.length < 40) {
      this.pollen.push(new PollenDust(undefined, undefined, this.width, this.height));
    }

    for (const p of this.pollen) {
      p.draw(ctx);
    }

    // ── 4. Update & draw sparks ──────────────────────────────
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      if (!this.sparks[i].update()) {
        this.sparks.splice(i, 1);
      }
    }

    for (const s of this.sparks) {
      s.draw(ctx);
    }

    // ── 5. Update & draw flowers ─────────────────────────────
    for (let i = this.flowers.length - 1; i >= 0; i--) {
      if (!this.flowers[i].update()) {
        // Natural death — gentle disintegration
        this.disintegrate(this.flowers[i]);
        this.flowers.splice(i, 1);
      }
    }

    for (const f of this.flowers) {
      f.draw(ctx);
    }
  }
}
