'use client';

import { useEffect, useState } from 'react';
import { RenderedMarkdown } from '@/components/markdown/rendered-markdown';

interface FileListProps {
  interviewId: string;
  kind: 'sesion' | 'conocimiento' | 'transcript';
  files: string[];
  emptyHint?: string;
}

interface ViewerState {
  open: boolean;
  filename: string | null;
  content: string;
  loading: boolean;
  error: string | null;
}

/** List of markdown files for one section of the interview — each row has
 * "ver" (opens an inline viewer) and "descargar" (triggers a file download).
 */
export function FileList({ interviewId, kind, files, emptyHint }: FileListProps) {
  const [viewer, setViewer] = useState<ViewerState>({
    open: false,
    filename: null,
    content: '',
    loading: false,
    error: null,
  });

  function urlFor(filename: string, download = false): string {
    const base = `/api/entrevistas/${encodeURIComponent(interviewId)}/archivos/${kind}/${encodeURIComponent(filename)}`;
    return download ? `${base}?download=1` : base;
  }

  async function open(filename: string) {
    setViewer({ open: true, filename, content: '', loading: true, error: null });
    try {
      const res = await fetch(urlFor(filename));
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const text = await res.text();
      setViewer({ open: true, filename, content: text, loading: false, error: null });
    } catch (e) {
      setViewer({
        open: true,
        filename,
        content: '',
        loading: false,
        error: (e as Error).message,
      });
    }
  }

  function close() {
    setViewer({ open: false, filename: null, content: '', loading: false, error: null });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    if (viewer.open) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [viewer.open]);

  if (files.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{emptyHint || 'Sin archivos.'}</p>
    );
  }

  return (
    <>
      <ul className="space-y-1 text-sm">
        {files.map((f) => (
          <li
            key={f}
            className="flex items-center justify-between gap-3 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"
          >
            <span className="truncate font-mono text-xs">{f}</span>
            <span className="flex shrink-0 gap-3">
              <button
                onClick={() => open(f)}
                className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                ver
              </button>
              <a
                href={urlFor(f, true)}
                className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                descargar
              </a>
            </span>
          </li>
        ))}
      </ul>

      {viewer.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
              <span className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {viewer.filename}
              </span>
              <div className="flex items-center gap-3">
                {viewer.filename && (
                  <a
                    href={urlFor(viewer.filename, true)}
                    className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    descargar
                  </a>
                )}
                <button
                  onClick={close}
                  className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              {viewer.loading && <p className="text-sm text-zinc-500">Cargando…</p>}
              {viewer.error && <p className="text-sm text-red-500">{viewer.error}</p>}
              {!viewer.loading && !viewer.error && <RenderedMarkdown content={viewer.content} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
