interface CompoundInterestInput {
  principal: number;
  rate: number;
  years: number;
  compoundsPerYear: number;
  contributions?: {
    amount: number;
    frequency: "monthly" | "annually";
  };
}

interface YearlySchedule {
  year: number;
  balance: number;
  interestEarned: number;
  contributionsToDate: number;
}

interface CompoundInterestResult {
  finalBalance: number;
  totalContributed: number;
  totalInterest: number;
  schedule: YearlySchedule[];
}

export function calculateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const { principal, rate, years, compoundsPerYear, contributions } = input;
  const rateDecimal = rate / 100;
  
  let balance = principal;
  let totalContributed = principal;
  const schedule: YearlySchedule[] = [];

  for (let year = 1; year <= years; year++) {
    let yearStartBalance = balance;
    let yearlyContributions = 0;
    
    // Add contributions for this year
    if (contributions) {
      if (contributions.frequency === "monthly") {
        // Monthly contributions: compound each month
        for (let month = 1; month <= 12; month++) {
          const monthlyRate = rateDecimal / compoundsPerYear * (compoundsPerYear / 12);
          balance = balance * (1 + monthlyRate) + contributions.amount;
          yearlyContributions += contributions.amount;
        }
        yearlyContributions = contributions.amount * 12;
      } else {
        // Annual contributions: add at the end of the year after interest
        const periodsPerYear = compoundsPerYear;
        const ratePerPeriod = rateDecimal / periodsPerYear;
        
        for (let period = 1; period <= periodsPerYear; period++) {
          balance = balance * (1 + ratePerPeriod);
        }
        balance += contributions.amount;
        yearlyContributions = contributions.amount;
      }
    } else {
      // No contributions, just compound interest
      const periodsPerYear = compoundsPerYear;
      const ratePerPeriod = rateDecimal / periodsPerYear;
      
      for (let period = 1; period <= periodsPerYear; period++) {
        balance = balance * (1 + ratePerPeriod);
      }
    }
    
    totalContributed += yearlyContributions;
    const interestEarned = balance - yearStartBalance - yearlyContributions;
    
    schedule.push({
      year,
      balance,
      interestEarned,
      contributionsToDate: totalContributed,
    });
  }

  const totalInterest = balance - totalContributed;

  return {
    finalBalance: balance,
    totalContributed,
    totalInterest,
    schedule,
  };
}
