import { NextRequest, NextResponse } from 'next/server';
import { getQuestions, gradeQuiz } from './quizData';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get('creator_id');

  if (!creatorId) {
    return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
  }

  const questions = getQuestions();
  // Return questions without the correct answers
  const sanitized = questions.map(({ id, text, options }) => ({ id, text, options }));

  return NextResponse.json({ creator_id: creatorId, questions: sanitized });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator_id, mod_id, answers } = body;

    if (!creator_id || !mod_id || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'creator_id, mod_id, and answers array are required' },
        { status: 400 },
      );
    }

    const { score, passed } = gradeQuiz(answers);
    const certified_at = passed ? new Date().toISOString() : null;

    return NextResponse.json({ score, passed, certified_at });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}