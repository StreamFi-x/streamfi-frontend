import { NextResponse } from 'next/server';

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension for dot product');
  }
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function crossProduct(a: number[], b: number[]): number[] {
  if (a.length !== 3 || b.length !== 3) {
    throw new Error('Cross product requires 3D vectors');
  }
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function magnitude(a: number[]): number {
  return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
}

function normalize(a: number[]): number[] {
  const mag = magnitude(a);
  if (mag === 0) {
    throw new Error('Cannot normalize zero vector');
  }
  return a.map((val) => val / mag);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { a, b, op } = body;

    if (!Array.isArray(a) || !a.every((val) => typeof val === 'number')) {
      return NextResponse.json({ error: 'a must be an array of numbers' }, { status: 400 });
    }

    if (!op || typeof op !== 'string') {
      return NextResponse.json(
        { error: 'op must be one of: dot, cross, magnitude, normalize' },
        { status: 400 }
      );
    }

    let result;

    switch (op) {
      case 'dot':
        if (!Array.isArray(b) || !b.every((val) => typeof val === 'number')) {
          return NextResponse.json({ error: 'b must be an array of numbers for dot product' }, { status: 400 });
        }
        result = dotProduct(a, b);
        break;

      case 'cross':
        if (!Array.isArray(b) || !b.every((val) => typeof val === 'number')) {
          return NextResponse.json({ error: 'b must be an array of numbers for cross product' }, { status: 400 });
        }
        result = crossProduct(a, b);
        break;

      case 'magnitude':
        result = magnitude(a);
        break;

      case 'normalize':
        result = normalize(a);
        break;

      default:
        return NextResponse.json(
          { error: 'op must be one of: dot, cross, magnitude, normalize' },
          { status: 400 }
        );
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
