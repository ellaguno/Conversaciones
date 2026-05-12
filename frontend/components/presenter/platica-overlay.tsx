'use client';

// Overlay con controles + estado para una plática en curso (modo live OR main
// app session). Se monta DENTRO de un AgentSessionProvider — necesita
// useLocalParticipant y useSessionContext.
//
// Responsabilidades:
//  - Estado local de mano levantada / Q&A abierta / final Q&A
//  - Auto-mute del mic en audience_mode='silent' (con re-enforcer en
//    LocalTrackPublished para vencer la carrera con el auto-publish de LiveKit)
//  - Listener del data channel para qa_window_start/end + final_qa_start
//  - Publicar advance/goto/hand_raised/speed por data channel topic 'control'
//  - Polling de current_slide vía /api/platicas/[id]/state (si no se provee
//    externamente) — necesario en el main app donde no hay useProjection
//
// Render:
//  - BottomControls (◀ ▶ 🎤 ✋ ⏱ ✕)
//  - HandRaisedOverlay (✋ animada en esquina) cuando la mano está arriba
//  - QaWindowBadge (pill verde arriba) durante Q&A
import { useCallback, useEffect, useRef, useState } from 'react';
import { ParticipantEvent, RoomEvent } from 'livekit-client';
import { useLocalParticipant, useSessionContext } from '@livekit/components-react';
import type { PlaticaGuion, PlaticaManifest } from '@/lib/platica-schema';

interface PlaticaOverlayProps {
  platicaId: string;
  manifest: PlaticaManifest;
  guion: PlaticaGuion;
  audioSpeed: number;
  setAudioSpeed: (v: number) => void;
  /** Si se provee (ej. el caller ya está pollando), se usa como verdad. Si no,
   *  el overlay pollea /api/platicas/[id]/state cada 500ms. */
  currentSlide?: number;
  /** Si se provee, el botón ✕ aparece y dispara este callback. Si no, no se
   *  renderiza (el caller probablemente tiene su propio botón de salir). */
  onLeave?: () => void;
}

