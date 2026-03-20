'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { DEFAULT_CONFIGS } from '@/lib/personalities-config';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const CHAT_MOTION_PROPS: MotionProps = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

export interface AgentSessionView_01Props {
  /** Current personality key */
  personality?: string;
  /**
   * Message shown above the controls before the first chat message is sent.
   *
   * @default 'Agent is listening, ask it a question'
   */
  preConnectMessage?: string;
  /**
   * Enables or disables the chat toggle and transcript input controls.
   *
   * @default true
   */
  supportsChatInput?: boolean;
  /**
   * Enables or disables camera controls in the bottom control bar.
   *
   * @default true
   */
  supportsVideoInput?: boolean;
  /**
   * Enables or disables screen sharing controls in the bottom control bar.
   *
   * @default true
   */
  supportsScreenShare?: boolean;
  /**
   * Shows a pre-connect buffer state with a shimmer message before messages appear.
   *
   * @default true
   */
  isPreConnectBufferEnabled?: boolean;

  /** Selects the visualizer style rendered in the main tile area. */
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  /** Primary hex color used by supported audio visualizer variants. */
  audioVisualizerColor?: `#${string}`;
  /** Hue shift intensity used by certain visualizers. */
  audioVisualizerColorShift?: number;
  /** Number of bars to render when `audioVisualizerType` is `bar`. */
  audioVisualizerBarCount?: number;
  /** Number of rows in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridRowCount?: number;
  /** Number of columns in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridColumnCount?: number;
  /** Number of radial bars when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialBarCount?: number;
  /** Base radius of the radial visualizer when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialRadius?: number;
  /** Stroke width of the wave path when `audioVisualizerType` is `wave`. */
  audioVisualizerWaveLineWidth?: number;
  /** Optional class name merged onto the outer `<section>` container. */
  className?: string;
}

const PERSONALITY_SUBTITLE: Record<string, string> = {
  trader: 'Trader',
  trader_bolsa: 'Trader',
  trader_crypto: 'Trader',
  trader_forex: 'Trader',
  trader_dinero: 'Finanzas',
  trader_commodities: 'Trader',
  abogado: 'Abogado',
  abogado_corporativo: 'Abogado',
  abogado_laboral: 'Abogado',
  abogado_fiscal: 'Abogado',
  abogado_penal: 'Abogado',
  abogado_familiar: 'Abogado',
  abogado_inmobiliario: 'Abogado',
  psicologo: 'Psicóloga',
  hippy: 'Conversacion',
  normal: 'Conversacion',
  tesla: 'Personaje Famoso',
  jesus: 'Personaje Famoso',
  aquino: 'Personaje Famoso',
  francisco: 'Personaje Famoso',
  suntzu: 'Personaje Famoso',
  curie: 'Personaje Famoso',
  vangogh: 'Personaje Famoso',
  hipatia: 'Personaje Famoso',
  estoico: 'Guía Espiritual',
  sacerdote: 'Guía Espiritual',
  monje: 'Guía Espiritual',
  imam: 'Guía Espiritual',
  rabino: 'Guía Espiritual',
  pandit: 'Guía Espiritual',
  maestro_ingles: 'Idiomas',
  maestro_frances: 'Idiomas',
  maestro_portugues: 'Idiomas',
  maestro_aleman: 'Idiomas',
  asesor_sistemas: 'Asesor de Sistemas',
  asesor_office: 'Asesor de Sistemas',
  asesor_web: 'Asesor de Sistemas',
  asesor_tecnico: 'Asesor de Sistemas',
  coach_oratoria: 'Instructor',
  instructor_ventas: 'Instructor',
  instructor_entrevistas: 'Instructor',
  instructor_historia: 'Instructor',
  instructor_meditacion: 'Instructor',
  instructor_salud: 'Instructor',
  nutriologo: 'Nutrióloga',
  nutriologo_deportivo: 'Nutrióloga',
  nutriologo_pediatrico: 'Nutrióloga',
  nutriologo_bariatrico: 'Nutrióloga',
};

function getSubtitle(key: string): string {
  if (PERSONALITY_SUBTITLE[key]) return PERSONALITY_SUBTITLE[key];
  if (key.startsWith('custom_')) return 'Personaje';
  return 'Conversacion';
}

function useSessionTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function useMetricsPoller() {
  const [metrics, setMetrics] = useState<{ total_tokens: number; total_cost_usd: number } | null>(
    null
  );
  useEffect(() => {
    const poll = () =>
      fetch('/api/metrics')
        .then((r) => r.json())
        .then(setMetrics)
        .catch(() => {});
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);
  return metrics;
}

export function AgentSessionView_01({
  personality,
  preConnectMessage = 'Escuchando...',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,

  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();
  const timer = useSessionTimer();
  const metrics = useMetricsPoller();

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section
      ref={ref}
      className={cn('bg-background relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      {/* Session header */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 px-4 pt-3">
        <div className="text-center">
          <h2 className="text-foreground text-base leading-tight font-bold drop-shadow-sm">
            {DEFAULT_CONFIGS[personality ?? '']?.name ?? personality ?? 'Conversacion'}
          </h2>
          <p className="text-muted-foreground text-xs">{getSubtitle(personality ?? '')}</p>
        </div>
        <div className="flex items-center gap-3">
          {metrics && metrics.total_tokens > 0 && (
            <div className="border-border bg-background/80 text-muted-foreground rounded-full border px-3 py-1 font-mono text-[10px] backdrop-blur-sm">
              {metrics.total_tokens.toLocaleString()} tok &middot; $
              {metrics.total_cost_usd.toFixed(4)}
            </div>
          )}
          <div className="border-border bg-background/80 text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs tabular-nums backdrop-blur-sm">
            {timer}
          </div>
        </div>
      </div>
      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />
      {/* transcript */}

      <div className="absolute top-0 bottom-[135px] flex w-full flex-col md:bottom-[170px]">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              {...CHAT_MOTION_PROPS}
              className="flex h-full w-full flex-col gap-4 space-y-3 transition-opacity duration-300 ease-out"
            >
              <AgentChatTranscript
                agentState={agentState}
                messages={messages}
                className="mx-auto w-full max-w-2xl [&_.is-user>div]:rounded-[22px] [&>div>div]:px-4 [&>div>div]:pt-40 md:[&>div>div]:px-6"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Tile layout */}
      <TileLayout
        chatOpen={chatOpen}
        audioVisualizerType={audioVisualizerType}
        audioVisualizerColor={audioVisualizerColor}
        audioVisualizerColorShift={audioVisualizerColorShift}
        audioVisualizerBarCount={audioVisualizerBarCount}
        audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
        audioVisualizerRadialRadius={audioVisualizerRadialRadius}
        audioVisualizerGridRowCount={audioVisualizerGridRowCount}
        audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
        audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
      />
      {/* Bottom */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        {isPreConnectBufferEnabled && (
          <AnimatePresence>
            {messages.length === 0 && (
              <MotionMessage
                key="pre-connect-message"
                duration={2}
                aria-hidden={messages.length > 0}
                {...SHIMMER_MOTION_PROPS}
                className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                {preConnectMessage}
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </motion.div>
    </section>
  );
}
