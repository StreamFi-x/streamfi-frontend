export function createSeededRng(seed: number) {
  let state = seed >>> 0;

  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
