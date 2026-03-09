'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface TranscriptionResult {
  transcript: string;
  duration: number;
  durationFormatted: string;
  speakers: number;
  cost: number;
  filename: string;
}

interface TranscribeViewProps {
  onBack: () => void;
}

export function TranscribeView({ onBack }: TranscribeViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setError('');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setResult(null);
      setError('');
    }
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError('');
    setProgress('Subiendo archivo...');

    try {
      const formData = new FormData();
      formData.append('audio', file);

      setProgress('Transcribiendo con Deepgram nova-3...');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }

      setResult(data);
      setProgress('');
    } catch (err) {
      setError('Error de conexion. Intenta de nuevo.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, [file]);

  const handleCopy = useCallback(() => {
    if (result?.transcript) {
      navigator.clipboard.writeText(result.transcript);
    }
  }, [result]);

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : '0';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-xl font-bold">Transcribir Audio</h2>
          <p className="text-muted-foreground text-xs">
            Sube una grabacion y obten la transcripcion con deteccion de hablantes
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-sm underline"
        >
          Volver
        </button>
      </div>

      {/* Upload area */}
      {!result && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-border hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
              file ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''
            }`}
          >
            <span className="mb-2 text-3xl">{file ? '🎵' : '📁'}</span>
            {file ? (
              <div className="text-center">
                <p className="text-foreground text-sm font-semibold">{file.name}</p>
                <p className="text-muted-foreground text-xs">{fileSizeMB} MB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-foreground text-sm font-medium">
                  Arrastra un archivo o haz clic para seleccionar
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  MP3, WAV, M4A, OGG, FLAC, MP4, WebM &middot; Max 30 minutos
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.ogg,.flac,.mp4,.webm"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Features info */}
          <div className="border-border bg-muted/30 rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase">
              Caracteristicas incluidas
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <span className="text-foreground">Deteccion de hablantes</span>
              <span className="text-foreground">Puntuacion automatica</span>
              <span className="text-foreground">Formato inteligente</span>
              <span className="text-foreground">Separacion por parrafos</span>
              <span className="text-foreground">Segmentacion por turnos</span>
              <span className="text-foreground">Timestamps</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          {uploading && progress && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {progress}
            </div>
          )}

          <Button
            size="lg"
            onClick={handleTranscribe}
            disabled={!file || uploading}
            className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase"
          >
            {uploading ? 'Procesando...' : 'Transcribir'}
          </Button>
        </>
      )}

      {/* Result */}
      {result && (
        <>
          {/* Stats bar */}
          <div className="border-border bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-3 rounded-full border px-4 py-2 font-mono text-[11px]">
            <span>{result.durationFormatted}</span>
            <span className="text-border">|</span>
            <span>
              {result.speakers} {result.speakers === 1 ? 'hablante' : 'hablantes'}
            </span>
            <span className="text-border">|</span>
            <span>${result.cost.toFixed(4)} USD</span>
            <span className="text-border">|</span>
            <span>Guardado</span>
          </div>

          {/* Transcript */}
          <div className="border-border max-h-[60vh] overflow-y-auto rounded-xl border p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {result.transcript.split('\n').map((line, i) => {
                if (line.startsWith('**Hablante')) {
                  return (
                    <p key={i} className="text-foreground mt-4 mb-1 text-sm font-bold">
                      {line.replace(/\*\*/g, '')}
                    </p>
                  );
                }
                if (line.trim() === '') return <br key={i} />;
                return (
                  <p key={i} className="text-foreground/90 my-0.5 text-sm leading-relaxed">
                    {line}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} className="flex-1 rounded-full text-xs">
              Copiar texto
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setFile(null);
              }}
              className="flex-1 rounded-full text-xs"
            >
              Nueva transcripcion
            </Button>
            <Button variant="outline" onClick={onBack} className="flex-1 rounded-full text-xs">
              Volver al inicio
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
