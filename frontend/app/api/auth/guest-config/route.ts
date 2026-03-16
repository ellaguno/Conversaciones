import { NextResponse } from 'next/server';
import { readSettings } from '@/lib/settings';

export async function GET() {
  const { guestEnabled, guestMinutes } = readSettings();
  return NextResponse.json({ guestEnabled, guestMinutes });
}
