import { RoutesFRecord, RoutesFMethod } from "./schema";

// Mulberry32 PRNG
// https://github.com/bryc/code/blob/master/jshash/PRNGs.md
function mulberry32(a: number) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Simple string hashing function to generate a numeric seed from a string
function cyrb128(str: string): number {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

export class DeterministicGenerator {
    private prng: () => number;

    constructor(seed: string | number) {
        const numericSeed = typeof seed === "string" ? cyrb128(seed) : seed;
        this.prng = mulberry32(numericSeed);
    }

    random(): number {
        return this.prng();
    }

    randomInt(min: number, max: number): number {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }

    pick<T>(items: T[]): T {
        return items[this.randomInt(0, items.length - 1)];
    }

    pickN<T>(items: T[], n: number): T[] {
        const shuffled = [...items].sort(() => 0.5 - this.random());
        return shuffled.slice(0, n);
    }

    generateId(): string {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let id = "rf-mock-";
        for (let i = 0; i < 8; i++) {
            id += chars[this.randomInt(0, chars.length - 1)];
        }
        return id;
    }
}

const DOMAINS: Record<string, { paths: string[], verbs: string[], prefixes: string[], tags: string[] }> = {
    financial: {
        paths: ["/transactions", "/balance", "/invoices", "/portfolio"],
        verbs: ["Process", "Calculate", "Audit", "Sync"],
        prefixes: ["Ledger", "Account", "Asset", "Tax"],
        tags: ["finance", "critical", "billing", "audit"],
    },
    social: {
        paths: ["/feed", "/friends", "/messages", "/notifications"],
        verbs: ["Fetch", "Update", "Broadcast", "Like"],
        prefixes: ["User", "Post", "Comment", "Reaction"],
        tags: ["engagement", "public", "realtime", "cacheable"],
    },
    default: {
        paths: ["/items", "/records", "/data", "/config"],
        verbs: ["Get", "Set", "Load", "Save"],
        prefixes: ["App", "System", "Base", "Core"],
        tags: ["general", "system", "internal"],
    }
};

const METHODS: RoutesFMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function generateMockData(seed: string | number, count: number, profileType: string = "default"): Omit<RoutesFRecord, "id">[] {
    const generator = new DeterministicGenerator(seed);
    const domain = DOMAINS[profileType] || DOMAINS["default"];

    const records: Omit<RoutesFRecord, "id">[] = [];

    for (let i = 0; i < count; i++) {
        const method = generator.pick(METHODS);
        const pathBase = generator.pick(domain.paths);
        const hasIdParam = generator.random() > 0.5;
        const path = hasIdParam ? `${pathBase}/:id` : pathBase;

        const prefix = generator.pick(domain.prefixes);
        const verb = generator.pick(domain.verbs);
        const name = `${verb} ${prefix} ${i}`;

        const tags = generator.pickN(domain.tags, generator.randomInt(1, 3));

        const priority = generator.randomInt(0, 100);
        const enabled = generator.random() > 0.2; // 80% chance of being enabled

        records.push({
            name,
            path,
            method,
            priority,
            enabled,
            tags,
            metadata: {
                generatedAt: new Date(1704067200000 + generator.randomInt(0, 31536000000)).toISOString(), // Sometime in 2024
                source: "mock-generator",
                profile: profileType
            }
        });
    }

    return records;
}
