import { playSplat, throttledPlay } from './audio.js';

export class PaintSplatter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.drips = []; // Gravity paint drips: {x, y, vy, width, length, maxLength, color, life}
    this.colors = [
      '#ff4757', // neon red
      '#ffa502', // neon orange
      '#2ed573', // neon green
      '#1e90ff', // neon blue
      '#9b5de5', // neon violet
      '#ff007f', // hot pink
      '#00f3ff'  // cyan
    ];
    
    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  init() {
    this.drips = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  destroy() {
    const win = this.canvas.ownerDocument.defaultView || window;
    win.removeEventListener('resize', this.resizeHandler);
  }

  resize() {
    const win = this.canvas.ownerDocument.defaultView || window;
    let tempCanvas = null;
    let tempCtx = null;
    if (this.width > 0 && this.height > 0) {
      tempCanvas = win.document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(this.canvas, 0, 0);
    }

    this.canvas.width = win.innerWidth;
    this.canvas.height = win.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    if (tempCanvas) {
      this.ctx.drawImage(tempCanvas, 0, 0, this.width, this.height);
    }
  }

  // Draw a jagged rounded-perturbation quadratic curve splash
  drawJaggedSplash(x, y, radius, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    
    const numPoints = 10;
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const perturbation = (Math.sin(angle * 4) * 0.15) + (Math.cos(angle * 7) * 0.1) + (Math.random() * 0.15 - 0.075);
      const r = radius * (0.8 + perturbation);
      points.push({
        x: x + Math.cos(angle) * r,
        y: y + Math.sin(angle) * r
      });
    }
    
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < numPoints; i++) {
      const nextIdx = (i + 1) % numPoints;
      const xc = (points[i].x + points[nextIdx].x) / 2;
      const yc = (points[i].y + points[nextIdx].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Draw a highly spiky organic starburst
  drawStarburstSplat(x, y, radius, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    
    const numPoints = 16;
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const isPeak = i % 2 === 0;
      const factor = isPeak ? (1.2 + Math.random() * 0.4) : (0.4 + Math.random() * 0.2);
      const r = radius * factor;
      points.push({
        x: x + Math.cos(angle) * r,
        y: y + Math.sin(angle) * r
      });
    }
    
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < numPoints; i++) {
      const nextIdx = (i + 1) % numPoints;
      const xc = (points[i].x + points[nextIdx].x) / 2;
      const yc = (points[i].y + points[nextIdx].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Draw an elongated teardrop droplet with trailing satellite circles
  drawDropletSplash(x, y, radius, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    
    const dirAngle = Math.random() * Math.PI * 2;
    const dx = Math.cos(dirAngle);
    const dy = Math.sin(dirAngle);
    
    const numPoints = 12;
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const alignment = Math.cos(angle - dirAngle);
      const stretch = alignment > 0 ? (1.0 + alignment * 0.7) : (1.0 + alignment * 0.2);
      const r = radius * stretch * (0.8 + Math.random() * 0.15);
      
      points.push({
        x: x + Math.cos(angle) * r,
        y: y + Math.sin(angle) * r
      });
    }
    
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < numPoints; i++) {
      const nextIdx = (i + 1) % numPoints;
      const xc = (points[i].x + points[nextIdx].x) / 2;
      const yc = (points[i].y + points[nextIdx].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.closePath();
    this.ctx.fill();
    
    // Tiny trailing satellite drops
    const trailingDist = radius * 2.0;
    const satelliteX = x - dx * trailingDist;
    const satelliteY = y - dy * trailingDist;
    const satRadius1 = radius * (0.15 + Math.random() * 0.15);
    
    this.ctx.beginPath();
    this.ctx.arc(satelliteX, satelliteY, satRadius1, 0, Math.PI * 2);
    this.ctx.fill();
    
    const satelliteX2 = x - dx * (trailingDist * 1.5);
    const satelliteY2 = y - dy * (trailingDist * 1.5);
    const satRadius2 = radius * (0.08 + Math.random() * 0.08);
    this.ctx.beginPath();
    this.ctx.arc(satelliteX2, satelliteY2, satRadius2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Draw an organic Bezier-based irregular splatter shape of a specific type
  drawOrganicSplatter(x, y, radius, color, shapeType = null) {
    if (shapeType === null) {
      shapeType = Math.floor(Math.random() * 3);
    }
    if (shapeType === 0) {
      this.drawJaggedSplash(x, y, radius, color);
    } else if (shapeType === 1) {
      this.drawStarburstSplat(x, y, radius, color);
    } else {
      this.drawDropletSplash(x, y, radius, color);
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];

    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;

    // 1. Slow Fade Canvas
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.025)'; // Fades paint faster over time to prevent covering whole screen
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalCompositeOperation = 'source-over';

    // 2. Gravity Paint Drips removed for flat floor simulation

    if (motionPoints.length === 0) return;

    throttledPlay(playSplat, 150);

    // 3. Create Splatters on Active Motion Coordinates
    const maxSamples = 1; // Reduced splat quantity
    const sampleCount = Math.min(maxSamples, motionPoints.length);
    for (let i = 0; i < sampleCount; i++) {
      const m = motionPoints[Math.floor(Math.random() * motionPoints.length)];
      const x = m.x * this.width;
      const y = m.y * this.height;
      
      const mass = m.mass || 30;
      // Lower splatter max velocity equivalent: smaller, less explosive splats
      const radius = Math.min(16, Math.random() * (mass / 4) + 4);
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];

      // Draw Main Splat Blob
      this.drawOrganicSplatter(x, y, radius, color);

      // Spawn Smaller Satellite Drops (0-1 drop to avoid clutter)
      const dropCount = Math.floor(Math.random() * 2);
      for (let j = 0; j < dropCount; j++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = radius * (1.1 + Math.random() * 1.2);
        const dropX = x + Math.cos(angle) * dist;
        const dropY = y + Math.sin(angle) * dist;
        const dropRadius = Math.random() * (radius / 3) + 1.5;

        this.drawOrganicSplatter(dropX, dropY, dropRadius, color);
      }
      
      // Downward gravity drips completely removed
    }
  }
}
