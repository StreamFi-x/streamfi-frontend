import { NextRequest, NextResponse } from 'next/server';
import { getQuoteById, getRandomQuote, getDeterministicQuote, getCategories, quotes } from './data';
import { QuoteResponse } from './types';

export async function GET(
  request: NextRequest,
  context?: { params?: { id?: string } | Promise<{ id?: string }> },
) {
  const rawParams = context?.params;
  const params = rawParams instanceof Promise ? await rawParams : rawParams;
  const { searchParams } = new URL(request.url);
  
  // Handle GET /quote/[id]
  if (params?.id) {
    const id = parseInt(params.id, 10);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid quote ID format' },
        { status: 400 }
      );
    }

    const quote = getQuoteById(id);
    
    if (!quote) {
      return NextResponse.json(
        { error: `Quote with ID ${id} not found` },
        { status: 404 }
      );
    }

    const response: QuoteResponse = {
      id: quote.id,
      text: quote.text,
      author: quote.author,
      category: quote.category,
      ...(quote.year && { year: quote.year })
    };
    
    return NextResponse.json(response);
  }

  // Handle GET /quote/today
  if (request.nextUrl.pathname.endsWith('/today')) {
    const dateParam = searchParams.get('date');
    const date = dateParam || new Date().toISOString().split('T')[0]; // Default to today
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const quote = getDeterministicQuote(date);
    
    const response: QuoteResponse = {
      id: quote.id,
      text: quote.text,
      author: quote.author,
      category: quote.category,
      ...(quote.year && { year: quote.year })
    };
    
    return NextResponse.json(response);
  }

  // Handle GET /quote/random
  if (request.nextUrl.pathname.endsWith('/random')) {
    const category = searchParams.get('category') || undefined;
    
    if (category) {
      const categories = getCategories();
      if (!categories.includes(category)) {
        return NextResponse.json(
          { 
            error: `Category '${category}' not found`,
            availableCategories: categories
          },
          { status: 400 }
        );
      }
    }

    try {
      const quote = getRandomQuote(category);
      
      const response: QuoteResponse = {
        id: quote.id,
        text: quote.text,
        author: quote.author,
        category: quote.category,
        ...(quote.year && { year: quote.year })
      };
      
      return NextResponse.json(response);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 404 }
      );
    }
  }

  // Handle GET /quote (list all quotes)
  return NextResponse.json({
    quotes: quotes.map(quote => ({
      id: quote.id,
      text: quote.text,
      author: quote.author,
      category: quote.category,
      ...(quote.year && { year: quote.year })
    })),
    total: quotes.length
  });
}
