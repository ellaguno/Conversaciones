import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getUserByUsername } from '@/lib/users';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`check-status:${ip}`, 10, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  try {
    const body = await req.json();
    const { username } = body;
    if (!username) {
      return NextResponse.json({ status: 'unknown' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ status: 'unknown' });
    }

    return NextResponse.json({ status: user.status || 'active' });
  } catch {
    return NextResponse.json({ status: 'unknown' });
  }
}
