export const VISUALIZER_TYPES = [
  { key: 'bar', name: 'Barras' },
  { key: 'wave', name: 'Onda' },
  { key: 'grid', name: 'Cuadrícula' },
  { key: 'radial', name: 'Radial' },
  { key: 'aura', name: 'Aura' },
] as const;

export type VisualizerType = (typeof VISUALIZER_TYPES)[number]['key'];

export const CARTESIA_VOICES_ES = [
  { id: 'f4d6bb07-f876-4464-ba70-cd48d8701890', name: 'Adriana - Animadora' },
  { id: '2695b6b5-5543-4be1-96d9-3967fb5e7fec', name: 'Agustín - Narrador' },
  { id: '3a35daa1-ba81-451c-9b21-59332e9db2f3', name: 'Alejandro - Mentor Calmado' },
  { id: 'ccfea4bf-b3f4-421e-87ed-dd05dae01431', name: 'Alondra - Hermana Confiable' },
  { id: '02aeee94-c02b-456e-be7a-659672acf82d', name: 'Benito - Voz Digital' },
  { id: 'bef2ba57-5c10-433b-b215-3bef35110a81', name: 'Camila - Conversadora Alegre' },
  { id: '9ebc775b-c579-4c31-b37c-2306cbe9cc91', name: 'Carlos - Joven Expresivo' },
  { id: '727f663b-0e90-4031-90f2-558b7334425b', name: 'Carmen - Vecina Amigable' },
  { id: '162e0f37-8504-474c-bb33-c606c01890dc', name: 'Catalina - Guía Cercana' },
  { id: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', name: 'Daniela - Mujer Relajada' },
  { id: '399002e9-7f7d-42d4-a6a8-9b91bd809b9d', name: 'Diego - Entusiasta' },
  { id: 'cefcb124-080b-4655-b31f-932f3ee743de', name: 'Elena - Narradora' },
  { id: 'b0689631-eee7-4a6c-bb86-195f1d267c2e', name: 'Emilio - Optimista' },
  { id: '79743797-2087-422f-8dc7-86f9efca85f1', name: 'Fran - Profesional Joven' },
  { id: '5ef98b2a-68d2-4a35-ac52-632a2d288ea6', name: 'Gabriel - Hombre Serio' },
  { id: 'dbaa1a0d-e004-442d-866f-5431b18d8d54', name: 'Guadalupe - Cuentacuentos' },
  { id: 'b042270c-d46f-4d4f-8fb0-7dd7c5fe5615', name: 'Héctor - Guía Turístico' },
  { id: 'c0c374aa-09be-42d9-9828-4d2d7df86962', name: 'Isabel - Maestra' },
  { id: 'e9f0368b-3662-4a01-b037-e13ca5203c74', name: 'Javier - Asesor Gentil' },
  { id: '7c1ecd2d-1c83-4d5d-a25c-b3820a274a2e', name: 'Jerónimo - Asesor Empático' },
  { id: '7b001dff-b8b2-4da7-92e4-5c794798effa', name: 'Jorge - Tipo Normal' },
  { id: 'c68a8bd0-f99e-4e7f-915d-a097da6d024c', name: 'Juanita - Compañera' },
  { id: 'b503f001-80b8-49d3-8666-8d7700fc5ca2', name: 'Liliana - Madre Cariñosa' },
  { id: 'b5aa8098-49ef-475d-89b0-c9262ecf33fd', name: 'Luis - Noticiero' },
  { id: '948196a7-fe02-417b-9b6d-c45ee0803565', name: 'Manuel - Presentador' },
  { id: 'ae823354-f9be-4aef-8543-f569644136b4', name: 'Mariana - Guía Maternal' },
  { id: '846fa30b-6e1a-49b9-b7df-6be47092a09a', name: 'Pablo - Narrador Castizo' },
  { id: 'd4db5fb9-f44b-4bd1-85fa-192e0f0d75f9', name: 'Paloma - Presentadora' },
  { id: 'e361b786-2768-4308-9369-a09793d4dd73', name: 'Paola - Artista Expresiva' },
  { id: '15d0c2e2-8d29-44c3-be23-d585d5f154a1', name: 'Pedro - Hablante Formal' },
  { id: 'd3793b7b-4996-409c-9d59-96dd09f47717', name: 'Renata - Conversadora' },
  { id: 'fb936dd1-66ea-43a0-86bd-18a6203dcda2', name: 'Rosa - Madre Optimista' },
  { id: 'ad8eee76-d702-4a1f-a1bd-7596755ae4c9', name: 'Valeria - Promotora' },
] as const;

export interface PersonalityConfig {
  name: string;
  voiceId: string;
  visualizer: VisualizerType;
  temperature: number; // 0.0 - 1.0
}

export const DEFAULT_CONFIGS: Record<string, PersonalityConfig> = {
  trader: {
    name: 'Carlos el Trader',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
  },
  abogado: {
    name: 'Licenciado Martínez',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
  },
  psicologo: {
    name: 'Dra. Ana',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4',
    visualizer: 'aura',
    temperature: 0.6,
  },
  hippy: {
    name: 'Paz',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3',
    visualizer: 'wave',
    temperature: 0.9,
  },
  normal: {
    name: 'Alguien Normal',
    voiceId: '7b001dff-b8b2-4da7-92e4-5c794798effa',
    visualizer: 'bar',
    temperature: 0.7,
  },
  estoico: {
    name: 'Marco el Estoico',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'radial',
    temperature: 0.5,
  },
  sacerdote: {
    name: 'Padre Miguel',
    voiceId: '5ef98b2a-68d2-4a35-ac52-632a2d288ea6',
    visualizer: 'aura',
    temperature: 0.6,
  },
  monje: {
    name: 'Monje Thich',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3',
    visualizer: 'aura',
    temperature: 0.7,
  },
  imam: {
    name: 'Imán Ahmed',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'radial',
    temperature: 0.6,
  },
  rabino: {
    name: 'Rabino David',
    voiceId: '2695b6b5-5543-4be1-96d9-3967fb5e7fec',
    visualizer: 'radial',
    temperature: 0.7,
  },
  pandit: {
    name: 'Pandit Arjun',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'aura',
    temperature: 0.7,
  },
};

const STORAGE_KEY = 'personality-configs';

export function loadConfigs(): Record<string, PersonalityConfig> {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Merge with defaults so new personalities get defaults
      return { ...DEFAULT_CONFIGS, ...saved };
    }
  } catch {}
  return { ...DEFAULT_CONFIGS };
}

export function saveConfigs(configs: Record<string, PersonalityConfig>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function getConfig(
  configs: Record<string, PersonalityConfig>,
  key: string
): PersonalityConfig {
  return configs[key] || DEFAULT_CONFIGS[key] || DEFAULT_CONFIGS.trader;
}
