import { NextRequest, NextResponse } from 'next/server';
import { buildEchoResponse } from './_lib/helpers';

//Echo endpoint — returns request details for debugging
 //Handles GET, POST, PUT, DELETE
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleEcho(request);
}

async function handleEcho(request: NextRequest): Promise<NextResponse> {
  try {
    const response = await buildEchoResponse(request);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[echo] Echo endpoint error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}