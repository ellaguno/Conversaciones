'use client';

// Listado de pláticas del usuario. Incluye sus propias pláticas y las que
// otros usuarios han marcado como compartidas. Solo el owner ve los controles
// de edición/borrado y el toggle de compartir.
import { useEffect, useState } from 'react';
import { useSession as useAuthSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlaticaListItem } from '@/lib/platica-schema';

export default function PlaticasListPage() {
  const router = useRouter();
  const { data: authSession } = useAuthSession();
  const currentUserId = authSession?.user?.id;
  const [items, setItems] = useState<PlaticaListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    // Abre la proyección en otro tab automáticamente — el flujo "operador
    // + proyección" siempre necesita ambas pantallas. window.open va antes
    // del router.push para que el browser no lo bloquee como popup
    // (estamos dentro del click handler).
    window.open(`/presentar/${id}`, '_blank', 'noopener,noreferrer');
    router.push('/');
  };

  // Toggle de los flags de compartir (`shared` = interno, `public_link` =
  // liga externa). PATCH al manifest, optimista — actualizamos el item
  // localmente y, si falla, refrescamos para reconciliar con el server.
  const toggleShare = async (id: string, patch: { shared?: boolean; public_link?: boolean }) => {
    setShareBusyId(id);
    setItems((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev));
    try {
      const r = await fetch(`/api/platicas/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest: patch }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      await refresh();
    } finally {
      setShareBusyId(null);
    }
  };

  // La liga externa apunta a ?mode=live: el visitante no tiene una segunda
  // pantalla con el operador, necesita slide + audio en la misma página.
  const publicUrl = (id: string) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/presentar/${id}?mode=live`;

  const copyPublicLink = async (id: string) => {
    const url = publicUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // Sin permiso de clipboard (http, Safari viejo): que al menos la vea.
      prompt('Copia la liga:', url);
    }
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
            {items.map((p) => {
              const isOwner = !!currentUserId && p.owner_user_id === currentUserId;
              return (
                // Las pláticas propias apilan título y controles en renglones
                // aparte: con compartir/editar/borrar en la misma línea no
                // quedaba ancho ni para la mitad del nombre. Las compartidas
                // por otros solo traen dos botones, así que a partir de sm
                // caben al lado del título.
                <li
                  key={p.id}
                  className={`border-border bg-card rounded-lg border p-3 ${
                    isOwner ? '' : 'sm:flex sm:items-center sm:justify-between sm:gap-3'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {/* Sin truncate: el nombre completo importa más que la
                        altura de la fila. */}
                      <div className="text-sm font-semibold break-words">{p.title}</div>
                      {!isOwner && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
                          Compartida
                        </span>
                      )}
                      {isOwner && p.shared && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
                          Interna
                        </span>
                      )}
                      {isOwner && p.public_link && (
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-sky-700 uppercase dark:text-sky-300">
                          Liga pública
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {p.slide_count} slides · personalidad <strong>{p.personality_key}</strong> ·
                      avance <strong>{p.advance_mode ?? 'hybrid'}</strong> ·{' '}
                      {new Date(p.created_at).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  <div
                    className={`mt-2.5 flex flex-wrap items-center gap-2 ${
                      isOwner ? '' : 'sm:mt-0 sm:shrink-0'
                    }`}
                  >
                    {/* Pareja "Proyección + Iniciar": la proyección puede abrirse
                      sola desde otro device, pero al picar Iniciar también se
                      abre automáticamente en un tab nuevo — por eso van juntas
                      visualmente como un button group con borde compartido. */}
                    <div className="inline-flex items-stretch overflow-hidden rounded-full border border-amber-600">
                      <Link
                        href={`/presentar/${p.id}`}
                        target="_blank"
                        className="border-r border-amber-600 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-amber-700 uppercase hover:bg-amber-600/10 dark:text-amber-400"
                        title="Solo proyección — útil si vas a abrirla manualmente en otro device"
                      >
                        Proyección
                      </Link>
                      <button
                        onClick={() => startPlatica(p.id, p.personality_key)}
                        className="bg-amber-600 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-white uppercase hover:bg-amber-700"
                        title="Inicia la sesión de chat (operador) Y abre la proyección en otro tab automáticamente"
                      >
                        Iniciar
                      </button>
                    </div>
                    <Link
                      href={`/presentar/${p.id}?mode=live`}
                      target="_blank"
                      className="rounded-full border border-amber-600 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-amber-700 uppercase hover:bg-amber-600/10 dark:text-amber-400"
                      title="Slide + orador en una sola pantalla (audio incluido)"
                    >
                      Todo en uno
                    </Link>
                    {isOwner && (
                      // ml-auto empuja los controles de dueño a la derecha
                      // cuando caben en el mismo renglón; si no, bajan juntos.
                      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                        <label
                          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs select-none"
                          title="Compartir INTERNO: todos los usuarios autenticados de la plataforma podrán ver, iniciar y proyectar esta plática (no editarla)"
                        >
                          <input
                            type="checkbox"
                            checked={p.shared}
                            disabled={shareBusyId === p.id}
                            onChange={(e) => toggleShare(p.id, { shared: e.target.checked })}
                            className="accent-emerald-600"
                          />
                          interno
                        </label>
                        <label
                          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs select-none"
                          title="Compartir EXTERNO: cualquiera con la liga la corre completa (con audio) sin cuenta ni login. Cada visitante consume minutos de tu cuenta."
                        >
                          <input
                            type="checkbox"
                            checked={p.public_link}
                            disabled={shareBusyId === p.id}
                            onChange={(e) => toggleShare(p.id, { public_link: e.target.checked })}
                            className="accent-sky-600"
                          />
                          externo
                        </label>
                        {p.public_link && (
                          <button
                            onClick={() => copyPublicLink(p.id)}
                            className="rounded-full border border-sky-600 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-sky-700 uppercase hover:bg-sky-600/10 dark:text-sky-400"
                            title="Copiar la liga para compartir fuera de la plataforma"
                          >
                            {copiedId === p.id ? '¡copiada!' : 'copiar liga'}
                          </button>
                        )}
                        <Link
                          href={`/platicas/${p.id}/editar`}
                          className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs"
                        >
                          editar
                        </Link>
                        <button
                          onClick={() => deletePlatica(p.id, p.title)}
                          disabled={busyId === p.id}
                          className="text-muted-foreground rounded p-1 text-xs hover:text-red-500 disabled:opacity-50"
                          title="Eliminar"
                        >
                          {busyId === p.id ? '…' : '🗑'}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