export function PlaticaOverlay({
  platicaId,
  manifest,
  guion,
  audioSpeed,
  setAudioSpeed,
  currentSlide: externalSlide,
  onLeave,
}: PlaticaOverlayProps) {
  const sessionCtx = useSessionContext();
  const { localParticipant } = useLocalParticipant();

  const audienceMode = manifest.audience_mode ?? 'open';
  const [handRaisedSlide, setHandRaisedSlide] = useState<number | null>(null);
  const [qaWindowOpen, setQaWindowOpen] = useState(false);
  const [finalQa, setFinalQa] = useState(false);

  // Slide actual: si el caller lo provee usamos ese; si no, pollamos.
  const polledSlide = usePolledCurrentSlide(platicaId, externalSlide === undefined);
  const currentSlide = externalSlide ?? polledSlide;

  const publishControl = useCallback(
    (payload: object) => {
      if (!localParticipant) return;
      try {
        const data = new TextEncoder().encode(JSON.stringify(payload));
        void localParticipant.publishData(data, { reliable: true, topic: 'control' });
      } catch {
        // noop
      }
    },
    [localParticipant]
  );

  // Próximo / anterior slide visible (saltando hidden).
  const visibleSlides = guion.blocks.filter((b) => !b.hidden).map((b) => b.slide);

  const requestAdvance = useCallback(() => {
    setHandRaisedSlide(null);
    publishControl({ type: 'advance' });
  }, [publishControl]);
  const requestPrev = useCallback(() => {
    setHandRaisedSlide(null);
    let target: number | null = null;
    for (let i = visibleSlides.length - 1; i >= 0; i--) {
      if (visibleSlides[i] < currentSlide) {
        target = visibleSlides[i];
        break;
      }
    }
    if (target !== null) publishControl({ type: 'goto', slide: target });
  }, [publishControl, currentSlide, visibleSlides]);
  const requestRaiseHand = useCallback(() => {
    setHandRaisedSlide(currentSlide);
    publishControl({ type: 'hand_raised', slide: currentSlide });
  }, [publishControl, currentSlide]);

  // Eventos del agente.
  useEffect(() => {
    const room = sessionCtx?.room;
    if (!room) return;
    const handler = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as { type?: string };
        if (msg.type === 'qa_window_start') setQaWindowOpen(true);
        else if (msg.type === 'qa_window_end') {
          setQaWindowOpen(false);
          setHandRaisedSlide(null);
        } else if (msg.type === 'final_qa_start') {
          setFinalQa(true);
          setQaWindowOpen(true);
        }
      } catch {
        // not for us
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [sessionCtx?.room]);

  // Mano levantada cuelga si el slide cambió antes de que se procesara.
  useEffect(() => {
    if (handRaisedSlide !== null && handRaisedSlide !== currentSlide) {
      setHandRaisedSlide(null);
    }
  }, [currentSlide, handRaisedSlide]);

  // Mic auto-state en silent mode. Re-enforce en LocalTrackPublished para
  // vencer la carrera con el auto-publish del mic al conectar la sesión.
  // NO escuchamos TrackUnmuted: el usuario sí puede unmutearse manualmente
  // desde el botón 🎤 para interrumpir.
  useEffect(() => {
    if (audienceMode !== 'silent') return;
    if (!localParticipant) return;
    const shouldUnmute = qaWindowOpen || finalQa;
    const enforce = () => {
      const currentlyEnabled = !!localParticipant.isMicrophoneEnabled;
      if (currentlyEnabled !== shouldUnmute) {
        void localParticipant.setMicrophoneEnabled(shouldUnmute);
      }
    };
    enforce();
    localParticipant.on(ParticipantEvent.LocalTrackPublished, enforce);
    return () => {
      localParticipant.off(ParticipantEvent.LocalTrackPublished, enforce);
    };
  }, [audienceMode, qaWindowOpen, finalQa, localParticipant]);

  return (
    <>
      <BottomControls
        onLeave={onLeave}
        onPrev={requestPrev}
        onNext={requestAdvance}
        onRaiseHand={requestRaiseHand}
        speed={audioSpeed}
        onSpeedChange={setAudioSpeed}
        audienceMode={audienceMode}
        handRaised={handRaisedSlide === currentSlide}
        qaOpen={qaWindowOpen}
      />
      {handRaisedSlide === currentSlide && !qaWindowOpen && <HandRaisedOverlay />}
      {qaWindowOpen && <QaWindowBadge isFinal={finalQa} />}
    </>
  );
}

// ─── Polling de currentSlide ────────────────────────────────────────────
// Lee el state file del agente vía /api/platicas/[id]/state. El roomName se
// lee de localStorage cada tick para no depender de eventos del browser.

function usePolledCurrentSlide(platicaId: string, enabled: boolean): number {
  const [slide, setSlide] = useState(1);
  useEffect(() => {
    if (!enabled || !platicaId) return;
    let cancelled = false;
    let lastUpdatedAt = '';
    const tick = async () => {
      try {
        const sessionRoom =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(`platica_session_${platicaId}`)
            : null;
        const url = sessionRoom
          ? `/api/platicas/${platicaId}/state?session=${encodeURIComponent(sessionRoom)}`
          : `/api/platicas/${platicaId}/state`;
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) return;
        const body = await r.json();
        if (cancelled) return;
        const s = body.state;
        if (s?.active && s.updated_at && s.updated_at !== lastUpdatedAt) {
          lastUpdatedAt = s.updated_at;
          if (typeof s.current_slide === 'number') setSlide(s.current_slide);
        }
      } catch {
        // silent retry
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [platicaId, enabled]);
  return slide;
}

// ─── Subcomponentes de UI ────────────────────────────────────────────────

function BottomControls({
  onLeave,
  onPrev,
  onNext,
  onRaiseHand,
  speed,
  onSpeedChange,
  audienceMode,
  handRaised,
  qaOpen,
}: {
  onLeave?: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRaiseHand: () => void;
  speed: number;
  onSpeedChange: (v: number) => void;
  audienceMode: 'open' | 'silent';
  handRaised: boolean;
  qaOpen: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const micEnabled = isMicrophoneEnabled;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 3000);
    };
    reset();
    window.addEventListener('mousemove', reset);
    window.addEventListener('touchstart', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('touchstart', reset);
    };
  }, []);

  // Debounce de speed slider — un solo publishData 150ms después del último
  // cambio, evitando flood durante drag.
  const speedSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendSpeed = useCallback(
    (value: number) => {
      onSpeedChange(value);
      if (!localParticipant) return;
      if (speedSendTimer.current) clearTimeout(speedSendTimer.current);
      speedSendTimer.current = setTimeout(() => {
        try {
          const payload = new TextEncoder().encode(JSON.stringify({ type: 'speed', value }));
          void localParticipant.publishData(payload, { reliable: true, topic: 'control' });
        } catch {
          // noop
        }
      }, 150);
    },
    [localParticipant, onSpeedChange]
  );

  return (
    <div
      className={`fixed inset-x-0 bottom-3 z-40 flex justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1.5 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md">
        <button
          type="button"
          onClick={onPrev}
          title="Slide anterior"
          aria-label="Slide anterior"
          className="rounded-full px-2.5 py-1 text-sm hover:bg-white/10"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={onNext}
          title="Slide siguiente"
          aria-label="Slide siguiente"
          className="rounded-full px-2.5 py-1 text-sm hover:bg-white/10"
        >
          ▶
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          type="button"
          onClick={() => localParticipant?.setMicrophoneEnabled(!micEnabled)}
          title={micEnabled ? 'Mutear micrófono' : 'Activar micrófono'}
          aria-label="Mute mic"
          className="rounded-full px-2.5 py-1 text-sm hover:bg-white/10"
        >
          {micEnabled ? '🎤' : '🔇'}
        </button>
        {audienceMode === 'silent' && (
          <>
            <div className="mx-1 h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={onRaiseHand}
              disabled={handRaised || qaOpen}
              title={
                qaOpen
                  ? 'Q&A abierta — habla ahora'
                  : handRaised
                    ? 'Mano levantada — esperando fin de lámina'
                    : 'Levantar la mano para preguntar al final de esta lámina'
              }
              aria-label="Levantar la mano"
              className={`rounded-full px-2.5 py-1 text-sm transition ${
                handRaised || qaOpen ? 'bg-amber-500/30 text-amber-200' : 'hover:bg-white/10'
              } disabled:cursor-default`}
            >
              ✋
            </button>
          </>
        )}
        <div className="mx-1 h-4 w-px bg-white/20" />
        <div
          className="flex items-center gap-1.5 px-1.5"
          title="Velocidad del orador"
          aria-label="Velocidad del orador"
        >
          <span className="text-xs">⏱</span>
          <input
            type="range"
            min={0.6}
            max={2.0}
            step={0.05}
            value={speed}
            onChange={(e) => sendSpeed(parseFloat(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-amber-500"
          />
          <span className="font-mono text-[10px] text-white/60 tabular-nums">
            {speed.toFixed(2)}x
          </span>
        </div>
        {onLeave && (
          <>
            <div className="mx-1 h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={onLeave}
              title="Salir de la plática"
              aria-label="Salir"
              className="rounded-full px-2.5 py-1 text-sm hover:bg-red-500/40"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function HandRaisedOverlay() {
  return (
    <div
      className="pointer-events-none fixed right-6 bottom-20 z-30 text-7xl drop-shadow-lg select-none"
      style={{ animation: 'hand-wave 1.6s ease-in-out infinite' }}
      aria-label="Mano levantada"
      role="img"
    >
      ✋
      <style jsx>{`
        @keyframes hand-wave {
          0%,
          100% {
            transform: rotate(-8deg);
            opacity: 0.7;
          }
          50% {
            transform: rotate(8deg);
            opacity: 0.95;
          }
        }
      `}</style>
    </div>
  );
}

function QaWindowBadge({ isFinal }: { isFinal: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center">
      <div className="flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
        <span className="text-base">🎤</span>
        {isFinal ? 'Q&A abierta — haz tu pregunta' : 'Ventana de preguntas — habla ahora'}
      </div>
    </div>
  );
}
