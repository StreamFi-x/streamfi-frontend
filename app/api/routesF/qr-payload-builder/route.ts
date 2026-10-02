import { NextResponse } from 'next/server';

function buildWiFiPayload(data: any): string {
  const { ssid, password, security = 'WPA' } = data;
  if (!ssid || !password) {
    throw new Error('WiFi requires ssid and password');
  }
  return `WIFI:T:${security};S:${ssid};P:${password};;`;
}

function buildVCardPayload(data: any): string {
  const { firstName, lastName, phone, email, organization, url } = data;
  if (!firstName && !lastName) {
    throw new Error('vCard requires at least firstName or lastName');
  }

  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  if (firstName || lastName) {
    lines.push(`FN:${(firstName || '').trim()} ${(lastName || '').trim()}`.trim());
    lines.push(`N:${lastName || ''};${firstName || ''};; ;`);
  }

  if (phone) {
    lines.push(`TEL:${phone}`);
  }

  if (email) {
    lines.push(`EMAIL:${email}`);
  }

  if (organization) {
    lines.push(`ORG:${organization}`);
  }

  if (url) {
    lines.push(`URL:${url}`);
  }

  lines.push('END:VCARD');

  return lines.join('\n');
}

function buildURLPayload(data: any): string {
  const { url } = data;
  if (!url) {
    throw new Error('URL requires url parameter');
  }
  return url;
}

function buildGeoPayload(data: any): string {
  const { latitude, longitude, altitude } = data;
  if (latitude === undefined || longitude === undefined) {
    throw new Error('Geo requires latitude and longitude');
  }

  if (altitude !== undefined) {
    return `geo:${latitude},${longitude},${altitude}`;
  }

  return `geo:${latitude},${longitude}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Missing type parameter' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid data object' },
        { status: 400 }
      );
    }

    let payload: string;

    switch (type.toLowerCase()) {
      case 'wifi':
        payload = buildWiFiPayload(data);
        break;
      case 'vcard':
        payload = buildVCardPayload(data);
        break;
      case 'url':
        payload = buildURLPayload(data);
        break;
      case 'geo':
        payload = buildGeoPayload(data);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Use wifi, vcard, url, or geo' },
          { status: 400 }
        );
    }

    return NextResponse.json({ payload });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Invalid request' },
      { status: 400 }
    );
  }
}
