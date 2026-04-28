import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { a, b, mode = "line" } = await req.json();

    if (a.length > 100000 || b.length > 100000) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let aTokens = mode === "word" ? a.split(/\b/) : a.split('\n');
    let bTokens = mode === "word" ? b.split(/\b/) : b.split('\n');

    // Prevent OOM for very large inputs
    if (aTokens.length > 2000) aTokens = aTokens.slice(0, 2000);
    if (bTokens.length > 2000) bTokens = bTokens.slice(0, 2000);

    const dp = Array(aTokens.length + 1).fill(null).map(() => Array(bTokens.length + 1).fill(0));
    for (let i = 1; i <= aTokens.length; i++) {
        for (let j = 1; j <= bTokens.length; j++) {
            if (aTokens[i-1] === bTokens[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }
    
    const changes: { type: "add"|"remove"|"unchanged", value: string }[] = [];
    let i = aTokens.length, j = bTokens.length;
    let added = 0, removed = 0, unchanged = 0;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && aTokens[i-1] === bTokens[j-1]) {
            changes.unshift({ type: "unchanged", value: aTokens[i-1] });
            unchanged++;
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
            changes.unshift({ type: "add", value: bTokens[j-1] });
            added++;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j-1] < dp[i-1][j])) {
            changes.unshift({ type: "remove", value: aTokens[i-1] });
            removed++;
            i--;
        }
    }

    return NextResponse.json({ changes, stats: { added, removed, unchanged } });
}
