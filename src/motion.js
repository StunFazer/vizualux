export class MotionDetector {
  constructor(videoElement, debugCanvas, threshold = 30) {
    this.video = videoElement;
    this.debugCanvas = debugCanvas;
    this.debugCtx = debugCanvas ? debugCanvas.getContext('2d') : null;
    
    // Create an offscreen canvas for processing
    this.processCanvas = document.createElement('canvas');
    this.processCtx = this.processCanvas.getContext('2d', { willReadFrequently: true });
    
    this.threshold = threshold;
    this.userSensitivityThreshold = threshold;
    this.runningNoise = 10.0;
    this.framesWithNoMotion = 0;
    
    this.lastImageData = null;
    this.motionPoints = [];
    this.debugPoints = [];
    
    // A lower resolution is sufficient for motion detection and is much faster
    this.processWidth = 64;
    this.processHeight = 48;
    this.processCanvas.width = this.processWidth;
    this.processCanvas.height = this.processHeight;
  }

  setThreshold(val) {
    this.userSensitivityThreshold = val;
  }

  captureBackground() {
    if (this.video && this.video.readyState >= 2) {
      this.processCtx.drawImage(this.video, 0, 0, this.processWidth, this.processHeight);
      this.referenceImageData = this.processCtx.getImageData(0, 0, this.processWidth, this.processHeight);
    }
  }

  update(homography = null, calibData = null) {
    if (!this.video || this.video.readyState < 2 || this.video.videoWidth === 0) {
      return { points: [], centroids: [], dir: { dx: 0, dy: 0 } };
    }

    // Dynamic scale based on homography calibrated area
    let targetWidth = 64; // Default if no calibData
    if (calibData && calibData.length === 4) {
      let area = 0;
      for (let i = 0; i < 4; i++) {
        let j = (i + 1) % 4;
        area += calibData[i].x * calibData[j].y;
        area -= calibData[j].x * calibData[i].y;
      }
      const fractionArea = Math.max(0.01, Math.abs(area) / 2.0 / 10000.0);
      
      // If fractionArea is 1.0 (full screen), use low res 32
      // If fractionArea is small (e.g. 0.1), use high res up to 160
      targetWidth = Math.max(32, Math.min(160, Math.round(32 + (1.0 - fractionArea) * 128)));
    }

    if (this.processWidth !== targetWidth) {
      this.processWidth = targetWidth;
    }

    // Dynamic adjustment of processing dimensions to match video aspect ratio
    const videoAspect = this.video.videoWidth / this.video.videoHeight;
    const targetHeight = Math.round(this.processWidth / videoAspect) || Math.round(this.processWidth * 0.75);
    if (this.processHeight !== targetHeight || this.processCanvas.width !== this.processWidth) {
      this.processHeight = targetHeight;
      this.processCanvas.width = this.processWidth;
      this.processCanvas.height = this.processHeight;
      this.lastImageData = null;
      this.referenceImageData = null;
    }

    // Draw current video frame to processing canvas
    this.processCtx.drawImage(this.video, 0, 0, this.processWidth, this.processHeight);
    
    const currentImageData = this.processCtx.getImageData(0, 0, this.processWidth, this.processHeight);
    this.motionPoints.length = 0;
    this.debugPoints.length = 0; // Store pre-transformed points for accurate debug drawing
    
    let sumX = 0, sumY = 0;

    // Use reference image if captured, otherwise use last frame
    const compareData = this.referenceImageData ? this.referenceImageData.data : (this.lastImageData ? this.lastImageData.data : null);

    if (compareData) {
      const learnRate = 0.001; // 0.1% learning rate per frame
      const invLearn = 1 - learnRate;
      const w = this.processWidth;
      const h = this.processHeight;
      let i = 0;
      let noiseSum = 0;
      let noiseCount = 0;

      const denominatorY = (h - 1) || 1;
      const denominatorX = (w - 1) || 1;

      for (let y = 0; y < h; y++) {
        const ny = y / denominatorY;
        for (let x = 0; x < w; x++) {
          const nx = x / denominatorX;

          const rDiff = Math.abs(currentImageData.data[i] - compareData[i]);
          const gDiff = Math.abs(currentImageData.data[i + 1] - compareData[i + 1]);
          const bDiff = Math.abs(currentImageData.data[i + 2] - compareData[i + 2]);
          
          const diff = (rDiff + gDiff + bDiff) / 3;

          // If using a static background reference, slowly blend the current frame into it
          // ONLY if there is no significant motion at this pixel
          if (this.referenceImageData && diff <= this.threshold) {
            compareData[i] = compareData[i] * invLearn + currentImageData.data[i] * learnRate;
            compareData[i + 1] = compareData[i + 1] * invLearn + currentImageData.data[i + 1] * learnRate;
            compareData[i + 2] = compareData[i + 2] * invLearn + currentImageData.data[i + 2] * learnRate;
          }
          
          if (diff <= this.threshold) {
            noiseSum += diff;
            noiseCount++;
          }
          
          if (diff > this.threshold) {
            let tx = nx;
            let ty = ny;
            
            this.debugPoints.push({ x: tx, y: ty });

            if (homography) {
              const mapped = homography.transform(tx, ty);
              tx = mapped.x;
              ty = mapped.y;
              
              // Discard points outside the calibrated area
              if (tx < 0 || tx > 1 || ty < 0 || ty > 1) {
                i += 4;
                continue;
              }
            }
            
            this.motionPoints.push({ x: tx, y: ty, mass: diff });
            sumX += tx;
            sumY += ty;
          }
          i += 4;
        }
      }
      
      if (noiseCount > 0) {
        const frameNoise = noiseSum / noiseCount;
        this.runningNoise = this.runningNoise * 0.98 + frameNoise * 0.02;
        const autoBaseThreshold = Math.max(12, Math.min(45, this.runningNoise * 3.0));
        this.threshold = Math.max(12, Math.min(130, autoBaseThreshold + (this.userSensitivityThreshold - 30) * 0.95));
      }
    }
    
    this.lastImageData = currentImageData;

    // 1. Leader-clustering of motion points to find centroids
    const centroids = [];
    const clusterRadius = 0.12; // Radius to group motion points (12% of screen width/height)
    
    for (const p of this.motionPoints) {
      let found = false;
      for (const c of centroids) {
        const dx = p.x - c.centerX;
        const dy = p.y - c.centerY;
        const distSq = dx * dx + dy * dy;
        if (distSq < clusterRadius * clusterRadius) {
          c.sumX += p.x;
          c.sumY += p.y;
          c.sumMass += p.mass;
          c.count++;
          // Update running center
          c.centerX = c.sumX / c.count;
          c.centerY = c.sumY / c.count;
          found = true;
          break;
        }
      }
      if (!found) {
        centroids.push({
          sumX: p.x,
          sumY: p.y,
          sumMass: p.mass,
          count: 1,
          centerX: p.x,
          centerY: p.y
        });
      }
    }

    // Filter out small centroids (noise) and map to clean output
    // A centroid needs to have at least 6 points to be considered valid
    const validCentroids = centroids
      .filter(c => c.count >= 6)
      .map(c => ({
        x: c.centerX,
        y: c.centerY,
        mass: c.sumMass,
        count: c.count
      }));

    // Sort by mass descending and cap at 8 centroids for performance
    validCentroids.sort((a, b) => b.mass - a.mass);
    const finalCentroids = validCentroids.slice(0, 8);

    // 2. Calculate general flow direction and apply EMA smoothing
    let dir = { dx: 0, dy: 0 };
    if (this.motionPoints.length > 0) {
      const avgX = sumX / this.motionPoints.length;
      const avgY = sumY / this.motionPoints.length;
      
      if (this.lastAvgCenter) {
        dir.dx = avgX - this.lastAvgCenter.x;
        dir.dy = avgY - this.lastAvgCenter.y;
      }
      this.lastAvgCenter = { x: avgX, y: avgY };
    }

    // Exponential Moving Average to smooth direction changes (alpha = 0.12)
    if (!this.smoothDir) {
      this.smoothDir = { dx: 0, dy: 0 };
    }
    const emaAlpha = 0.12;
    this.smoothDir.dx = this.smoothDir.dx * (1 - emaAlpha) + dir.dx * emaAlpha;
    this.smoothDir.dy = this.smoothDir.dy * (1 - emaAlpha) + dir.dy * emaAlpha;

    this.drawDebug();
    
    // Auto-Reference Capture
    if (this.motionPoints.length < 5) {
      this.framesWithNoMotion++;
      if (this.framesWithNoMotion >= 90) { // ~3 seconds at 30fps
        this.captureBackground();
        this.framesWithNoMotion = 0;
      }
    } else {
      this.framesWithNoMotion = 0;
    }
    
    return { points: this.motionPoints, centroids: finalCentroids, dir: this.smoothDir };
  }

  drawDebug() {
    if (!this.debugCtx) return;
    
    this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    this.debugCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    
    for (let point of this.debugPoints) {
      this.debugCtx.fillRect(
        point.x * this.debugCanvas.width, 
        point.y * this.debugCanvas.height, 
        4, 4
      );
    }
  }
}
