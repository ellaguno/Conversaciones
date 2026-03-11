function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#7c3aed;padding:20px 24px;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;">Conversaciones</h1>
    </div>
    <div style="padding:24px;">
      ${content}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Este es un correo automatico de Conversaciones</p>
    </div>
  </div>
</body>
</html>`;
}

export function sessionTranscriptEmail(
  sessionContent: string,
  patientName: string,
  sessionDate: string
): string {
  // Convert markdown to basic HTML (simple conversion)
  const htmlContent = markdownToHtml(sessionContent);
  return baseLayout(`
    <h2 style="color:#1f2937;margin:0 0 8px;">Notas de sesion</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px;">Paciente: <strong>${escapeHtml(patientName)}</strong> &middot; Fecha: ${escapeHtml(sessionDate)}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <div style="color:#374151;font-size:14px;line-height:1.6;">
      ${htmlContent}
    </div>
  `);
}

export function homeworkEmail(tasks: string, patientName: string, sessionDate: string): string {
  const htmlContent = markdownToHtml(tasks);
  return baseLayout(`
    <h2 style="color:#1f2937;margin:0 0 8px;">Tareas asignadas</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px;">Paciente: <strong>${escapeHtml(patientName)}</strong> &middot; Fecha: ${escapeHtml(sessionDate)}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <div style="color:#374151;font-size:14px;line-height:1.6;">
      ${htmlContent}
    </div>
    <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e;">
      <p style="margin:0;color:#166534;font-size:13px;"><strong>Recuerda:</strong> Estas tareas fueron asignadas durante tu sesion de terapia. Intenta completarlas antes de tu proxima cita.</p>
    </div>
  `);
}

export function newRegistrationEmail(username: string, displayName: string, email: string): string {
  return baseLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">Nueva solicitud de registro</h2>
    <div style="padding:16px;background:#fef3c7;border-radius:8px;margin-bottom:16px;">
      <p style="margin:0;color:#92400e;font-size:14px;">Un nuevo usuario solicita acceso a la plataforma.</p>
    </div>
    <table style="width:100%;font-size:14px;color:#374151;">
      <tr><td style="padding:8px 0;font-weight:bold;">Usuario:</td><td>${escapeHtml(username)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Nombre:</td><td>${escapeHtml(displayName)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Email:</td><td>${escapeHtml(email)}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin-top:16px;">Ingresa al panel de administracion para aprobar o rechazar esta solicitud.</p>
  `);
}

export function accountApprovedEmail(displayName: string): string {
  return baseLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">Cuenta aprobada</h2>
    <p style="color:#374151;font-size:14px;">Hola <strong>${escapeHtml(displayName)}</strong>,</p>
    <p style="color:#374151;font-size:14px;">Tu cuenta ha sido aprobada. Ya puedes iniciar sesion en la plataforma.</p>
    <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
      <p style="margin:0;color:#166534;font-size:14px;font-weight:bold;">Tu cuenta esta activa</p>
    </div>
  `);
}

export function accountRejectedEmail(displayName: string): string {
  return baseLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">Solicitud de cuenta</h2>
    <p style="color:#374151;font-size:14px;">Hola <strong>${escapeHtml(displayName)}</strong>,</p>
    <p style="color:#374151;font-size:14px;">Lamentamos informarte que tu solicitud de registro no ha sido aprobada. Si crees que esto es un error, contacta al administrador.</p>
  `);
}

export function passwordResetEmail(displayName: string, resetUrl: string): string {
  return baseLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">Recuperar contraseña</h2>
    <p style="color:#374151;font-size:14px;">Hola <strong>${escapeHtml(displayName)}</strong>,</p>
    <p style="color:#374151;font-size:14px;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el boton de abajo:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Restablecer contraseña</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
    <p style="color:#9ca3af;font-size:11px;word-break:break-all;">${escapeHtml(resetUrl)}</p>
  `);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  // Simple markdown to HTML (no external dependency needed)
  return md
    .replace(/^### (.+)$/gm, '<h3 style="color:#1f2937;margin:16px 0 8px;">$1</h3>')
    .replace(
      /^## (.+)$/gm,
      '<h2 style="color:#1f2937;margin:20px 0 10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">$1</h2>'
    )
    .replace(/^# (.+)$/gm, '<h1 style="color:#1f2937;margin:24px 0 12px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /^- \[x\] (.+)$/gm,
      '<div style="margin:4px 0;"><span style="color:#22c55e;">&#9745;</span> <s>$1</s></div>'
    )
    .replace(
      /^- \[ \] (.+)$/gm,
      '<div style="margin:4px 0;"><span style="color:#9ca3af;">&#9744;</span> $1</div>'
    )
    .replace(/^- (.+)$/gm, '<div style="margin:4px 0;padding-left:12px;">&bull; $1</div>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
