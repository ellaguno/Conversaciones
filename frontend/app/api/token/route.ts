import { NextResponse } from 'next/server';
import {
  AccessToken,
  type AccessTokenOptions,
  RoomServiceClient,
  type VideoGrant,
} from 'livekit-server-sdk';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { readSettings } from '@/lib/settings';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;

const VALID_PERSONALITIES = new Set([
  'trader',
  'trader_bolsa',
  'trader_crypto',
  'trader_forex',
  'trader_dinero',
  'trader_commodities',
  'abogado',
  'abogado_corporativo',
  'abogado_laboral',
  'abogado_fiscal',
  'abogado_penal',
  'abogado_familiar',
  'abogado_inmobiliario',
  'psicologo',
  'hippy',
  'normal',
  'tesla',
  'jesus',
  'aquino',
  'francisco',
  'suntzu',
  'estoico',
  'sacerdote',
  'monje',
  'imam',
  'rabino',
  'pandit',
  'curie',
  'vangogh',
  'hipatia',
  'maestro_ingles',
  'maestro_frances',
  'maestro_portugues',
  'maestro_aleman',
  'asesor_sistemas',
  'asesor_office',
  'asesor_web',
  'asesor_tecnico',
  'coach_oratoria',
  'instructor_ventas',
  'instructor_entrevistas',
  'instructor_historia',
  'instructor_meditacion',
  'instructor_salud',
  'nutriologo',
  'nutriologo_deportivo',
  'nutriologo_pediatrico',
  'nutriologo_bariatrico',
  'demo_vendedor_vida',
  'demo_vendedor_gastos',
  'demo_cliente_vida',
  'demo_cliente_gastos',
]);

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    // Rate limit: 20 requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`token:${ip}`, 20, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    // Get authenticated user or allow guest
    const session = await auth();
    let userId = session?.user?.id || '';
    let isGuest = false;

    if (!userId) {
      const body_peek = await req
        .clone()
        .json()
        .catch(() => ({}));
      const isDemo =
        typeof body_peek?.personality === 'string' && body_peek.personality.startsWith('demo_');
      if (isDemo) {
        // Demo personalities don't require auth
        userId = `demo_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
        isGuest = true;
      } else {
        const settings = readSettings();
        if (!settings.guestEnabled) {
          return new NextResponse('No autenticado', { status: 401 });
        }
        userId = `guest_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
        isGuest = true;
      }
    }

    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be defined');
    }

    const body = await req.json().catch(() => ({}));
    let rawPersonality = body?.personality || 'trader';

    // Guests cannot use psicologo (requires session management)
    if (isGuest && rawPersonality === 'psicologo') {
      rawPersonality = 'trader';
    }
    // Accept known personalities or custom_* keys
    const isCustom =
      typeof rawPersonality === 'string' && /^custom_[a-z0-9_-]+$/.test(rawPersonality);
    const personality =
      VALID_PERSONALITIES.has(rawPersonality) || isCustom ? rawPersonality : 'trader';
    const rawPatientId = body?.patientId || '';
    const patientId = rawPatientId.replace(/[^a-zA-Z0-9_-]/g, '');
    const voiceId = body?.voiceId || '';
    const temperature = typeof body?.temperature === 'number' ? body.temperature : null;
    const speed = typeof body?.speed === 'number' ? body.speed : null;
    const model = typeof body?.model === 'string' ? body.model : '';
    const therapyMethod = typeof body?.therapyMethod === 'string' ? body.therapyMethod : '';
    const coupleTherapy = body?.coupleTherapy === true;
    const demoProfile = typeof body?.demoProfile === 'string' ? body.demoProfile : '';

    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName =
      personality === 'psicologo' && patientId
        ? `room_${personality}_${patientId}_${Math.floor(Math.random() * 10_000)}`
        : `room_${personality}_${Math.floor(Math.random() * 10_000)}`;

    // Create room with metadata via RoomService API
    const httpUrl = LIVEKIT_URL.replace('wss://', 'https://');
    const roomService = new RoomServiceClient(httpUrl, API_KEY, API_SECRET);
    // Pack config into metadata as JSON — include userId for data isolation
    const metadata = JSON.stringify({
      personality,
      userId,
      ...(voiceId && { voiceId }),
      ...(temperature !== null && { temperature }),
      ...(speed !== null && { speed }),
      ...(model && { model }),
      ...(therapyMethod && { therapyMethod }),
      ...(coupleTherapy && { coupleTherapy }),
      ...(demoProfile && { demoProfile }),
    });

    await roomService.createRoom({
      name: roomName,
      metadata,
      emptyTimeout: 60,
      maxParticipants: 2,
    });

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };

    // Notify demo usage via email (fire-and-forget)
    if (personality.startsWith('demo_')) {
      const DEMO_NOTIFY_EMAIL = 'eduardo@llaguno.com';
      const now = new Date();
      const hora = now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
      const profileLabels: Record<string, string> = {
        demo_vendedor_vida: 'Vendedor de Seguro de Vida',
        demo_vendedor_gastos: 'Vendedor de Gastos Médicos',
        demo_cliente_vida: 'Prospecto de Seguro de Vida',
        demo_cliente_gastos: 'Prospecto de Gastos Médicos',
      };
      const agentLabel = profileLabels[personality] || personality;
      const profileType = demoProfile || 'no especificado';
      sendEmail(
        DEMO_NOTIFY_EMAIL,
        `Demo Seguros: ${agentLabel} (${profileType})`,
        `<h3>Uso de Demo - Venta de Seguros</h3>
        <table style="border-collapse:collapse;font-family:sans-serif;">
          <tr><td style="padding:4px 12px;font-weight:bold;">Hora</td><td style="padding:4px 12px;">${hora}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">IP</td><td style="padding:4px 12px;">${ip}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Usuario</td><td style="padding:4px 12px;">${userId}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Agente</td><td style="padding:4px 12px;">${agentLabel}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Perfil</td><td style="padding:4px 12px;">${profileType}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Sala</td><td style="padding:4px 12px;">${roomName}</td></tr>
        </table>`
      ).catch((err) => console.error('Error enviando notificación demo:', err));
    }

    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(userInfo: AccessTokenOptions, roomName: string): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}
