import { NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { getUserDataDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

// Raw conversation logs are scoped by personality, not by interview (see
// agent/conversation_log.py). That means all of a user's Elena interviews
// share one directory. We list everything for now — a future improvement is
// to filter by date range matching the interview's session dates.
export async function GET(req: Request, _ctx: RouteCtx) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`ent-tr:${ip}`, 60, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const dir = join(getUserDataDir(session.user.id), 'conversations', 'entrevistadora');
    if (!existsSync(dir)) {
      return NextResponse.json({ transcripts: [] });
    }
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const full = join(dir, f);
        let mtime: string | null = null;
        let size = 0;
        try {
          const s = statSync(full);
          mtime = s.mtime.toISOString();
          size = s.size;
        } catch {
          // ignore
        }
        return { filename: f, mtime, size };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename));
    return NextResponse.json({ transcripts: files });
  } catch (error) {
    console.error('Error listing transcripts:', error);
    return NextResponse.json({ transcripts: [] });
  }
}
