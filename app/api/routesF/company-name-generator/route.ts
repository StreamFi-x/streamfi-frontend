import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Word pools for company name generation
const PREFIXES = {
  tech: ["Cyber", "Digital", "Smart", "Tech", "Data", "Cloud", "Quantum", "Neural", "Pixel", "Code"],
  finance: ["Capital", "Wealth", "Asset", "Prime", "Elite", "Trust", "Secure", "Gold", "Silver", "Diamond"],
  food: ["Fresh", "Organic", "Gourmet", "Tasty", "Crispy", "Sweet", "Spicy", "Golden", "Royal", "Premium"],
  any: ["Global", "United", "Premier", "Advanced", "Superior", "Dynamic", "Innovative", "Creative", "Modern", "Future"]
};

const ROOTS = {
  tech: ["Soft", "Ware", "Logic", "System", "Network", "Protocol", "Algorithm", "Interface", "Platform", "Framework"],
  finance: ["Bank", "Fund", "Investment", "Credit", "Finance", "Capital", "Equity", "Portfolio", "Market", "Exchange"],
  food: ["Kitchen", "Bistro", "Cafe", "Deli", "Market", "Bakery", "Grill", "Feast", "Flavor", "Cuisine"],
  any: ["Corp", "Group", "Solutions", "Services", "Industries", "Enterprises", "Holdings", "Partners", "Associates", "Ventures"]
};

const SUFFIXES = {
  tech: ["Labs", "Systems", "Technologies", "Solutions", "Innovations", "Dynamics", "Networks", "Platforms", "Studios", "Works"],
  finance: ["Partners", "Associates", "Holdings", "Capital", "Advisors", "Management", "Group", "Trust", "Securities", "Investments"],
  food: ["Co", "Kitchen", "Foods", "Catering", "Delights", "Treats", "Specialties", "Provisions", "Pantry", "Table"],
  any: ["Inc", "LLC", "Corp", "Ltd", "Group", "Company", "Enterprises", "International", "Global", "Worldwide"]
};

type Industry = "tech" | "finance" | "food" | "any";

const querySchema = z.object({
  count: z.string().optional().default("5").transform(val => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 5 : Math.max(1, Math.min(50, num));
  }),
  industry: z.enum(["tech", "finance", "food", "any"]).optional().default("any"),
  seed: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
});

// Simple seeded random number generator (LCG)
class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

function generateCompanyName(industry: Industry, rng: SeededRandom): string {
  const prefix = rng.choice(PREFIXES[industry]);
  const root = rng.choice(ROOTS[industry]);
  const suffix = rng.choice(SUFFIXES[industry]);

  return `${prefix}${root} ${suffix}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const validation = querySchema.safeParse({
    count: searchParams.get("count"),
    industry: searchParams.get("industry"),
    seed: searchParams.get("seed")
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { count, industry, seed } = validation.data;
  const rng = new SeededRandom(seed);
  
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(generateCompanyName(industry, rng));
  }

  return NextResponse.json({
    names,
    count: names.length,
    industry,
    seed: seed ?? "random"
  });
}