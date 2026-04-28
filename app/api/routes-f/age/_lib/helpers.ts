export function calculateAge(birthdate: Date, targetDate: Date) {
  // Calculate total days and seconds
  const totalDays = Math.floor((targetDate.getTime() - birthdate.getTime()) / (1000 * 60 * 60 * 24));
  const totalSeconds = Math.floor((targetDate.getTime() - birthdate.getTime()) / 1000);

  // Calculate years, months, days
  let years = targetDate.getFullYear() - birthdate.getFullYear();
  let months = targetDate.getMonth() - birthdate.getMonth();
  let days = targetDate.getDate() - birthdate.getDate();

  // Adjust for negative values
  if (days < 0) {
    months--;
    const lastMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
    days += lastMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  // Calculate next birthday
  const currentYear = targetDate.getFullYear();
  let nextBirthday = new Date(currentYear, birthdate.getMonth(), birthdate.getDate());
  
  if (nextBirthday < targetDate) {
    nextBirthday = new Date(currentYear + 1, birthdate.getMonth(), birthdate.getDate());
  }

  const daysUntilNextBirthday = Math.ceil((nextBirthday.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    years,
    months,
    days,
    totalDays,
    totalSeconds,
    nextBirthday: {
      daysUntil: daysUntilNextBirthday,
      date: nextBirthday.toISOString().split('T')[0],
    },
  };
}

export function getGeneration(birthdate: Date): string {
  const year = birthdate.getFullYear();
  
  if (year >= 1901 && year <= 1924) return "Lost Generation";
  if (year >= 1925 && year <= 1945) return "Silent Generation";
  if (year >= 1946 && year <= 1964) return "Baby Boomers";
  if (year >= 1965 && year <= 1980) return "Generation X";
  if (year >= 1981 && year <= 1996) return "Millennials";
  if (year >= 1997 && year <= 2012) return "Generation Z";
  if (year >= 2013) return "Generation Alpha";
  
  return "Unknown";
}

export function getWesternZodiac(birthdate: Date): string {
  const month = birthdate.getMonth() + 1;
  const day = birthdate.getDate();
  
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";
  
  return "Unknown";
}

export function getChineseZodiac(birthdate: Date): string {
  const year = birthdate.getFullYear();
  const zodiacs = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
  const index = (year - 4) % 12;
  return zodiacs[index];
}
