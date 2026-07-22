# VizuaLux Interactive Projection Hub

VizuaLux Interactive Projection Hub is a premium, client-side interactive floor projection system. It turns any standard room projection setup into a motion-responsive interactive floor using a simple webcam and a projector.

Featuring computer vision motion tracking, perspective warping calibration, and over 18 custom bioluminescent nature, generative art, and arcade game modules.

---

## 🌟 Key Features

* **Real-time Webcam Motion Tracking**: High-performance, client-side motion detection and centroid tracking running at 60fps.
* **Webcam Auto-Calibration**: Structured-light calibration system that projects sequence targets and runs luminance-difference centroid calculations to solve room perspective matrixes automatically.
* **Draggable Manual Calibration**: Admin UI overlay utilizing 8x8 Gaussian elimination homography solvers to map projection grids.
* **18 Interactive Visual Effects**:
  * *Nature & Fluids*: Bioluminescent Koi Pond, Zen Garden, Liquid Ripples, Scatter Objects, Frost Reveal, Fog Reveal, Footprints, Grow & Fall, Breaking Ice, Liquid Sand, Bioluminescent Storm.
  * *Generative Art*: Smoke Trails, Paint Splatter, Motion Reveal, Orbital Gravity Vortex, Dynamic Harmonograph, Pixie Dust.
  * *Arcade Games*: Floor Pong, Asteroids Defense.
* **Simulated Input Mode**: Lissajous-pattern auto-motion coordinator for testing without webcam hardware.
* **Glassmorphic UI / Dashboard**: Glassmorphic theme built on CSS with Outfit typography, advanced collapsible setups, audio controls, and an integrated playlist loop system.

---

## 🚀 Setup & Execution

### 1. Requirements
* Node.js (v18+)
* A connected webcam and a projector (for physical installation)

### 2. Installation
Install the project dependencies using npm:
```bash
npm install
```

### 3. Run Locally (Development Server)
Launch the Vite development server:
```bash
npm run dev
```
Open the local URL (usually `http://localhost:5173`) in your browser.

### 4. Build for Production
Compile and bundle client assets:
```bash
npm run build
```
The production bundle will be generated under the `dist/` directory.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `1` - `9`, `0`, `Q` - `R` | Quick-switch between interactive visual effects and games. |
| `[` / `]` | Decrease / Increase system master volume. |
| `-` / `+` | Decrease / Increase camera motion tracking sensitivity. |
| `F` | Toggle fullscreen mode. |
| `Esc` | Close setup onboarding guide. |

---

## 📐 Projector Warping Configuration

* **Open Projector Window**: Click the "Open Projector" button to launch the secondary viewport popup. Drag this popup to your physical projector screen and double-click to fullscreen it.
* **Calibrate Viewport**: Click "Warp" on the admin dashboard, select a test pattern (Corners, Grid, Checkerboard, or Circles), and drag the 4 corner handles to align the output area with your physical tracking zone.
* **Auto-Calibration**: Press the "Auto Calibrate" button to launch the automatic CV camera-projector calibration sequence.
