export const VISUALIZER_TYPES = [
  { key: 'bar', name: 'Barras' },
  { key: 'wave', name: 'Onda' },
  { key: 'grid', name: 'Cuadrícula' },
  { key: 'radial', name: 'Radial' },
  { key: 'aura', name: 'Aura' },
] as const;

export type VisualizerType = (typeof VISUALIZER_TYPES)[number]['key'];

export const CARTESIA_VOICES_ES = [
  { id: 'f4d6bb07-f876-4464-ba70-cd48d8701890', name: 'Adriana - Animadora', gender: 'F' },
  { id: '2695b6b5-5543-4be1-96d9-3967fb5e7fec', name: 'Agustín - Narrador', gender: 'M' },
  { id: '3a35daa1-ba81-451c-9b21-59332e9db2f3', name: 'Alejandro - Mentor Calmado', gender: 'M' },
  { id: 'ccfea4bf-b3f4-421e-87ed-dd05dae01431', name: 'Alondra - Hermana Confiable', gender: 'F' },
  { id: '02aeee94-c02b-456e-be7a-659672acf82d', name: 'Benito - Voz Digital', gender: 'M' },
  { id: 'bef2ba57-5c10-433b-b215-3bef35110a81', name: 'Camila - Conversadora Alegre', gender: 'F' },
  { id: '9ebc775b-c579-4c31-b37c-2306cbe9cc91', name: 'Carlos - Joven Expresivo', gender: 'M' },
  { id: '727f663b-0e90-4031-90f2-558b7334425b', name: 'Carmen - Vecina Amigable', gender: 'F' },
  { id: '162e0f37-8504-474c-bb33-c606c01890dc', name: 'Catalina - Guía Cercana', gender: 'F' },
  {
    id: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c',
    name: 'Daniela - Mujer Relajada (MX)',
    gender: 'F',
  },
  { id: '399002e9-7f7d-42d4-a6a8-9b91bd809b9d', name: 'Diego - Entusiasta', gender: 'M' },
  { id: 'cefcb124-080b-4655-b31f-932f3ee743de', name: 'Elena - Narradora (ES)', gender: 'F' },
  { id: 'b0689631-eee7-4a6c-bb86-195f1d267c2e', name: 'Emilio - Optimista', gender: 'M' },
  { id: '79743797-2087-422f-8dc7-86f9efca85f1', name: 'Fran - Profesional Joven', gender: 'M' },
  { id: '5ef98b2a-68d2-4a35-ac52-632a2d288ea6', name: 'Gabriel - Hombre Serio (ES)', gender: 'M' },
  { id: 'dbaa1a0d-e004-442d-866f-5431b18d8d54', name: 'Guadalupe - Cuentacuentos', gender: 'F' },
  { id: 'b042270c-d46f-4d4f-8fb0-7dd7c5fe5615', name: 'Héctor - Guía Turístico (ES)', gender: 'M' },
  { id: 'c0c374aa-09be-42d9-9828-4d2d7df86962', name: 'Isabel - Maestra (ES)', gender: 'F' },
  { id: 'e9f0368b-3662-4a01-b037-e13ca5203c74', name: 'Javier - Asesor Gentil', gender: 'M' },
  { id: '7c1ecd2d-1c83-4d5d-a25c-b3820a274a2e', name: 'Jerónimo - Asesor Empático', gender: 'M' },
  { id: '7b001dff-b8b2-4da7-92e4-5c794798effa', name: 'Jorge - Tipo Normal', gender: 'M' },
  { id: 'c68a8bd0-f99e-4e7f-915d-a097da6d024c', name: 'Juanita - Compañera', gender: 'F' },
  { id: 'b503f001-80b8-49d3-8666-8d7700fc5ca2', name: 'Liliana - Madre Cariñosa', gender: 'F' },
  { id: 'b5aa8098-49ef-475d-89b0-c9262ecf33fd', name: 'Luis - Noticiero (ES)', gender: 'M' },
  { id: '948196a7-fe02-417b-9b6d-c45ee0803565', name: 'Manuel - Presentador', gender: 'M' },
  { id: 'ae823354-f9be-4aef-8543-f569644136b4', name: 'Mariana - Guía Maternal', gender: 'F' },
  {
    id: '846fa30b-6e1a-49b9-b7df-6be47092a09a',
    name: 'Pablo - Narrador Castizo (ES)',
    gender: 'M',
  },
  { id: 'd4db5fb9-f44b-4bd1-85fa-192e0f0d75f9', name: 'Paloma - Presentadora', gender: 'F' },
  { id: 'e361b786-2768-4308-9369-a09793d4dd73', name: 'Paola - Artista Expresiva', gender: 'F' },
  { id: '15d0c2e2-8d29-44c3-be23-d585d5f154a1', name: 'Pedro - Hablante Formal (MX)', gender: 'M' },
  { id: 'd3793b7b-4996-409c-9d59-96dd09f47717', name: 'Renata - Conversadora', gender: 'F' },
  { id: 'fb936dd1-66ea-43a0-86bd-18a6203dcda2', name: 'Rosa - Madre Optimista', gender: 'F' },
  { id: 'ad8eee76-d702-4a1f-a1bd-7596755ae4c9', name: 'Valeria - Promotora', gender: 'F' },
] as const;

