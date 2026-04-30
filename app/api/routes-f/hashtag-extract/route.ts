import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    if (text.length > 100 * 1024) {
      return NextResponse.json({ error: 'Input too large' }, { status: 413 });
    }

    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urlsMatches = text.match(urlRegex) || [];
    
    // Remove URLs from text to avoid hashtag/mention extraction from them
    let cleanText = text;
    for (const url of urlsMatches) {
        cleanText = cleanText.replace(url, ' ');
    }

    const hashtagRegex = /#\w+/g;
    const mentionRegex = /@\w+/g;

    const hashtagsMatches = cleanText.match(hashtagRegex) || [];
    const mentionsMatches = cleanText.match(mentionRegex) || [];

    const urls = Array.from(new Set(urlsMatches));
    const hashtags = Array.from(new Set(hashtagsMatches));
    const mentions = Array.from(new Set(mentionsMatches));

    return NextResponse.json({ hashtags, mentions, urls });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
