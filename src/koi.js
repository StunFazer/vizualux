import { playSplash } from './audio.js';

// Bioluminescent Koi Pond Interactive Skill
// Procedural canvas-based simulation of koi fish and floating lily pads

class FoodPellet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.eaten = false;
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = (Math.random() - 0.5) * 0.6;
  }

  update(width, height, timeScale = 1.0) {
    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;

    // Bounce off walls
    if (this.x < 10) { this.x = 10; this.vx *= -1; }
    if (this.x > width - 10) { this.x = width - 10; this.vx *= -1; }
    if (this.y < 10) { this.y = 10; this.vy *= -1; }
    if (this.y > height - 10) { this.y = height - 10; this.vy *= -1; }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff9f43';
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Core white highlight
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(this.x - 1, this.y - 1, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Koi {
  constructor(x, y, color, size) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;
    this.color = color;
    this.size = size; // length scale factor (typically 12 - 22)
    this.baseSpeed = Math.random() * 0.8 + 1.2;
    this.maxSpeed = 1.5;
    this.speedMultiplier = 1.0;
    
    // Segment history for organic skeletal spine animation
    this.history = [];
    this.historyLimit = 36;
    for (let i = 0; i < this.historyLimit; i++) {
      this.history.push({ x: x, y: y });
    }
    
    this.swimCycle = Math.random() * Math.PI * 2;
    this.escapeTimer = 0;
    this.dangerSource = null;
  }

  update(width, height, allKoi, motionPoints, foodList = [], lilyPads = [], timeScale = 1.0) {
    this.swimCycle += (this.escapeTimer > 0 ? 0.35 : 0.15) * timeScale;

    // Decay speed multiplier
    if (this.speedMultiplier > 1.0) {
      this.speedMultiplier = Math.max(1.0, this.speedMultiplier - (timeScale / 180));
    }

    // 1. Interactive Motion Evading (Escape Behavior)
    let fearX = 0;
    let fearY = 0;
    let fearCount = 0;
    const scareRadius = 150;

    for (const m of motionPoints) {
      const mx = m.x * width;
      const my = m.y * height;
      const dist = Math.hypot(this.x - mx, this.y - my) || 0.001;
      if (dist < scareRadius) {
        // Force vector away from motion point
        const force = (scareRadius - dist) / scareRadius;
        fearX += ((this.x - mx) / dist) * force;
        fearY += ((this.y - my) / dist) * force;
        fearCount++;
      }
    }

    if (fearCount > 0) {
      this.escapeTimer = 60; // Keep escape mode active for 60 frames
      // Combine fears
      this.vx += (fearX / fearCount) * 0.75 * timeScale;
      this.vy += (fearY / fearCount) * 0.75 * timeScale;
    } else if (this.escapeTimer > 0) {
      this.escapeTimer = Math.max(0, this.escapeTimer - timeScale);
    }

    // Stem Avoidance (only when fleeing/escaping or swimming fast)
    const isSwimmingFast = this.escapeTimer > 0 || this.speedMultiplier > 1.2;
    if (isSwimmingFast && lilyPads.length > 0) {
      for (const pad of lilyPads) {
        const dx = this.x - pad.x;
        const dy = this.y - pad.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const avoidDist = pad.radius + 15;
        if (dist < avoidDist) {
          const force = (avoidDist - dist) / avoidDist;
          this.vx += (dx / dist) * force * 1.2 * timeScale;
          this.vy += (dy / dist) * force * 1.2 * timeScale;
        }
      }
    }

    // 2. Flocking / Seeking Food
    let nearestFood = null;
    let nearestFoodDist = Infinity;
    const foodDetectionRange = 300;

    for (const pellet of foodList) {
      if (pellet.eaten) continue;
      const dist = Math.hypot(this.x - pellet.x, this.y - pellet.y);
      if (dist < foodDetectionRange && dist < nearestFoodDist) {
        nearestFood = pellet;
        nearestFoodDist = dist;
      }
    }

    // Under-pad hiding: only if there's no active motion/fear and not seeking food
    let hidingInPad = false;
    if (fearCount === 0 && !nearestFood && lilyPads.length > 0) {
      let nearestPad = null;
      let minPadDist = Infinity;
      for (const pad of lilyPads) {
        const dist = Math.hypot(this.x - pad.x, this.y - pad.y);
        if (dist < minPadDist) {
          minPadDist = dist;
          nearestPad = pad;
        }
      }
      if (nearestPad) {
        const dx = nearestPad.x - this.x;
        const dy = nearestPad.y - this.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist > 15) {
          this.vx += (dx / dist) * 0.06 * timeScale;
          this.vy += (dy / dist) * 0.06 * timeScale;
        } else {
          this.vx *= Math.pow(0.94, timeScale);
          this.vy *= Math.pow(0.94, timeScale);
          hidingInPad = true;
        }
      }
    }

    // Core Boids behaviors: Cohesion, Alignment, Separation
    let alignX = 0, alignY = 0, alignCount = 0;
    let cohereX = 0, cohereY = 0, cohereCount = 0;
    let separateX = 0, separateY = 0, separateCount = 0;

    const rAlign = 100;
    const rCohere = 120;
    const rSeparate = 45;

    for (const other of allKoi) {
      if (other === this) continue;
      const dist = Math.hypot(this.x - other.x, this.y - other.y);

      if (dist < rAlign) {
        alignX += other.vx;
        alignY += other.vy;
        alignCount++;
      }
      if (dist < rCohere) {
        cohereX += other.x;
        cohereY += other.y;
        cohereCount++;
      }
      if (dist < rSeparate) {
        const dSafe = dist || 0.001;
        const force = (rSeparate - dist) / rSeparate;
        separateX += ((this.x - other.x) / dSafe) * force;
        separateY += ((this.y - other.y) / dSafe) * force;
        separateCount++;
      }
    }

    // If seeking food, steer towards food instead of cohesion/alignment, but keep separation!
    if (nearestFood) {
      const dx = nearestFood.x - this.x;
      const dy = nearestFood.y - this.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      
      this.vx += (dx / dist) * 0.25 * timeScale;
      this.vy += (dy / dist) * 0.25 * timeScale;

      if (dist < 18) {
        nearestFood.eaten = true;
        this.speedMultiplier = 2.5;
        playSplash();
      }
    } else if (!hidingInPad) {
      if (alignCount > 0) {
        this.vx += (alignX / alignCount) * 0.3 * timeScale;
        this.vy += (alignY / alignCount) * 0.3 * timeScale;
      }
      if (cohereCount > 0) {
        const avgX = cohereX / cohereCount;
        const avgY = cohereY / cohereCount;
        this.vx += (avgX - this.x) * 0.1 * timeScale;
        this.vy += (avgY - this.y) * 0.1 * timeScale;
      }
    }

    if (separateCount > 0) {
      this.vx += (separateX / separateCount) * 0.1 * timeScale;
      this.vy += (separateY / separateCount) * 0.1 * timeScale;
    }

    // 3. Screen Edge Avoidance
    const margin = 80;
    const turnFactor = 0.45 * timeScale;
    if (this.x < margin) this.vx += turnFactor;
    if (this.x > width - margin) this.vx -= turnFactor;
    if (this.y < margin) this.vy += turnFactor;
    if (this.y > height - margin) this.vy -= turnFactor;

    // 4. Speed Limits & Normalization
    let currentSpeed = Math.hypot(this.vx, this.vy);
    const targetMaxSpeed = (this.escapeTimer > 0 ? this.maxSpeed * 1.5 : this.maxSpeed) * this.speedMultiplier;
    const targetMinSpeed = (this.escapeTimer > 0 ? this.baseSpeed * 1.4 : this.baseSpeed) * (hidingInPad ? 0.2 : this.speedMultiplier);

    if (currentSpeed > targetMaxSpeed) {
      this.vx = (this.vx / currentSpeed) * targetMaxSpeed;
      this.vy = (this.vy / currentSpeed) * targetMaxSpeed;
    } else if (currentSpeed < targetMinSpeed && currentSpeed > 0) {
      this.vx = (this.vx / currentSpeed) * targetMinSpeed;
      this.vy = (this.vy / currentSpeed) * targetMinSpeed;
    }

    if (currentSpeed === 0) {
      this.vx = (Math.random() - 0.5) * this.baseSpeed;
      this.vy = (Math.random() - 0.5) * this.baseSpeed;
    }

    // 5. Update Position
    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;

    // 6. Record history (Shift old positions)
    this.history.unshift({ x: this.x, y: this.y });
    if (this.history.length > this.historyLimit) {
      this.history.pop();
    }
  }

  draw(ctx, time) {
    const s = this.size;
    ctx.save();

    // 1. Draw Bioluminescent Underglow / Light Trail (Screen composite)
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowBlur = 24;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.escapeTimer > 0 ? 0.15 : 0.06;
    
    // Draw a larger blurred shadow behind the fish body
    ctx.beginPath();
    ctx.arc(this.x, this.y, s * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    
    // Helper to get angle between two history indices
    const getAngleAt = (idxA, idxB) => {
      const pA = this.history[Math.min(idxA, this.history.length - 1)];
      const pB = this.history[Math.min(idxB, this.history.length - 1)];
      return Math.atan2(pA.y - pB.y, pA.x - pB.x);
    };

    // Calculate heading angle at head
    const headAngle = getAngleAt(0, 4);

    // 2. Draw Pectoral Fins (attached near head, index 4)
    const finBasePos = this.history[Math.min(4, this.history.length - 1)];
    const finAngle = getAngleAt(4, 8);

    ctx.save();
    ctx.translate(finBasePos.x, finBasePos.y);
    ctx.rotate(finAngle);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.55;

    // Left fin
    ctx.save();
    ctx.rotate(Math.PI / 3 + Math.sin(this.swimCycle) * 0.15);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.8, s * 0.4, s * 0.95, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right fin
    ctx.save();
    ctx.rotate(-Math.PI / 3 - Math.sin(this.swimCycle) * 0.15);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.8, s * 0.4, s * 0.95, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // 3. Draw Segmented Spine Body (draw segments back to front, tail to head)
    // Tapering radii for body segments
    // Total history length is 36. We sample at indexes:
    // head (0), body1 (6), body2 (12), body3 (18), tailJoint (24), tailTip (30)
    const segments = [
      { histIdx: 30, r: s * 0.22, alpha: 0.4 },
      { histIdx: 24, r: s * 0.38, alpha: 0.5 },
      { histIdx: 18, r: s * 0.55, alpha: 0.65 },
      { histIdx: 12, r: s * 0.72, alpha: 0.8 },
      { histIdx: 6,  r: s * 0.85, alpha: 0.95 },
      { histIdx: 0,  r: s * 0.95, alpha: 1.0 }
    ];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pos = this.history[Math.min(seg.histIdx, this.history.length - 1)];
      
      // Draw segment glow outline
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.globalAlpha = seg.alpha * 0.85;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, seg.r, 0, Math.PI * 2);
      ctx.fill();
      
      // Core highlight
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = seg.alpha * 0.25;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, seg.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }

    // 4. Draw Tail Fin (at tail tip, index 30)
    const tailPos = this.history[Math.min(30, this.history.length - 1)];
    const tailAngle = getAngleAt(30, 34);
    
    ctx.save();
    ctx.translate(tailPos.x, tailPos.y);
    // Add sinusoidal wagging based on swim cycle
    const wagAngle = Math.sin(this.swimCycle * 1.2) * 0.45;
    ctx.rotate(tailAngle + wagAngle);

    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.65;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    // Split tail fin (traditional double koi tail)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.8, -s * 0.4, -s * 1.5, -s * 0.75);
    ctx.lineTo(-s * 1.3, -s * 0.1);
    ctx.lineTo(-s * 0.8, 0);
    ctx.lineTo(-s * 1.3, s * 0.1);
    ctx.lineTo(-s * 1.5, s * 0.75);
    ctx.quadraticCurveTo(-s * 0.8, s * 0.4, 0, 0);
    ctx.fill();
    ctx.restore();

    // 5. Draw Whisker / Barbels at Head (index 0)
    const headPos = this.history[0];
    ctx.save();
    ctx.translate(headPos.x, headPos.y);
    ctx.rotate(headAngle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    
    // Left barbel
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 0.25);
    ctx.quadraticCurveTo(s * 1.1, -s * 0.65, s * 1.2, -s * 0.2);
    ctx.stroke();

    // Right barbel
    ctx.beginPath();
    ctx.moveTo(s * 0.6, s * 0.25);
    ctx.quadraticCurveTo(s * 1.1, s * 0.65, s * 1.2, s * 0.2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}

class LilyPad {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.phase = Math.random() * Math.PI * 2;
    this.angle = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.005;
  }

  update(width, height, motionPoints, timeScale = 1.0) {
    this.phase += 0.025 * timeScale;
    this.angle += this.rotationSpeed * timeScale;

    // Drift when stepped on
    const pushRadius = this.radius + 60;
    for (const m of motionPoints) {
      const mx = m.x * width;
      const my = m.y * height;
      const dist = Math.hypot(this.x - mx, this.y - my);
      if (dist < pushRadius) {
        const force = (pushRadius - dist) * 0.04 * timeScale;
        const dx = this.x - mx;
        const dy = this.y - my;
        const len = Math.hypot(dx, dy) || 1;
        this.vx += (dx / len) * force;
        this.vy += (dy / len) * force;
      }
    }

    // Apply friction/drag
    this.vx *= Math.pow(0.93, timeScale);
    this.vy *= Math.pow(0.93, timeScale);

    // Apply soft home-seeking spring force
    const homeDx = this.homeX - this.x;
    const homeDy = this.homeY - this.y;
    this.vx += homeDx * 0.0018 * timeScale;
    this.vy += homeDy * 0.0018 * timeScale;

    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;
  }

  draw(ctx) {
    ctx.save();
    
    // 1. Soft slow bobbing oscillation
    const bobY = Math.sin(this.phase) * 3;
    ctx.translate(this.x, this.y + bobY);
    ctx.rotate(this.angle);

    // 2. Lily Pad Drop Shadow (vector)
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(2, 8, 12, 0.65)';
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    // 3. Draw Leaf body (circle with Pacman slice cut-out)
    // Slice goes from angle -Math.PI/6 to Math.PI/6
    ctx.fillStyle = '#10ac84'; // Darker teal green
    
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, Math.PI / 7, Math.PI * 2 - Math.PI / 7);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Reset shadow for details
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw veins on the lily pad
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    
    // Radial veins
    const numVeins = 7;
    for (let i = 0; i < numVeins; i++) {
      // Calculate angles outside of the cutout slice
      const a = Math.PI / 6 + ((i / (numVeins - 1)) * (Math.PI * 2 - Math.PI / 3));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * this.radius * 0.9, Math.sin(a) * this.radius * 0.9);
      ctx.stroke();
    }

    // Highlights on the leaf edge
    ctx.strokeStyle = '#55efc4'; // Light green highlights
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, Math.PI / 7, Math.PI * 2 - Math.PI / 7);
    ctx.stroke();

    ctx.restore();
  }
}

