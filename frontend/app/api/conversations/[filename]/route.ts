import { type NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { rateLimit } from '@/lib/rate-limit';

const CONVERSATIONS_BASE = join(process.cwd(), '..', 'agent', 'conversations');

function isValidFilename(f: string): boolean {
  return /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.md$/.test(f);
}

function isValidPersonality(p: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(p) && p.length < 50;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`conv-file:${ip}`, 60, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const { filename } = await params;
    const personality = req.nextUrl.searchParams.get('personality') || '';

    if (!isValidFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    if (!isValidPersonality(personality)) {
      return NextResponse.json({ error: 'Invalid personality' }, { status: 400 });
    }

    const filePath = resolve(CONVERSATIONS_BASE, personality, filename);
    if (!filePath.startsWith(resolve(CONVERSATIONS_BASE))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const content = readFileSync(filePath, 'utf-8');
    return NextResponse.json({ filename, content });
  } catch (error) {
    console.error('Error reading conversation:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
