export function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return function () {
    state = Math.imul(state + 0x6d2b79f5, 1);
    let t = state;
    t ^= t >>> 15;
    t = Math.imul(t | 1, t ^ (t + Math.imul(t ^ (t >>> 7), t | 61)));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