export const KOI_PALETTES = {
  paradise: ['#ff4d4d', '#ff9f43', '#00d2d3', '#ff9ff3', '#00f3ff'],
  deep: ['#00f3ff', '#00cec9', '#81ecec', '#0984e3', '#ffffff'],
  sunset: ['#ef4444', '#f97316', '#f59e0b', '#e11d48', '#ff9ff3'],
  swamp: ['#10b981', '#059669', '#0284c7', '#06b6d4', '#55efc4'],
  zen: ['#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8', '#475569']
};

export const KOI_PRESETS = {
  lagoon: {
    palette: 'paradise',
    fishCount: 20,
    lilyPadCount: 8
  },
  zen: {
    palette: 'zen',
    fishCount: 8,
    lilyPadCount: 3
  },
  sunset: {
    palette: 'sunset',
    fishCount: 16,
    lilyPadCount: 4
  },
  deep: {
    palette: 'deep',
    fishCount: 12,
    lilyPadCount: 0
  },
  swamp: {
    palette: 'swamp',
    fishCount: 28,
    lilyPadCount: 10
  }
};

export class KoiPond {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    this.allKoi = [];
    this.lilyPads = [];
    this.ripples = [];
    this.food = [];
    this.trackedCentroids = [];
    this.time = 0;
    
