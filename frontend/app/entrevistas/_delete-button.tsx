'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteInterviewButton({
  id,
  intervieweeName,
  sessionCount,
}: {
  id: string;
  intervieweeName: string;
  sessionCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    const label = intervieweeName || id;
    const warn =
      sessionCount > 0
        ? `Esta entrevista tiene ${sessionCount} sesión${sessionCount === 1 ? '' : 'es'} con conocimiento destilado y notas.`
        : 'Esta entrevista no tiene sesiones aún.';
    const ok = window.confirm(
      `¿Borrar la entrevista "${label}"?\n\n${warn}\n\nEsta acción NO se puede deshacer desde la app. El directorio se renombra con sufijo _deleted_<ts> y queda en disco para recuperación manual.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/entrevistas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        alert(`No se pudo borrar (${res.status}). ${t}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="shrink-0 text-xs text-red-600 underline hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
    >
      {busy ? 'borrando…' : 'borrar'}
    </button>
  );
}
