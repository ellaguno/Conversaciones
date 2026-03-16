import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readPersonalityDefaults, writePersonalityDefaults } from '@/lib/settings';
import { rateLimit } from '@/lib/rate-limit';

// Public: anyone can read admin defaults
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`pd-get:${ip}`, 30, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const defaults = readPersonalityDefaults();
  return NextResponse.json({ defaults });
}

// Admin only: save personality defaults
export async function PUT(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`pd-put:${ip}`, 10, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await req.json();
    writePersonalityDefaults(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al guardar' }, { status: 400 });
  }
}
