// Bioluminescent Ocean Storm effect for VizuaLux
export const STORM_PRESETS = {
  bioluminescent: {
    bg: '#02030a',
    lightning: ['#00f3ff', '#00a8ff', '#0984e3'],
    rain: ['rgba(0, 243, 255, 0.4)', 'rgba(0, 168, 255, 0.25)'],
    algae: ['#00f3ff', '#74b9ff', '#00d2d3']
  },
  cyberpunk: {
    bg: '#08010f',
    lightning: ['#d63031', '#e84393', '#fd79a8'],
    rain: ['rgba(232, 67, 147, 0.4)', 'rgba(253, 121, 168, 0.2)'],
    algae: ['#e84393', '#fd79a8', '#ff7675']
  },
  volcanic: {
    bg: '#0a0202',
    lightning: ['#e17055', '#d63031', '#ff7675'],
    rain: ['rgba(225, 112, 85, 0.4)', 'rgba(214, 48, 49, 0.2)'],
    algae: ['#e17055', '#ff7675', '#d63031']
  }
};

export class BioluminescentStorm {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    // Effect settings
    this.preset = 'bioluminescent';
    this.theme = STORM_PRESETS[this.preset];
    
    this.rainDensity = 150; // max drops
    this.lightningFrequency = 35; // chance scale
    this.lightningIntensity = 70; // brightness / width scale
    
    // Arrays for storm physics
    this.rainDrops = [];
    this.ripples = [];
    this.algae = [];
    this.lightningStrikes = [];

    this.windX = -0.5;
    
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

  setPreset(name) {
    if (STORM_PRESETS[name]) {
      this.preset = name;
      this.theme = STORM_PRESETS[name];
    }
  }

  setRainDensity(val) {
    this.rainDensity = parseInt(val) || 150;
  }

  setLightningFrequency(val) {
    this.lightningFrequency = parseInt(val) || 35;
  }

  setLightningIntensity(val) {
    this.lightningIntensity = parseInt(val) || 70;
  }

