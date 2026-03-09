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
