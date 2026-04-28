import { NextRequest, NextResponse } from 'next/server';
import { DiceRequest, DiceResponse, DiceError } from './_lib/types';
import { parseDiceNotation, rollDice } from './_lib/helpers';

export async function POST(req: NextRequest) {
  try {
    const body: DiceRequest = await req.json();
    
    // Validate required parameters
    if (!body.notation) {
      return NextResponse.json<DiceError>(
        { error: 'Missing required parameter: notation' },
        { status: 400 }
      );
    }

    // Validate seed if provided
    if (body.seed !== undefined && (typeof body.seed !== 'number' || !Number.isInteger(body.seed))) {
      return NextResponse.json<DiceError>(
        { error: 'Seed must be an integer' },
        { status: 400 }
      );
    }

    // Parse the dice notation
    const parsed = parseDiceNotation(body.notation);
    
    // Roll the dice
    const result = rollDice(parsed, body.seed);
    
    const response: DiceResponse = {
      total: result.total,
      rolls: result.rolls,
      dropped: result.dropped,
      notation: body.notation
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Dice roll error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json<DiceError>(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
