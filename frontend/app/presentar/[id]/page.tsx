'use client';

// Vista pública de proyección — pantalla completa, sin chrome. Pensada para
// abrirse en la laptop conectada al cañón. Phase 1 (este archivo) maneja
// navegación manual con teclado para verificar render. Phase 2 conectará al
// LiveKit room y reemplazará el teclado por eventos `slide_change` publicados
// por el agente Tato o por la vista de control.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PlaticaGuion, PlaticaManifest, SlideTransition } from '@/lib/platica-schema';

// Duración global del cambio de slide. Mantenerlo igual para todos los efectos
// para que el operador pueda comparar A/B sin recalcular timing.
const TRANSITION_MS = 600;

export default function PresentarPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [manifest, setManifest] = useState<PlaticaManifest | null>(null);
  const [guion, setGuion] = useState<PlaticaGuion | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Slide saliente durante la transición. Cuando es null, solo renderizamos el
  // slide actual sin animar. Lo seteamos al cambiar de slide y lo limpiamos
  // cuando termina la animación.
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const prevSlideRef = useRef<number>(1);

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
        // Si el primer slide está oculto, salta al primer slide visible para
        // que la proyección no arranque mostrando un slide marcado para saltar.
        const firstVisible = (data.guion as PlaticaGuion).blocks.find((b) => !b.hidden);
        if (firstVisible) setCurrentSlide(firstVisible.slide);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  // Polling: every 500ms, fetch the agent-written state file. When the agent
  // calls `avanzar_diapositiva`/`repasar_punto`/etc., the state file updates
  // and this view follows. Keyboard navigation below remains as an offline
  // override (e.g. for verifying renders without an active session).
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
          if (typeof s.current_slide === 'number') {
            setCurrentSlide(s.current_slide);
          }
        } else if (!s?.active && wasActive) {
          // Session ended (state file deleted on agent shutdown). Reset to
          // slide 1 so the projection doesn't keep showing the last slide of
          // the previous session.
          wasActive = false;
          lastUpdatedAt = '';
          setCurrentSlide(1);
        }
      } catch {
        // Polling errors are silent — the next tick will retry.
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, manifest]);

  // Keyboard navigation — Phase 1 fallback, useful for testing without an
  // active agent session. Polling above takes precedence when an agent is live.
  // Salta slides marcados como `hidden` para alinearse con lo que el agente
  // narra (que también los filtra).
  useEffect(() => {
    if (!manifest || !guion) return;
    const visible = guion.blocks.filter((b) => !b.hidden).map((b) => b.slide);
    if (visible.length === 0) return;
    const nextVisible = (s: number, dir: 1 | -1) => {
      const sorted = dir === 1 ? visible : [...visible].reverse();
      for (const v of sorted) {
        if ((dir === 1 && v > s) || (dir === -1 && v < s)) return v;
      }
      return s;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setCurrentSlide((s) => nextVisible(s, 1));
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentSlide((s) => nextVisible(s, -1));
        e.preventDefault();
      } else if (e.key === 'Home') {
        setCurrentSlide(visible[0]);
        e.preventDefault();
      } else if (e.key === 'End') {
        setCurrentSlide(visible[visible.length - 1]);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manifest, guion]);

  // Cada vez que cambia currentSlide arrancamos una transición: se renderizan
  // ambos <img> (saliente con clase "leaving" y entrante con "entering"), y al
  // cabo de TRANSITION_MS soltamos el saliente.
  useEffect(() => {
    if (currentSlide === prevSlideRef.current) return;
    const leaving = prevSlideRef.current;
    prevSlideRef.current = currentSlide;
    setPrevSlide(leaving);
    const t = setTimeout(() => setPrevSlide(null), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [currentSlide]);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black font-mono text-lg text-red-400">
        Error: {error}
      </div>
    );
  }
  if (!manifest || !guion) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black font-mono text-white/60">
        Cargando plática…
      </div>
    );
  }

  const block = guion.blocks.find((b) => b.slide === currentSlide);
  const hasMedia = block?.media != null;
  const transition: SlideTransition = manifest.slide_transition ?? 'fade';

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {hasMedia ? (
        <MediaPlaceholder block={block!} />
      ) : (
        <>
          {prevSlide != null && transition !== 'none' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`leave-${prevSlide}`}
              src={`/api/platicas/${id}/slides/${prevSlide}`}
              alt=""
              aria-hidden
              className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-leave-${transition}`}
              draggable={false}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`enter-${currentSlide}`}
            src={`/api/platicas/${id}/slides/${currentSlide}`}
            alt={`Slide ${currentSlide}`}
            className={`absolute inset-0 m-auto max-h-full max-w-full object-contain ${
              transition !== 'none' ? `transition-enter-${transition}` : ''
            }`}
            draggable={false}
          />
        </>
      )}
      {/* Subtle progress indicator at the bottom; doesn't reveal slide numbers in
          big numerals — only a thin bar so the audience doesn't focus on counting. */}
      <div className="absolute right-0 bottom-0 left-0 h-1 bg-white/5">
        <div
          className="h-full bg-white/30 transition-[width] duration-300"
          style={{ width: `${(currentSlide / manifest.slide_count) * 100}%` }}
        />
      </div>
      <style jsx global>{`
        /* Animaciones de cambio de slide. Duración fija (TRANSITION_MS=600ms)
           para que el operador pueda comparar efectos sin re-cronometrar. */
        @keyframes platica-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes platica-fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes platica-slide-left-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes platica-slide-left-out {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }
        @keyframes platica-slide-right-in {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes platica-slide-right-out {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        @keyframes platica-slide-up-in {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes platica-slide-up-out {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-100%);
            opacity: 0;
          }
        }
        @keyframes platica-zoom-in {
          from {
            transform: scale(0.85);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes platica-zoom-out {
          from {
            transform: scale(1);
            opacity: 1;
          }
          to {
            transform: scale(1.15);
            opacity: 0;
          }
        }
        .transition-enter-fade {
          animation: platica-fade-in 600ms ease forwards;
        }
        .transition-leave-fade {
          animation: platica-fade-out 600ms ease forwards;
        }
        .transition-enter-slide_left {
          animation: platica-slide-left-in 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .transition-leave-slide_left {
          animation: platica-slide-left-out 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .transition-enter-slide_right {
          animation: platica-slide-right-in 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .transition-leave-slide_right {
          animation: platica-slide-right-out 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .transition-enter-slide_up {
          animation: platica-slide-up-in 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .transition-leave-slide_up {
          animation: platica-slide-up-out 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .transition-enter-zoom {
          animation: platica-zoom-in 600ms ease-out forwards;
        }
        .transition-leave-zoom {
          animation: platica-zoom-out 600ms ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Phase-2 hook: when block.media is set, render the appropriate player.
// For now we render a clear placeholder so the operator notices media exists.
function MediaPlaceholder({ block }: { block: PlaticaGuion['blocks'][number] }) {
  const m = block.media!;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 font-mono text-white">
      <div className="space-y-2 text-center">
        <div className="text-xs tracking-widest text-white/50 uppercase">Media en este slide</div>
        <div className="text-2xl">
          {m.type === 'youtube' ? `YouTube: ${m.video_id ?? m.url}` : `Audio: ${m.url}`}
        </div>
        <div className="text-sm text-white/50">
          (Reproducción se implementa en una iteración posterior.)
        </div>
      </div>
    </div>
  );
}
