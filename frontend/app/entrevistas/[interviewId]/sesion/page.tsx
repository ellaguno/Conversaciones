import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { App } from '@/components/app/app';
import { auth } from '@/lib/auth';
import { getAppConfig } from '@/lib/utils';

interface PageProps {
  params: Promise<{ interviewId: string }>;
}

async function fetchConfig(id: string, cookie: string, host: string, proto: string) {
  try {
    const res = await fetch(`${proto}://${host}/api/entrevistas/${encodeURIComponent(id)}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.config || null;
  } catch {
    return null;
  }
}

export default async function EntrevistaSessionPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { interviewId } = await params;
  const safeId = interviewId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  if (!safeId) notFound();

  const hdrs = await headers();
  const host = hdrs.get('host') || '';
  const proto = hdrs.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const cookie = hdrs.get('cookie') || '';

  const config = await fetchConfig(safeId, cookie, host, proto);
  if (!config) notFound();

  const mode: 'legado' | 'corporativo' = config.mode === 'corporativo' ? 'corporativo' : 'legado';
  const appConfig = await getAppConfig(hdrs);

  return (
    <App
      appConfig={appConfig}
      initialPersonality="entrevistadora"
      initialPatientId={safeId}
      autoStartInterview={{
        mode,
        intervieweeName: config.intervieweeName || '',
        frequency: config.frequency || '',
      }}
    />
  );
}
