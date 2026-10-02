import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { computeSimilarity, type SimilarityAlgorithm } from "@/app/api/routes-f/_lib/textSimilarity";

const similarityBodySchema = z.object({
  a: z.string(),
  b: z.string(),
  algorithm: z.enum(["jaccard", "cosine", "both"]).optional(),
});

export async function POST(req: NextRequest) {
  const validated = await validateBody(req, similarityBodySchema);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { a, b, algorithm } = validated.data;
  const normalizedAlgorithm = algorithm ?? "both";
  return NextResponse.json(computeSimilarity(a, b, normalizedAlgorithm as SimilarityAlgorithm));
}
