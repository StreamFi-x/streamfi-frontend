import { createSeededRng } from "./rng";

type Cell = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

function createGrid(width: number, height: number) {
  return Array.from({ length: height }, () =>
    Array.from(
      { length: width },
      (): Cell => ({
        top: true,
        right: true,
        bottom: true,
        left: true,
      })
    )
  );
}

function shuffleDirections(
  directions: Array<
    [dx: number, dy: number, wall: keyof Cell, opposite: keyof Cell]
  >,
  random: () => number
) {
  const copy = [...directions];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateMaze(width: number, height: number, seed: number) {
  const random = createSeededRng(seed);
  const grid = createGrid(width, height);
  const visited = Array.from({ length: height }, () =>
    Array<boolean>(width).fill(false)
  );
  const directions: Array<[number, number, keyof Cell, keyof Cell]> = [
    [0, -1, "top", "bottom"],
    [1, 0, "right", "left"],
    [0, 1, "bottom", "top"],
    [-1, 0, "left", "right"],
  ];

  function carve(x: number, y: number) {
    visited[y][x] = true;

    for (const [dx, dy, wall, opposite] of shuffleDirections(
      directions,
      random
    )) {
      const nextX = x + dx;
      const nextY = y + dy;

      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
        continue;
      }

      if (visited[nextY][nextX]) {
        continue;
      }

      grid[y][x][wall] = false;
      grid[nextY][nextX][opposite] = false;
      carve(nextX, nextY);
    }
  }

  carve(0, 0);
  return grid;
}

export function renderMaze(width: number, height: number, seed: number) {
  const grid = generateMaze(width, height, seed);
  const rows = height * 2 + 1;
  const cols = width * 2 + 1;
  const output: string[][] = Array.from({ length: rows }, () =>
    Array(cols).fill("#")
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      const row = y * 2 + 1;
      const col = x * 2 + 1;

      output[row][col] = " ";

      if (!cell.top) {
        output[row - 1][col] = " ";
      }
      if (!cell.right) {
        output[row][col + 1] = " ";
      }
      if (!cell.bottom) {
        output[row + 1][col] = " ";
      }
      if (!cell.left) {
        output[row][col - 1] = " ";
      }
    }
  }

  output[0][1] = " ";
  output[rows - 1][cols - 2] = " ";

  return output.map(row => row.join("")).join("\n");
}
