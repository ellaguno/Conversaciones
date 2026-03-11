import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { newRegistrationEmail } from '@/lib/email-templates';
import { rateLimit } from '@/lib/rate-limit';
import { createUser, getUserByEmail, getUsers } from '@/lib/users';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`register:${ip}`, 5, 3_600_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const body = await req.json();
    const { username, email, displayName, password } = body;

    if (!username || !email || !displayName || !password) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: 'El nombre de usuario debe tener entre 3 y 30 caracteres' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'El nombre de usuario solo puede contener letras, numeros y guion bajo' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existingByEmail = getUserByEmail(email);
    if (existingByEmail) {
      return NextResponse.json({ error: 'Este correo ya esta registrado' }, { status: 400 });
    }

    const user = createUser({
      username,
      password,
      displayName,
      email,
      status: 'pending',
    });

    // Notify admins via email
    try {
      const allUsers = getUsers();
      const admins = allUsers.filter((u) => u.role === 'admin' && u.email);
      const emailHtml = newRegistrationEmail(username, displayName, email);
      for (const admin of admins) {
        if (admin.email) {
          await sendEmail(admin.email, 'Nueva solicitud de registro - Conversaciones', emailHtml);
        }
      }
    } catch {
      // Email notification is best-effort, don't fail registration
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al registrar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
