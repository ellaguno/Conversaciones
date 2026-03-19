'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const ALL_PERSONALITY_CATEGORIES = [
  {
    key: 'trader',
    name: 'Trader',
    description: 'Elige un mercado',
    emoji: '📈',
  },
  {
    key: 'abogado',
    name: 'Abogado',
    description: 'Elige una especialidad',
    emoji: '⚖️',
  },
  {
    key: 'psicologo',
    name: 'Dra. Ana',
    description: 'Psicóloga clínica',
    emoji: '🧠',
  },
  {
    key: 'idiomas',
    name: 'Idiomas',
    description: 'Aprende un nuevo idioma',
    emoji: '🌍',
  },
  {
    key: 'asesor',
    name: 'Asesor de Sistemas',
    description: 'Ve tu pantalla y te guía',
    emoji: '🖥️',
  },
  {
    key: 'normal',
    name: 'Personaje Famoso',
    description: 'Platica con alguien especial',
    emoji: '🌟',
  },
  {
    key: 'espiritual',
    name: 'Guía Espiritual',
    description: 'Elige una tradición',
    emoji: '🕊️',
  },
  {
    key: 'instructor',
    name: 'Instructor',
    description: 'Mejora tus habilidades',
    emoji: '🎯',
  },
  {
    key: 'nutriologa',
    name: 'Nutrióloga',
    description: 'Elige una especialidad',
    emoji: '🥗',
  },
];

// Layout config: maps category key → position (1-6). 0 or absent = hidden.
export type PersonalityLayout = Record<string, number>;

const DEFAULT_LAYOUT: PersonalityLayout = {
  trader: 1,
  abogado: 2,
  psicologo: 3,
  idiomas: 4,
  asesor: 5,
  normal: 6,
  espiritual: 7,
  instructor: 8,
  nutriologa: 9,
};

export function loadPersonalityLayout(
  adminDefaults?: Record<string, number> | null
): PersonalityLayout {
  const base = adminDefaults ? { ...DEFAULT_LAYOUT, ...adminDefaults } : DEFAULT_LAYOUT;
  if (typeof window === 'undefined') return base;
  try {
    const saved = localStorage.getItem('personality-layout');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...base, ...parsed };
    }
  } catch {}
  return base;
}

export function savePersonalityLayout(layout: PersonalityLayout) {
  localStorage.setItem('personality-layout', JSON.stringify(layout));
}

function getVisiblePersonalities(layout: PersonalityLayout) {
  return ALL_PERSONALITY_CATEGORIES.filter((p) => layout[p.key] && layout[p.key] > 0).sort(
    (a, b) => (layout[a.key] || 99) - (layout[b.key] || 99)
  );
}

const DEFAULT_FAMOUS_CHARACTERS = [
  { key: 'normal', name: 'Alguien Normal' },
  { key: 'tesla', name: 'Nikola Tesla' },
  { key: 'jesus', name: 'Jesucristo' },
  { key: 'aquino', name: 'Santo Tomas de Aquino' },
  { key: 'francisco', name: 'San Francisco de Asis' },
  { key: 'suntzu', name: 'Sun Tzu' },
  { key: 'curie', name: 'Marie Curie' },
  { key: 'vangogh', name: 'Vincent van Gogh' },
  { key: 'hipatia', name: 'Hipatia de Alejandría' },
];

const CUSTOM_KEY = '__other__';

