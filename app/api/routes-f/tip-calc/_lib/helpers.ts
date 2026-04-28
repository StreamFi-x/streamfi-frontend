interface TipCalcInput {
  subtotal: number;
  tipPercent: number;
  people: number;
  round: "none" | "up" | "nearest";
}

interface TipCalcResult {
  tip: number;
  total: number;
  perPerson: {
    tip: number;
    total: number;
  };
  roundedTotal?: number;
}

export function calculateTip(input: TipCalcInput): TipCalcResult {
  const { subtotal, tipPercent, people, round } = input;
  
  // Work with cents to avoid floating point precision issues
  const subtotalCents = Math.round(subtotal * 100);
  const tipCents = Math.round(subtotalCents * tipPercent) / 100;
  const totalCents = subtotalCents + tipCents;
  
  let finalTotal = totalCents / 100;
  let roundedTotal: number | undefined;
  
  // Apply rounding if requested
  if (round !== "none") {
    if (round === "up") {
      roundedTotal = Math.ceil(finalTotal);
    } else if (round === "nearest") {
      roundedTotal = Math.round(finalTotal);
    }
    finalTotal = roundedTotal!;
  }
  
  // Calculate per-person amounts
  const tipPerPerson = tipCents / (people * 100);
  const totalPerPerson = finalTotal / people;
  
  return {
    tip: tipCents / 100,
    total: totalCents / 100,
    perPerson: {
      tip: Math.round(tipPerPerson * 100) / 100,
      total: Math.round(totalPerPerson * 100) / 100,
    },
    roundedTotal,
  };
}
