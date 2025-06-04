import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(req: NextRequest) {
  const { callerUsername, receiverUsername } = await req.json();

  if (!callerUsername || !receiverUsername) {
    return NextResponse.json({ error: 'Both usernames are required' }, { status: 400 });
  }

  try {
    const { rows: callerRows } = await sql`SELECT * FROM users WHERE username = ${callerUsername}`;
    const { rows: receiverRows } = await sql`SELECT * FROM users WHERE username = ${receiverUsername}`;

    if (callerRows.length === 0 || receiverRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await sql`
      UPDATE users
      SET following = ARRAY(
        SELECT DISTINCT unnest(COALESCE(following, '{}'::TEXT[])) || ${receiverUsername}
      )
      WHERE username = ${callerUsername}
    `;

    await sql`
      UPDATE users
      SET followers = ARRAY(
        SELECT DISTINCT unnest(COALESCE(followers, '{}'::TEXT[])) || ${callerUsername}
      )
      WHERE username = ${receiverUsername}
    `;

    return NextResponse.json({ message: 'Followed successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
  }
}
