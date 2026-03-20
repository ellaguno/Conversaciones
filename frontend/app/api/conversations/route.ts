import { NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { getUserConversationsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

interface ConversationFile {
  filename: string;
  date: string;
  time: string;
}

interface PersonalityConversations {
  personality: string;
  conversations: ConversationFile[];
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`conversations:${ip}`, 60, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.user.id;
    const conversationsBase = getUserConversationsDir(userId);

    const url = new URL(req.url);

    // Quick check: does a specific personality have any transcripts?
    const checkPersonality = url.searchParams.get('personality');
    if (checkPersonality && url.searchParams.get('check')) {
      const safeKey = checkPersonality.replace(/[^a-zA-Z0-9_-]/g, '');
      const dir = join(conversationsBase, safeKey);
      let count = 0;
      if (existsSync(dir)) {
        count = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'summary.md').length;
      }
      return NextResponse.json({ count });
    }

    // Recent: return last N agents sorted by most recent conversation
    if (url.searchParams.get('recent')) {
      if (!existsSync(conversationsBase)) {
        return NextResponse.json({ recent: [] });
      }
      const dirs = readdirSync(conversationsBase).filter((d) => {
        try {
          return statSync(join(conversationsBase, d)).isDirectory();
        } catch {
          return false;
        }
      });
      const recents: { personality: string; lastDate: string; count: number }[] = [];
      for (const d of dirs) {
        const dirPath = join(conversationsBase, d);
        const files = readdirSync(dirPath)
          .filter((f) => f.endsWith('.md') && f !== 'summary.md')
          .sort()
          .reverse();
        if (files.length === 0) continue;
        const match = files[0].match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})\.md$/);
        const lastDate = match ? `${match[1]} ${match[2].replace('-', ':')}` : '';
        recents.push({ personality: d, lastDate, count: files.length });
      }
      recents.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
      return NextResponse.json({ recent: recents.slice(0, 5) });
    }

    if (!existsSync(conversationsBase)) {
      return NextResponse.json({ personalities: [] });
    }

    const dirs = readdirSync(conversationsBase).filter((d) => {
      try {
        const full = join(conversationsBase, d);
        return statSync(full).isDirectory();
      } catch {
        return false;
      }
    });

    const personalities: PersonalityConversations[] = dirs
      .map((d) => {
        const dirPath = join(conversationsBase, d);
        const files = readdirSync(dirPath)
          .filter((f) => f.endsWith('.md'))
          .sort()
          .reverse();

        const conversations: ConversationFile[] = files.map((f) => {
          const match = f.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})\.md$/);
          return {
            filename: f,
            date: match ? match[1] : '',
            time: match ? match[2].replace('-', ':') : '',
          };
        });

        return { personality: d, conversations };
      })
      .filter((p) => p.conversations.length > 0);

    return NextResponse.json({ personalities });
  } catch (error) {
    console.error('Error reading conversations:', error);
    return NextResponse.json({ personalities: [] });
  }
}
