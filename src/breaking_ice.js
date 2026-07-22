import { playCrack, playShatter, playSplash, playSplat, playChime, throttledPlay } from './audio.js';

class IceShard {
  constructor(x, y, color, size) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.5) * 5;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.1;
    this.size = Math.random() * size * 0.3 + size * 0.15;
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.02;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08; // slight gravity drift
    this.rotation += this.rotSpeed;
    this.life -= this.decay;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;

    // Draw triangle shard shape
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(this.size * 0.5, this.size * 0.5);
    ctx.lineTo(-this.size * 0.5, this.size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class IceGridCell {
  constructor(col, row, px, py, w, h) {
    this.col = col;
    this.row = row;
    this.px = px; // screen x coordinate
    this.py = py; // screen y coordinate
    this.w = w;   // cell width
    this.h = h;   // cell height

    this.integrity = 1.0;
    this.stage = 0; // 0=solid, 1=light cracks, 2=heavy cracks, 3=broken
    this.cracks = [];
    this.healDelay = 0; // stillness counter before healing starts
  }

  reset() {
    this.integrity = 1.0;
    this.stage = 0;
    this.cracks = [];
  }

  generateCracks(stage) {
    const segments = [];
    const cx = this.px + this.w / 2;
    const cy = this.py + this.h / 2;
    
    const branches = stage === 1 ? 3 : 5;
    for (let b = 0; b < branches; b++) {
      const angle = (b * Math.PI * 2) / branches + (Math.random() - 0.5) * 0.4;
      let currX = cx;
      let currY = cy;
      const length = stage === 1 ? this.w * 0.28 : this.w * 0.45;
      const count = stage === 1 ? 2 : 3;

      for (let s = 0; s < count; s++) {
        const segLen = length / count;
        const nextX = currX + Math.cos(angle) * segLen + (Math.random() - 0.5) * 8;
        const nextY = currY + Math.sin(angle) * segLen + (Math.random() - 0.5) * 8;
        segments.push({ x1: currX, y1: currY, x2: nextX, y2: nextY });
        currX = nextX;
        currY = nextY;
      }
    }
    this.cracks = this.cracks.concat(segments);
  }
}

export class BreakingIce {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    this.preset = 'ice'; // Default: 'ice', 'lava', 'glass'

    // Grid configuration
    this.cols = 10;
    this.rows = 8;
    this.cells = [];
    this.shards = [];

    // Ambient bubbles for lava preset
    this.ambientParticles = [];

    // Pre-rendered elements
    this.bgCanvas = document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');

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

    this.setupGrid();
    this.renderPresetBackground();
  }

  setPreset(preset) {
    this.preset = preset;
    this.shards = [];
    this.ambientParticles = [];
    this.setupGrid();
    this.renderPresetBackground();
  }

  setupGrid() {
    this.cells = [];
    const cellW = this.width / this.cols;
    const cellH = this.height / this.rows;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.cells.push(new IceGridCell(
          c, r,
          c * cellW, r * cellH,
          cellW, cellH
        ));
      }
    }
  }

  init() {
    this.cells.forEach(cell => cell.reset());
    this.shards = [];
    this.ambientParticles = [];
  }

  // Pre-render underwater patterns, glowing core lava, or church window backplates
  renderPresetBackground() {
    const ctx = this.bgCtx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    if (this.preset === 'ice') {
      // 1. Arctic ocean water showing below
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0284c7'); // sky blue
      grad.addColorStop(1, '#075985'); // deep cobalt water
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Simple water wave caustics
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.ellipse(w * 0.15 + i * (w * 0.12), h * 0.2 + i * (h * 0.08), 80, 40, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

    } else if (this.preset === 'lava') {
      // 2. Liquid glowing magma
      ctx.fillStyle = '#1e0501'; // obsidian dark lava base
      ctx.fillRect(0, 0, w, h);

      // Glowing liquid lava channels
      const lavaGrad = ctx.createLinearGradient(0, 0, w, h);
      lavaGrad.addColorStop(0, '#ea580c'); // orange
      lavaGrad.addColorStop(0.5, '#f97316'); // bright yellow-orange
      lavaGrad.addColorStop(1, '#dc2626'); // red
      ctx.fillStyle = lavaGrad;

      // Draw stylized winding lava pathways
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.15, Math.PI / 6, 0, Math.PI * 2);
      ctx.ellipse(w * 0.2, h * 0.8, w * 0.3, h * 0.12, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.preset === 'glass') {
      // 3. Gothic Stained Glass Window floor
      // Draw grid segments of colorful light panes
      const cellW = w / this.cols;
      const cellH = h / this.rows;

      const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const colorIdx = (c + r) % colors.length;
          ctx.fillStyle = colors[colorIdx];
          ctx.globalAlpha = 0.55;
          ctx.fillRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);

          // Add inner mosaic circle
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.08;
          ctx.beginPath();
          ctx.arc(c * cellW + cellW/2, r * cellH + cellH/2, Math.min(cellW, cellH) * 0.35, 0, Math.PI*2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];

    // 1. Draw Revealed Background
    this.ctx.drawImage(this.bgCanvas, 0, 0);

    // ── 2. Update Integrity & Crack Stages ─────────────────────
    const cellW = this.width / this.cols;
    const cellH = this.height / this.rows;

    this.cells.forEach(cell => {
      // Check if any centroid overlaps this cell
      let hasOverlap = false;

      motionPoints.forEach(m => {
        const mx = m.x * this.width;
        const my = m.y * this.height;

        if (
          mx >= cell.px && mx < cell.px + cell.w &&
          my >= cell.py && my < cell.py + cell.h
        ) {
          hasOverlap = true;
        }
      });

      if (hasOverlap) {
        cell.healDelay = 180; // delay healing (3 seconds at 60fps)
        if (cell.stage < 3) {
          cell.integrity -= 0.015; // degrade integrity on step
          
          if (cell.stage === 0 && cell.integrity <= 0.72) {
            cell.stage = 1;
            cell.generateCracks(1);
            throttledPlay(playCrack, 160);
          } else if (cell.stage === 1 && cell.integrity <= 0.38) {
            cell.stage = 2;
            cell.generateCracks(2);
            // Play crack slightly higher pitched or louder
            throttledPlay(playCrack, 160);
          } else if (cell.stage === 2 && cell.integrity <= 0.0) {
            cell.stage = 3;
            this.shatterCell(cell);
          }
        }
      } else {
        // Heal back slowly if no movement detected
        if (cell.healDelay > 0) {
          cell.healDelay--;
        } else if (cell.integrity < 1.0) {
          cell.integrity += 0.003; // slow freeze back
          if (cell.stage === 3 && cell.integrity >= 0.15) {
            cell.stage = 2;
          } else if (cell.stage === 2 && cell.integrity >= 0.5) {
            cell.stage = 1;
          } else if (cell.stage === 1 && cell.integrity >= 0.85) {
            cell.reset();
          }
        }
      }

      // ── 3. Render Solid Ice and Cracks ───────────────────────
      if (cell.stage < 3) {
        this.ctx.save();
        this.ctx.globalAlpha = 1.0;

        if (this.preset === 'ice') {
          // Frosty white-blue ice plate
          const grad = this.ctx.createLinearGradient(cell.px, cell.py, cell.px + cell.w, cell.py + cell.h);
          grad.addColorStop(0, '#e0f2fe');
          grad.addColorStop(1, '#bae6fd');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(cell.px + 1, cell.py + 1, cell.w - 2, cell.h - 2);

          // Draw bevel highlight border
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(cell.px + 1, cell.py + 1, cell.w - 2, cell.h - 2);

        } else if (this.preset === 'lava') {
          // Hardened dark obsidian volcanic crust
          const grad = this.ctx.createLinearGradient(cell.px, cell.py, cell.px + cell.w, cell.py + cell.h);
          grad.addColorStop(0, '#1e293b'); // grey slate
          grad.addColorStop(1, '#0f172a'); // dark grey slate
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(cell.px + 0.8, cell.py + 0.8, cell.w - 1.6, cell.h - 1.6);

          // Edge glow
          this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(cell.px, cell.py, cell.w, cell.h);

        } else if (this.preset === 'glass') {
          // Stained Glass frames: thick black iron seams
          this.ctx.strokeStyle = '#090514';
          this.ctx.lineWidth = 4;
          this.ctx.strokeRect(cell.px, cell.py, cell.w, cell.h);
        }

        // Draw crack line segments
        if (cell.cracks.length > 0) {
          if (this.preset === 'ice') {
            this.ctx.strokeStyle = 'rgba(12, 74, 110, 0.65)'; // deep blue slate crack
            this.ctx.lineWidth = 2.0;
          } else if (this.preset === 'lava') {
            this.ctx.strokeStyle = '#f97316'; // orange hot crack
            this.ctx.lineWidth = 2.5;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#f97316';
          } else {
            this.ctx.strokeStyle = '#f8fafc'; // silver cracks on glass
            this.ctx.lineWidth = 1.8;
          }

          this.ctx.beginPath();
          cell.cracks.forEach(seg => {
            this.ctx.moveTo(seg.x1, seg.y1);
            this.ctx.lineTo(seg.x2, seg.y2);
          });
          this.ctx.stroke();
          this.ctx.shadowBlur = 0; // reset
        }
        this.ctx.restore();
      }
    });

    // ── 4. Update & Draw Shattered Shards ────────────────────
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      if (!s.update()) {
        this.shards.splice(i, 1);
      } else {
        s.draw(this.ctx);
      }
    }

    // ── 5. Lava bubbles / chimes spores ──────────────────────
    if (this.preset === 'lava') {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'lighter';
      
      // Spawn lava bubbles occasionally below shattered plates
      this.cells.forEach(cell => {
        if (cell.stage === 3 && Math.random() < 0.03) {
          this.ambientParticles.push({
            x: cell.px + cell.w / 2 + (Math.random() - 0.5) * cell.w * 0.7,
            y: cell.py + cell.h / 2 + (Math.random() - 0.5) * cell.h * 0.7,
            vy: -Math.random() * 0.8 - 0.4,
            size: Math.random() * 4 + 3,
            life: 1.0,
            color: '#ef4444' // red bubble
          });
        }
      });

      for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
        const p = this.ambientParticles[i];
        p.y += p.vy;
        p.life -= 0.015;
        if (p.life <= 0) {
          this.ambientParticles.splice(i, 1);
        } else {
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          this.ctx.fillStyle = p.color;
          this.ctx.fill();
        }
      }
      this.ctx.restore();
    }
  }

  shatterCell(cell) {
    const cx = cell.px + cell.w / 2;
    const cy = cell.py + cell.h / 2;

    // Play heavy shatter sound
    if (this.preset === 'ice') {
      playShatter();
    } else if (this.preset === 'lava') {
      // Lava crackle + splash bubble
      playShatter();
    } else {
      // Stained glass breaks - chimes chord + thud
      playShatter();
      playChime();
    }

    // Spawn 6 to 10 shattered shards flying away
    const shardsCount = 6 + Math.floor(Math.random() * 4);
    const color = this.preset === 'ice' ? '#bae6fd' : this.preset === 'lava' ? '#0f172a' : '#ffffff';
    
    for (let i = 0; i < shardsCount; i++) {
      const sx = cx + (Math.random() - 0.5) * cell.w * 0.4;
      const sy = cy + (Math.random() - 0.5) * cell.h * 0.4;
      this.shards.push(new IceShard(sx, sy, color, cell.w));
    }
  }
}
