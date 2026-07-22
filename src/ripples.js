import { playSplash } from './audio.js';

export class LiquidRipples {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // We run the simulation at a lower resolution for performance
    this.simScale = 4; 
    this.cols = Math.floor(this.width / this.simScale);
    this.rows = Math.floor(this.height / this.simScale);
    
    this.buffer1 = new Float32Array(this.cols * this.rows);
    this.buffer2 = new Float32Array(this.cols * this.rows);
    this.damping = 0.98;
    this.rippleSize = 3;
    
    // For rendering the water texture
    this.imageData = this.ctx.createImageData(this.cols, this.rows);
    
    this.resizeHandler = this.resize.bind(this);
    const win = this.canvas.ownerDocument.defaultView || window;
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  init() {
    this.buffer1.fill(0);
    this.buffer2.fill(0);
    this.ctx.clearRect(0, 0, this.width, this.height);
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
    
    this.cols = Math.floor(this.width / this.simScale);
    this.rows = Math.floor(this.height / this.simScale);
    this.buffer1 = new Float32Array(this.cols * this.rows);
    this.buffer2 = new Float32Array(this.cols * this.rows);
    this.imageData = this.ctx.createImageData(this.cols, this.rows);

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = win.document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }
    this.offscreenCanvas.width = this.cols;
    this.offscreenCanvas.height = this.rows;
  }

  update(motionData) {
    const { centroids, points, timeScale = 1.0 } = motionData;
    const motionPoints = centroids || points || [];

    // Reset globalAlpha to prevent leaks from other effects
    this.ctx.globalAlpha = 1.0;
    const cols = this.cols;
    const rows = this.rows;
    const damping = Math.pow(this.damping, timeScale);
    const b1 = this.buffer1;
    const b2 = this.buffer2;

    // Process motion as stone drops
    if (motionPoints.length > 0) {
      let stoneDropped = false;
      const sampleCount = Math.min(10, motionPoints.length);
      for (let i = 0; i < sampleCount; i++) {
        // Uniformly spaced sampling
        const m = motionPoints[Math.floor((i / sampleCount) * motionPoints.length)];
        const cx = Math.floor(m.x * cols);
        const cy = Math.floor(m.y * rows);
        
        // Sparsely drop stones so the wave equation has time to ripple
        if (Math.random() < 0.2) {
          stoneDropped = true;
          const radius = Math.round(this.rippleSize);
          for (let y = -radius; y <= radius; y++) {
            const targetY = cy + y;
            if (targetY <= 0 || targetY >= rows - 1) continue;
            const rowOffset = targetY * cols;
            for (let x = -radius; x <= radius; x++) {
              const targetX = cx + x;
              if (targetX > 0 && targetX < cols - 1) {
                b1[targetX + rowOffset] = 255; // Drop stone
              }
            }
          }
        }
      }
      if (stoneDropped) {
        playSplash();
      }
    }

    // Process wave equation with cached index math
    for (let j = 1; j < rows - 1; j++) {
      const rowOffset = j * cols;
      for (let i = 1; i < cols - 1; i++) {
        const index = i + rowOffset;
        const val = (
          b1[index - 1] +
          b1[index + 1] +
          b1[index - cols] +
          b1[index + cols]
        ) / 2 - b2[index];
        
        b2[index] = val * damping;
      }
    }

    // Render buffer to imageData using a 32-bit Uint32Array view for high performance
    const data = this.imageData.data;
    const data32 = new Uint32Array(data.buffer);
    const len = b2.length;
    for (let i = 0; i < len; i++) {
      const val = b2[i];
      
      // Dynamic highlights: make positive wave peaks glow aqua/turquoise and troughs run deep blue
      const highlight = val > 0 ? val * 1.85 : val;
      const r = (9 + highlight * 0.4) | 0;
      const g = (132 + highlight * 0.95) | 0;
      const b = (227 + highlight * 0.7) | 0;
      
      const rClamp = r < 0 ? 0 : (r > 255 ? 255 : r);
      const gClamp = g < 0 ? 0 : (g > 255 ? 255 : g);
      const bClamp = b < 0 ? 0 : (b > 255 ? 255 : b);
      
      // Write a single 32-bit integer per pixel (ABGR layout in little-endian)
      data32[i] = (255 << 24) | (bClamp << 16) | (gClamp << 8) | rClamp;
    }

    // We can't directly drawImage an ImageData scaled up using the context transform easily,
    // so we use an offscreen canvas to scale it up smoothly.
    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    // Disable image smoothing for a pixelated look, or enable for smooth water
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.width, this.height);

    // Swap buffers
    this.buffer1 = b2;
    this.buffer2 = b1;
  }
}