// Default voices by gender for custom characters
export const DEFAULT_MALE_VOICE = '3a35daa1-ba81-451c-9b21-59332e9db2f3'; // Alejandro
export const DEFAULT_FEMALE_VOICE = 'ae823354-f9be-4aef-8543-f569644136b4'; // Mariana

const FEMALE_NAMES = new Set([
  // Spanish
  'ana',
  'maría',
  'maria',
  'carmen',
  'rosa',
  'elena',
  'isabel',
  'patricia',
  'laura',
  'claudia',
  'diana',
  'gabriela',
  'lucía',
  'lucia',
  'sofía',
  'sofia',
  'valentina',
  'mariana',
  'daniela',
  'camila',
  'catalina',
  'andrea',
  'paula',
  'carolina',
  'adriana',
  'alejandra',
  'alicia',
  'beatriz',
  'blanca',
  'cecilia',
  'clara',
  'consuelo',
  'cristina',
  'dolores',
  'elvira',
  'esperanza',
  'estela',
  'eva',
  'fernanda',
  'gloria',
  'graciela',
  'guadalupe',
  'irene',
  'josefina',
  'juana',
  'julia',
  'leticia',
  'lourdes',
  'luz',
  'magdalena',
  'margarita',
  'martha',
  'marta',
  'mercedes',
  'mónica',
  'monica',
  'natalia',
  'norma',
  'olga',
  'pilar',
  'raquel',
  'rebeca',
  'rocío',
  'rocio',
  'sandra',
  'silvia',
  'susana',
  'teresa',
  'verónica',
  'veronica',
  'victoria',
  'virginia',
  'yolanda',
  // International / historical
  'marie',
  'cleopatra',
  'frida',
  'florence',
  'jane',
  'margaret',
  'elizabeth',
  'catherine',
  'victoria',
  'eleanor',
  'joan',
  'helen',
  'anne',
  'mary',
  'emily',
  'charlotte',
  'virginia',
  'simone',
  'rosa',
  'amelia',
  'ada',
  'hypatia',
  'hildegard',
  'harriet',
  'sojourner',
  'malala',
  'indira',
  'golda',
  'angela',
  'aung',
  'benazir',
  'eva',
  'rigoberta',
  'sor',
  'santa',
  'madre',
  'reina',
  'princesa',
  'emperatriz',
  'condesa',
  'duquesa',
  'sacerdotisa',
  'profetisa',
  'diosa',
]);

