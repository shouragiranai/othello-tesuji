// Solves an 8x8 linear system A*h = b via Gauss-Jordan elimination with partial pivoting.
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  return M.map((row) => row[n]);
}

// Computes a projective homography mapping each srcPts[i] to dstPts[i] (4 point
// correspondences), and returns a function that maps any (u, v) in source space to
// the corresponding (x, y) in destination space.
function computeHomography(srcPts, dstPts) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = srcPts[i];
    const { x: X, y: Y } = dstPts[i];
    A.push([u, v, 1, 0, 0, 0, -u * X, -v * X]);
    b.push(X);
    A.push([0, 0, 0, u, v, 1, -u * Y, -v * Y]);
    b.push(Y);
  }
  const h = solveLinearSystem(A, b);
  return (u, v) => {
    const denom = h[6] * u + h[7] * v + 1;
    return { x: (h[0] * u + h[1] * v + h[2]) / denom, y: (h[3] * u + h[4] * v + h[5]) / denom };
  };
}
