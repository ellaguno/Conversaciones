'use client';

// Visualizador del agente sobre el slide en /presentar/[id]?mode=live.
// Reusa los visualizadores existentes (`aura`, `wave`, `bar`, `grid`, `radial`)
// pero a tamaño compacto (~120px) y con posición configurable por esquina.
import { useVoiceAssistant } from '@livekit/components-react';
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import { AgentAudioVisualizerBar } from '@/components/agents-ui/agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from '@/components/agents-ui/agent-audio-visualizer-grid';
import { AgentAudioVisualizerRadial } from '@/components/agents-ui/agent-audio-visualizer-radial';
import { AgentAudioVisualizerWave } from '@/components/agents-ui/agent-audio-visualizer-wave';
import type { OverlayCorner, PresenterVisualizer } from '@/lib/platica-schema';

const CORNER_CLASSES: Record<OverlayCorner, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-8 left-4',
  'bottom-right': 'bottom-8 right-4',
};

export function PresenterOverlay({
  corner = 'top-right',
  visualizer = 'aura',
}: {
  corner?: OverlayCorner;
  visualizer?: PresenterVisualizer;
}) {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div
      className={`pointer-events-none absolute z-30 ${CORNER_CLASSES[corner]} rounded-2xl bg-black/30 p-2 ring-1 ring-white/10 backdrop-blur-md`}
    >
      {visualizer === 'aura' && (
        // Aura es shader-based y rinde feo a tamaños chicos: damos un cuadro
        // razonable de 120x120 con ring sutil para que se vea como "halo del orador".
        <AgentAudioVisualizerAura
          size="md"
          state={state}
          audioTrack={audioTrack}
          className="size-[120px]"
        />
      )}
      {visualizer === 'wave' && (
        <AgentAudioVisualizerWave state={state} audioTrack={audioTrack} className="size-[120px]" />
      )}
      {visualizer === 'bar' && (
        <AgentAudioVisualizerBar
          size="md"
          state={state}
          audioTrack={audioTrack}
          barCount={5}
          className="h-[60px] w-[120px]"
        />
      )}
      {visualizer === 'grid' && (
        <AgentAudioVisualizerGrid
          size="sm"
          state={state}
          audioTrack={audioTrack}
          rowCount={8}
          columnCount={8}
          className="size-[120px]"
        />
      )}
      {visualizer === 'radial' && (
        <AgentAudioVisualizerRadial
          state={state}
          audioTrack={audioTrack}
          barCount={20}
          radius={40}
          className="size-[120px]"
        />
      )}
    </div>
  );
}
