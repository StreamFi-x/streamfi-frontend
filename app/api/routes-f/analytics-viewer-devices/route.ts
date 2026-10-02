import { NextResponse } from 'next/server';
import { seedDeviceViewers } from './seed-data';

interface DeviceBreakdown {
  type: 'desktop' | 'mobile' | 'tablet' | 'tv';
  count: number;
  percent: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');

    if (!streamId || typeof streamId !== 'string' || streamId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid stream_id parameter' },
        { status: 400 }
      );
    }

    const viewers = seedDeviceViewers.filter((v) => v.stream_id === streamId);

    if (viewers.length === 0) {
      return NextResponse.json(
        { devices: [] },
        { status: 200 }
      );
    }

    const deviceCounts: Record<string, number> = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      tv: 0,
    };

    viewers.forEach((viewer) => {
      deviceCounts[viewer.device_type]++;
    });

    const devices: DeviceBreakdown[] = Object.entries(deviceCounts)
      .map(([type, count]) => ({
        type: type as 'desktop' | 'mobile' | 'tablet' | 'tv',
        count,
        percent: Number(((count / viewers.length) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ devices });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