    this.palette = 'paradise';
    this.colors = KOI_PALETTES[this.palette];
    this.fishCount = 10;
    this.lilyPadCount = 6;

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
    
    // Reposition lily pads nicely when screen resizes
    if (this.lilyPads.length > 0) {
      this.setupLilyPads();
    }
  }

  init() {
    this.allKoi = [];
    this.ripples = [];
    this.food = [];
    this.trackedCentroids = [];
    
    // 1. Spawn Koi fish
    for (let i = 0; i < this.fishCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const size = Math.random() * 8 + 12; // Length scale
      this.allKoi.push(new Koi(x, y, color, size));
    }

    // 2. Setup Lily Pads
    this.setupLilyPads();
  }

  setupLilyPads() {
    this.lilyPads = [];
    if (this.lilyPadCount === 0) return;
    
    const cols = Math.ceil(Math.sqrt(this.lilyPadCount));
    const rows = Math.ceil(this.lilyPadCount / (cols || 1));
    const cellWidth = this.width / (cols || 1);
    const cellHeight = this.height / (rows || 1);

    let count = 0;
    for (let c = 0; c < cols && count < this.lilyPadCount; c++) {
      for (let r = 0; r < rows && count < this.lilyPadCount; r++) {
        const padX = cellWidth * c + cellWidth * 0.5 + (Math.random() - 0.5) * (cellWidth * 0.3);
        const padY = cellHeight * r + cellHeight * 0.5 + (Math.random() - 0.5) * (cellHeight * 0.3);
        const radius = Math.random() * 18 + 26;

        this.lilyPads.push(new LilyPad(padX, padY, radius));
        count++;
      }
    }
  }

  setPalette(paletteName) {
    if (KOI_PALETTES[paletteName]) {
      this.palette = paletteName;
      this.colors = KOI_PALETTES[paletteName];
      for (const fish of this.allKoi) {
        fish.color = this.colors[Math.floor(Math.random() * this.colors.length)];
      }
    }
  }

  setFishCount(count) {
    this.fishCount = count;
    while (this.allKoi.length < this.fishCount) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const size = Math.random() * 8 + 12;
      this.allKoi.push(new Koi(x, y, color, size));
    }
    while (this.allKoi.length > this.fishCount) {
      this.allKoi.pop();
    }
  }

  setLilyPadCount(count) {
    if (this.lilyPadCount === count) return;
    this.lilyPadCount = count;
    this.setupLilyPads();
  }

  applyPreset(presetName) {
    const preset = KOI_PRESETS[presetName];
    if (preset) {
      this.setPalette(preset.palette);
      this.setFishCount(preset.fishCount);
      this.setLilyPadCount(preset.lilyPadCount);
    }
  }

  update(motionData) {
    const { points: motionPoints, centroids, timeScale = 1.0 } = motionData;
    this.time++;

    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;

    // Resolve motion sources: use filtered centroids for organic interaction if available, otherwise raw points
    const activeMotionSources = centroids && centroids.length > 0 ? centroids : motionPoints;

    // Track stationary centroids to spawn food
    if (centroids && centroids.length > 0) {
      let nextTracked = [];
      for (const c of centroids) {
        let found = this.trackedCentroids.find(tc => Math.hypot(tc.x - c.x, tc.y - c.y) < 0.05);
        if (found) {
          found.x = c.x;
          found.y = c.y;
          found.duration += timeScale;
          found.matched = true;
          nextTracked.push(found);
          
          if (found.duration >= 90) { // 1.5 seconds at 60fps
            this.food.push(new FoodPellet(c.x * this.width, c.y * this.height));
            found.duration = 0; // reset
            playSplash();
          }
        } else {
          nextTracked.push({
            x: c.x,
            y: c.y,
            duration: 1,
            matched: true
          });
        }
      }
      this.trackedCentroids = nextTracked;
    } else {
      this.trackedCentroids = [];
    }

    // 1. Spawn Water Ripples at active motion points
    if (activeMotionSources.length > 0 && this.time % 5 === 0) {
      const m = activeMotionSources[Math.floor(Math.random() * activeMotionSources.length)];
      this.ripples.push({
        x: m.x * this.width,
        y: m.y * this.height,
        radius: 10,
        maxRadius: Math.random() * 90 + 90,
        speed: Math.random() * 1.5 + 2.0,
        alpha: 1.0
      });
      playSplash();
    }

    // 2. Draw deep indigo/black water pond background
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#030510'; // Deep pond water base
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw subtle glowing pond gradient lines / water surface caustic look
    this.ctx.fillStyle = 'rgba(0, 243, 255, 0.005)';
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2, this.height / 2, this.width * 0.6, 0, Math.PI * 2);
    this.ctx.fill();

    // 3. Update & Draw Water Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed;
      r.alpha = 1 - (r.radius / r.maxRadius);

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.strokeStyle = `rgba(0, 243, 255, ${r.alpha * 0.35})`;
      this.ctx.lineWidth = 1.8 * r.alpha;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = '#00f3ff';
      
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.strokeStyle = `rgba(0, 243, 255, ${r.alpha * 0.12})`;
      this.ctx.lineWidth = 1.0 * r.alpha;
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius * 1.3, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Update & Draw Food Pellets
    if (this.food) {
      for (let i = this.food.length - 1; i >= 0; i--) {
        const pellet = this.food[i];
        if (pellet.eaten) {
          this.food.splice(i, 1);
          continue;
        }
        pellet.update(this.width, this.height, timeScale);
        pellet.draw(this.ctx);
      }
    }

    // 4. Update & Draw Lily Pads (so they sit below fish or overlap)
    for (const pad of this.lilyPads) {
      pad.update(this.width, this.height, activeMotionSources, timeScale);
      pad.draw(this.ctx);
    }

    // 5. Update & Draw Bioluminescent Koi Fish
    for (const fish of this.allKoi) {
      fish.update(this.width, this.height, this.allKoi, activeMotionSources, this.food, this.lilyPads, timeScale);
      fish.draw(this.ctx, this.time);
    }
  }
}
