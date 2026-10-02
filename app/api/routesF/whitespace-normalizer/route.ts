/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';

function normalizeWhitespace(
  text: string,
  collapseSpaces: boolean = true,
  trimLines: boolean = false,
  stripBlankLines: boolean = false
): string {
  let result = text;

  if (trimLines) {
    result = result
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
  }

  if (collapseSpaces) {
    result = result
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' '))
      .join('\n');
  }

  if (stripBlankLines) {
    result = result
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n');
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      text,
      collapse_spaces = true,
      trim_lines = false,
      strip_blank_lines = false,
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text' },
        { status: 400 }
      );
    }

    const result = normalizeWhitespace(
      text,
      collapse_spaces,
      trim_lines,
      strip_blank_lines
    );

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
}
