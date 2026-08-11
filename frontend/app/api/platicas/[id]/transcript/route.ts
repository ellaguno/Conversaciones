// Envía por correo la transcripción de la sesión de plática que acaba de
// terminar. Reemplaza el uso de /api/conversations/email desde /presentar,
// que fallaba: el cliente pedía la carpeta `custom` (personality_key del
// manifest) mientras el agente escribía en `normal` (porque /api/token degrada
// las personalidades desconocidas). Ahora ambos lados usan `platica_<id>`.
//
// Accesible sin sesión cuando la plática tiene liga externa (public_link): el
// visitante anónimo escribe su correo y recibe la transcripción de SU sesión —
// la que quedó en data/guest_<ip>/, la misma identidad que /api/token le
// asignó al despachar el agente.
import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { getUserConversationsDir } from '@/lib/data-paths';
import { sendEmail } from '@/lib/email';
import { conversationTranscriptEmail } from '@/lib/email-templates';
import { authorizePlaticaRead, guestUserIdFromIp } from '@/lib/platica-access';
import { rateLimit } from '@/lib/rate-limit';
import { getUserById } from '@/lib/users';

// El agente escribe la transcripción en su shutdown callback, que corre
// después de que el cliente se desconecta. Reintentamos mientras aparece.
const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

// Margen hacia atrás sobre `notBefore`: la sesión pudo arrancar unos segundos
// antes de que el cliente montara el componente que toma la marca de tiempo.
const NOT_BEFORE_SLACK_MS = 120_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickTranscript(dir: string, notBefore: number | null): string | null {
  if (!existsSync(dir)) return null;
  let best: { path: string; mtime: number } | null = null;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md') || f === 'summary.md') continue;
    const full = join(dir, f);
    try {
      const mtime = statSync(full).mtimeMs;
      if (notBefore !== null && mtime < notBefore - NOT_BEFORE_SLACK_MS) continue;
      if (!best || mtime > best.mtime) best = { path: full, mtime };
    } catch {
      // ignore unreadable
    }
  }
  return best?.path ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const { id } = await params;
  const access = await authorizePlaticaRead(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { manifest, userId } = access;

  // Con sesión, la cuota es la misma que la de los otros envíos de correo.
  // Sin sesión el destinatario lo escribe un desconocido, así que la cuota es
  // estrecha: es la única barrera contra usar esto para mandar correo.
  const [quota, windowMs] = userId ? [10, 60_000] : [5, 600_000];
  if (!rateLimit(`platica-transcript:${ip}`, quota, windowMs)) {
    return NextResponse.json({ error: 'Demasiados envíos. Intenta más tarde.' }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // cuerpo opcional
  }
  const requestedEmail = typeof body.email === 'string' ? body.email.trim().slice(0, 120) : '';
  const notBefore =
    typeof body.notBefore === 'number' && Number.isFinite(body.notBefore) ? body.notBefore : null;

  // Destinatario: el correo que pidió el cliente o, si hay sesión, el del perfil.
  let toEmail = requestedEmail;
  if (!toEmail && userId) {
    toEmail = getUserById(userId)?.email ?? '';
  }
  if (!toEmail) {
    return NextResponse.json(
      { error: 'Escribe el correo al que quieres recibir la transcripción.' },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(toEmail)) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  }

  // La transcripción de un visitante externo vive bajo su identidad de
  // invitado, no bajo la del owner de la plática.
  const dataUserId = userId ?? guestUserIdFromIp(ip);
  const convsBase = getUserConversationsDir(dataUserId);
  const dir = join(convsBase, `platica_${id.replace(/[^a-zA-Z0-9_-]/g, '')}`);
  if (!resolve(dir).startsWith(resolve(convsBase))) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  }

  let target: string | null = null;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    target = pickTranscript(dir, notBefore);
    if (target) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (!target) {
    return NextResponse.json(
      {
        error:
          'Todavía no hay transcripción de esta sesión. Si la plática duró muy poco, no se guardó nada.',
      },
      { status: 404 }
    );
  }

  const content = readFileSync(target, 'utf-8');
  const baseName = target.split('/').pop() || '';
  const dateMatch = baseName.match(/(\d{4}-\d{2}-\d{2})/);
  const sessionDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  try {
    const html = conversationTranscriptEmail(content, manifest.title, sessionDate);
    await sendEmail(toEmail, `Plática: ${manifest.title} - ${sessionDate}`, html);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar correo';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: toEmail });
}
