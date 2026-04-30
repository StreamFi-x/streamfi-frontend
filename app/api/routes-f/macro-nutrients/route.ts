import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { weight_kg, height_cm, age, sex, activity_level, goal } = body;

    if (!weight_kg || !height_cm || !age || !sex || !activity_level || !goal) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // BMR Mifflin-St Jeor
    let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age;
    if (sex === 'male') {
      bmr += 5;
    } else if (sex === 'female') {
      bmr -= 161;
    } else {
      return NextResponse.json({ error: 'Invalid sex' }, { status: 400 });
    }

    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const multiplier = activityMultipliers[activity_level];
    if (!multiplier) {
      return NextResponse.json({ error: 'Invalid activity_level' }, { status: 400 });
    }

    let tdee = bmr * multiplier;
    let target_calories = tdee;

    if (goal === 'lose') {
      target_calories -= 500;
    } else if (goal === 'gain') {
      target_calories += 500;
    } else if (goal !== 'maintain') {
      return NextResponse.json({ error: 'Invalid goal' }, { status: 400 });
    }

    const protein_cals = target_calories * 0.3;
    const carbs_cals = target_calories * 0.4;
    const fat_cals = target_calories * 0.3;

    const protein_g = Math.round(protein_cals / 4);
    const carbs_g = Math.round(carbs_cals / 4);
    const fat_g = Math.round(fat_cals / 9);

    const water_ml = weight_kg * 35; // simple heuristic

    return NextResponse.json({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target_calories: Math.round(target_calories),
      macros: {
        protein_g,
        carbs_g,
        fat_g
      },
      water_ml: Math.round(water_ml),
      disclaimer: "This provides general guidance and is not medical advice."
    });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
