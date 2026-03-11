import { NextResponse } from 'next/server';
import { isGoogleOAuthConfigured } from '@/lib/settings';

export async function GET() {
  return NextResponse.json({
    google: isGoogleOAuthConfigured(),
  });
}
