import { NextRequest, NextResponse } from 'next/server';
import { ConversionRequest, ConversionResponse, ConversionError } from './_lib/types';
import { convertUnits } from './_lib/helpers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const valueParam = searchParams.get('value');
    
    // Validate required parameters
    if (!from || !to || !valueParam) {
      return NextResponse.json<ConversionError>(
        { error: 'Missing required parameters: from, to, value' },
        { status: 400 }
      );
    }
    
    // Parse and validate value
    const value = parseFloat(valueParam);
    if (isNaN(value)) {
      return NextResponse.json<ConversionError>(
        { error: 'Invalid value parameter: must be a number' },
        { status: 400 }
      );
    }
    
    // Perform conversion
    const converted = convertUnits(value, from as any, to as any);
    
    const response: ConversionResponse = {
      converted,
      from: from as any,
      to: to as any,
      value
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Unit conversion error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json<ConversionError>(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
