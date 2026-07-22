export class ScatterEffect {
  constructor(canvas, defaultImageSrc = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.objects = [];
    this.numObjects = 500;
    this.baseScale = 0.5;
    this.scatterForce = 15;
    this.driftSpeed = 0;
    
    this.image = new Image();
    if (defaultImageSrc) {
      this.image.src = defaultImageSrc;
    }
    
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

  setImage(src) {
    this.image.src = src;
  }

  setQuantity(qty) {
    this.numObjects = qty;
    while (this.objects.length < this.numObjects) {
      const startX = Math.random() * this.width;
      const startY = Math.random() * this.height;
      this.objects.push({
        x: startX,
        y: startY,
        homeX: startX,
        homeY: startY,
        vx: 0,
        vy: 0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: 0,
        scale: Math.random() * (this.baseScale * 0.8) + (this.baseScale * 0.6)
      });
    }
    if (this.objects.length > this.numObjects) {
      this.objects.length = this.numObjects;
    }
  }

  setSize(scale) {
    this.baseScale = scale;
    this.objects.forEach(obj => {
      obj.scale = Math.random() * (scale * 0.8) + (scale * 0.6);
    });
  }

  setMovement(val) {
    this.scatterForce = val * 3;
    this.driftSpeed = 0;
  }

  init() {
    this.objects = [];
    for (let i = 0; i < this.numObjects; i++) {
      const startX = Math.random() * this.width;
      const startY = Math.random() * this.height;
      this.objects.push({
        x: startX,
        y: startY,
        homeX: startX,
        homeY: startY,
        vx: 0,
        vy: 0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: 0,
        scale: Math.random() * (this.baseScale * 0.8) + (this.baseScale * 0.6)
      });
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];
    
    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;
    
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Check if image is loaded
    if (!this.image.complete || this.image.naturalWidth === 0) return;

    // Use a fixed aspect ratio width for drawing
    const imgW = 100;
    const imgH = (this.image.naturalHeight / this.image.naturalWidth) * imgW;

    // Sample active motion points once per frame for all objects
    const activePoints = [];
    if (motionPoints.length > 0) {
      const sampleCount = Math.min(motionPoints.length, 5);
      for (let i = 0; i < sampleCount; i++) {
        const idx = Math.floor((i / sampleCount) * motionPoints.length);
        activePoints.push(motionPoints[idx]);
      }
    }

    let outOfBoundsCount = 0;

    for (let obj of this.objects) {
      let isDisturbed = false;

      // Repel from sampled motion points
      if (activePoints.length > 0) {
        for (const m of activePoints) {
          const mx = m.x * this.width;
          const my = m.y * this.height;
          const dx = obj.x - mx;
          const dy = obj.y - my;
          const distSq = dx * dx + dy * dy;
          const hitRadius = 150;
          
          if (distSq > 0 && distSq < hitRadius * hitRadius) {
            isDisturbed = true;
            const dist = Math.sqrt(distSq);
            const force = (hitRadius - dist) / hitRadius;
            
            obj.vx += (dx / dist) * force * this.scatterForce;
            obj.vy += (dy / dist) * force * this.scatterForce;
            obj.rotSpeed += (Math.random() - 0.5) * force * 0.8;
          }
        }
      }

      // Spring back to home position if not actively disturbed
      if (!isDisturbed) {
        const dxHome = obj.homeX - obj.x;
        const dyHome = obj.homeY - obj.y;
        obj.vx += dxHome * 0.01;
        obj.vy += dyHome * 0.01;
      }

      // Physics
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.rotation += obj.rotSpeed;

      // Friction
      obj.vx *= 0.92;
      obj.vy *= 0.92;
      obj.rotSpeed *= 0.95;

      // Render
      this.ctx.save();
      this.ctx.translate(obj.x, obj.y);
      this.ctx.rotate(obj.rotation);
      this.ctx.scale(obj.scale, obj.scale);
      
      this.ctx.drawImage(this.image, -imgW / 2, -imgH / 2, imgW, imgH);
      this.ctx.restore();
    }
  }
}
