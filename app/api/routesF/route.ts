/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { CreatorMerchData, MerchLink, PutMerchLinksBody } from './types';
import { isValidUrl } from './utils';

// In-memory store for practice implementation
const merchStore: Record<string, CreatorMerchData> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creator_id = searchParams.get('creator_id');

  if (!creator_id) {
    return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
  }

  const data = merchStore[creator_id] || { merch_links: [] };
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try {
    const body: PutMerchLinksBody = await request.json();
    const { creator_id, merch_links } = body;

    if (!creator_id) {
      return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
    }

    if (!Array.isArray(merch_links)) {
      return NextResponse.json({ error: 'merch_links must be an array' }, { status: 400 });
    }

    if (merch_links.length > 5) {
      return NextResponse.json({ error: 'Maximum of 5 merch links allowed' }, { status: 400 });
    }

    const validatedLinks: MerchLink[] = [];
    for (const link of merch_links) {
      if (!link || typeof link !== 'object') {
        return NextResponse.json({ error: 'Invalid link object' }, { status: 400 });
      }
      if (!link.label || typeof link.label !== 'string') {
        return NextResponse.json({ error: 'Invalid label in merch_links' }, { status: 400 });
      }
      if (!link.url || typeof link.url !== 'string' || !isValidUrl(link.url)) {
        return NextResponse.json({ error: `Invalid URL: ${link.url}` }, { status: 400 });
      }
      validatedLinks.push({ label: link.label, url: link.url });
    }

    merchStore[creator_id] = { merch_links: validatedLinks };
    return NextResponse.json(merchStore[creator_id], { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
