export function determinant(matrix: number[][]): number {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  let det = 1;
  let sign = 1;

  for (let i = 0; i < n; i += 1) {
    let pivotRow = i;
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(a[j][i]) > Math.abs(a[pivotRow][i])) {
        pivotRow = j;
      }
    }

    if (a[pivotRow][i] === 0) {
      return 0;
    }

    if (pivotRow !== i) {
      [a[i], a[pivotRow]] = [a[pivotRow], a[i]];
      sign *= -1;
    }

    det *= a[i][i];

    for (let j = i + 1; j < n; j += 1) {
      const factor = a[j][i] / a[i][i];
      for (let k = i; k < n; k += 1) {
        a[j][k] -= factor * a[i][k];
      }
    }
  }

  return sign * det;
}
