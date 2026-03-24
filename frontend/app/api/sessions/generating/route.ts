import { NextResponse } from 'next/server';
import { existsSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserSessionsDir } from '@/lib/data-paths';

export const revalidate = 0;

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function isGeneratingActive(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const age = Date.now() - statSync(filePath).mtimeMs;
    if (age > STALE_THRESHOLD_MS) {
      unlinkSync(filePath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ generating: false });
    }

    const sessionsBase = getUserSessionsDir(session.user.id);
    if (!existsSync(sessionsBase)) {
      return NextResponse.json({ generating: false });
    }

    const url = new URL(req.url);
    const patientId = url.searchParams.get('patientId');

    if (patientId) {
      // Check specific patient
      const safe = patientId.replace(/[^a-zA-Z0-9_-]/g, '');
      const patientDir = join(sessionsBase, safe);
      if (!resolve(patientDir).startsWith(resolve(sessionsBase))) {
        return NextResponse.json({ generating: false });
      }
      const generating = isGeneratingActive(join(patientDir, '.generating'));
      return NextResponse.json({ generating });
    }

    // Check all patients — return true if any is generating
    try {
      const { readdirSync } = await import('fs');
      const dirs = readdirSync(sessionsBase);
      for (const d of dirs) {
        if (d.includes('_deleted_')) continue;
        const genFile = join(sessionsBase, d, '.generating');
        if (isGeneratingActive(genFile)) {
          return NextResponse.json({ generating: true, patientId: d });
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ generating: false });
  } catch {
    return NextResponse.json({ generating: false });
  }
}
