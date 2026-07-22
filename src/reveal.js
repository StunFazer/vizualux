export class MotionReveal {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.topImage = null;
    this.bgImage = null;
    this.topColor = '#121218';
    this.preset = 'default';

    this.initBrush();
    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
    this.init();
  }

  setPreset(name) {
    this.preset = name;
    this.initBrush();
    this.init();
  }

  initBrush() {
    this.brushCanvas = document.createElement('canvas');
    this.brushSize = 128;
    this.brushCanvas.width = this.brushSize;
    this.brushCanvas.height = this.brushSize;
    const brushCtx = this.brushCanvas.getContext('2d');
    const half = this.brushSize / 2;
    
    if (this.preset === 'frost') {
      brushCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
      brushCtx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const radius = half * (0.6 + Math.random() * 0.4);
        if (i === 0) brushCtx.moveTo(half + Math.cos(angle) * radius, half + Math.sin(angle) * radius);
        else brushCtx.lineTo(half + Math.cos(angle) * radius, half + Math.sin(angle) * radius);
      }
      brushCtx.closePath();
      brushCtx.fill();
    } else {
      const gradient = brushCtx.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      brushCtx.fillStyle = gradient;
      brushCtx.beginPath();
      brushCtx.arc(half, half, half, 0, Math.PI * 2);
      brushCtx.fill();
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
    // Redraw the top layer when resized
    if (this.topImage || this.bgImage) {
      this.init();
    }
  }

  setImages(topImage, bgImage) {
    this.topImage = topImage;
    this.bgImage = bgImage;
    this.init();
  }

  init() {
    // Fill initially with top color or image
    this.ctx.globalCompositeOperation = 'source-over';
    if (this.topImage) {
      this.ctx.drawImage(this.topImage, 0, 0, this.width, this.height);
    } else {
      this.ctx.fillStyle = this.topColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  update(motionData) {
    const motionPoints = motionData.centroids || motionData.points || [];
    
    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;
    
    // First, slowly fade the mask back in
    this.ctx.globalCompositeOperation = 'source-over';
    if (this.topImage) {
      this.ctx.globalAlpha = 0.05;
      this.ctx.drawImage(this.topImage, 0, 0, this.width, this.height);
      this.ctx.globalAlpha = 1.0;
    } else {
      this.ctx.fillStyle = 'rgba(18, 18, 24, 0.05)'; // slight fade back
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Erase where there is motion
    this.ctx.globalCompositeOperation = 'destination-out';
    
    // Sample motion points to prevent rendering overhead
    const maxPoints = 45;
    const step = Math.max(1, Math.floor(motionPoints.length / maxPoints));
    for (let i = 0; i < motionPoints.length; i += step) {
      const p = motionPoints[i];
      if (!p) continue;
      const mx = p.x * this.width;
      const my = p.y * this.height;
      const mass = p.mass || 30;
      
      const radius = 80 + mass * 0.5;
      const size = radius * 2;
      // Draw pre-rendered gradient brush
      this.ctx.drawImage(this.brushCanvas, mx - radius, my - radius, size, size);
    }
    
    // Reset composite operation
    this.ctx.globalCompositeOperation = 'source-over';

    // Draw some underlying text or image for the reveal effect
    // We do this by setting composite operation to destination-over
    this.ctx.globalCompositeOperation = 'destination-over';
    
    if (this.bgImage) {
      this.ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
    } else {
      if (this.preset === 'frost') {
        const bgGradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        bgGradient.addColorStop(0, '#e0f7fa');
        bgGradient.addColorStop(0.5, '#b2ebf2');
        bgGradient.addColorStop(1, '#ffffff');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 50; i++) {
          this.ctx.fillRect(Math.random() * this.width, Math.random() * this.height, Math.random() * 100, Math.random() * 5);
        }
        
        this.ctx.fillStyle = '#006064';
        this.ctx.font = 'bold 8vw Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('FROST REVEAL', this.width / 2, this.height / 2);
      } else {
        // Draw a vibrant background to be revealed
        const bgGradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        bgGradient.addColorStop(0, '#ff9a9e');
        bgGradient.addColorStop(0.5, '#fecfef');
        bgGradient.addColorStop(1, '#a1c4fd');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw some text
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 8vw Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('VIZUALUX REVEAL', this.width / 2, this.height / 2);
      }
    }

    this.ctx.globalCompositeOperation = 'source-over';
  }
}
