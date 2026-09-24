/**
 * Homography matrix solver using Gaussian elimination on the 8x8 system.
 * Ported from the Interactive Projection Software architecture for Structured Light Calibration.
 */

export interface Point2D {
  x: number
  y: number
}

export class Homography {
  matrix: number[]

  constructor() {
    this.matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1] // Identity
  }

  /**
   * Solves for the 3x3 homography matrix that maps src points to dst points.
   * src = 4 points in source coordinate space
   * dst = 4 corresponding points in target coordinate space
   */
  calibrate(src: Point2D[], dst: Point2D[]): boolean {
    if (src.length !== 4 || dst.length !== 4) return false
    
    const P: number[][] = []
    for (let i = 0; i < 4; i++) {
      P.push([
        -src[i].x, -src[i].y, -1,
        0, 0, 0,
        src[i].x * dst[i].x, src[i].y * dst[i].x, -dst[i].x
      ])
      P.push([
        0, 0, 0,
        -src[i].x, -src[i].y, -1,
        src[i].x * dst[i].y, src[i].y * dst[i].y, -dst[i].y
      ])
    }

    // Gaussian elimination with partial pivoting
    for (let i = 0; i < 8; i++) {
      let maxRow = i
      for (let j = i + 1; j < 8; j++) {
        if (Math.abs(P[j][i]) > Math.abs(P[maxRow][i])) {
          maxRow = j
        }
      }
      // Swap rows
      const temp = P[i]
      P[i] = P[maxRow]
      P[maxRow] = temp

      // Make pivot 1
      const pivot = P[i][i]
      if (Math.abs(pivot) < 1e-10) return false // Singular matrix
      
      for (let j = i; j < 9; j++) {
        P[i][j] /= pivot
      }

      // Eliminate other rows
      for (let j = 0; j < 8; j++) {
        if (i !== j) {
          const factor = P[j][i]
          for (let k = i; k < 9; k++) {
            P[j][k] -= factor * P[i][k]
          }
        }
      }
    }

    this.matrix = [
      P[0][8], P[1][8], P[2][8],
      P[3][8], P[4][8], P[5][8],
      P[6][8], P[7][8], 1
    ]
    return true
  }

  /**
   * Projects a 2D point (x, y) through the computed homography matrix.
   */
  transform(x: number, y: number): Point2D {
    const m = this.matrix
    const w = m[6] * x + m[7] * y + m[8]
    if (Math.abs(w) < 1e-10) return { x, y }
    return {
      x: (m[0] * x + m[1] * y + m[2]) / w,
      y: (m[3] * x + m[4] * y + m[5]) / w
    }
  }
}
