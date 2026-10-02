/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { seedAppeals } from './seed-data';

type AppealStatus = 'pending' | 'resolved';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creator_id');
    const statusParam = searchParams.get('status');

    if (!creatorId || typeof creatorId !== 'string' || creatorId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid creator_id parameter' },
        { status: 400 }
      );
    }

    let filterStatus: AppealStatus | null = null;
    if (statusParam) {
      if (statusParam !== 'pending' && statusParam !== 'resolved') {
        return NextResponse.json(
          { error: 'Invalid status parameter. Must be pending or resolved' },
          { status: 400 }
        );
      }
      filterStatus = statusParam as AppealStatus;
    }

    let appeals = seedAppeals.filter((a) => a.creator_id === creatorId);

    if (filterStatus) {
      appeals = appeals.filter((a) => a.status === filterStatus);
    }

    appeals.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({ appeals });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
