import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  readLayoutDefaults,
  readPersonalityDefaults,
  writeLayoutDefaults,
  writePersonalityDefaults,
} from '@/lib/settings';

// Public: anyone can read admin defaults
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`pd-get:${ip}`, 30, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const defaults = readPersonalityDefaults();
  const layoutDefaults = readLayoutDefaults();
  return NextResponse.json({ defaults, layoutDefaults });
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
    // If body has __layout__ key, save layout separately
    if (body.__layout__) {
      writeLayoutDefaults(body.__layout__);
      return NextResponse.json({ ok: true });
    }
    writePersonalityDefaults(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al guardar' }, { status: 400 });
  }
}
