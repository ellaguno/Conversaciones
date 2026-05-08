'use client';

// Vista pública de proyección — pantalla completa, sin chrome. Pensada para
// abrirse en la laptop conectada al cañón. Phase 1 (este archivo) maneja
// navegación manual con teclado para verificar render. Phase 2 conectará al
// LiveKit room y reemplazará el teclado por eventos `slide_change` publicados
// por el agente Tato o por la vista de control.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PlaticaGuion, PlaticaManifest } from '@/lib/platica-schema';

export default function PresentarPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [manifest, setManifest] = useState<PlaticaManifest | null>(null);
  const [guion, setGuion] = useState<PlaticaGuion | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!manifest) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setCurrentSlide((s) => Math.min(manifest.slide_count, s + 1));
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentSlide((s) => Math.max(1, s - 1));
        e.preventDefault();
      } else if (e.key === 'Home') {
        setCurrentSlide(1);
        e.preventDefault();
      } else if (e.key === 'End') {
        setCurrentSlide(manifest.slide_count);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manifest]);

  // Reset image-loaded state when slide changes so the brief flicker is hidden.
  useEffect(() => {
    setImgLoaded(false);
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

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {hasMedia ? (
        <MediaPlaceholder block={block!} />
      ) : (
        <img
          src={`/api/platicas/${id}/slides/${currentSlide}`}
          alt={`Slide ${currentSlide}`}
          className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-150 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />
      )}
      {/* Subtle progress indicator at the bottom; doesn't reveal slide numbers in
          big numerals — only a thin bar so the audience doesn't focus on counting. */}
      <div className="absolute right-0 bottom-0 left-0 h-1 bg-white/5">
        <div
          className="h-full bg-white/30 transition-[width] duration-300"
          style={{ width: `${(currentSlide / manifest.slide_count) * 100}%` }}
        />
      </div>
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
