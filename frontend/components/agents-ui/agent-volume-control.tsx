'use client';

import { type ComponentProps } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAgentVolume } from '@/hooks/agents-ui/use-agent-volume';
import { cn } from '@/lib/shadcn/utils';

export type AgentVolumeControlProps = ComponentProps<'div'>;

/**
 * A volume slider control for adjusting the agent's audio output volume.
 * Supports amplification up to 2x using Web Audio API GainNode.
 * Persists volume preference in localStorage.
 */
export function AgentVolumeControl({ className, ...props }: AgentVolumeControlProps) {
  const { volume, setVolume, maxVolume } = useAgentVolume();
  const isMuted = volume === 0;

  const handleToggleMute = () => {
    setVolume(isMuted ? maxVolume : 0);
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)} {...props}>
      <button
        type="button"
        onClick={handleToggleMute}
        className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
        aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={maxVolume}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className={cn(
          'h-1 w-16 cursor-pointer appearance-none rounded-full md:w-20',
          'bg-muted',
          '[&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0'
        )}
        aria-label="Volumen del agente"
      />
    </div>
  );
}
