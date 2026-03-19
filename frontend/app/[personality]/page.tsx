import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

// All valid personality slugs that can be used as URL routes
// Maps URL-friendly names to internal personality keys
const PERSONALITY_MAP: Record<string, string> = {
  // Traders
  trader: 'trader',
  trader_bolsa: 'trader_bolsa',
  trader_crypto: 'trader_crypto',
  trader_forex: 'trader_forex',
  trader_dinero: 'trader_dinero',
  trader_commodities: 'trader_commodities',
  // Lawyers
  abogado: 'abogado',
  abogado_corporativo: 'abogado_corporativo',
  abogado_laboral: 'abogado_laboral',
  abogado_fiscal: 'abogado_fiscal',
  abogado_penal: 'abogado_penal',
  abogado_familiar: 'abogado_familiar',
  abogado_inmobiliario: 'abogado_inmobiliario',
  // Therapy — "psicologa" as friendly alias for "psicologo"
  psicologa: 'psicologo',
  psicologo: 'psicologo',
  // Famous
  normal: 'normal',
  tesla: 'tesla',
  jesus: 'jesus',
  aquino: 'aquino',
  francisco: 'francisco',
  suntzu: 'suntzu',
  // Spiritual
  hippy: 'hippy',
  estoico: 'estoico',
  sacerdote: 'sacerdote',
  monje: 'monje',
  imam: 'imam',
  rabino: 'rabino',
  pandit: 'pandit',
  curie: 'curie',
  vangogh: 'vangogh',
  hipatia: 'hipatia',
  // Language teachers
  maestro_ingles: 'maestro_ingles',
  maestro_frances: 'maestro_frances',
  maestro_portugues: 'maestro_portugues',
  maestro_aleman: 'maestro_aleman',
  // System advisors
  asesor_sistemas: 'asesor_sistemas',
  asesor_office: 'asesor_office',
  asesor_web: 'asesor_web',
  asesor_tecnico: 'asesor_tecnico',
};

// Routes that already exist and should NOT be caught by this dynamic route
const RESERVED_ROUTES = new Set([
  'admin',
  'api',
  'login',
  'register',
  'forgot-password',
  'reset-password',
]);

interface PageProps {
  params: Promise<{ personality: string }>;
}

export default async function PersonalityPage({ params }: PageProps) {
  const { personality: slug } = await params;

  // Don't catch reserved routes
  if (RESERVED_ROUTES.has(slug)) {
    notFound();
  }

  const internalKey = PERSONALITY_MAP[slug.toLowerCase()];
  if (!internalKey) {
    notFound();
  }

  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <App appConfig={appConfig} initialPersonality={internalKey} />;
}
