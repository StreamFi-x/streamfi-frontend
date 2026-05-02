import { CITIES, FIRST_NAMES, LAST_NAMES, STREET_NAMES } from "./pools";

export type FakeUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  avatar_url: string;
};

function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, values: T[]): T {
  return values[Math.floor(rand() * values.length)];
}

function digits(rand: () => number, count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    out += Math.floor(rand() * 10).toString();
  }
  return out;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function generateFakeUsers(count: number, seed: number): FakeUser[] {
  const rand = createSeededRandom(seed);
  const users: FakeUser[] = [];

  for (let i = 0; i < count; i++) {
    const first = pick(rand, FIRST_NAMES);
    const last = pick(rand, LAST_NAMES);
    const streetNo = Math.floor(rand() * 999) + 1;
    const street = `${streetNo} ${pick(rand, STREET_NAMES)}`;
    const cityInfo = pick(rand, CITIES);
    const zip = digits(rand, 5);
    const phone = `+1-${digits(rand, 3)}-${digits(rand, 3)}-${digits(rand, 4)}`;
    const idNum = Math.floor(rand() * 1_000_000);
    const id = `usr_${idNum.toString().padStart(6, "0")}_${i + 1}`;

    users.push({
      id,
      name: `${first} ${last}`,
      email: `${slug(first)}.${slug(last)}@example.com`,
      phone,
      address: {
        street,
        city: cityInfo.city,
        state: cityInfo.state,
        zip,
        country: cityInfo.country,
      },
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        `${first} ${last} ${id}`,
      )}`,
    });
  }

  return users;
}