function loadCustomCharacters(): { key: string; name: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('customCharacters');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomCharacters(chars: { key: string; name: string }[]) {
  localStorage.setItem('customCharacters', JSON.stringify(chars));
}

const LAWYER_SPECIALTIES = [
  { key: 'abogado', name: 'Abogado General' },
  { key: 'abogado_corporativo', name: 'Corporativo / Mercantil' },
  { key: 'abogado_laboral', name: 'Laboral' },
  { key: 'abogado_fiscal', name: 'Fiscal / Tributario' },
  { key: 'abogado_penal', name: 'Penal' },
  { key: 'abogado_familiar', name: 'Familiar' },
  { key: 'abogado_inmobiliario', name: 'Inmobiliario' },
];

const TRADER_MARKETS = [
  { key: 'trader', name: 'Trader General' },
  { key: 'trader_bolsa', name: 'Bolsa / Renta Variable' },
  { key: 'trader_crypto', name: 'Criptomonedas' },
  { key: 'trader_forex', name: 'Forex / Divisas' },
  { key: 'trader_dinero', name: 'Finanzas Personales' },
  { key: 'trader_commodities', name: 'Commodities / Materias Primas' },
];

const CUSTOM_LAWYER_KEY = '__other_lawyer__';
const CUSTOM_TRADER_KEY = '__other_trader__';

function loadCustomLawyers(): { key: string; name: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('customLawyers');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomLawyers(items: { key: string; name: string }[]) {
  localStorage.setItem('customLawyers', JSON.stringify(items));
}

function loadCustomTraders(): { key: string; name: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('customTraders');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomTraders(items: { key: string; name: string }[]) {
  localStorage.setItem('customTraders', JSON.stringify(items));
}

const LANGUAGE_TEACHERS = [
  { key: 'maestro_ingles', name: 'Inglés - Teacher Sarah' },
  { key: 'maestro_frances', name: 'Francés - Professeur Marie' },
  { key: 'maestro_portugues', name: 'Portugués - Professor Lucas' },
  { key: 'maestro_aleman', name: 'Alemán - Lehrer Hans' },
];

const SYSTEM_ADVISORS = [
  { key: 'asesor_sistemas', name: 'General (Windows/Mac/Linux)' },
  { key: 'asesor_office', name: 'Office / Google Workspace' },
  { key: 'asesor_web', name: 'Web / Navegadores / Email' },
  { key: 'asesor_tecnico', name: 'Técnico Avanzado' },
];

const SPIRITUAL_GUIDES = [
  { key: 'hippy', name: 'Paz - Sabio Alternativo' },
  { key: 'estoico', name: 'Filósofo Estoico' },
  { key: 'sacerdote', name: 'Sacerdote Católico' },
  { key: 'monje', name: 'Monje Budista' },
  { key: 'imam', name: 'Imán Musulmán' },
  { key: 'rabino', name: 'Rabino Judío' },
  { key: 'pandit', name: 'Pandit Hindú' },
];

const INSTRUCTORS = [
  { key: 'coach_oratoria', name: 'Coach de Oratoria' },
  { key: 'instructor_ventas', name: 'Instructor de Ventas' },
  { key: 'instructor_entrevistas', name: 'Entrenador de Entrevistas' },
  { key: 'instructor_historia', name: 'Profesor de Historia' },
  { key: 'instructor_meditacion', name: 'Maestro de Meditación' },
  { key: 'instructor_salud', name: 'Asesor de Salud Integral' },
];

const CUSTOM_INSTRUCTOR_KEY = '__other_instructor__';

function loadCustomInstructors(): { key: string; name: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('customInstructors');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomInstructors(items: { key: string; name: string }[]) {
  localStorage.setItem('customInstructors', JSON.stringify(items));
}

const NUTRITIONIST_SPECIALTIES = [
  { key: 'nutriologo', name: 'Nutrióloga Clínica (General)' },
  { key: 'nutriologo_deportivo', name: 'Nutrición Deportiva' },
  { key: 'nutriologo_pediatrico', name: 'Nutrición Pediátrica' },
  { key: 'nutriologo_bariatrico', name: 'Nutrición Bariátrica' },
];

// Reverse map: individual personality key → { category, displayName }
const PERSONALITY_TO_CATEGORY: Record<string, { category: string; displayName: string }> = (() => {
  const map: Record<string, { category: string; displayName: string }> = {};
  for (const g of SPIRITUAL_GUIDES) map[g.key] = { category: 'espiritual', displayName: g.name };
  for (const g of DEFAULT_FAMOUS_CHARACTERS)
    map[g.key] = { category: 'normal', displayName: g.name };
  for (const g of SYSTEM_ADVISORS) map[g.key] = { category: 'asesor', displayName: g.name };
  for (const g of LAWYER_SPECIALTIES) map[g.key] = { category: 'abogado', displayName: g.name };
  for (const g of TRADER_MARKETS) map[g.key] = { category: 'trader', displayName: g.name };
  for (const g of LANGUAGE_TEACHERS) map[g.key] = { category: 'idiomas', displayName: g.name };
  for (const g of INSTRUCTORS) map[g.key] = { category: 'instructor', displayName: g.name };
  for (const g of NUTRITIONIST_SPECIALTIES)
    map[g.key] = { category: 'nutriologa', displayName: g.name };
  // Category keys map to themselves
  map['psicologo'] = { category: 'psicologo', displayName: 'Dra. Ana - Psicóloga clínica' };
  map['espiritual'] = { category: 'espiritual', displayName: 'Guía Espiritual' };
  map['normal'] = { category: 'normal', displayName: 'Alguien Normal' };
  map['asesor'] = { category: 'asesor', displayName: 'Asesor de Sistemas' };
  map['abogado'] = { category: 'abogado', displayName: 'Abogado General' };
  map['trader'] = { category: 'trader', displayName: 'Trader General' };
  map['idiomas'] = { category: 'idiomas', displayName: 'Maestro de Idiomas' };
  map['instructor'] = { category: 'instructor', displayName: 'Instructor' };
  map['nutriologa'] = { category: 'nutriologa', displayName: 'Nutrióloga Clínica' };
  return map;
})();

const THERAPY_METHODS = [
  { key: 'cbt', name: 'CBT - Cognitivo-Conductual', short: 'CBT' },
  { key: 'act', name: 'ACT - Aceptacion y Compromiso', short: 'ACT' },
  { key: 'dbt', name: 'DBT - Dialectico-Conductual', short: 'DBT' },
  { key: 'mindfulness', name: 'Mindfulness - Atencion Plena', short: 'Mindfulness' },
  { key: 'gestalt', name: 'Gestalt / Sistemica', short: 'Gestalt' },
];

interface Metrics {
  total_tokens: number;
  total_cost_usd: number;
  llm_cost_usd: number;
  tts_cost_usd: number;
  stt_cost_usd: number;
  llm_calls: number;
  tts_characters: number;
  stt_audio_seconds: number;
}

interface PatientInfo {
  id: string;
  name: string;
  sessionNumber: number;
  sessionsCount: number;
}

function useGeneratingStatus() {
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => {
      fetch('/api/sessions/generating')
        .then((r) => r.json())
        .then((data) => {
          if (active) setGenerating(data.generating === true);
        })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return generating;
}

export interface TherapyOptions {
  therapyMethod?: string;
  coupleTherapy?: boolean;
}

interface WelcomeViewProps {
  startButtonText: string;
  selectedPersonality: string;
  onSelectPersonality: (personality: string) => void;
  onStartCall: (personality: string, patientId?: string, therapy?: TherapyOptions) => void;
  onViewNotes?: () => void;
  onViewConversations?: (personality: string) => void;
  onTranscribe?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onAdminPanel?: () => void;
  isAdmin?: boolean;
  initialPatientId?: string;
  isGuest?: boolean;
  adminLayoutDefaults?: Record<string, number> | null;
}

export const WelcomeView = ({
  startButtonText,
  selectedPersonality,
  onSelectPersonality,
  onStartCall,
  onViewNotes,
  onViewConversations,
  onTranscribe,
  onOpenSettings,
  onLogout,
  onAdminPanel,
  isAdmin,
  initialPatientId,
  isGuest,
  adminLayoutDefaults,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [personalityLayout, setPersonalityLayout] = useState<PersonalityLayout>(DEFAULT_LAYOUT);
  const visiblePersonalities = getVisiblePersonalities(personalityLayout);

  useEffect(() => {
    setPersonalityLayout(loadPersonalityLayout(adminLayoutDefaults));
  }, [adminLayoutDefaults]);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    initialPatientId || null
  );
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [selectedAdvisor, setSelectedAdvisor] = useState('asesor_sistemas');
  const [selectedLanguage, setSelectedLanguage] = useState('maestro_ingles');
  const [selectedGuide, setSelectedGuide] = useState('hippy');
  const [selectedFamous, setSelectedFamous] = useState('normal');
  const [customCharacters, setCustomCharacters] = useState<{ key: string; name: string }[]>([]);
  const [customName, setCustomName] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState('abogado');
  const [customLawyers, setCustomLawyers] = useState<{ key: string; name: string }[]>([]);
  const [customLawyerName, setCustomLawyerName] = useState('');
  const [selectedTrader, setSelectedTrader] = useState('trader');
  const [customTraders, setCustomTraders] = useState<{ key: string; name: string }[]>([]);
  const [customTraderName, setCustomTraderName] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('coach_oratoria');
  const [customInstructors, setCustomInstructors] = useState<{ key: string; name: string }[]>([]);
  const [customInstructorName, setCustomInstructorName] = useState('');
  const [selectedNutritionist, setSelectedNutritionist] = useState('nutriologo');

  useEffect(() => {
    setCustomCharacters(loadCustomCharacters());
    setCustomLawyers(loadCustomLawyers());
    setCustomTraders(loadCustomTraders());
    setCustomInstructors(loadCustomInstructors());
  }, []);
  const [conversationCounts, setConversationCounts] = useState<Record<string, number>>({});
  const [therapyMethod, setTherapyMethod] = useState('mindfulness');
  const [coupleTherapy, setCoupleTherapy] = useState(false);

  // Resolve initialPersonality (individual key like 'hippy') to its category + sub-selector
  const [preselectedBanner, setPreselectedBanner] = useState<string | null>(null);
  useEffect(() => {
    const info = PERSONALITY_TO_CATEGORY[selectedPersonality];
    if (!info) return;
    const { category } = info;
    // If selectedPersonality is already a category key, nothing to resolve
    if (selectedPersonality === category) return;
    // Set the category card as selected
    onSelectPersonality(category);
    // Set the correct sub-selector
    if (category === 'espiritual') setSelectedGuide(selectedPersonality);
    else if (category === 'idiomas') setSelectedLanguage(selectedPersonality);
    else if (category === 'normal') setSelectedFamous(selectedPersonality);
    else if (category === 'asesor') setSelectedAdvisor(selectedPersonality);
    else if (category === 'abogado') setSelectedLawyer(selectedPersonality);
    else if (category === 'trader') setSelectedTrader(selectedPersonality);
    else if (category === 'instructor') setSelectedInstructor(selectedPersonality);
    else if (category === 'nutriologa') setSelectedNutritionist(selectedPersonality);
    // Show banner
    setPreselectedBanner(info.displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data) => {
        const counts: Record<string, number> = {};
        for (const p of data.personalities || []) {
          counts[p.personality] = p.conversations.length;
        }
        setConversationCounts(counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedPersonality === 'psicologo') {
      fetch('/api/sessions')
        .then((r) => r.json())
        .then((data) => {
          const list: PatientInfo[] = (data.patients || []).map(
            (p: { id: string; name: string; sessionNumber: number; sessions: unknown[] }) => ({
              id: p.id,
              name: p.name,
              sessionNumber: p.sessionNumber,
              sessionsCount: p.sessions.length,
            })
          );
          setPatients(list);
          if (list.length > 0 && !selectedPatientId) {
            setSelectedPatientId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [selectedPersonality, selectedPatientId]);

  const isGenerating = useGeneratingStatus();
  const isPsicologo = selectedPersonality === 'psicologo' && !isGuest;
  const isEspiritual = selectedPersonality === 'espiritual';
  const isIdiomas = selectedPersonality === 'idiomas';
  const isNormal = selectedPersonality === 'normal';
  const isAbogado = selectedPersonality === 'abogado';
  const isTrader = selectedPersonality === 'trader';
  const isAsesor = selectedPersonality === 'asesor';
  const isInstructor = selectedPersonality === 'instructor';
  const isNutriologa = selectedPersonality === 'nutriologa';
  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div ref={ref}>
      <section className="bg-background flex flex-col items-center justify-center px-4 text-center">
        {/* Logo + title */}
        <div className="mb-3 flex flex-col items-center gap-2">
          <img
            src="/logo_transparente.png"
            alt="Conversaciones"
            className="h-24 w-auto object-contain"
          />
          <h1 className="text-foreground text-2xl font-bold">Conversaciones</h1>
        </div>

        {/* Metrics bar — admin only */}
        {isAdmin && metrics && metrics.total_tokens > 0 && (
          <div className="border-border bg-muted/40 text-muted-foreground mb-4 flex flex-col items-center gap-1 rounded-2xl border px-4 py-2 font-mono text-[11px]">
            <div className="flex items-center gap-4">
              <span>{metrics.total_tokens.toLocaleString()} tokens</span>
              <span className="text-border">|</span>
              <span className="font-semibold">${metrics.total_cost_usd.toFixed(4)} USD</span>
              <span className="text-border">|</span>
              <span>{metrics.llm_calls} llamadas</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] opacity-70">
              <span>LLM ${(metrics.llm_cost_usd || 0).toFixed(4)}</span>
              <span className="text-border">·</span>
              <span>Voz ${(metrics.tts_cost_usd || 0).toFixed(4)}</span>
              <span className="text-border">·</span>
              <span>Escucha ${(metrics.stt_cost_usd || 0).toFixed(4)}</span>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="mb-4 flex w-full max-w-md items-center justify-center gap-2.5 rounded-xl border-2 border-purple-300 bg-purple-50 px-4 py-3 dark:border-purple-700 dark:bg-purple-950/30">
            <svg
              className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              Generando notas de sesion...
            </span>
          </div>
        )}

        <p className="text-muted-foreground mb-5 text-sm">Elige con quien quieres hablar</p>

        {preselectedBanner && (
          <div className="mb-4 flex w-full max-w-md items-center justify-between rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2.5">
            <span className="text-foreground text-sm">
              Vas a conversar con <strong>{preselectedBanner}</strong>
            </span>
            <button
              onClick={() => setPreselectedBanner(null)}
              className="text-muted-foreground hover:text-foreground ml-2 text-xs"
            >
              &times;
            </button>
          </div>
        )}

        <div className="mb-5 grid w-full max-w-md grid-cols-3 gap-2.5">
          {visiblePersonalities
            .filter((p) => !(isGuest && p.key === 'psicologo'))
            .map((p) => (
              <button
                key={p.key}
                onClick={() => onSelectPersonality(p.key)}
                className={`flex flex-col items-center rounded-xl border-2 px-3 py-2.5 transition-all ${
                  selectedPersonality === p.key
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-md'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <span className="mb-1 text-xl">{p.emoji}</span>
                <span className="text-foreground text-xs font-semibold">{p.name}</span>
                <span className="text-muted-foreground text-[10px]">{p.description}</span>
              </button>
            ))}
        </div>

        {/* Famous character selector */}
        {isNormal && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedFamous}
              onChange={(e) => {
                setSelectedFamous(e.target.value);
                if (e.target.value !== CUSTOM_KEY) setCustomName('');
              }}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {DEFAULT_FAMOUS_CHARACTERS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              {customCharacters.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              <option value={CUSTOM_KEY}>Otro...</option>
            </select>
            {selectedFamous === CUSTOM_KEY && (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Escribe el nombre del personaje"
                autoFocus
                className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            )}
          </div>
        )}

        {/* Lawyer specialty selector */}
        {isAbogado && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedLawyer}
              onChange={(e) => {
                setSelectedLawyer(e.target.value);
                if (e.target.value !== CUSTOM_LAWYER_KEY) setCustomLawyerName('');
              }}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {LAWYER_SPECIALTIES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              {customLawyers.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              <option value={CUSTOM_LAWYER_KEY}>Otro...</option>
            </select>
            {selectedLawyer === CUSTOM_LAWYER_KEY && (
              <input
                type="text"
                value={customLawyerName}
                onChange={(e) => setCustomLawyerName(e.target.value)}
                placeholder="Escribe la especialidad legal"
                autoFocus
                className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            )}
          </div>
        )}

        {/* Trader market selector */}
        {isTrader && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedTrader}
              onChange={(e) => {
                setSelectedTrader(e.target.value);
                if (e.target.value !== CUSTOM_TRADER_KEY) setCustomTraderName('');
              }}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {TRADER_MARKETS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              {customTraders.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              <option value={CUSTOM_TRADER_KEY}>Otro...</option>
            </select>
            {selectedTrader === CUSTOM_TRADER_KEY && (
              <input
                type="text"
                value={customTraderName}
                onChange={(e) => setCustomTraderName(e.target.value)}
                placeholder="Escribe el tipo de mercado o tema"
                autoFocus
                className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            )}
          </div>
        )}

        {/* System advisor selector */}
        {isAsesor && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedAdvisor}
              onChange={(e) => setSelectedAdvisor(e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {SYSTEM_ADVISORS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              Comparte tu pantalla durante la llamada para que el asesor te guíe visualmente
            </p>
          </div>
        )}

        {/* Language teacher selector */}
        {isIdiomas && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {LANGUAGE_TEACHERS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              El maestro adapta el nivel a tu experiencia con el idioma
            </p>
          </div>
        )}

        {/* Spiritual guide selector */}
        {isEspiritual && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedGuide}
              onChange={(e) => setSelectedGuide(e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {SPIRITUAL_GUIDES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Instructor selector */}
        {isInstructor && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedInstructor}
              onChange={(e) => {
                setSelectedInstructor(e.target.value);
                if (e.target.value !== CUSTOM_INSTRUCTOR_KEY) setCustomInstructorName('');
              }}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {INSTRUCTORS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              {customInstructors.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
              <option value={CUSTOM_INSTRUCTOR_KEY}>Otro...</option>
            </select>
            {selectedInstructor === CUSTOM_INSTRUCTOR_KEY && (
              <input
                type="text"
                value={customInstructorName}
                onChange={(e) => setCustomInstructorName(e.target.value)}
                placeholder="Describe el tipo de instructor"
                autoFocus
                className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            )}
          </div>
        )}

        {/* Nutrióloga selector */}
        {isNutriologa && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedNutritionist}
              onChange={(e) => setSelectedNutritionist(e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {NUTRITIONIST_SPECIALTIES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              No sustituye una consulta profesional presencial
            </p>
          </div>
        )}

        {/* Dra. Ana patient selector */}
        {isPsicologo && (
          <div className="mb-4 w-full max-w-sm">
            {/* Patient list */}
            {patients.length > 0 && (
              <div className="mb-3 flex flex-col gap-1.5">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setCreatingPatient(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all ${
                      selectedPatientId === p.id
                        ? 'border-purple-400 bg-purple-50 shadow-sm dark:border-purple-600 dark:bg-purple-950/30'
                        : 'border-border hover:border-purple-300 dark:hover:border-purple-700'
                    }`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-200 text-sm dark:bg-purple-800">
                      👤
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-bold">{p.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {p.sessionsCount} {p.sessionsCount === 1 ? 'sesion' : 'sesiones'} &middot;
                        Proxima: #{p.sessionNumber}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* New patient form */}
            {creatingPatient ? (
              <div className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-3 dark:border-purple-700 dark:bg-purple-950/20">
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreatingPatient(false);
                      setNewPatientName('');
                    }
                  }}
                  placeholder="Nombre del paciente"
                  autoFocus
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground mb-2 w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                />

                {/* Therapy method selector */}
                <label className="text-muted-foreground mt-2 mb-1 block text-left text-[11px] font-semibold uppercase">
                  Enfoque terapeutico
                </label>
                <select
                  value={therapyMethod}
                  onChange={(e) => setTherapyMethod(e.target.value)}
                  className="border-border bg-background text-foreground mb-2 w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                >
                  {THERAPY_METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {/* Couple therapy toggle */}
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-left">
                  <input
                    type="checkbox"
                    checked={coupleTherapy}
                    onChange={(e) => setCoupleTherapy(e.target.checked)}
                    className="h-4 w-4 rounded border-purple-400 accent-purple-600"
                  />
                  <span className="text-foreground text-xs font-medium">Terapia de pareja</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const patientId = newPatientName
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_-]/g, '');
                      if (patientId) {
                        setCreatingPatient(false);
                        setNewPatientName('');
                        onStartCall('psicologo', patientId, {
                          therapyMethod,
                          coupleTherapy,
                        });
                      }
                    }}
                    disabled={!newPatientName.trim()}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    Iniciar primera sesion
                  </button>
                  <button
                    onClick={() => {
                      setCreatingPatient(false);
                      setNewPatientName('');
                    }}
                    className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-3 py-1.5 text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCreatingPatient(true);
                  setSelectedPatientId(null);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-purple-300 p-2.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20"
              >
                <span className="text-base">+</span>
                Nuevo paciente
              </button>
            )}

            <p className="text-muted-foreground mt-2 text-center text-xs">{today}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex w-64 flex-col gap-2">
          {isPsicologo ? (
            <>
              <Button
                size="lg"
                onClick={() => onStartCall('psicologo', selectedPatientId || undefined)}
                disabled={!selectedPatientId}
                className="w-full rounded-full bg-purple-600 font-mono text-xs font-bold tracking-wider uppercase hover:bg-purple-700 disabled:opacity-50"
              >
                Iniciar sesion
              </Button>
              {onViewNotes && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onViewNotes}
                  className="w-full rounded-full border-purple-300 font-mono text-xs font-bold tracking-wider text-purple-700 uppercase hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
                >
                  Ver notas
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                size="lg"
                onClick={() => {
                  // Handle custom "Otro..." for Famous Characters
                  if (isNormal && selectedFamous === CUSTOM_KEY) {
                    const name = customName.trim();
                    if (!name) return;
                    const slug = name
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z0-9_-]/g, '');
                    const key = `custom_${slug}`;
                    const exists = customCharacters.some((c) => c.key === key);
                    if (!exists) {
                      const updated = [...customCharacters, { key, name }];
                      setCustomCharacters(updated);
                      saveCustomCharacters(updated);
                    }
                    setSelectedFamous(key);
                    setCustomName('');
                    onStartCall(key);
                    return;
                  }
                  // Handle custom "Otro..." for Lawyer
                  if (isAbogado && selectedLawyer === CUSTOM_LAWYER_KEY) {
                    const name = customLawyerName.trim();
                    if (!name) return;
                    const slug = name
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z0-9_-]/g, '');
                    const key = `custom_abogado_${slug}`;
                    const exists = customLawyers.some((c) => c.key === key);
                    if (!exists) {
                      const updated = [...customLawyers, { key, name }];
                      setCustomLawyers(updated);
                      saveCustomLawyers(updated);
                    }
                    setSelectedLawyer(key);
                    setCustomLawyerName('');
                    onStartCall(key);
                    return;
                  }
                  // Handle custom "Otro..." for Trader
                  if (isTrader && selectedTrader === CUSTOM_TRADER_KEY) {
                    const name = customTraderName.trim();
                    if (!name) return;
                    const slug = name
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z0-9_-]/g, '');
                    const key = `custom_trader_${slug}`;
                    const exists = customTraders.some((c) => c.key === key);
                    if (!exists) {
                      const updated = [...customTraders, { key, name }];
                      setCustomTraders(updated);
                      saveCustomTraders(updated);
                    }
                    setSelectedTrader(key);
                    setCustomTraderName('');
                    onStartCall(key);
                    return;
                  }
                  // Handle custom "Otro..." for Instructor
                  if (isInstructor && selectedInstructor === CUSTOM_INSTRUCTOR_KEY) {
                    const name = customInstructorName.trim();
                    if (!name) return;
                    const slug = name
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z0-9_-]/g, '');
                    const key = `custom_instructor_${slug}`;
                    const exists = customInstructors.some((c) => c.key === key);
                    if (!exists) {
                      const updated = [...customInstructors, { key, name }];
                      setCustomInstructors(updated);
                      saveCustomInstructors(updated);
                    }
                    setSelectedInstructor(key);
                    setCustomInstructorName('');
                    onStartCall(key);
                    return;
                  }
                  // Standard selection
                  const effectiveKey = isEspiritual
                    ? selectedGuide
                    : isIdiomas
                      ? selectedLanguage
                      : isNormal
                        ? selectedFamous
                        : isAbogado
                          ? selectedLawyer
                          : isTrader
                            ? selectedTrader
                            : isAsesor
                              ? selectedAdvisor
                              : isInstructor
                                ? selectedInstructor
                                : isNutriologa
                                  ? selectedNutritionist
                                  : selectedPersonality;
                  onStartCall(effectiveKey);
                }}
                disabled={
                  (isNormal && selectedFamous === CUSTOM_KEY && !customName.trim()) ||
                  (isAbogado && selectedLawyer === CUSTOM_LAWYER_KEY && !customLawyerName.trim()) ||
                  (isTrader && selectedTrader === CUSTOM_TRADER_KEY && !customTraderName.trim()) ||
                  (isInstructor &&
                    selectedInstructor === CUSTOM_INSTRUCTOR_KEY &&
                    !customInstructorName.trim())
                }
                className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase disabled:opacity-50"
              >
                {startButtonText}
              </Button>
              {(() => {
                const effectiveKey = isEspiritual
                  ? selectedGuide
                  : isIdiomas
                    ? selectedLanguage
                    : isNormal
                      ? selectedFamous
                      : isAbogado
                        ? selectedLawyer
                        : isTrader
                          ? selectedTrader
                          : isAsesor
                            ? selectedAdvisor
                            : selectedPersonality;
                const count = conversationCounts[effectiveKey] || 0;
                if (count > 0 && onViewConversations) {
                  return (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => onViewConversations(effectiveKey)}
                      className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase"
                    >
                      Ver conversaciones ({count})
                    </Button>
                  );
                }
                return null;
              })()}
            </>
          )}
        </div>

        {/* Guest banner */}
        {isGuest && (
          <div className="mt-4 w-full max-w-md rounded-xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/5 px-4 py-3 text-center">
            <p className="text-foreground text-xs font-medium">
              Estas en modo de prueba.{' '}
              <Link href="/register" className="text-primary font-bold underline">
                Crea tu cuenta
              </Link>{' '}
              para tiempo ilimitado e historial de conversaciones.
            </p>
          </div>
        )}

        {/* Settings, admin & logout links */}
        <div className="mt-4 flex items-center gap-4">
          {isGuest ? (
            <>
              <Link href="/register" className="text-primary text-xs font-bold underline">
                Crear cuenta
              </Link>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
              >
                Iniciar sesion
              </Link>
            </>
          ) : (
            <>
              {onTranscribe && (
                <button
                  onClick={onTranscribe}
                  className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
                >
                  Transcribir audio
                </button>
              )}
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
                >
                  Configuracion
                </button>
              )}
              {isAdmin && onAdminPanel && (
                <button
                  onClick={onAdminPanel}
                  className="text-muted-foreground text-xs underline transition-colors hover:text-amber-600 dark:hover:text-amber-400"
                >
                  Usuarios
                </button>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-muted-foreground text-xs underline transition-colors hover:text-red-500"
                >
                  Salir
                </button>
              )}
            </>
          )}
        </div>
        <span className="text-muted-foreground mt-4 text-[10px]">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
      </section>
    </div>
  );
};
