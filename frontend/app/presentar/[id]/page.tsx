'use client';

// Vista de proyección. Dos modos:
//   ?mode=poll (default) — solo lee el state file del agente. No se une a
//     LiveKit, no produce minutos. Usado cuando proyección y operador están
//     en pantallas separadas.
//   ?mode=live — se une al room de LiveKit usando la misma identidad y token
//     que la vista de chat. Reproduce el audio del agente, muestra el
//     visualizador del orador en una esquina configurable, y expone controles
//     mínimos abajo (mute / leave / arrows). Diseñado para escenarios de una
//     sola pantalla.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { TokenSource } from 'livekit-client';
import { useSession, useSessionContext } from '@livekit/components-react';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { PlaticaOverlay } from '@/components/presenter/platica-overlay';
import { PresenterOverlay } from '@/components/presenter/presenter-overlay';
import type {
  OverlayCorner,
  PlaticaGuion,
  PlaticaManifest,
  PresenterVisualizer,
  SlideTransition,
} from '@/lib/platica-schema';

const TRANSITION_MS = 600;

// ¿Hay sesión iniciada? El middleware no responde 401 a las rutas protegidas:
// REDIRIGE al login, y fetch sigue el redirect, así que un `res.ok` a secas
// daría "autenticado" con el HTML del login. Solo cuenta como sesión una
// respuesta directa y parseable como JSON.
async function fetchProfile(): Promise<{ email: string } | null> {
  try {
    const r = await fetch('/api/auth/profile', { credentials: 'include' });
    if (!r.ok || r.redirected) return null;
    const d = await r.json();
    return typeof d?.email === 'string' ? { email: d.email } : null;
  } catch {
    return null;
  }
}

export default function PresentarPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const mode = search.get('mode') === 'live' ? 'live' : 'poll';

  const [manifest, setManifest] = useState<PlaticaManifest | null>(null);
  const [guion, setGuion] = useState<PlaticaGuion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (loadError) {
    return <FullScreenMessage>Error: {loadError}</FullScreenMessage>;
  }
  if (!manifest || !guion) {
    return <FullScreenMessage>Cargando plática…</FullScreenMessage>;
  }

  if (mode === 'live') {
    return <LiveMode id={id} manifest={manifest} guion={guion} />;
  }
  return <PollMode id={id} manifest={manifest} guion={guion} />;
}

// ─── PollMode (comportamiento original) ─────────────────────────────────
function PollMode({
  id,
  manifest,
  guion,
}: {
  id: string;
  manifest: PlaticaManifest;
  guion: PlaticaGuion;
}) {
  const projection = useProjection(id, manifest, guion);
  return <ProjectionView id={id} manifest={manifest} guion={guion} {...projection} />;
}

