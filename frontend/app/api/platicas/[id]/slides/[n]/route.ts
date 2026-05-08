import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { auth } from '@/lib/auth';
import { getSlidePath, readManifest } from '@/lib/platicas-storage';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`platicas-slide:${ip}`, 600, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { id, n } = await params;
  const manifest = readManifest(id);
  if (!manifest) {
    return NextResponse.json({ error: 'Plática no encontrada' }, { status: 404 });
  }
  if (manifest.owner_user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  // n is "001" (string) or "1"; accept both.
  const slideNumber = parseInt(n, 10);
  if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > manifest.slide_count) {
    return NextResponse.json({ error: 'slide fuera de rango' }, { status: 404 });
  }
  const path = getSlidePath(id, slideNumber);
  if (!existsSync(path)) {
    return NextResponse.json({ error: 'PNG no rendirizado' }, { status: 404 });
  }
  const buf = readFileSync(path);
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
