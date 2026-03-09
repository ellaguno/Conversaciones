'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';

interface TranscriptionResult {
  transcript: string;
  duration: number;
  durationFormatted: string;
  speakers: number;
  cost: number;
  filename: string;
}

interface SavedTranscription {
  filename: string;
  date: string;
  time: string;
  originalName: string;
  size: number;
}

type View = 'list' | 'upload' | 'result' | 'reading';

interface TranscribeViewProps {
  onBack: () => void;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MarkdownContent({ content }: { content: string }) {
  const cleaned = content.replace(/^```markdown\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return (
    <article>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-foreground border-border mt-6 mb-4 border-b pb-2 text-xl font-bold">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-foreground mt-5 mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="bg-primary inline-block h-5 w-1 rounded-full" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-foreground mt-4 mb-2 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/80 mb-3 text-sm leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-foreground/80 mb-3 ml-1 space-y-1.5 text-sm">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="bg-primary/60 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </article>
  );
}

export function TranscribeView({ onBack }: TranscribeViewProps) {
  const [view, setView] = useState<View>('list');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedTranscription[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [readingContent, setReadingContent] = useState('');
  const [readingFilename, setReadingFilename] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchSaved = useCallback(() => {
    setLoadingSaved(true);
    fetch('/api/transcribe')
      .then((r) => r.json())
      .then((data) => setSaved(data.transcriptions || []))
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [readingFilename]);

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
      setView('result');
      setProgress('');
      // Refresh list
      fetchSaved();
    } catch (err) {
      setError('Error de conexion. Intenta de nuevo.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, [file, fetchSaved]);

  const handleOpen = useCallback(async (filename: string) => {
    try {
      const res = await fetch(`/api/transcribe/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (res.ok) {
        setReadingContent(data.content);
        setReadingFilename(filename);
        setView('reading');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDownload = useCallback((filename: string) => {
    const link = document.createElement('a');
    link.href = `/api/transcribe/${encodeURIComponent(filename)}?download=true`;
    link.download = filename;
    link.click();
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : '0';

  // --- Reading a saved transcription ---
  if (view === 'reading') {
    return (
      <div className="bg-background fixed inset-0 flex flex-col">
        <header className="border-border bg-background/95 flex-shrink-0 border-b px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('list')}
                className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
                title="Volver"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="min-w-0">
                <h2 className="text-foreground truncate text-sm font-bold">{readingFilename}</h2>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(readingContent)}
                className="border-border text-muted-foreground hover:text-foreground rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Copiar
              </button>
              <button
                onClick={() => handleDownload(readingFilename)}
                className="border-border text-muted-foreground hover:text-foreground rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Descargar
              </button>
            </div>
          </div>
        </header>
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-5 pb-16">
            <MarkdownContent content={readingContent} />
          </div>
        </div>
      </div>
    );
  }

  // --- Result after transcription ---
  if (view === 'result' && result) {
    return (
      <div className="bg-background fixed inset-0 flex flex-col">
        <header className="border-border bg-background/95 flex-shrink-0 border-b px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setView('list'); setResult(null); setFile(null); }}
                className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
                title="Volver"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div>
                <h2 className="text-foreground text-sm font-bold">Transcripcion completa</h2>
                <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px]">
                  <span>{result.durationFormatted}</span>
                  <span>·</span>
                  <span>{result.speakers} {result.speakers === 1 ? 'hablante' : 'hablantes'}</span>
                  <span>·</span>
                  <span>${result.cost.toFixed(4)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(result.transcript)}
                className="border-border text-muted-foreground hover:text-foreground rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Copiar
              </button>
              <button
                onClick={() => handleDownload(result.filename)}
                className="border-border text-muted-foreground hover:text-foreground rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Descargar
              </button>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-5 pb-16">
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
        </div>
      </div>
    );
  }

  // --- Main view: list + upload ---
  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      <header className="border-border bg-background/95 flex-shrink-0 border-b px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
              title="Volver"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h2 className="text-foreground text-base leading-tight font-bold">Transcripciones</h2>
              <p className="text-muted-foreground text-[11px]">
                {saved.length} {saved.length === 1 ? 'transcripcion' : 'transcripciones'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setView('upload'); setFile(null); setError(''); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-1.5 text-xs font-bold transition-colors"
          >
            Nueva transcripcion
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 pb-16">
          {/* Upload section (inline or expanded) */}
          {view === 'upload' && (
            <div className="mb-6 flex flex-col gap-3">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-border hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
                  file ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''
                }`}
              >
                {file ? (
                  <div className="text-center">
                    <span className="mb-1 block text-2xl">🎵</span>
                    <p className="text-foreground text-sm font-semibold">{file.name}</p>
                    <p className="text-muted-foreground text-xs">{fileSizeMB} MB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="mb-1 block text-2xl">📁</span>
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

              <div className="flex gap-2">
                <Button
                  size="lg"
                  onClick={handleTranscribe}
                  disabled={!file || uploading}
                  className="flex-1 rounded-full font-mono text-xs font-bold tracking-wider uppercase"
                >
                  {uploading ? 'Procesando...' : 'Transcribir'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => { setView('list'); setFile(null); setError(''); }}
                  className="rounded-full text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Saved transcriptions list */}
          {loadingSaved ? (
            <div className="text-muted-foreground flex items-center justify-center py-16 text-sm">
              Cargando...
            </div>
          ) : saved.length === 0 && view === 'list' ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
              <div className="mb-3 text-4xl opacity-30">🎙️</div>
              <p className="text-sm">No hay transcripciones guardadas.</p>
              <p className="mt-1 text-xs">Sube un archivo de audio para empezar.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {saved.map((t, i) => (
                <div
                  key={t.filename}
                  className="group border-border bg-background hover:border-primary/50 flex items-center justify-between rounded-xl border px-4 py-3.5 transition-all hover:shadow-sm"
                >
                  <button
                    onClick={() => handleOpen(t.filename)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="bg-primary/10 text-primary flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                      #{saved.length - i}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-medium">
                        {t.originalName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(t.date)} &middot; {t.time} hrs &middot; {formatSize(t.size)}
                      </p>
                    </div>
                  </button>
                  <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleDownload(t.filename)}
                      className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                      title="Descargar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleOpen(t.filename)}
                      className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
