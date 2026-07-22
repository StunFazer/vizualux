import { playSplash } from './audio.js';

export const SAND_PRESETS = {
  cyberpunk: {
    colors: ['#ff007f', '#00f3ff', '#fffb00'],
    bg: '#04020a'
  },
  volcanic: {
    colors: ['#ff3300', '#ff9900', '#595959'],
    bg: '#0a0302'
  },
  bioluminescent: {
    colors: ['#00f3ff', '#00ffaa', '#0066ff'],
    bg: '#02050c'
  },
  sandbox: {
    colors: ['#e1b382', '#c89666', '#8d5524', '#2d1e0f'], // earthy tan and dark browns
    bg: '#120c06'
  }
};

function hexTo32(hex) {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function hexToRgb(hex) {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export class LiquidSand {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = canvas.width;
    this.height = canvas.height;

    // Simulation grid dimensions
    this.cols = 200;
    this.rows = 150;
    this.grid = new Array(this.cols * this.rows).fill(0); // 0 = empty, 1 = sand, 2 = obstacle, 3 = dirt
    this.grainColors = new Array(this.cols * this.rows).fill(null);
    
    this.presetName = 'bioluminescent';
    this.colors = SAND_PRESETS[this.presetName].colors;
    this.bg = SAND_PRESETS[this.presetName].bg;

    // Offscreen rendering components
    const win = this.canvas.ownerDocument.defaultView || window;
    this.offscreenCanvas = win.document.createElement('canvas');
    this.offscreenCanvas.width = this.cols;
    this.offscreenCanvas.height = this.rows;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.offscreenImageData = this.offscreenCtx.createImageData(this.cols, this.rows);
    this.colorMap32 = new Map();
    this.updateColorsCache();
    
    // Sliders
    this.flowRate = 4; // grains spawned per frame
    this.gravity = 1;  // vertical physics steps per frame

    this.resizeHandler = this.resize.bind(this);
    win.addEventListener('resize', this.resizeHandler);
    this.resize();
  }

  updateColorsCache() {
    this.bg32 = hexTo32(this.bg);
    const rgb = hexToRgb(this.bg);
    this.bgR = rgb.r;
    this.bgG = rgb.g;
    this.bgB = rgb.b;

    this.colorMap32.clear();
    // Cache the preset colors mapped to 32-bit values
    this.colors.forEach(col => {
      this.colorMap32.set(col, hexTo32(col));
    });
    this.defaultGrainColor32 = this.colors.length > 0 ? (this.colorMap32.get(this.colors[0]) || 0xffffffff) : 0xffffffff;
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

  init() {
    this.grid.fill(0);
    this.grainColors.fill(null);
  }

  setPreset(presetName) {
    if (SAND_PRESETS[presetName]) {
      this.presetName = presetName;
      this.colors = SAND_PRESETS[presetName].colors;
      this.bg = SAND_PRESETS[presetName].bg;
      this.updateColorsCache();
    }
  }

  setFlowRate(val) {
    this.flowRate = Math.max(1, Math.min(15, val));
  }

  setGravity(val) {
    this.gravity = Math.max(1, Math.min(5, val));
  }

  getIndex(x, y) {
    return y * this.cols + x;
  }

  update(motionData) {
    const { centroids, points: motionPoints, timeScale = 1.0 } = motionData;
    const activeMotion = centroids && centroids.length > 0 ? centroids : motionPoints;

    // 1. Clear obstacles (type 2) from the grid
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === 2) {
        this.grid[i] = 0;
      }
    }

    // 2. Map motion sources, push particles away from moving centroids
    const obstacleRadius = 10; // cell radius in grid space
    for (const m of activeMotion) {
      const mx = Math.floor(m.x * this.cols);
      const my = Math.floor(m.y * this.rows);
      
      // Look for sand/dirt within the centroid area and push them radially outward
      for (let dy = -obstacleRadius; dy <= obstacleRadius; dy++) {
        for (let dx = -obstacleRadius; dx <= obstacleRadius; dx++) {
          if (dx * dx + dy * dy <= obstacleRadius * obstacleRadius) {
            const gx = mx + dx;
            const gy = my + dy;
            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
              const idx = this.getIndex(gx, gy);
              const type = this.grid[idx];
              if (type === 1 || type === 3) {
                // Determine radial push vector
                const vx = gx - mx;
                const vy = gy - my;
                const dist = Math.hypot(vx, vy);
                
                const dirX = dist > 0 ? vx / dist : (Math.random() - 0.5);
                const dirY = dist > 0 ? vy / dist : (Math.random() - 0.5);
                
                let pushed = false;
                // Search along the ray just outside the obstacle circle boundary to place the particle
                for (let step = obstacleRadius + 1; step <= obstacleRadius + 6; step++) {
                  const tx = Math.floor(mx + dirX * step);
                  const ty = Math.floor(my + dirY * step);
                  if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) {
                    const tIdx = this.getIndex(tx, ty);
                    if (this.grid[tIdx] === 0) {
                      this.grid[tIdx] = type;
                      this.grainColors[tIdx] = this.grainColors[idx];
                      pushed = true;
                      break;
                    }
                  }
                }
                
                // Clear the original position
                this.grid[idx] = 0;
                this.grainColors[idx] = null;
              }
            }
          }
        }
      }
      
      // Mark the obstacle circle coordinates as occupied (type 2) so sand falls around it
      for (let dy = -obstacleRadius; dy <= obstacleRadius; dy++) {
        for (let dx = -obstacleRadius; dx <= obstacleRadius; dx++) {
          if (dx * dx + dy * dy <= obstacleRadius * obstacleRadius) {
            const gx = mx + dx;
            const gy = my + dy;
            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
              const idx = this.getIndex(gx, gy);
              this.grid[idx] = 2;
              this.grainColors[idx] = null;
            }
          }
        }
      }
    }

    // 3. Spawn new sand grains at the top depending on flowRate
    const spawnMargin = 20;
    const rate = Math.round(this.flowRate * timeScale);
    for (let r = 0; r < rate; r++) {
      const rx = Math.floor(Math.random() * (this.cols - spawnMargin * 2)) + spawnMargin;
      const idx = this.getIndex(rx, 0);
      if (this.grid[idx] === 0) {
        // In sandbox preset, spawn 70% light sand and 30% heavier dirt. For other presets, spawn standard sand.
        const spawnDirt = this.presetName === 'sandbox' && Math.random() < 0.3;
        this.grid[idx] = spawnDirt ? 3 : 1;
        
        if (this.presetName === 'sandbox') {
          if (spawnDirt) {
            // Heavier dirt takes the darker brown colors (index 2 & 3)
            this.grainColors[idx] = this.colors[2 + Math.floor(Math.random() * 2)];
          } else {
            // Lighter sand takes the lighter tan colors (index 0 & 1)
            this.grainColors[idx] = this.colors[Math.floor(Math.random() * 2)];
          }
        } else {
          this.grainColors[idx] = this.colors[Math.floor(Math.random() * this.colors.length)];
        }
      }
    }

    // 4. Update sand/dirt physics (from bottom to top)
    const gravitySteps = Math.round(this.gravity * timeScale);
    for (let step = 0; step < gravitySteps; step++) {
      for (let y = this.rows - 2; y >= 0; y--) {
        const leftToRight = Math.random() < 0.5;
        const startX = leftToRight ? 0 : this.cols - 1;
        const endX = leftToRight ? this.cols : -1;
        const dirX = leftToRight ? 1 : -1;

        for (let x = startX; x !== endX; x += dirX) {
          const currentIdx = this.getIndex(x, y);
          const type = this.grid[currentIdx];
          
          if (type === 1 || type === 3) {
            // Check directly below
            const belowIdx = this.getIndex(x, y + 1);
            if (this.grid[belowIdx] === 0) {
              this.grid[belowIdx] = type;
              this.grainColors[belowIdx] = this.grainColors[currentIdx];
              this.grid[currentIdx] = 0;
              this.grainColors[currentIdx] = null;
            } else {
              // Diagonal checks
              // Heavier dirt particles (type 3) have higher friction/inertia and resist sliding down diagonals
              if (type === 3 && Math.random() > 0.12) {
                continue; 
              }
              
              const dlIdx = (x > 0) ? this.getIndex(x - 1, y + 1) : -1;
              const drIdx = (x < this.cols - 1) ? this.getIndex(x + 1, y + 1) : -1;
              
              const leftFree = dlIdx !== -1 && this.grid[dlIdx] === 0;
              const rightFree = drIdx !== -1 && this.grid[drIdx] === 0;

              if (leftFree && rightFree) {
                const chooseLeft = Math.random() < 0.5;
                const targetIdx = chooseLeft ? dlIdx : drIdx;
                this.grid[targetIdx] = type;
                this.grainColors[targetIdx] = this.grainColors[currentIdx];
                this.grid[currentIdx] = 0;
                this.grainColors[currentIdx] = null;
              } else if (leftFree) {
                this.grid[dlIdx] = type;
                this.grainColors[dlIdx] = this.grainColors[currentIdx];
                this.grid[currentIdx] = 0;
                this.grainColors[currentIdx] = null;
              } else if (rightFree) {
                this.grid[drIdx] = type;
                this.grainColors[drIdx] = this.grainColors[currentIdx];
                this.grid[currentIdx] = 0;
                this.grainColors[currentIdx] = null;
              }
            }
          }
        }
      }
    }

    // 5. Draw simulation grid on canvas
    this.draw();
  }

  draw() {
    const data32 = new Uint32Array(this.offscreenImageData.data.buffer);
    const bg32 = this.bg32;
    const len = this.grid.length;

    // Fill background color
    data32.fill(bg32);

    for (let idx = 0; idx < len; idx++) {
      const state = this.grid[idx];
      if (state === 1 || state === 3) {
        data32[idx] = this.colorMap32.get(this.grainColors[idx]) || this.defaultGrainColor32;
      } else if (state === 2) {
        // Draw subtle outline glow of active obstacle boundaries
        const r = Math.min(255, (this.bgR * 0.96 + 10) | 0);
        const g = Math.min(255, (this.bgG * 0.96 + 10) | 0);
        const b = Math.min(255, (this.bgB * 0.96 + 10) | 0);
        data32[idx] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }

    this.offscreenCtx.putImageData(this.offscreenImageData, 0, 0);

    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.imageSmoothingEnabled = false; // keeps the sand grain pixels sharp and crisp
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.width, this.height);
  }
}
