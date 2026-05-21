import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DeleteInterviewButton } from './_delete-button';
import { NewInterviewForm } from './_new-form';

interface Interview {
  id: string;
  intervieweeName: string;
  mode: string;
  frequency: string;
  sessionCount: number;
  hasProfile: boolean;
  hasTree: boolean;
  updatedAt: string | null;
}

async function fetchInterviews(): Promise<Interview[]> {
  const { headers } = await import('next/headers');
  const hdrs = await headers();
  const host = hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  const cookie = hdrs.get('cookie') || '';
  try {
    const res = await fetch(`${proto}://${host}/api/entrevistas`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.interviews || [];
  } catch {
    return [];
  }
}

export default async function EntrevistasListPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const interviews = await fetchInterviews();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Entrevistas</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Conversaciones largas con Elena para preservar memorias o conocimiento.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Inicio
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Nueva entrevista
        </h2>
        <NewInterviewForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Tus entrevistas ({interviews.length})
        </h2>
        {interviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Aún no tienes entrevistas. Crea una arriba para empezar.
          </p>
        ) : (
          <ul className="space-y-2">
            {interviews.map((iv) => (
              <li
                key={iv.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <Link
                  href={`/entrevistas/${encodeURIComponent(iv.id)}`}
                  className="min-w-0 flex-1 hover:opacity-80"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{iv.intervieweeName || iv.id}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Modo: {iv.mode} · {iv.sessionCount} sesion
                        {iv.sessionCount === 1 ? '' : 'es'}
                        {iv.hasTree ? ' · árbol' : ''}
                        {iv.hasProfile ? ' · perfil' : ''}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {iv.updatedAt ? new Date(iv.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </Link>
                <DeleteInterviewButton
                  id={iv.id}
                  intervieweeName={iv.intervieweeName}
                  sessionCount={iv.sessionCount}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
