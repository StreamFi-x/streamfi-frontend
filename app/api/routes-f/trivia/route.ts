import { NextRequest, NextResponse } from 'next/server';
import { 
  TriviaQuestionsResponse, 
  TriviaCategory, 
  TriviaDifficulty,
  VerifyAnswerRequest,
  VerifyAnswerResponse
} from './_lib/types';
import { 
  filterQuestions, 
  getRandomQuestions, 
  formatQuestionForResponse,
  validateAnswer
} from './_lib/helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category') as TriviaCategory | undefined;
    const difficulty = searchParams.get('difficulty') as TriviaDifficulty | undefined;
    const countParam = searchParams.get('count');
    
    // Validate count parameter
    let count = 1; // default
    if (countParam) {
      const parsedCount = parseInt(countParam, 10);
      if (isNaN(parsedCount) || parsedCount < 1) {
        return NextResponse.json(
          { error: 'Count must be a positive integer' },
          { status: 400 }
        );
      }
      count = Math.min(parsedCount, 20); // max 20
    }
    
    // Validate category
    if (category && !['science', 'history', 'geography', 'entertainment'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: science, history, geography, entertainment' },
        { status: 400 }
      );
    }
    
    // Validate difficulty
    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty. Must be one of: easy, medium, hard' },
        { status: 400 }
      );
    }
    
    // Filter and get random questions
    const filteredQuestions = filterQuestions(category, difficulty);
    
    if (filteredQuestions.length === 0) {
      return NextResponse.json(
        { error: 'No questions found matching the specified criteria' },
        { status: 404 }
      );
    }
    
    const randomQuestions = getRandomQuestions(filteredQuestions, count);
    const responseQuestions = randomQuestions.map(formatQuestionForResponse);
    
    const response: TriviaQuestionsResponse = {
      questions: responseQuestions
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in trivia GET endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyAnswerRequest = await request.json();
    
    // Validate request body
    if (!body.question_id || typeof body.question_id !== 'string') {
      return NextResponse.json(
        { error: 'question_id is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (typeof body.answer_index !== 'number' || body.answer_index < 0) {
      return NextResponse.json(
        { error: 'answer_index is required and must be a non-negative integer' },
        { status: 400 }
      );
    }
    
    // Validate answer
    const result = validateAnswer(body.question_id, body.answer_index);
    
    if (result === null) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    const response: VerifyAnswerResponse = {
      correct: result.correct,
      correct_index: result.correct_index
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in trivia POST endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
