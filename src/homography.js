/**
 * Calculates the homography matrix and transforms points.
 * Solves Ah = 0 using Gaussian elimination on the 8x8 matrix.
 */

export class Homography {
  constructor() {
    this.matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // Identity
  }

  // src = [{x,y}, {x,y}, {x,y}, {x,y}] (camera space)
  // dst = [{x,y}, {x,y}, {x,y}, {x,y}] (screen space 0-1)
  calibrate(src, dst) {
    if (src.length !== 4 || dst.length !== 4) return;
    
    let P = [];
    for (let i = 0; i < 4; i++) {
      P.push([
        -src[i].x, -src[i].y, -1,
        0, 0, 0,
        src[i].x * dst[i].x, src[i].y * dst[i].x, -dst[i].x
      ]);
      P.push([
        0, 0, 0,
        -src[i].x, -src[i].y, -1,
        src[i].x * dst[i].y, src[i].y * dst[i].y, -dst[i].y
      ]);
    }

    // Gaussian elimination
    for (let i = 0; i < 8; i++) {
      let maxRow = i;
      for (let j = i + 1; j < 8; j++) {
        if (Math.abs(P[j][i]) > Math.abs(P[maxRow][i])) {
          maxRow = j;
        }
      }
      // Swap rows
      let temp = P[i];
      P[i] = P[maxRow];
      P[maxRow] = temp;

      // Make pivot 1
      let pivot = P[i][i];
      if (Math.abs(pivot) < 1e-10) return; // Abort on singular matrix
      
      for (let j = i; j < 9; j++) {
        P[i][j] /= pivot;
      }

      // Eliminate others
      for (let j = 0; j < 8; j++) {
        if (i !== j) {
          let factor = P[j][i];
          for (let k = i; k < 9; k++) {
            P[j][k] -= factor * P[i][k];
          }
        }
      }
    }

    this.matrix = [
      P[0][8], P[1][8], P[2][8],
      P[3][8], P[4][8], P[5][8],
      P[6][8], P[7][8], 1
    ];
  }

  transform(x, y) {
    const m = this.matrix;
    const w = m[6] * x + m[7] * y + m[8];
    if (Math.abs(w) < 1e-10) return { x, y };
    return {
      x: (m[0] * x + m[1] * y + m[2]) / w,
      y: (m[3] * x + m[4] * y + m[5]) / w
    };
  }
}
