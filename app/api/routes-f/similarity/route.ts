import { NextResponse } from "next/server";

function levenshtein(a: string, b: string) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

function jaro(s1: string, s2: string) {
    if (s1 === s2) return 1;
    const len1 = s1.length, len2 = s2.length;
    if (len1 === 0 || len2 === 0) return 0;
    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    let matches = 0, transpositions = 0;

    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchDistance);
        const end = Math.min(i + matchDistance + 1, len2);
        for (let j = start; j < end; j++) {
            if (s2Matches[j]) continue;
            if (s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }
    if (matches === 0) return 0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k] && k < len2) k++;
        if (k < len2 && s1[i] !== s2[k]) transpositions++;
        k++;
    }
    return ((matches / len1) + (matches / len2) + ((matches - transpositions / 2) / matches)) / 3;
}

function jaroWinkler(s1: string, s2: string) {
    let j = jaro(s1, s2);
    let prefix = 0;
    for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }
    return j + prefix * 0.1 * (1 - j);
}

function dice(s1: string, s2: string) {
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;
    const bigrams = (s: string) => {
        const res = new Set<string>();
        for (let i = 0; i < s.length - 1; i++) {
            res.add(s.slice(i, i + 2));
        }
        return res;
    };
    const b1 = bigrams(s1);
    const b2 = bigrams(s2);
    let intersection = 0;
    for (const bg of b1) {
        if (b2.has(bg)) intersection++;
    }
    return (2 * intersection) / (b1.size + b2.size);
}

export async function POST(req: Request) {
    const { a, b, algorithms = ["levenshtein", "jaro", "jaro_winkler", "dice"] } = await req.json();
    if (a.length > 10000 || b.length > 10000) {
        return NextResponse.json({ error: "String too large" }, { status: 413 });
    }

    const results: any = {};
    if (algorithms.includes("levenshtein")) {
        const dist = levenshtein(a, b);
        results.levenshtein = { distance: dist, score: 1 - dist / Math.max(a.length, b.length) };
    }
    if (algorithms.includes("jaro")) {
        results.jaro = { score: jaro(a, b) };
    }
    if (algorithms.includes("jaro_winkler")) {
        results.jaro_winkler = { score: jaroWinkler(a, b) };
    }
    if (algorithms.includes("dice")) {
        results.dice = { score: dice(a, b) };
    }

    return NextResponse.json({ results });
}