const MALE_NAMES = new Set([
  // Spanish
  'josé',
  'jose',
  'juan',
  'carlos',
  'pedro',
  'miguel',
  'luis',
  'francisco',
  'antonio',
  'manuel',
  'jorge',
  'ricardo',
  'fernando',
  'rafael',
  'daniel',
  'alejandro',
  'roberto',
  'pablo',
  'arturo',
  'enrique',
  'sergio',
  'raúl',
  'raul',
  'alberto',
  'andrés',
  'andres',
  'david',
  'eduardo',
  'emilio',
  'ernesto',
  'felipe',
  'gabriel',
  'gerardo',
  'gustavo',
  'héctor',
  'hector',
  'hugo',
  'ignacio',
  'jaime',
  'javier',
  'jesús',
  'jesus',
  'joaquín',
  'joaquin',
  'marcos',
  'mario',
  'martín',
  'martin',
  'óscar',
  'oscar',
  'ramón',
  'ramon',
  'rodrigo',
  'salvador',
  'santiago',
  'tomás',
  'tomas',
  'víctor',
  'victor',
  // International / historical
  'albert',
  'isaac',
  'nikola',
  'charles',
  'leonardo',
  'galileo',
  'napoleon',
  'alexander',
  'aristotle',
  'plato',
  'socrates',
  'homer',
  'dante',
  'shakespeare',
  'mozart',
  'beethoven',
  'einstein',
  'newton',
  'darwin',
  'marx',
  'gandhi',
  'buddha',
  'confucius',
  'lao',
  'sun',
  'genghis',
  'julius',
  'augustus',
  'marco',
  'martin',
  'nelson',
  'winston',
  'buda',
  'buddha',
  'séneca',
  'seneca',
  'neruda',
  'borja',
  'baroja',
  'kafka',
  'tesla',
  'abraham',
  'george',
  'thomas',
  'benjamin',
  'john',
  'james',
  'henry',
  'william',
  'richard',
  'santo',
  'san',
  'padre',
  'fray',
  'rey',
  'príncipe',
  'principe',
  'emperador',
  'conde',
  'duque',
  'profeta',
  'apóstol',
  'apostol',
  'rabino',
  'imán',
  'iman',
  'monje',
]);

/**
 * Detect gender from a character name. Returns 'F', 'M', or null if unknown.
 */
export function detectGender(name: string): 'F' | 'M' | null {
  const lower = name.toLowerCase().trim();
  const words = lower.split(/\s+/);
  const firstName = words[0];

  // Check prefix/title first
  const femaleTitles = [
    'sra',
    'sra.',
    'señora',
    'doña',
    'dra',
    'dra.',
    'doctora',
    'reina',
    'princesa',
    'emperatriz',
    'sor',
    'santa',
    'madre',
    'hermana',
  ];
  const maleTitles = [
    'sr',
    'sr.',
    'señor',
    'don',
    'dr',
    'dr.',
    'doctor',
    'rey',
    'príncipe',
    'principe',
    'emperador',
    'san',
    'santo',
    'padre',
    'fray',
    'hermano',
  ];

  for (const title of femaleTitles) {
    if (words.includes(title)) return 'F';
  }
  for (const title of maleTitles) {
    if (words.includes(title)) return 'M';
  }

  // Check name lists (try first name and also second word for compound names)
  for (const word of words.slice(0, 2)) {
    if (FEMALE_NAMES.has(word)) return 'F';
    if (MALE_NAMES.has(word)) return 'M';
  }

  // Heuristic: Spanish name endings
  if (firstName.endsWith('a') || firstName.endsWith('ia') || firstName.endsWith('na')) return 'F';
  if (firstName.endsWith('o') || firstName.endsWith('os') || firstName.endsWith('ón')) return 'M';

  return null;
}

/**
 * Get the appropriate default voice ID for a character name.
 */
export function getVoiceForName(name: string): string {
  const gender = detectGender(name);
  return gender === 'F' ? DEFAULT_FEMALE_VOICE : DEFAULT_MALE_VOICE;
}

export const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

export interface PersonalityConfig {
  name: string;
  voiceId: string;
  visualizer: VisualizerType;
  temperature: number; // 0.0 - 1.0
  speed: number; // 0.6 - 2.0 (Cartesia TTS speech speed, 1.0 = normal)
  model: string; // OpenRouter model ID
}

