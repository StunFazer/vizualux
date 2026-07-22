export class MediaPipeDetector {
  constructor(videoElement, debugCanvas) {
    this.video = videoElement;
    this.debugCanvas = debugCanvas;
    this.debugCtx = debugCanvas ? debugCanvas.getContext('2d') : null;
    
    this.landmarks = null;
    this.centroids = [];
    this.dir = { dx: 0, dy: 0 };
    this.lastAvgCenter = null;
    this.smoothDir = { dx: 0, dy: 0 };
    
    this.isModelLoaded = false;
    this.isVisualizationEnabled = false; 
    this.isProcessing = false;
    
    this.initModel();
  }

  setVisualization(enabled) {
    this.isVisualizationEnabled = enabled;
  }

  async initModel() {
    try {
      this.pose = new window.Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });
      
      this.pose.setOptions({
        modelComplexity: 0, // Lite model for performance
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      this.pose.onResults(this.onResults.bind(this));
      
      // Initialize the model in the background
      await this.pose.initialize();
      this.isModelLoaded = true;
      console.log('MediaPipe Pose (Lite) loaded and ready in background.');
    } catch (e) {
      console.error('Failed to initialize MediaPipe Pose', e);
    }
  }

  onResults(results) {
    this.isProcessing = false;
    if (results.poseLandmarks) {
      this.landmarks = results.poseLandmarks;
    } else {
      this.landmarks = null;
    }
  }

  update(homography = null, calibData = null) {
    if (!this.video || this.video.readyState < 2 || !this.isModelLoaded) {
      return { points: [], centroids: [], dir: { dx: 0, dy: 0 } };
    }

    // Send frame to model if not currently processing one
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.pose.send({image: this.video}).catch(err => {
        console.error('MediaPipe Pose send error:', err);
        this.isProcessing = false;
      });
    }

    this.centroids.length = 0;
    let sumX = 0, sumY = 0;
    
    if (this.landmarks) {
      // Hands: 15, 16, 17, 18, 19, 20, 21, 22
      // Feet: 27, 28, 29, 30, 31, 32
      const targetIndices = [15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32];
      
      for (const idx of targetIndices) {
        const lm = this.landmarks[idx];
        // Ensure the landmark is confident enough
        if (lm && lm.visibility > 0.4) {
          let tx = lm.x;
          let ty = lm.y;
          
          if (homography) {
            const mapped = homography.transform(tx, ty);
            tx = mapped.x;
            ty = mapped.y;
            
            // Discard points outside the calibrated floor area
            if (tx < 0 || tx > 1 || ty < 0 || ty > 1) {
              continue;
            }
          }
          
          this.centroids.push({
            x: tx,
            y: ty,
            mass: 120, // Arbitrary interaction weight for AI points
            count: 1
          });
          
          sumX += tx;
          sumY += ty;
        }
      }
    }

    // Calculate flow direction based on center of mass movement
    let dir = { dx: 0, dy: 0 };
    if (this.centroids.length > 0) {
      const avgX = sumX / this.centroids.length;
      const avgY = sumY / this.centroids.length;
      
      if (this.lastAvgCenter) {
        dir.dx = avgX - this.lastAvgCenter.x;
        dir.dy = avgY - this.lastAvgCenter.y;
      }
      this.lastAvgCenter = { x: avgX, y: avgY };
    } else {
      this.lastAvgCenter = null;
    }

    const emaAlpha = 0.12;
    this.smoothDir.dx = this.smoothDir.dx * (1 - emaAlpha) + dir.dx * emaAlpha;
    this.smoothDir.dy = this.smoothDir.dy * (1 - emaAlpha) + dir.dy * emaAlpha;

    this.drawDebug();
    
    return { points: this.centroids, centroids: this.centroids, dir: this.smoothDir };
  }

  drawDebug() {
    if (!this.debugCtx) return;

    // Scale canvas to match video element intrinsic size for accurate drawing
    if (this.video && this.video.videoWidth) {
      if (this.debugCanvas.width !== this.video.videoWidth) {
        this.debugCanvas.width = this.video.videoWidth;
        this.debugCanvas.height = this.video.videoHeight;
      }
    }
    
    this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    
    if (this.isVisualizationEnabled && this.landmarks && window.drawConnectors && window.drawLandmarks && window.POSE_CONNECTIONS) {
      this.debugCtx.save();
      window.drawConnectors(this.debugCtx, this.landmarks, window.POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
      window.drawLandmarks(this.debugCtx, this.landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
      this.debugCtx.restore();
    }
  }
}
