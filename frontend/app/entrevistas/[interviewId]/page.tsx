import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DetailBlock } from '@/components/entrevistas/detail-block';
import { FileList } from '@/components/entrevistas/file-list';
import { TranscriptsSection } from '@/components/entrevistas/transcripts-section';
import { type Tree, TreeEditor } from '@/components/entrevistas/tree-editor';
import { auth } from '@/lib/auth';

interface PageProps {
  params: Promise<{ interviewId: string }>;
}

interface InterviewData {
  id: string;
  config: { mode: string; intervieweeName: string; frequency: string };
  tree: Tree | null;
  profile: string | null;
  generalSummary: string | null;
  agenda: string | null;
  pendientes: string | null;
  sessions: { filename: string; date: string; num: number }[];
  knowledge: string[];
  generating: boolean;
}

async function fetchInterview(id: string): Promise<InterviewData | null> {
  const hdrs = await headers();
  const host = hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  const cookie = hdrs.get('cookie') || '';
  try {
    const res = await fetch(`${proto}://${host}/api/entrevistas/${encodeURIComponent(id)}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as InterviewData;
  } catch {
    return null;
  }
}

export default async function EntrevistaDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { interviewId } = await params;
  const safeId = interviewId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  if (!safeId) notFound();

  const data = await fetchInterview(safeId);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/entrevistas"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Todas las entrevistas
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{data.config.intervieweeName || data.id}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Modo: <span className="font-medium">{data.config.mode}</span>
            {data.config.frequency ? ` · ${data.config.frequency}` : ''}
            {' · '}
            {data.sessions.length} sesion{data.sessions.length === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/entrevistas/${encodeURIComponent(safeId)}/zip`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title="Descarga todo (perfil, árbol, sesiones, conocimiento, transcripciones)"
          >
            ⬇ Bajar todo (.zip)
          </a>
          <Link
            href={`/entrevistas/${encodeURIComponent(safeId)}/sesion`}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-bold text-white uppercase dark:bg-zinc-100 dark:text-zinc-900"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      {data.generating && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
          ⏳ Elena está analizando la última sesión y actualizando el árbol y el conocimiento.
          Refresca en unos segundos.
        </div>
      )}

      <TreeEditor initialTree={data.tree} modo={data.config.mode} interviewId={safeId} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.profile && (
          <DetailBlock
            title="Perfil del entrevistado"
            body={data.profile}
            downloadFilename="perfil.md"
          />
        )}
        {data.generalSummary && (
          <DetailBlock
            title="Resumen general"
            body={data.generalSummary}
            downloadFilename="resumen_general.md"
          />
        )}
        {data.agenda && (
          <DetailBlock title="Agenda" body={data.agenda} downloadFilename="agenda.md" />
        )}
        {data.pendientes && (
          <DetailBlock title="Pendientes" body={data.pendientes} downloadFilename="pendientes.md" />
        )}
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Sesiones ({data.sessions.length})
        </h2>
        <FileList
          interviewId={safeId}
          kind="sesion"
          files={data.sessions.map((s) => s.filename)}
          emptyHint="Las notas estructuradas aparecerán aquí después de cada sesión."
        />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Conocimiento destilado ({data.knowledge.length})
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Lo que la persona compartió, organizado por rama del árbol. El archivo empieza con el id
          del nodo (ej. <code>1_2-…</code> = nodo 1.2).
        </p>
        <FileList
          interviewId={safeId}
          kind="conocimiento"
          files={data.knowledge}
          emptyHint="El conocimiento se irá destilando por rama después de cada sesión."
        />
      </section>

      <TranscriptsSection interviewId={safeId} />
    </main>
  );
}
