// Per-user UI preferences. Hoy solo guarda `lastPersonality` para que al
// re-entrar el usuario aterrice en el agente con el que habló por última
// vez. Vive en `data/{userId}/preferences.json`.
//
// Los guests (sin sesión) NO usan este endpoint — su default lo decide el
// código del cliente (constante 'normal' hardcoded en app.tsx).
import { NextResponse } from 'next/server';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { auth } from '@/lib/auth';
import { getUserPreferencesFile } from '@/lib/data-paths';

export const revalidate = 0;

interface UserPreferences {
  lastPersonality?: string;
}

function readPreferences(userId: string): UserPreferences {
  const file = getUserPreferencesFile(userId);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function writePreferences(userId: string, prefs: UserPreferences): void {
  const file = getUserPreferencesFile(userId);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(prefs, null, 2), 'utf-8');
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  return NextResponse.json(readPreferences(session.user.id));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body debe ser objeto' }, { status: 400 });
  }
  const incoming = body as Record<string, unknown>;
  const current = readPreferences(session.user.id);
  // Merge: solo se permiten campos conocidos. Validamos cada uno.
  if (incoming.lastPersonality !== undefined) {
    if (
      typeof incoming.lastPersonality !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(incoming.lastPersonality)
    ) {
      return NextResponse.json({ error: 'lastPersonality inválido' }, { status: 400 });
    }
    current.lastPersonality = incoming.lastPersonality;
  }
  writePreferences(session.user.id, current);
  return NextResponse.json(current);
}
