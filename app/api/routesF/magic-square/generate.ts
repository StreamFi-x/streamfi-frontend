export function generateMagicSquare(order: number) {
  const square = Array.from({ length: order }, () =>
    Array<number>(order).fill(0)
  );

  let row = 0;
  let col = Math.floor(order / 2);

  for (let value = 1; value <= order * order; value++) {
    square[row][col] = value;

    const nextRow = (row - 1 + order) % order;
    const nextCol = (col + 1) % order;

    if (square[nextRow][nextCol] !== 0) {
      row = (row + 1) % order;
    } else {
      row = nextRow;
      col = nextCol;
    }
  }

  return square;
}

export function getMagicConstant(order: number) {
  return (order * (order * order + 1)) / 2;
}
