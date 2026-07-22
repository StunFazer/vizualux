import { playBleep } from './audio.js';

export class FloorPong {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.leftScore = 0;
    this.rightScore = 0;
    this.gameState = 'start';
    
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      vx: (Math.random() > 0.5 ? 1 : -1) * 8,
      vy: (Math.random() * 4) - 2,
      radius: 20,
      color: '#00cec9',
      baseSpeed: 8,
      maxSpeed: 25
    };

    this.particles = []; // For explosions and hit sparks
    this.trail = [];     // History of ball positions for drawing trail
    
    // Paddle positions smoothed via lerp
    this.paddles = {
      left: this.height / 2,
      right: this.height / 2,
      height: 140,
      width: 15
    };

    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  init() {
    this.leftScore = 0;
    this.rightScore = 0;
    this.gameState = 'start';
    this.resetBall(Math.random() > 0.5 ? 1 : -1);
    this.particles = [];
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
    
    // Reposition ball if offscreen after resize
    if (this.ball.x > this.width || this.ball.y > this.height) {
      this.resetBall(1);
    }
  }

  resetBall(direction) {
    this.ball.x = this.width / 2;
    this.ball.y = this.height / 2;
    this.ball.vx = direction * this.ball.baseSpeed;
    this.ball.vy = (Math.random() * 4) - 2;
    this.trail = [];
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        life: 1.0,
        color: color
      });
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];

    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;

    // Safety check against NaN propagation
    if (isNaN(this.ball.vx) || isNaN(this.ball.vy) || isNaN(this.ball.x) || isNaN(this.ball.y)) {
      this.resetBall(Math.random() > 0.5 ? 1 : -1);
    }

    // 1. Render Cyber Grid Arena Background
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#08080e';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Neon grid lines
    this.ctx.strokeStyle = 'rgba(108, 92, 231, 0.07)';
    this.ctx.lineWidth = 1;
    const gridSize = 50;
    this.ctx.beginPath();
    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
    }
    for (let y = 0; y < this.height; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
    }
    this.ctx.stroke();

    // Side glowing arena limits
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 3);
    this.ctx.lineTo(this.width, 3);
    this.ctx.moveTo(0, this.height - 3);
    this.ctx.lineTo(this.width, this.height - 3);
    this.ctx.stroke();

    // Draw Center Dashed Line
    this.ctx.setLineDash([15, 15]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, 0);
    this.ctx.lineTo(this.width / 2, this.height);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 2. Compute Motion-Tracking Curved Paddles
    let leftPlayerSumY = 0;
    let leftPlayerCount = 0;
    let rightPlayerSumY = 0;
    let rightPlayerCount = 0;

    for (const m of motionPoints) {
      const mx = m.x * this.width;
      const my = m.y * this.height;
      if (mx < this.width * 0.35) {
        leftPlayerSumY += my;
        leftPlayerCount++;
      } else if (mx > this.width * 0.65) {
        rightPlayerSumY += my;
        rightPlayerCount++;
      }
    }

    if (this.paddles.left === undefined || this.paddles.left === null) this.paddles.left = this.height / 2;
    if (this.paddles.right === undefined || this.paddles.right === null) this.paddles.right = this.height / 2;

    if (leftPlayerCount > 0) {
      const targetY = leftPlayerSumY / leftPlayerCount;
      this.paddles.left += (targetY - this.paddles.left) * 0.15;
    }
    if (rightPlayerCount > 0) {
      const targetY = rightPlayerSumY / rightPlayerCount;
      this.paddles.right += (targetY - this.paddles.right) * 0.15;
    }

    // Check center stepped
    let centerStepped = false;
    for (const m of motionPoints) {
      if (m.x >= 0.45 && m.x <= 0.55 && m.y >= 0.45 && m.y <= 0.55) {
        centerStepped = true;
        break;
      }
    }

    // Draw high-contrast scoreboard containers
    this.ctx.fillStyle = 'rgba(10, 8, 20, 0.8)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 2;

    const leftCardX = this.width * 0.25 - 80;
    const rightCardX = this.width * 0.75 - 80;
    const cardY = 30;
    const cardW = 160;
    const cardH = 100;

    this.ctx.beginPath();
    this.ctx.roundRect(leftCardX, cardY, cardW, cardH, 12);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.roundRect(rightCardX, cardY, cardW, cardH, 12);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = 'bold 64px Outfit, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.leftScore, this.width * 0.25, cardY + cardH / 2);
    this.ctx.fillText(this.rightScore, this.width * 0.75, cardY + cardH / 2);

    // Draw paddles
    this.ctx.save();
    // Left Paddle (Cyan Glow)
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#00f3ff';
    this.ctx.fillStyle = '#00f3ff';
    this.ctx.beginPath();
    this.ctx.roundRect(40, this.paddles.left - this.paddles.height / 2, this.paddles.width, this.paddles.height, 8);
    this.ctx.fill();

    // Right Paddle (Pink Glow)
    this.ctx.shadowColor = '#fd79a8';
    this.ctx.fillStyle = '#fd79a8';
    this.ctx.beginPath();
    this.ctx.roundRect(this.width - 40 - this.paddles.width, this.paddles.right - this.paddles.height / 2, this.paddles.width, this.paddles.height, 8);
    this.ctx.fill();
    this.ctx.restore();

    // GAME STATE MACHINE CHECK
    if (this.gameState === 'start') {
      if (centerStepped) {
        this.gameState = 'play';
        this.resetBall(Math.random() > 0.5 ? 1 : -1);
        playBleep(600);
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
      this.ctx.strokeStyle = '#00f3ff';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#00f3ff';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.roundRect(modalX, modalY, modalW, modalH, 20);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.font = 'bold 44px Outfit, sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("FLOOR PONG", this.width / 2, this.height / 2 - 40);

      if (Math.floor(performance.now() / 600) % 2 === 0) {
        this.ctx.font = 'bold 22px Outfit, sans-serif';
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.fillText("STEP ON CENTER TO START", this.width / 2, this.height / 2 + 40);
      }

      // Draw center bounding box outline
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
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
        this.leftScore = 0;
        this.rightScore = 0;
        this.gameState = 'play';
        this.resetBall(Math.random() > 0.5 ? 1 : -1);
        playBleep(600);
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

      const winnerText = this.leftScore >= 5 ? "PLAYER 1 WINS!" : "PLAYER 2 WINS!";
      this.ctx.font = 'bold 26px Outfit, sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(winnerText, this.width / 2, this.height / 2);

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

    // 4. Update Ball Physics & Paddle Collisions
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // Record positions for trail
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) {
      this.trail.shift();
    }

    // Paddle Collisions
    const prevX = this.ball.x - this.ball.vx;
    const prevY = this.ball.y - this.ball.vy;
    
    // Left Paddle Collision (Interpolated)
    const leftPaddleX = 40 + this.paddles.width;
    let crossedLeft = false;
    let yAtLeftCrossing = this.ball.y;
    if (this.ball.vx < 0) {
      const prevLeft = prevX - this.ball.radius;
      const currLeft = this.ball.x - this.ball.radius;
      if (prevLeft >= leftPaddleX && currLeft <= leftPaddleX) {
        crossedLeft = true;
        const t = (prevLeft - leftPaddleX) / (prevLeft - currLeft || 1);
        yAtLeftCrossing = prevY + t * this.ball.vy;
      }
    }
    if (this.ball.vx < 0 && crossedLeft) {
      if (yAtLeftCrossing >= this.paddles.left - this.paddles.height / 2 - 15 && yAtLeftCrossing <= this.paddles.left + this.paddles.height / 2 + 15) {
        this.ball.x = leftPaddleX + this.ball.radius;
        this.ball.vx = Math.abs(this.ball.vx) * 1.06; // increase speed slightly on hit
        const relativeIntersectY = (this.paddles.left - yAtLeftCrossing) / (this.paddles.height / 2);
        this.ball.vy = -relativeIntersectY * 10;
        this.createExplosion(this.ball.x, this.ball.y, '#00f3ff');
        playBleep(440);
      }
    }

    // Right Paddle Collision (Interpolated)
    const rightPaddleX = this.width - 40 - this.paddles.width;
    let crossedRight = false;
    let yAtRightCrossing = this.ball.y;
    if (this.ball.vx > 0) {
      const prevRight = prevX + this.ball.radius;
      const currRight = this.ball.x + this.ball.radius;
      if (prevRight <= rightPaddleX && currRight >= rightPaddleX) {
        crossedRight = true;
        const t = (rightPaddleX - prevRight) / (currRight - prevRight || 1);
        yAtRightCrossing = prevY + t * this.ball.vy;
      }
    }
    if (this.ball.vx > 0 && crossedRight) {
      if (yAtRightCrossing >= this.paddles.right - this.paddles.height / 2 - 15 && yAtRightCrossing <= this.paddles.right + this.paddles.height / 2 + 15) {
        this.ball.x = rightPaddleX - this.ball.radius;
        this.ball.vx = -Math.abs(this.ball.vx) * 1.06;
        const relativeIntersectY = (this.paddles.right - yAtRightCrossing) / (this.paddles.height / 2);
        this.ball.vy = -relativeIntersectY * 10;
        this.createExplosion(this.ball.x, this.ball.y, '#fd79a8');
        playBleep(440);
      }
    }

    // Interactive rebound with free-form motion points
    let hit = false;
    for (const m of motionPoints) {
      const mx = m.x * this.width;
      const my = m.y * this.height;
      const dx = this.ball.x - mx;
      const dy = this.ball.y - my;
      const distSq = dx * dx + dy * dy;
      const hitRadius = 80;

      if (distSq < hitRadius * hitRadius) {
        if (distSq < 1) continue;
        const dist = Math.sqrt(distSq);
        const force = (hitRadius - dist) / hitRadius;
        
        this.ball.vx += (dx / dist) * force * 4.5;
        this.ball.vy += (dy / dist) * force * 4.5;
        hit = true;

        if (Math.random() < 0.4) {
          const sparkAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1;
          const sparkSpeed = Math.random() * 6 + 4;
          this.particles.push({
            x: this.ball.x,
            y: this.ball.y,
            vx: Math.cos(sparkAngle) * sparkSpeed,
            vy: Math.sin(sparkAngle) * sparkSpeed,
            life: 0.8,
            color: '#ffeaa7'
          });
        }
      }
    }

    // Limit maximum/minimum speed
    const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy) || 0.001;
    if (speed > this.ball.maxSpeed) {
      this.ball.vx = (this.ball.vx / speed) * this.ball.maxSpeed;
      this.ball.vy = (this.ball.vy / speed) * this.ball.maxSpeed;
    } else if (speed < this.ball.baseSpeed && !hit) {
      const ratio = this.ball.baseSpeed / speed;
      this.ball.vx += (ratio - 1) * 0.05 * this.ball.vx;
      this.ball.vy += (ratio - 1) * 0.05 * this.ball.vy;
    } else if (!hit) {
      const ratio = this.ball.baseSpeed / speed;
      this.ball.vx += (ratio - 1) * 0.015 * this.ball.vx;
      this.ball.vy += (ratio - 1) * 0.015 * this.ball.vy;
    }

    // Dynamic color shift depending on speed
    const speedRange = (this.ball.maxSpeed - this.ball.baseSpeed) || 0.001;
    const speedFraction = Math.min(1.0, Math.max(0.0, (speed - this.ball.baseSpeed) / speedRange));
    const redVal = Math.floor(0 + (253 - 0) * speedFraction);
    const greenVal = Math.floor(243 + (121 - 243) * speedFraction);
    const blueVal = Math.floor(255 + (168 - 255) * speedFraction);
    this.ball.color = `rgb(${redVal}, ${greenVal}, ${blueVal})`;

    // Arena Top/Bottom bouncing
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
    } else if (this.ball.y + this.ball.radius > this.height) {
      this.ball.y = this.height - this.ball.radius;
      this.ball.vy *= -1;
    }

    // Goal scoring left/right
    if (this.ball.x < 0) {
      this.rightScore++;
      this.createExplosion(0, this.ball.y, '#fd79a8');
      this.resetBall(1);
      playBleep(880);
      if (this.rightScore >= 5) {
        this.gameState = 'gameover';
      }
    } else if (this.ball.x > this.width) {
      this.leftScore++;
      this.createExplosion(this.width, this.ball.y, '#00f3ff');
      this.resetBall(-1);
      playBleep(880);
      if (this.leftScore >= 5) {
        this.gameState = 'gameover';
      }
    }

    // 5. Draw Render Elements (Trail & Ball)
    this.ctx.globalCompositeOperation = 'lighter';
    
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      if (!p) continue;
      const alpha = (i / this.trail.length) * 0.35;
      const size = this.ball.radius * (0.3 + 0.7 * (i / this.trail.length));
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = this.ball.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.fill();
    }

    // Sparks & Particles
    if (this.particles.length > 200) {
      this.particles = this.particles.slice(-200);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 0.02;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.fill();
    }

    // Glow ball halo
    this.ctx.globalAlpha = 0.35;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 2.2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.ball.color;
    this.ctx.fill();

    // Solid ball center
    this.ctx.globalAlpha = 1.0;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff'; // White hot core
    this.ctx.fill();

    // Ring outline
    this.ctx.strokeStyle = this.ball.color;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}
