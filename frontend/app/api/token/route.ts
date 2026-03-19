import { NextResponse } from 'next/server';
import {
  AccessToken,
  type AccessTokenOptions,
  RoomServiceClient,
  type VideoGrant,
} from 'livekit-server-sdk';
import { auth } from '@/lib/auth';
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
  'maestro_ingles',
  'maestro_frances',
  'maestro_portugues',
  'maestro_aleman',
  'asesor_sistemas',
  'asesor_office',
  'asesor_web',
  'asesor_tecnico',
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
      const settings = readSettings();
      if (!settings.guestEnabled) {
        return new NextResponse('No autenticado', { status: 401 });
      }
      userId = `guest_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
      isGuest = true;
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
    const model = typeof body?.model === 'string' ? body.model : '';
    const therapyMethod = typeof body?.therapyMethod === 'string' ? body.therapyMethod : '';
    const coupleTherapy = body?.coupleTherapy === true;

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
      ...(model && { model }),
      ...(therapyMethod && { therapyMethod }),
      ...(coupleTherapy && { coupleTherapy }),
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