  init() {
    this.rainDrops = [];
    this.ripples = [];
    this.algae = [];
    this.lightningStrikes = [];

    // Initialize floating algae particles
    const algaeCount = 60;
    for (let i = 0; i < algaeCount; i++) {
      this.algae.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        targetX: Math.random() * this.width,
        targetY: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1.2,
        color: this.theme.algae[Math.floor(Math.random() * this.theme.algae.length)],
        alpha: Math.random() * 0.5 + 0.3
      });
    }
  }

  // Generate fractal lightning path between start and end
  generateLightningPath(startX, startY, endX, endY, displacement) {
    const points = [{ x: startX, y: startY }, { x: endX, y: endY }];
    
    let currentDisplacement = displacement;
    const minDisplacement = 4;
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      for (let j = points.length - 1; j > 0; j--) {
        const p1 = points[j - 1];
        const p2 = points[j];
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Displace perpendicular to the path
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        
        const offset = (Math.random() - 0.5) * currentDisplacement;
        const newPoint = {
          x: midX + nx * offset,
          y: midY + ny * offset
        };
        
        points.splice(j, 0, newPoint);
      }
      currentDisplacement = Math.max(minDisplacement, currentDisplacement * 0.5);
    }
    
    return points;
  }

  update(motionData) {
    const { centroids = [], points: motionPoints = [], timeScale = 1.0 } = motionData;

    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';

    // 1. Draw Background Dark Layer
    this.ctx.fillStyle = this.theme.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. Spawn and Update Rain Drops
    while (this.rainDrops.length < this.rainDensity) {
      let spawnX = Math.random() * this.width;
      if (centroids && centroids.length > 0 && Math.random() < 0.7) {
        const c = centroids[Math.floor(Math.random() * centroids.length)];
        spawnX = c.x * this.width + (Math.random() - 0.5) * 250;
      }
      this.rainDrops.push({
        x: spawnX,
        y: Math.random() * -100 - 10,
        speed: Math.random() * 18 + 25, // more aggressive speed
        length: Math.random() * 35 + 40, // longer drops
        width: Math.random() * 2.0 + 1.2, // slightly thicker
        color: this.theme.rain[Math.floor(Math.random() * this.theme.rain.length)]
      });
    }

    this.rainDrops.forEach((drop, idx) => {
      drop.y += drop.speed * timeScale;
      drop.x += this.windX * timeScale;

      // Draw drop
      this.ctx.strokeStyle = drop.color;
      this.ctx.lineWidth = drop.width;
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x + this.windX * 1.2, drop.y + drop.length);
      this.ctx.stroke();

      // Check collision with bottom of screen or hit virtual floor plane (e.g. 92% down)
      const floorY = this.height * 0.92;
      if (drop.y >= floorY) {
        // Spawn ripple at collision coordinate
        if (this.ripples.length < 100) {
          this.ripples.push({
            x: drop.x,
            y: floorY + (Math.random() - 0.5) * 10,
            radius: 1,
            maxRadius: Math.random() * 25 + 15,
            alpha: 0.6,
            thickness: Math.random() * 0.8 + 0.6
          });
        }
        
        // Reset drop
        let spawnX = Math.random() * this.width;
        if (centroids && centroids.length > 0 && Math.random() < 0.7) {
          const c = centroids[Math.floor(Math.random() * centroids.length)];
          spawnX = c.x * this.width + (Math.random() - 0.5) * 250;
        }
        this.rainDrops[idx] = {
          x: spawnX,
          y: Math.random() * -100 - 10,
          speed: Math.random() * 18 + 25,
          length: Math.random() * 35 + 40,
          width: Math.random() * 2.0 + 1.2,
          color: this.theme.rain[Math.floor(Math.random() * this.theme.rain.length)]
        };
      }
    });

    // 3. Update and Draw Ripples
    this.ripples.forEach((ripple, idx) => {
      ripple.radius += 1.2 * timeScale;
      ripple.alpha -= 0.018 * timeScale;

      if (ripple.alpha <= 0 || ripple.radius >= ripple.maxRadius) {
        this.ripples.splice(idx, 1);
        return;
      }

      this.ctx.strokeStyle = `rgba(0, 243, 255, ${ripple.alpha})`;
      if (this.preset === 'cyberpunk') this.ctx.strokeStyle = `rgba(232, 67, 147, ${ripple.alpha})`;
      if (this.preset === 'volcanic') this.ctx.strokeStyle = `rgba(225, 112, 85, ${ripple.alpha})`;

      this.ctx.lineWidth = ripple.thickness;
      this.ctx.beginPath();
      this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    });

    // 4. Update and Draw Drifting Bioluminescent Algae
    this.algae.forEach(p => {
      // Repelled by motion points
      if (motionPoints.length > 0) {
        for (const mp of motionPoints) {
          const mx = mp.x * this.width;
          const my = mp.y * this.height;
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 100) {
            const force = (100 - dist) * 0.08;
            p.vx += (dx / dist) * force * 0.08;
            p.vy += (dy / dist) * force * 0.08;
          }
        }
      }

      // Add gentle drift velocity
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;

      // Friction
      p.vx *= 0.95;
      p.vy *= 0.95;

      // Boundary wraps
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Draw particle
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;

    // 5. Proc Neon Lightning Striking and Chaining to active user centroids
    const activeCentroids = centroids || [];
    
    // Dynamic trigger probability scale
    const prob = (this.lightningFrequency / 100) * 0.04;
    
    if (activeCentroids.length > 0 && Math.random() < prob) {
      // Start from the top edge
      let startX = Math.random() * this.width;
      let startY = 0;

      // Map primary target to first centroid
      const primaryCentroid = activeCentroids[0];
      const targetX = primaryCentroid.x * this.width;
      const targetY = primaryCentroid.y * this.height;

      const mainBranch = this.generateLightningPath(startX, startY, targetX, targetY, 60);
      const branches = [mainBranch];

      // Chain to secondary centroids if multiple exist
      for (let k = 1; k < activeCentroids.length; k++) {
        const c = activeCentroids[k];
        const cx = c.x * this.width;
        const cy = c.y * this.height;
        
        // Branch from previous target or main branch node
        const originNode = mainBranch[Math.floor(mainBranch.length * 0.6)];
        const chainBranch = this.generateLightningPath(originNode.x, originNode.y, cx, cy, 40);
        branches.push(chainBranch);
      }

      this.lightningStrikes.push({
        branches,
        alpha: 1.0,
        width: Math.random() * 3 + 2,
        color: this.theme.lightning[Math.floor(Math.random() * this.theme.lightning.length)]
      });

      // Spawn localized visual footprints/ripples at centroids when struck
      activeCentroids.forEach(c => {
        const cx = c.x * this.width;
        const cy = c.y * this.height;
        for (let r = 0; r < 3; r++) {
          this.ripples.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: cy + (Math.random() - 0.5) * 20,
            radius: 1,
            maxRadius: Math.random() * 45 + 30,
            alpha: 0.9,
            thickness: Math.random() * 2.5 + 1.5
          });
        }
      });
    }

    // 6. Draw active Lightning Strikes
    this.lightningStrikes.forEach((strike, sIdx) => {
      strike.alpha -= 0.12 * timeScale;
      if (strike.alpha <= 0) {
        this.lightningStrikes.splice(sIdx, 1);
        return;
      }

      this.ctx.save();
      this.ctx.globalAlpha = strike.alpha;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = strike.color;

      strike.branches.forEach(branch => {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = strike.width * (this.lightningIntensity / 70);
        
        this.ctx.beginPath();
        this.ctx.moveTo(branch[0].x, branch[0].y);
        for (let i = 1; i < branch.length; i++) {
          this.ctx.lineTo(branch[i].x, branch[i].y);
        }
        this.ctx.stroke();

        // Core thin line for neon glow look
        this.ctx.strokeStyle = strike.color;
        this.ctx.lineWidth = Math.max(1, (strike.width * 0.4) * (this.lightningIntensity / 70));
        this.ctx.beginPath();
        this.ctx.moveTo(branch[0].x, branch[0].y);
        for (let i = 1; i < branch.length; i++) {
          this.ctx.lineTo(branch[i].x, branch[i].y);
        }
        this.ctx.stroke();
      });
      this.ctx.restore();
    });
  }
}
