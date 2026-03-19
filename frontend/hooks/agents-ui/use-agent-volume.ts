'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const VOLUME_STORAGE_KEY = 'agent-volume';
const DEFAULT_VOLUME = 2.0;
const MAX_VOLUME = 2.0;

function loadStoredVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (stored !== null) {
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= MAX_VOLUME) return parsed;
  }
  return DEFAULT_VOLUME;
}

interface GainEntry {
  gainNode: GainNode;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
}

/**
 * Hook that applies Web Audio API gain to all remote audio elements
 * rendered by LiveKit's RoomAudioRenderer, allowing amplification
 * beyond the normal 1.0 volume limit (up to 2x).
 *
 * Uses MutationObserver to detect new <audio> elements as they appear.
 */
export function useAgentVolume() {
  const [volume, setVolumeState] = useState(loadStoredVolume);
  const gainMapRef = useRef<Map<HTMLAudioElement, GainEntry>>(new Map());
  const volumeRef = useRef(volume);

  volumeRef.current = volume;

  const setVolume = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(MAX_VOLUME, newVolume));
    setVolumeState(clamped);
    localStorage.setItem(VOLUME_STORAGE_KEY, clamped.toString());
  }, []);

  const processAudioElement = useCallback((audioEl: HTMLAudioElement) => {
    if (gainMapRef.current.has(audioEl)) return;
    // Only process elements with a MediaStream source (LiveKit audio)
    const stream = audioEl.srcObject;
    if (!(stream instanceof MediaStream)) return;

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = volumeRef.current;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      // Mute original element to prevent double playback
      audioEl.volume = 0;
      gainMapRef.current.set(audioEl, { gainNode, context: ctx, source });
    } catch (err) {
      console.warn('[useAgentVolume] Failed to create gain node:', err);
    }
  }, []);

  // Watch for new audio elements
  useEffect(() => {
    // Process any existing audio elements
    document.querySelectorAll('audio').forEach(processAudioElement);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLAudioElement) {
            // Small delay to ensure srcObject is assigned
            setTimeout(() => processAudioElement(node), 100);
          }
          // Also check children
          if (node instanceof HTMLElement) {
            node.querySelectorAll('audio').forEach((el) => {
              setTimeout(() => processAudioElement(el), 100);
            });
          }
        }
        // Clean up removed audio elements
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLAudioElement) {
            const entry = gainMapRef.current.get(node);
            if (entry) {
              entry.context.close();
              gainMapRef.current.delete(node);
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      for (const { context } of gainMapRef.current.values()) {
        context.close();
      }
      gainMapRef.current.clear();
    };
  }, [processAudioElement]);

  // Update all gain nodes when volume changes
  useEffect(() => {
    for (const { gainNode } of gainMapRef.current.values()) {
      gainNode.gain.value = volume;
    }
  }, [volume]);

  return { volume, setVolume, maxVolume: MAX_VOLUME };
}