// ─── LiveMode (nueva: une al room) ──────────────────────────────────────
function LiveMode({
  id,
  manifest,
  guion,
}: {
  id: string;
  manifest: PlaticaManifest;
  guion: PlaticaGuion;
}) {
  const router = useRouter();
  // Advertencia: si el USUARIO ACTUAL ya tiene una sesión activa para esta
  // plática (otra pestaña/device suyos), unirse aquí dispara un segundo
  // dispatch — duplicando minutos. Solo nos importan SUS sesiones, no las
  // de otros usuarios viendo la misma plática compartida (esos corren en
  // rooms aislados). El roomName del usuario vive en localStorage, escrito
  // por el token-fetch de app.tsx o de este mismo componente.
  const [warningState, setWarningState] = useState<'checking' | 'active' | 'ready'>('checking');
  // Visitante externo (liga pública, sin cuenta): no auto-conectamos. Dos
  // razones — cada carga de la página despacharía un agente y consumiría
  // minutos aunque nadie esté viendo, y los navegadores bloquean el audio
  // que arranca sin un gesto del usuario, así que sin este clic el orador
  // se oiría mudo. Con sesión iniciada mantenemos el arranque automático:
  // es el flujo del presentador desde su lista.
  const [authState, setAuthState] = useState<'checking' | 'authed' | 'anon'>('checking');
  const [guestStarted, setGuestStarted] = useState(false);
  useEffect(() => {
    fetchProfile().then((p) => setAuthState(p ? 'authed' : 'anon'));
  }, []);
  useEffect(() => {
    const ownRoom =
      typeof window !== 'undefined' ? window.localStorage.getItem(`platica_session_${id}`) : null;
    if (!ownRoom) {
      setWarningState('ready');
      return;
    }
    fetch(`/api/platicas/${id}/state?session=${encodeURIComponent(ownRoom)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.state?.active) setWarningState('active');
        else setWarningState('ready');
      })
      .catch(() => setWarningState('ready'));
  }, [id]);

  if (warningState === 'checking' || authState === 'checking') {
    return <FullScreenMessage>Verificando sesiones activas…</FullScreenMessage>;
  }
  if (warningState === 'active') {
    return (
      <FullScreenMessage>
        <div className="space-y-4 text-center">
          <div className="text-xl font-semibold">Ya hay una plática activa</div>
          <div className="max-w-md text-sm text-white/70">
            Si continúas, se iniciará una segunda sesión paralela y se cobrarán minutos extra.
            Cierra primero la otra pestaña/dispositivo si no es lo que quieres.
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/platicas')}
              className="rounded-full border border-white/30 px-4 py-1.5 text-xs hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setWarningState('ready')}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-white/90"
            >
              Continuar de todos modos
            </button>
          </div>
        </div>
      </FullScreenMessage>
    );
  }
  if (authState === 'anon' && !guestStarted) {
    return (
      <FullScreenMessage>
        <div className="max-w-md space-y-4 text-center">
          <div className="text-2xl font-semibold">{manifest.title}</div>
          <div className="text-sm text-white/70">
            {manifest.presenter_name
              ? `${manifest.presenter_name} te va a presentar esta plática en voz alta. `
              : 'Un orador te va a presentar esta plática en voz alta. '}
            Sube el volumen y, si quieres preguntar algo, permite el micrófono cuando el navegador
            te lo pida.
          </div>
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setGuestStarted(true)}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black hover:bg-white/90"
            >
              Comenzar plática
            </button>
          </div>
        </div>
      </FullScreenMessage>
    );
  }
  return <LiveModeConnected id={id} manifest={manifest} guion={guion} />;
}

function LiveModeConnected({
  id,
  manifest,
  guion,
}: {
  id: string;
  manifest: PlaticaManifest;
  guion: PlaticaGuion;
}) {
  // Token y sesión, mismo patrón que app.tsx pero pidiendo solo lo necesario
  // para una plática. personality_key = 'custom' funciona — el agente usa el
  // presenter_persona del manifest como prompt base.
  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personality: manifest.personality_key || 'custom',
          platicaId: id,
          ...(manifest.voice_id && { voiceId: manifest.voice_id }),
          ...(typeof manifest.speed === 'number' && { speed: manifest.speed }),
          ...(manifest.model && { model: manifest.model }),
        }),
      });
      if (!res.ok) throw new Error(`Token error: ${res.status}`);
      const data = await res.json();
      // Persistir el roomName de esta sesión: el warning de mode=live, otra
      // pestaña con la proyección abierta, etc. lo necesitan para leer su
      // state file específico (`_state_<roomName>.json`) y no el de otra
      // sesión paralela del mismo platica id.
      if (data?.roomName && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`platica_session_${id}`, data.roomName);
          // El evento 'storage' solo se dispara entre pestañas — para que
          // useProjection en ESTA pestaña reaccione al roomName recién
          // creado, emitimos un CustomEvent local. Sin esto, el polling
          // arranca con el roomName viejo de localStorage y se queda leyendo
          // un state file que ya no existe.
          window.dispatchEvent(
            new CustomEvent('platica-session-set', {
              detail: { id, roomName: data.roomName },
            })
          );
        } catch {
          // noop
        }
      }
      return data;
    });
  }, [id, manifest.personality_key, manifest.voice_id, manifest.model]);

  const session = useSession(tokenSource);

  // Auto-conectar al montar la vista.
  useEffect(() => {
    session.start?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hoisted al nivel del Provider para poder mutear el RoomAudioRenderer
  // cuando estamos en un slide con video — Phase 1 del soporte de YouTube.
  // El agente sigue corriendo (sigue "pensando" su narración), pero el
  // usuario solo escucha al video. Cuando el slide cambia a uno sin media,
  // el audio del agente regresa.
  const projection = useProjection(id, manifest, guion);
  const currentBlock = guion.blocks.find((b) => b.slide === projection.currentSlide);
  const isMediaSlide = !!currentBlock?.media;

  // Velocidad del orador. El valor inicial viene del manifest (configurable en
  // el editor); los cambios se mandan por LiveKit data channel al agente, que
  // llama tts.update_options(speed=...) sobre Cartesia. NO se puede hacer
  // client-side: el audio remoto llega como MediaStream en vivo (srcObject) y
  // <audio>.playbackRate sobre eso es no-op en todos los navegadores.
  const [audioSpeed, setAudioSpeed] = useState<number>(manifest.speed ?? 1.0);

  return (
    <AgentSessionProvider session={session} muted={isMediaSlide}>
      <LiveProjection
        id={id}
        manifest={manifest}
        guion={guion}
        projection={projection}
        audioSpeed={audioSpeed}
        setAudioSpeed={setAudioSpeed}
      />
    </AgentSessionProvider>
  );
}

function LiveProjection({
  id,
  manifest,
  guion,
  projection,
  audioSpeed,
  setAudioSpeed,
}: {
  id: string;
  manifest: PlaticaManifest;
  guion: PlaticaGuion;
  projection: ReturnType<typeof useProjection>;
  audioSpeed: number;
  setAudioSpeed: (v: number) => void;
}) {
  const router = useRouter();
  // useSessionContext expone `end()` desde el SessionProvider que mete
  // AgentSessionProvider — mismo patrón que AgentDisconnectButton.
  const sessionCtx = useSessionContext();

  // Flujo de salida: en vez de navegar de vuelta directo, ofrecemos enviar
  // la transcripción por correo. El agente la deja escrita en disco al
  // desconectar; /api/platicas/[id]/transcript la recoge de la carpeta
  // `platica_<id>` del usuario (o del invitado, si entró por liga externa).
  const [leaveStage, setLeaveStage] = useState<'live' | 'asking' | 'sending' | 'sent' | 'failed'>(
    'live'
  );
  const [emailInput, setEmailInput] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // Marca de arranque de la sesión: el endpoint la usa para no mandar la
  // transcripción de una corrida anterior cuando ésta no dejó nada escrito.
  const startedAtRef = useRef<number>(Date.now());

  // Prellena con el correo del perfil. 401 (visitante por liga externa) deja
  // el campo vacío para que escriba el suyo.
  useEffect(() => {
    fetchProfile().then((p) => {
      if (!p) return;
      setIsAuthed(true);
      if (p.email) setEmailInput(p.email);
    });
  }, []);

  const handleLeave = () => {
    try {
      sessionCtx?.end?.();
    } catch {
      // best-effort — si ya está desconectado, ignoramos
    }
    setLeaveStage('asking');
  };

  const handleSend = async () => {
    const email = emailInput.trim();
    if (!email.includes('@')) return;
    setLeaveStage('sending');
    setSendError(null);
    try {
      const res = await fetch(`/api/platicas/${id}/transcript`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notBefore: startedAtRef.current }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setSentTo(body?.sentTo || email);
      setLeaveStage('sent');
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Error al enviar');
      setLeaveStage('failed');
    }
  };

  // El visitante externo no tiene acceso a /platicas (lo mandaría al login);
  // para él "cerrar" es volver a la portada de la propia plática.
  const handleClose = () => {
    if (isAuthed) router.push('/platicas');
    else window.location.href = `/presentar/${id}`;
  };

  return (
    <>
      <ProjectionView id={id} manifest={manifest} guion={guion} {...projection} />
      <PresenterOverlay
        corner={(manifest.presenter_overlay_corner as OverlayCorner) ?? 'top-right'}
        visualizer={(manifest.presenter_visualizer as PresenterVisualizer) ?? 'aura'}
      />
      <PlaticaOverlay
        platicaId={id}
        manifest={manifest}
        guion={guion}
        audioSpeed={audioSpeed}
        setAudioSpeed={setAudioSpeed}
        currentSlide={projection.currentSlide}
        onLeave={handleLeave}
      />
      {leaveStage !== 'live' && (
        <LeaveTranscriptDialog
          stage={leaveStage}
          email={emailInput}
          onEmailChange={setEmailInput}
          sentTo={sentTo}
          errorMsg={sendError}
          onSend={handleSend}
          onSkip={handleClose}
          onClose={handleClose}
          onRetry={handleSend}
        />
      )}
    </>
  );
}

function LeaveTranscriptDialog({
  stage,
  email,
  onEmailChange,
  sentTo,
  errorMsg,
  onSend,
  onSkip,
  onClose,
  onRetry,
}: {
  stage: 'asking' | 'sending' | 'sent' | 'failed';
  email: string;
  onEmailChange: (v: string) => void;
  sentTo: string | null;
  errorMsg: string | null;
  onSend: () => void;
  onSkip: () => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const emailOk = email.trim().includes('@');
  return (
    <FullScreenMessage>
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="text-xl font-semibold">Plática terminada</div>
        {stage === 'asking' && (
          <>
            <div className="text-sm text-white/70">¿A qué correo te mandamos la transcripción?</div>
            {/* Un solo campo para todos los casos: viene prellenado con el
              correo del perfil si hay sesión, y vacío para quien entró por
              liga externa. Editable siempre — el presentador a veces quiere
              mandársela a otra dirección. */}
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailOk) onSend();
              }}
              placeholder="tu@correo.com"
              autoFocus
              className="w-full rounded-full border border-white/30 bg-white/10 px-4 py-2 text-center text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
            />
            <div className="flex justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={onSkip}
                className="rounded-full border border-white/30 px-4 py-1.5 text-xs hover:bg-white/10"
              >
                No, gracias
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={!emailOk}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-white/90 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </>
        )}
        {stage === 'sending' && (
          <div className="text-sm text-white/70">Enviando transcripción…</div>
        )}
        {stage === 'sent' && (
          <>
            <div className="text-sm text-white/70">
              Transcripción enviada{sentTo ? ` a ${sentTo}` : ''}.
            </div>
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-white/90"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
        {stage === 'failed' && (
          <>
            <div className="text-sm text-red-300">
              No se pudo enviar: {errorMsg || 'error desconocido'}
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/30 px-4 py-1.5 text-xs hover:bg-white/10"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-white/90"
              >
                Reintentar
              </button>
            </div>
          </>
        )}
      </div>
    </FullScreenMessage>
  );
}

// ─── Hook compartido: estado del slide actual + polling + transición ──────
function useProjection(id: string, manifest: PlaticaManifest, guion: PlaticaGuion) {
  const [currentSlide, setCurrentSlide] = useState<number>(() => {
    const firstVisible = guion.blocks.find((b) => !b.hidden);
    return firstVisible?.slide ?? 1;
  });
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const prevSlideRef = useRef<number>(currentSlide);

  // Session-aware polling: si conocemos el roomName de la sesión propia (lo
  // escribió el operador en localStorage al despachar el agente), usamos
  // ?session=<roomName> para no leer el state file de otra sesión paralela.
  // Si no lo conocemos (ej. invitado en plática compartida), el endpoint
  // elige el `_state_*.json` más reciente.
  const [sessionRoom, setSessionRoom] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(`platica_session_${id}`);
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `platica_session_${id}`;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setSessionRoom(e.newValue);
    };
    // 'storage' solo se dispara entre pestañas; el CustomEvent lo emite el
    // tokenSource al recibir un roomName fresco en ESTA pestaña.
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; roomName: string }>).detail;
      if (detail?.id !== id) return;
      setSessionRoom(detail.roomName);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('platica-session-set', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('platica-session-set', onLocal);
    };
  }, [id]);

  // Polling del state file del agente.
  useEffect(() => {
    let cancelled = false;
    let lastUpdatedAt = '';
    let wasActive = false;
    const stateUrl = sessionRoom
      ? `/api/platicas/${id}/state?session=${encodeURIComponent(sessionRoom)}`
      : `/api/platicas/${id}/state`;
    const tick = async () => {
      try {
        const r = await fetch(stateUrl, { credentials: 'include' });
        if (!r.ok) return;
        const body = await r.json();
        if (cancelled) return;
        const s = body.state;
        if (s?.active && s.updated_at && s.updated_at !== lastUpdatedAt) {
          lastUpdatedAt = s.updated_at;
          wasActive = true;
          if (typeof s.current_slide === 'number') setCurrentSlide(s.current_slide);
        } else if (!s?.active && wasActive) {
          wasActive = false;
          lastUpdatedAt = '';
          const firstVisible = guion.blocks.find((b) => !b.hidden);
          setCurrentSlide(firstVisible?.slide ?? 1);
        }
      } catch {
        // silent retry next tick
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, guion, sessionRoom]);

  // Animación de transición entre slides.
  useEffect(() => {
    if (currentSlide === prevSlideRef.current) return;
    const leaving = prevSlideRef.current;
    prevSlideRef.current = currentSlide;
    setPrevSlide(leaving);
    const t = setTimeout(() => setPrevSlide(null), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [currentSlide]);

  // Helpers de navegación manual (saltan ocultos).
  const visible = useMemo(() => guion.blocks.filter((b) => !b.hidden).map((b) => b.slide), [guion]);
  const navigateNext = useCallback(() => {
    if (visible.length === 0) return;
    setCurrentSlide((s) => {
      for (const v of visible) if (v > s) return v;
      return s;
    });
  }, [visible]);
  const navigatePrev = useCallback(() => {
    if (visible.length === 0) return;
    setCurrentSlide((s) => {
      for (let i = visible.length - 1; i >= 0; i--) if (visible[i] < s) return visible[i];
      return s;
    });
  }, [visible]);

  // Keyboard nav DESHABILITADO en useProjection — antes mutaba currentSlide
  // local, pero como el polling reescribe el state del agente cada 500ms el
  // efecto era "presionas → cambia → polling regresa". En live mode el
  // PlaticaOverlay registra su propio handler que sí publica al agente
  // (mismo path que los botones), garantizando consistencia entre UI y agente.

  return { currentSlide, prevSlide, navigateNext, navigatePrev };
}

// ─── ProjectionView: render del slide y transiciones ──────────────────────
function ProjectionView({
  id,
  manifest,
  guion,
  currentSlide,
  prevSlide,
}: {
  id: string;
  manifest: PlaticaManifest;
  guion: PlaticaGuion;
  currentSlide: number;
  prevSlide: number | null;
  navigateNext: () => void;
  navigatePrev: () => void;
}) {
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
      <div className="absolute right-0 bottom-0 left-0 h-1 bg-white/5">
        <div
          className="h-full bg-white/30 transition-[width] duration-300"
          style={{ width: `${(currentSlide / manifest.slide_count) * 100}%` }}
        />
      </div>
      <SlideTransitionStyles />
    </div>
  );
}

// ─── Helpers / pieces sin lógica ─────────────────────────────────────────
function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black font-mono text-white/80">
      {children}
    </div>
  );
}

// Player real para slides con media. YouTube hoy; audio queda como placeholder
// hasta que lo necesitemos. El iframe se remonta en cada cambio de slide
// (`key={block.slide}-{video_id}`) para que el video reinicie limpio si el
// usuario regresa al mismo slide.
function MediaPlaceholder({ block }: { block: PlaticaGuion['blocks'][number] }) {
  const m = block.media!;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Autoplay workaround: el `autoplay=1` del URL es ignorado por el browser
  // cuando un tab nuevo no tiene "user activation" (window.open desde otro
  // tab no la propaga). Con `enablejsapi=1` podemos mandar `playVideo` por
  // postMessage; lo intentamos varias veces porque el iframe tarda en cargar.
  // Si la policy bloquea aun así (no hay interacción local), el video se queda
  // pausado pero el usuario puede darle click directamente.
  useEffect(() => {
    if (m.type !== 'youtube' || !m.video_id) return;
    const send = () => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        'https://www.youtube.com'
      );
    };
    const timers = [400, 900, 1800, 3500].map((d) => setTimeout(send, d));
    return () => timers.forEach(clearTimeout);
  }, [m.type, m.video_id]);

  if (m.type === 'youtube' && m.video_id) {
    const params = new URLSearchParams({
      autoplay: m.autoplay !== false ? '1' : '0',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
    });
    if (m.start_sec) params.set('start', String(m.start_sec));
    if (m.end_sec) params.set('end', String(m.end_sec));
    const src = `https://www.youtube.com/embed/${m.video_id}?${params.toString()}`;
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="aspect-video h-full max-h-full w-full max-w-full">
          <iframe
            ref={iframeRef}
            key={`${block.slide}-${m.video_id}`}
            src={src}
            title={`Video del slide ${block.slide}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      </div>
    );
  }
  // Audio (no implementado) o media inválido: caemos a placeholder informativo.
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 font-mono text-white">
      <div className="space-y-2 text-center">
        <div className="text-xs tracking-widest text-white/50 uppercase">Media en este slide</div>
        <div className="text-2xl">{m.type === 'audio' ? `Audio: ${m.url}` : 'Media inválido'}</div>
        <div className="text-sm text-white/50">(Solo YouTube está soportado por ahora.)</div>
      </div>
    </div>
  );
}

function SlideTransitionStyles() {
  return (
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
  );
}
