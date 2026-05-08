'use client';

// Vista de control — para el presentador (Lalo). Muestra slide actual, slide
// siguiente, speaker_notes del bloque actual, cronómetro absoluto y badges de
// estado (EN REPASO / EN PAUSA Q&A). Teclado avanza/retrocede/pausa.
//
// Phase 1: estado local (igual que la pública). Phase 2 cableará: a) publicar
// `slide_change` con `source: 'manual'` al room cuando Lalo navega; b) escuchar
// `slide_change` y `timer_state` del room para reflejar lo que hace Tato.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { GuionBlock, PlaticaGuion, PlaticaManifest } from '@/lib/platica-schema';

type Mode = 'live' | 'repaso' | 'qa_paused';

export default function ControlPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [manifest, setManifest] = useState<PlaticaManifest | null>(null);
  const [guion, setGuion] = useState<PlaticaGuion | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [mode, setMode] = useState<Mode>('live');
  const [repasoOrigin, setRepasoOrigin] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    fetch(`/api/platicas/${id}`, { credentials: 'include' })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        return body;
      })
      .then((data) => {
        setManifest(data.manifest);
        setGuion(data.guion);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  // Wall clock — only ticks while not paused, so the displayed elapsed time
  // matches what the agent sees ("real" plática time).
  useEffect(() => {
    if (mode === 'qa_paused') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [mode]);

  // Poll the agent-written state file. Mirrors current_slide, timer_running,
  // in_repaso so the operator sees what Tato is doing. Local keyboard input
  // still overrides — Phase 2 will publish manual changes back to the room.
  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    let lastUpdatedAt = '';
    let wasActive = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/platicas/${id}/state`, { credentials: 'include' });
        if (!r.ok) return;
        const body = await r.json();
        if (cancelled) return;
        const s = body.state;
        if (s?.active && s.updated_at && s.updated_at !== lastUpdatedAt) {
          lastUpdatedAt = s.updated_at;
          wasActive = true;
          if (typeof s.current_slide === 'number') setCurrentSlide(s.current_slide);
          if (s.in_repaso) {
            setMode('repaso');
            setRepasoOrigin(s.repaso_origin_slide ?? null);
          } else if (s.timer_running === false) {
            setMode((prev) => (prev === 'repaso' ? 'live' : 'qa_paused'));
          } else {
            setMode('live');
            setRepasoOrigin(null);
          }
        } else if (!s?.active && wasActive) {
          // Previous session ended — reset operator view to a clean slate.
          wasActive = false;
          lastUpdatedAt = '';
          setCurrentSlide(1);
          setMode('live');
          setRepasoOrigin(null);
        }
      } catch {
        // Silent retry on next tick.
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, manifest]);

  // Keyboard. Space toggles pause; ←/→ navigate; "r" goes back one slide as
  // a quick-repaso shortcut; Esc cancels repaso/pause.
  useEffect(() => {
    if (!manifest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(manifest.slide_count, s + 1));
        if (mode === 'repaso') {
          setMode('live');
          setRepasoOrigin(null);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(1, s - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setMode((m) => (m === 'qa_paused' ? 'live' : 'qa_paused'));
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (mode !== 'repaso' && currentSlide > 1) {
          setRepasoOrigin(currentSlide);
          setCurrentSlide((s) => Math.max(1, s - 1));
          setMode('repaso');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (mode === 'repaso' && repasoOrigin != null) {
          setCurrentSlide(repasoOrigin);
          setRepasoOrigin(null);
          setMode('live');
        } else if (mode === 'qa_paused') {
          setMode('live');
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlide(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlide(manifest.slide_count);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manifest, mode, currentSlide, repasoOrigin]);

  const block = useMemo<GuionBlock | undefined>(
    () => guion?.blocks.find((b) => b.slide === currentSlide),
    [guion, currentSlide]
  );
  const nextBlock = useMemo<GuionBlock | undefined>(
    () => guion?.blocks.find((b) => b.slide === currentSlide + 1),
    [guion, currentSlide]
  );
  const elapsedSec = Math.floor((now - startedAt) / 1000);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 font-mono text-red-400">
        Error: {error}
      </div>
    );
  }
  if (!manifest || !guion) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 font-mono text-zinc-400">
        Cargando plática…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 grid grid-cols-3 grid-rows-[auto_1fr_auto] gap-3 bg-zinc-950 p-4 font-mono text-sm text-zinc-100">
      {/* Header */}
      <div className="col-span-3 flex items-center justify-between">
        <div className="text-xs tracking-widest text-zinc-400 uppercase">{manifest.title}</div>
        <div className="flex items-center gap-2">
          {mode === 'repaso' && (
            <Badge color="amber">
              EN REPASO desde {repasoOrigin} → {currentSlide}
            </Badge>
          )}
          {mode === 'qa_paused' && <Badge color="cyan">EN PAUSA · Q&amp;A</Badge>}
          {mode === 'live' && <Badge color="green">EN VIVO</Badge>}
          <div className="text-zinc-300 tabular-nums">{formatTime(elapsedSec)}</div>
        </div>
      </div>

      {/* Slide actual (grande) */}
      <div className="col-span-2 row-span-1 flex flex-col gap-2">
        <div className="text-xs text-zinc-500">
          Slide {currentSlide} de {manifest.slide_count}
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md bg-black">
          <img
            key={currentSlide}
            src={`/api/platicas/${id}/slides/${currentSlide}`}
            alt={`Slide ${currentSlide}`}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* Miniatura siguiente + speaker notes */}
      <div className="row-span-1 flex min-h-0 flex-col gap-2">
        <div className="text-xs text-zinc-500">Siguiente</div>
        <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-black">
          {nextBlock ? (
            <img
              src={`/api/platicas/${id}/slides/${currentSlide + 1}`}
              alt={`Slide ${currentSlide + 1}`}
              className="max-h-full max-w-full object-contain opacity-80"
              draggable={false}
            />
          ) : (
            <div className="text-xs text-zinc-600">Fin de la plática</div>
          )}
        </div>
        <div className="mt-2 text-xs text-zinc-500">Notas (slide {currentSlide})</div>
        <div className="flex-1 overflow-y-auto rounded-md bg-zinc-900 p-3 leading-relaxed text-zinc-200">
          {block ? (
            <>
              <div className="mb-2 text-amber-400">{block.summary}</div>
              <div className="whitespace-pre-wrap">{block.speaker_notes}</div>
              {block.talking_points.length > 0 && (
                <ul className="mt-3 list-inside list-disc space-y-1 text-zinc-300">
                  {block.talking_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {block.media && (
                <div className="mt-3 text-xs text-cyan-400">
                  ▶ Reproduce {block.media.type} aquí
                </div>
              )}
            </>
          ) : (
            <div className="text-zinc-500">Sin notas para este slide</div>
          )}
        </div>
      </div>

      {/* Footer con teclas */}
      <div className="col-span-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        <span>
          <kbd className="kb">←</kbd>/<kbd className="kb">→</kbd> navegar
        </span>
        <span>
          <kbd className="kb">Espacio</kbd> pausa Q&amp;A
        </span>
        <span>
          <kbd className="kb">R</kbd> repaso al slide anterior
        </span>
        <span>
          <kbd className="kb">Esc</kbd> cancelar repaso/pausa
        </span>
        <span>
          <kbd className="kb">Home</kbd>/<kbd className="kb">End</kbd> primero/último
        </span>
        <style jsx>{`
          .kb {
            background: #27272a;
            border: 1px solid #3f3f46;
            border-radius: 3px;
            padding: 1px 5px;
            font-family: inherit;
            color: #d4d4d8;
            font-size: 11px;
          }
        `}</style>
      </div>
    </div>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: 'amber' | 'cyan' | 'green';
}) {
  const palette = {
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  }[color];
  return (
    <span className={`rounded border px-2 py-0.5 text-xs tracking-wider uppercase ${palette}`}>
      {children}
    </span>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
