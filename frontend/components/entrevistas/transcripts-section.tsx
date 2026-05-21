'use client';

import { useEffect, useState } from 'react';
import { FileList } from './file-list';

interface Props {
  interviewId: string;
}

interface Transcript {
  filename: string;
  mtime: string | null;
  size: number;
}

export function TranscriptsSection({ interviewId }: Props) {
  const [files, setFiles] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entrevistas/${encodeURIComponent(interviewId)}/transcripciones`)
      .then((r) => (r.ok ? r.json() : { transcripts: [] }))
      .then((data: { transcripts: Transcript[] }) => {
        if (!cancelled) setFiles((data.transcripts || []).map((t) => t.filename));
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-medium tracking-wide text-zinc-500 uppercase">
        Transcripciones en crudo
      </h2>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Conversación textual completa. Estos logs son compartidos entre todas las entrevistas hechas
        con Elena, ordenados por fecha más reciente.
      </p>
      {files === null ? (
        <p className="text-xs text-zinc-400">Cargando…</p>
      ) : (
        <FileList
          interviewId={interviewId}
          kind="transcript"
          files={files}
          emptyHint="Aún no hay transcripciones."
        />
      )}
    </section>
  );
}