export const DEFAULT_CONFIGS: Record<string, PersonalityConfig> = {
  trader: {
    name: 'Trader General',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  trader_bolsa: {
    name: 'Trader de Bolsa',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  trader_crypto: {
    name: 'Trader de Criptomonedas',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  trader_forex: {
    name: 'Trader de Forex',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  trader_dinero: {
    name: 'Asesor Finanzas Personales',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  trader_commodities: {
    name: 'Trader de Commodities',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado: {
    name: 'Abogado General',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado_corporativo: {
    name: 'Abogado Corporativo',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado_laboral: {
    name: 'Abogado Laboral',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado_fiscal: {
    name: 'Abogado Fiscal',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado_penal: {
    name: 'Abogado Penalista',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado_familiar: {
    name: 'Abogado Familiar',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  abogado_inmobiliario: {
    name: 'Abogado Inmobiliario',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'bar',
    temperature: 0.4,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  psicologo: {
    name: 'Dra. Ana',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4',
    visualizer: 'aura',
    temperature: 0.6,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  hippy: {
    name: 'Paz',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3',
    visualizer: 'wave',
    temperature: 0.9,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  normal: {
    name: 'Alguien Normal',
    voiceId: '7b001dff-b8b2-4da7-92e4-5c794798effa',
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  tesla: {
    name: 'Nikola Tesla',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3',
    visualizer: 'grid',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  jesus: {
    name: 'Jesús de Nazaret',
    voiceId: '5ef98b2a-68d2-4a35-ac52-632a2d288ea6',
    visualizer: 'aura',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  aquino: {
    name: 'Santo Tomás de Aquino',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'radial',
    temperature: 0.5,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  francisco: {
    name: 'San Francisco de Asís',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'aura',
    temperature: 0.8,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  suntzu: {
    name: 'Sun Tzu',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'radial',
    temperature: 0.5,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  estoico: {
    name: 'Marco el Estoico',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    visualizer: 'radial',
    temperature: 0.5,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  sacerdote: {
    name: 'Padre Miguel',
    voiceId: '5ef98b2a-68d2-4a35-ac52-632a2d288ea6',
    visualizer: 'aura',
    temperature: 0.6,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  monje: {
    name: 'Monje Thich',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3',
    visualizer: 'aura',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  imam: {
    name: 'Imán Ahmed',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'radial',
    temperature: 0.6,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  rabino: {
    name: 'Rabino David',
    voiceId: '2695b6b5-5543-4be1-96d9-3967fb5e7fec',
    visualizer: 'radial',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  pandit: {
    name: 'Pandit Arjun',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'aura',
    temperature: 0.7,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  curie: {
    name: 'Marie Curie',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4',
    visualizer: 'radial',
    temperature: 0.6,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  vangogh: {
    name: 'Vincent van Gogh',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3',
    visualizer: 'aura',
    temperature: 0.8,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  hipatia: {
    name: 'Hipatia de Alejandría',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4',
    visualizer: 'radial',
    temperature: 0.6,
    speed: 1.0,
    model: DEFAULT_MODEL,
  },
  // Maestros de Idiomas
  maestro_ingles: {
    name: 'Teacher Sarah',
    voiceId: 'ccfea4bf-b3f4-421e-87ed-dd05dae01431',
    visualizer: 'wave',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  maestro_frances: {
    name: 'Professeur Marie',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4',
    visualizer: 'wave',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  maestro_portugues: {
    name: 'Professor Lucas',
    voiceId: '399002e9-7f7d-42d4-a6a8-9b91bd809b9d',
    visualizer: 'wave',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  maestro_aleman: {
    name: 'Lehrer Hans',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565',
    visualizer: 'wave',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  // Instructores
  coach_oratoria: {
    name: 'Coach Ricardo',
    voiceId: '399002e9-7f7d-42d4-a6a8-9b91bd809b9d', // Diego - Entusiasta
    visualizer: 'wave',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  instructor_ventas: {
    name: 'Coach de Ventas',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565', // Manuel - Presentador
    visualizer: 'bar',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  instructor_entrevistas: {
    name: 'Preparador de Entrevistas',
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1', // Pedro - Formal
    visualizer: 'bar',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  instructor_historia: {
    name: 'Profesor de Historia',
    voiceId: '2695b6b5-5543-4be1-96d9-3967fb5e7fec', // Agustín - Narrador
    visualizer: 'wave',
    temperature: 0.7,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  instructor_meditacion: {
    name: 'Maestro de Meditación',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3', // Alejandro - Mentor Calmado
    visualizer: 'aura',
    temperature: 0.7,
    speed: 0.75,
    model: DEFAULT_MODEL,
  },
  instructor_salud: {
    name: 'Asesor de Salud Integral',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74', // Javier - Asesor Gentil
    visualizer: 'bar',
    temperature: 0.6,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  // Nutriólogos
  nutriologo: {
    name: 'Nutrióloga Laura',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4', // Mariana - Guía Maternal
    visualizer: 'bar',
    temperature: 0.6,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  nutriologo_deportivo: {
    name: 'Nutriólogo Deportivo',
    voiceId: '399002e9-7f7d-42d4-a6a8-9b91bd809b9d', // Diego - Entusiasta
    visualizer: 'bar',
    temperature: 0.6,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  nutriologo_pediatrico: {
    name: 'Nutrióloga Pediátrica',
    voiceId: 'ae823354-f9be-4aef-8543-f569644136b4', // Mariana - Guía Maternal
    visualizer: 'bar',
    temperature: 0.6,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  nutriologo_bariatrico: {
    name: 'Nutriólogo Bariátrico',
    voiceId: '3a35daa1-ba81-451c-9b21-59332e9db2f3', // Alejandro - Mentor Calmado
    visualizer: 'bar',
    temperature: 0.6,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  // Asesores de Sistemas (con visión de pantalla)
  asesor_sistemas: {
    name: 'Asesor de Sistemas',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'grid',
    temperature: 0.5,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  asesor_office: {
    name: 'Asesor de Office',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'grid',
    temperature: 0.5,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  asesor_web: {
    name: 'Asesor Web',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'grid',
    temperature: 0.5,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  asesor_tecnico: {
    name: 'Asesor Técnico',
    voiceId: 'e9f0368b-3662-4a01-b037-e13ca5203c74',
    visualizer: 'grid',
    temperature: 0.5,
    speed: 0.85,
    model: DEFAULT_MODEL,
  },
  // Demo: Venta de Seguros
  demo_vendedor_vida: {
    name: 'Vendedor de Seguro de Vida',
    voiceId: '948196a7-fe02-417b-9b6d-c45ee0803565', // Manuel - Presentador
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: 'google/gemini-3-flash-preview',
  },
  demo_vendedor_gastos: {
    name: 'Vendedor de Gastos Médicos',
    voiceId: 'ad8eee76-d702-4a1f-a1bd-7596755ae4c9', // Valeria - Promotora
    visualizer: 'bar',
    temperature: 0.7,
    speed: 1.0,
    model: 'google/gemini-3-flash-preview',
  },
  demo_cliente_vida: {
    name: 'Prospecto de Seguro de Vida',
    voiceId: '7b001dff-b8b2-4da7-92e4-5c794798effa', // Jorge - Tipo Normal
    visualizer: 'wave',
    temperature: 0.7,
    speed: 1.0,
    model: 'google/gemini-3-flash-preview',
  },
  demo_cliente_gastos: {
    name: 'Prospecto de Gastos Médicos',
    voiceId: '727f663b-0e90-4031-90f2-558b7334425b', // Carmen - Vecina Amigable
    visualizer: 'wave',
    temperature: 0.7,
    speed: 1.0,
    model: 'google/gemini-3-flash-preview',
  },
};

const STORAGE_KEY = 'personality-configs';

export function loadConfigs(
  adminDefaults?: Record<string, PersonalityConfig> | null
): Record<string, PersonalityConfig> {
  // Build base: CODE_DEFAULTS → adminDefaults
  const base = adminDefaults
    ? mergeConfigsDeep(DEFAULT_CONFIGS, adminDefaults)
    : { ...DEFAULT_CONFIGS };

  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // User overrides on top of base
      return mergeConfigsDeep(base, saved);
    }
  } catch {}
  return base;
}

/** Merge per-personality configs (each key gets its own shallow merge) */
function mergeConfigsDeep(
  base: Record<string, PersonalityConfig>,
  overrides: Record<string, PersonalityConfig>
): Record<string, PersonalityConfig> {
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (base[key]) {
      result[key] = { ...base[key], ...overrides[key] };
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

export function saveConfigs(configs: Record<string, PersonalityConfig>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function getConfig(
  configs: Record<string, PersonalityConfig>,
  key: string
): PersonalityConfig {
  if (configs[key]) return configs[key];
  if (DEFAULT_CONFIGS[key]) return DEFAULT_CONFIGS[key];

  // Custom characters: detect gender from name to assign appropriate voice
  if (key.startsWith('custom_')) {
    const charName = key.replace(/^custom_(abogado_|trader_)?/, '').replace(/_/g, ' ');
    const voiceId = getVoiceForName(charName);
    // Determine category defaults
    if (key.startsWith('custom_abogado_')) {
      return { ...DEFAULT_CONFIGS.abogado, name: charName, voiceId };
    }
    if (key.startsWith('custom_trader_')) {
      return { ...DEFAULT_CONFIGS.trader, name: charName, voiceId };
    }
    return {
      name: charName,
      voiceId,
      visualizer: 'bar',
      temperature: 0.7,
      speed: 1.0,
      model: DEFAULT_MODEL,
    };
  }

  return DEFAULT_CONFIGS.trader;
}
