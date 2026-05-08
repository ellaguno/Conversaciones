'use client';

// Listado de pláticas del usuario. Cada fila tiene "Iniciar" (lleva al usuario
// a la home con la plática preseleccionada vía sessionStorage) y "Eliminar".
// Botón principal arriba: "+ Nueva plática" → /platicas/nueva.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlaticaListItem } from '@/lib/platica-schema';

export default function PlaticasListPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlaticaListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch('/api/platicas', { credentials: 'include' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setItems(body.platicas);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const startPlatica = (id: string, personality: string) => {
    sessionStorage.setItem('pending_platica_id', id);
    sessionStorage.setItem('pending_platica_personality', personality);
    router.push('/');
  };

  const deletePlatica = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}" definitivamente? No se puede deshacer.`)) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/platicas/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) {
        const body = await r.json();
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-muted-foreground hover:text-foreground text-xs">
              ← Inicio
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Pláticas con presentación</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Cada plática es un PDF + un guion + configuración. Al iniciar, el agente narra
              siguiendo el guion mientras la audiencia ve las diapositivas en{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">/presentar/&lt;id&gt;</code>.
            </p>
          </div>
          <Link
            href="/platicas/nueva"
            className="bg-primary text-primary-foreground rounded-full px-4 py-2 font-mono text-xs font-bold tracking-wider uppercase"
          >
            + Nueva plática
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {items === null ? (
          <div className="text-muted-foreground text-sm">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">No tienes pláticas guardadas todavía.</p>
            <Link
              href="/platicas/nueva"
              className="text-primary mt-3 inline-block text-sm underline"
            >
              Crear la primera
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li
                key={p.id}
                className="border-border bg-card flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.title}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {p.slide_count} slides · personalidad <strong>{p.personality_key}</strong> ·
                    avance <strong>{p.advance_mode ?? 'hybrid'}</strong> ·{' '}
                    {new Date(p.created_at).toLocaleDateString('es-MX')}
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <Link
                    href={`/presentar/${p.id}`}
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs"
                    title="Solo proyección — sin audio (requiere otro device para conversar con el agente)"
                  >
                    proyección
                  </Link>
                  <Link
                    href={`/platicas/${p.id}/editar`}
                    className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs"
                  >
                    editar
                  </Link>
                  <Link
                    href={`/presentar/${p.id}?mode=live`}
                    target="_blank"
                    className="rounded-full border border-amber-600 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-amber-700 uppercase hover:bg-amber-600/10 dark:text-amber-400"
                    title="Slide + orador en una sola pantalla (audio incluido)"
                  >
                    Todo en uno
                  </Link>
                  <button
                    onClick={() => startPlatica(p.id, p.personality_key)}
                    className="rounded-full bg-amber-600 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-white uppercase hover:bg-amber-700"
                    title="Iniciar la sesión de chat (operador) — proyección en otra pantalla"
                  >
                    Iniciar
                  </button>
                  <button
                    onClick={() => deletePlatica(p.id, p.title)}
                    disabled={busyId === p.id}
                    className="text-muted-foreground rounded p-1 text-xs hover:text-red-500 disabled:opacity-50"
                    title="Eliminar"
                  >
                    {busyId === p.id ? '…' : '🗑'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
