import { readSettings } from './settings';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { smtp } = readSettings();
  if (!smtp.host || !smtp.user || !smtp.password || !smtp.fromAddress) {
    throw new Error('SMTP no configurado. Configure el correo en Configuracion > Servidor.');
  }

  // Dynamic import to avoid issues if nodemailer not installed
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
  });

  await transporter.sendMail({
    from: smtp.fromAddress,
    to,
    subject,
    html,
  });
}

export async function testSmtpConnection(): Promise<boolean> {
  const { smtp } = readSettings();
  if (!smtp.host || !smtp.user || !smtp.password) {
    throw new Error('SMTP no configurado');
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
  });

  await transporter.verify();
  return true;
}
