import { playShoot, playExplosion } from './audio.js';

export class AsteroidsDefense {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.score = 0;
    this.base = {
      x: this.width / 2,
      y: this.height / 2,
      health: 100,
      radius: 55
    };
    
    this.asteroids = [];
    this.particles = [];
    this.spawnRate = 60; // Frames between spawns
    this.asteroidSpeedScale = 1.0;
    this.frames = 0;
    this.baseHitFrame = 0; // Flash base when hit
    this.gameState = 'start';

    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  init() {
    this.score = 0;
    this.base.health = 100;
    this.asteroids = [];
    this.particles = [];
    this.frames = 0;
    this.gameState = 'start';
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
    
    this.base.x = this.width / 2;
    this.base.y = this.height / 2;
  }

  spawnAsteroid() {
    let x, y;
    if (Math.random() > 0.5) {
      x = Math.random() > 0.5 ? -50 : this.width + 50;
      y = Math.random() * this.height;
    } else {
      x = Math.random() * this.width;
      y = Math.random() > 0.5 ? -50 : this.height + 50;
    }

    const angle = Math.atan2(this.base.y - y, this.base.x - x);
    const speed = (Math.random() * 2 + 1) * (this.asteroidSpeedScale || 1.0);
    
    this.asteroids.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 20 + 20,
      vertices: Math.floor(Math.random() * 5) + 6,
      offsets: Array(12).fill(0).map(() => Math.random() * 0.35 + 0.82), // Jagged edges
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 0.06
    });
  }

  createExplosion(x, y, color) {
    // Shard particles
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 2;
      this.particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 1.5,
        life: 1.0,
        decay: Math.random() * 0.025 + 0.015,
        color: color
      });
    }

    // Expanding shockwave vector ring
    this.particles.push({
      type: 'ring',
      x: x,
      y: y,
      radius: 6,
      maxRadius: 75 + Math.random() * 35,
      life: 1.0,
      decay: 0.035,
      color: color
    });
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];
    this.frames++;

    // Prevent leaks from previous frame/effects
    this.ctx.globalAlpha = 1.0;
    this.ctx.setLineDash([]);

    // Check center stepped
    let centerStepped = false;
    for (const m of motionPoints) {
      if (m.x >= 0.45 && m.x <= 0.55 && m.y >= 0.45 && m.y <= 0.55) {
        centerStepped = true;
        break;
      }
    }

    // 1. Draw Starry Cyber-Grid Background
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#06060c';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Vector grid
    this.ctx.strokeStyle = 'rgba(99, 110, 114, 0.06)';
    this.ctx.lineWidth = 1;
    const gridSpace = 60;
    this.ctx.beginPath();
    for (let x = 0; x < this.width; x += gridSpace) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
    }
    for (let y = 0; y < this.height; y += gridSpace) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
    }
    this.ctx.stroke();

    // 2. Draw High-Contrast Score & Shield HUD Cards
    const cardY = 30;
    const cardW = 260;
    const cardH = 80;
    const leftCardX = this.width * 0.25 - cardW / 2;
    const rightCardX = this.width * 0.75 - cardW / 2;

    this.ctx.fillStyle = 'rgba(10, 8, 20, 0.8)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.roundRect(leftCardX, cardY, cardW, cardH, 12);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.roundRect(rightCardX, cardY, cardW, cardH, 12);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = 'bold 32px Outfit, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`SCORE: ${this.score}`, this.width * 0.25, cardY + cardH / 2);

    this.ctx.fillStyle = this.base.health > 30 ? '#55efc4' : '#ff7675';
    this.ctx.fillText(`SHIELD: ${this.base.health}%`, this.width * 0.75, cardY + cardH / 2);

    // GAME STATE MACHINE CHECK
    if (this.gameState === 'start') {
      if (centerStepped) {
        this.gameState = 'play';
        this.score = 0;
        this.base.health = 100;
        this.asteroids = [];
        this.particles = [];
        this.frames = 0;
        playShoot();
      }

      // Draw glassmorphic center modal
      const modalW = 550;
      const modalH = 300;
      const modalX = this.width / 2 - modalW / 2;
      const modalY = this.height / 2 - modalH / 2;

      this.ctx.fillStyle = 'rgba(15, 12, 30, 0.85)';
      this.ctx.beginPath();
      this.ctx.roundRect(modalX, modalY, modalW, modalH, 20);
      this.ctx.fill();

      this.ctx.save();
      this.ctx.strokeStyle = '#fd79a8';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#fd79a8';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.roundRect(modalX, modalY, modalW, modalH, 20);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.font = 'bold 40px Outfit, sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("ASTEROIDS DEFENSE", this.width / 2, this.height / 2 - 40);

      if (Math.floor(performance.now() / 600) % 2 === 0) {
        this.ctx.font = 'bold 22px Outfit, sans-serif';
        this.ctx.fillStyle = '#fd79a8';
        this.ctx.fillText("STEP ON CENTER TO START", this.width / 2, this.height / 2 + 40);
      }

      // Draw center bounding box outline
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(253, 121, 168, 0.4)';
      this.ctx.setLineDash([6, 6]);
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(this.width * 0.45, this.height * 0.45, this.width * 0.1, this.height * 0.1, 10);
      this.ctx.stroke();
      this.ctx.restore();

      return;
    }

    if (this.gameState === 'gameover') {
      if (centerStepped) {
        this.gameState = 'play';
        this.score = 0;
        this.base.health = 100;
        this.asteroids = [];
        this.particles = [];
        this.frames = 0;
        playShoot();
      }

      // Draw glassmorphic center modal
      const modalW = 550;
      const modalH = 300;
      const modalX = this.width / 2 - modalW / 2;
      const modalY = this.height / 2 - modalH / 2;

      this.ctx.fillStyle = 'rgba(25, 12, 12, 0.88)';
      this.ctx.beginPath();
      this.ctx.roundRect(modalX, modalY, modalW, modalH, 20);
      this.ctx.fill();

      this.ctx.save();
      this.ctx.strokeStyle = '#ff7675';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#ff7675';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.roundRect(modalX, modalY, modalW, modalH, 20);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.font = 'bold 44px Outfit, sans-serif';
      this.ctx.fillStyle = '#ff7675';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 50);

      this.ctx.font = 'bold 26px Outfit, sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(`FINAL SCORE: ${this.score}`, this.width / 2, this.height / 2);

      if (Math.floor(performance.now() / 600) % 2 === 0) {
        this.ctx.font = 'bold 20px Outfit, sans-serif';
        this.ctx.fillStyle = '#ff7675';
        this.ctx.fillText("STEP ON CENTER TO RESTART", this.width / 2, this.height / 2 + 60);
      }

      // Draw center bounding box outline
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 118, 117, 0.4)';
      this.ctx.setLineDash([6, 6]);
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(this.width * 0.45, this.height * 0.45, this.width * 0.1, this.height * 0.1, 10);
      this.ctx.stroke();
      this.ctx.restore();

      return;
    }

    // --- PLAY STATE LOGIC ---

    // Speed up spawns as score increases
    if (this.frames % Math.max(12, this.spawnRate - Math.floor(this.score / 12)) === 0) {
      this.spawnAsteroid();
    }

    // Flashing effects on shield hit
    let baseColor = '#0984e3';
    let baseInnerColor = '#74b9ff';
    let pulseScale = 1.0;
    if (this.baseHitFrame > 0) {
      this.baseHitFrame--;
      baseColor = '#ff7675';
      baseInnerColor = '#ff7675';
      pulseScale = 1.2;
    }

    // 3. Draw Concentric Energy Shield Core
    this.ctx.save();
    // Shield Pulse Glow
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = baseColor;
    this.ctx.globalAlpha = 0.15;
    this.ctx.beginPath();
    this.ctx.arc(this.base.x, this.base.y, this.base.radius * 1.5 * pulseScale, 0, Math.PI * 2);
    this.ctx.fillStyle = baseColor;
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 2.5;

    // Outer shield circle (rotating)
    this.ctx.save();
    this.ctx.translate(this.base.x, this.base.y);
    this.ctx.rotate(this.frames * 0.012);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.base.radius, 0, Math.PI * 2);
    this.ctx.stroke();
    // Radial notches
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(a) * this.base.radius, Math.sin(a) * this.base.radius);
      this.ctx.lineTo(Math.cos(a) * (this.base.radius - 8), Math.sin(a) * (this.base.radius - 8));
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Inner shield dashed ring (rotating opposite)
    this.ctx.save();
    this.ctx.translate(this.base.x, this.base.y);
    this.ctx.rotate(-this.frames * 0.02);
    this.ctx.strokeStyle = baseInnerColor;
    this.ctx.setLineDash([8, 10]);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.base.radius * 0.72, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
    this.ctx.setLineDash([]); // Reset line dash to prevent leakage

    // Glowing core
    this.ctx.beginPath();
    this.ctx.arc(this.base.x, this.base.y, this.base.radius * 0.38 * (0.95 + Math.sin(this.frames * 0.06) * 0.05), 0, Math.PI * 2);
    this.ctx.fillStyle = baseInnerColor;
    this.ctx.fill();

    // 4. Update and Draw Wireframe Asteroids & Aiming Lasers
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i];
      if (!a) continue;
      
      a.x += a.vx;
      a.y += a.vy;
      a.rotation += a.rotSpeed;

      // Space rock dust particles
      if (Math.random() < 0.18) {
        this.particles.push({
          type: 'spark',
          x: a.x,
          y: a.y,
          vx: -a.vx * 0.4 + (Math.random() - 0.5) * 1.2,
          vy: -a.vy * 0.4 + (Math.random() - 0.5) * 1.2,
          size: Math.random() * 3 + 1,
          life: 0.6,
          decay: 0.035,
          color: '#636e72'
        });
      }

      // Check collision with central base
      const distToBase = Math.hypot(this.base.x - a.x, this.base.y - a.y);
      if (distToBase < this.base.radius + a.radius - 8) {
        this.base.health -= 10;
        this.baseHitFrame = 12;
        this.createExplosion(a.x, a.y, '#ff7675');
        playExplosion();
        this.asteroids.splice(i, 1);
        if (this.base.health <= 0) {
          this.gameState = 'gameover';
          this.createExplosion(this.base.x, this.base.y, '#0984e3');
          playExplosion();
          break;
        }
        continue;
      }

      // Out of bounds cleanup
      if (distToBase > Math.max(this.width, this.height) + 200) {
        this.asteroids.splice(i, 1);
        continue;
      }

      // 5. Draw Dynamic Target Locks & Beams
      let targetPoint = null;
      let minDist = 200; // Trigger laser lock if player is within 200px
      for (const m of motionPoints) {
        const mx = m.x * this.width;
        const my = m.y * this.height;
        const dist = Math.hypot(a.x - mx, a.y - my);
        if (dist < minDist) {
          minDist = dist;
          targetPoint = { x: mx, y: my };
        }
      }

      let targetedThisFrame = false;
      if (targetPoint) {
        if (!a.wasTargeted) {
          playShoot();
        }
        targetedThisFrame = true;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
        this.ctx.lineWidth = 2.0;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00f3ff';
        
        // Aiming laser beam
        this.ctx.beginPath();
        this.ctx.moveTo(targetPoint.x, targetPoint.y);
        this.ctx.lineTo(a.x, a.y);
        this.ctx.stroke();

        // Target reticle
        this.ctx.strokeStyle = '#fdcb6e';
        this.ctx.shadowColor = '#fdcb6e';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.arc(a.x, a.y, a.radius + 8, 0, Math.PI * 2);
        this.ctx.stroke();

        // Four corner ticks on targeting circle
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
          this.ctx.beginPath();
          this.ctx.moveTo(a.x + Math.cos(angle) * (a.radius + 4), a.y + Math.sin(angle) * (a.radius + 4));
          this.ctx.lineTo(a.x + Math.cos(angle) * (a.radius + 12), a.y + Math.sin(angle) * (a.radius + 12));
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      // Check collision with motion points (destroy)
      let destroyed = false;
      for (const m of motionPoints) {
        const mx = m.x * this.width;
        const my = m.y * this.height;
        const dist = Math.hypot(a.x - mx, a.y - my);
        const hitRadius = a.radius + Math.min(50, m.mass * 1.5 + 15);
        if (dist < hitRadius) {
          destroyed = true;
          break;
        }
      }

      if (destroyed) {
        this.score += 10;
        this.createExplosion(a.x, a.y, '#fdcb6e');
        playExplosion();
        this.asteroids.splice(i, 1);
        continue;
      }

      // 6. Draw Premium Wireframe Asteroids
      this.ctx.save();
      this.ctx.translate(a.x, a.y);
      this.ctx.rotate(a.rotation);
      
      // Base shadow / background filler for asteroid shape
      this.ctx.beginPath();
      for (let j = 0; j < a.vertices; j++) {
        const angle = (j / a.vertices) * Math.PI * 2;
        const r = a.radius * a.offsets[j];
        if (j === 0) this.ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      this.ctx.closePath();
      this.ctx.fillStyle = 'rgba(25, 25, 35, 0.7)';
      this.ctx.fill();

      // Outer vector outline
      this.ctx.strokeStyle = '#fd79a8';
      this.ctx.lineWidth = 2.2;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = '#fd79a8';
      this.ctx.stroke();

      // Inner wireframe scaling layer
      this.ctx.scale(0.72, 0.72);
      this.ctx.beginPath();
      for (let j = 0; j < a.vertices; j++) {
        const angle = (j / a.vertices) * Math.PI * 2;
        const r = a.radius * a.offsets[j];
        if (j === 0) this.ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      this.ctx.closePath();
      this.ctx.strokeStyle = 'rgba(253, 121, 168, 0.35)';
      this.ctx.lineWidth = 1;
      this.ctx.shadowBlur = 0;
      this.ctx.stroke();

      this.ctx.restore();
      a.wasTargeted = targetedThisFrame;
    }

    // 7. Draw Explosion Sparks & Expansion Circles
    this.ctx.globalCompositeOperation = 'lighter';
    if (this.particles.length > 300) {
      this.particles = this.particles.slice(-300);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;

      if (p.type === 'ring') {
        p.radius += (p.maxRadius - p.radius) * 0.12;
        p.life -= p.decay;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 2.8 * p.life;
        this.ctx.shadowBlur = 0; // disable shadow for particles to speed up rendering
        this.ctx.globalAlpha = p.life;
        this.ctx.stroke();
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= p.decay;

        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        
        if (p.color === '#fdcb6e') {
          const r = 255;
          const g = Math.floor(190 * p.life);
          const b = Math.floor(90 * p.life * p.life);
          this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else {
          this.ctx.fillStyle = p.color;
        }

        this.ctx.globalAlpha = p.life;
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}
