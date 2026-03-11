import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { testSmtpConnection } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { readSettings, writeSettings } from '@/lib/settings';

async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`admin-settings:${ip}`, 30, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  return null;
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const settings = readSettings();
  // Mask password for display
  return NextResponse.json({
    settings: {
      ...settings,
      smtp: {
        ...settings.smtp,
        password: settings.smtp.password ? '••••••••' : '',
      },
    },
  });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const current = readSettings();

    // Update SMTP
    if (body.smtp) {
      current.smtp = {
        host: body.smtp.host ?? current.smtp.host,
        port: parseInt(body.smtp.port) || current.smtp.port,
        user: body.smtp.user ?? current.smtp.user,
        // Keep existing password if masked value is sent
        password:
          body.smtp.password === '••••••••'
            ? current.smtp.password
            : (body.smtp.password ?? current.smtp.password),
        fromAddress: body.smtp.fromAddress ?? current.smtp.fromAddress,
        secure: body.smtp.secure ?? current.smtp.secure,
      };
    }

    // Update Google OAuth
    if (body.googleOAuth) {
      current.googleOAuth = {
        clientId: body.googleOAuth.clientId ?? current.googleOAuth.clientId,
        clientSecret: body.googleOAuth.clientSecret ?? current.googleOAuth.clientSecret,
      };
    }

    // Update analysis model
    if (body.analysisModel !== undefined) {
      current.analysisModel = body.analysisModel || 'anthropic/claude-opus-4.6';
    }

    writeSettings(current);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al guardar configuracion';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Test SMTP connection
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await testSmtpConnection();
    return NextResponse.json({ ok: true, message: 'Conexion SMTP exitosa' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de conexion';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
