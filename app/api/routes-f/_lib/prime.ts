function getSieveLimit(n: number): number {
  if (n < 6) {
    return 15;
  }

  return Math.ceil(n * (Math.log(n) + Math.log(Math.log(n)))) + 10;
}

function sieveNthPrime(n: number, limit: number): number | null {
  const sieve = new Uint8Array(limit + 1);
  sieve.fill(1);
  sieve[0] = 0;
  sieve[1] = 0;

  let count = 0;

  for (let i = 2; i <= limit; i += 1) {
    if (!sieve[i]) {
      continue;
    }

    count += 1;
    if (count === n) {
      return i;
    }

    const step = i * i;
    if (step <= limit) {
      for (let j = step; j <= limit; j += i) {
        sieve[j] = 0;
      }
    }
  }

  return null;
}

export function findNthPrime(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 100000) {
    throw new Error("n must be an integer between 1 and 100000.");
  }

  let limit = getSieveLimit(n);
  let prime = sieveNthPrime(n, limit);

  while (prime === null) {
    limit = Math.ceil(limit * 1.2) + 10;
    prime = sieveNthPrime(n, limit);
  }

  return prime;
}
