'use client';

// Formulario para crear una plática nueva. Tres modos para el guion:
//   - 'auto'  → solo PDF, el backend deriva speaker_notes del texto del slide.
//   - 'doc'   → PDF + documento narrativo (.pdf/.txt); un LLM alinea con cada slide.
//   - 'json'  → JSON estructurado (file o paste).
// Para auto/doc, después de generar el preview el usuario edita cada slide
// antes de guardar.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CARTESIA_VOICES_ES } from '@/lib/personalities-config';
import {
  type AdvanceMode,
  DEFAULT_PRESENTER,
  type GuionBlock,
  type PlaticaGuion,
  type PresenterGender,
} from '@/lib/platica-schema';

type GuionMode = 'doc' | 'auto' | 'json';

// Cartesia voice id → 'hombre' | 'mujer'. Cuando el usuario elige voz, sincroniza
// el género para que las concordancias del LLM coincidan con cómo suena.
const VOICE_GENDER_MAP: Record<string, PresenterGender> = Object.fromEntries(
  CARTESIA_VOICES_ES.map((v) => [v.id, v.gender === 'F' ? 'mujer' : 'hombre'])
);

const ADVANCE_MODE_DESCRIPTIONS: Record<AdvanceMode, { label: string; help: string }> = {
  hybrid: {
    label: 'Híbrido (recomendado)',
    help: 'Avanza solo cuando termina el slide, pero pausa si la audiencia pregunta. Si oye "sigamos" avanza inmediatamente.',
  },
  on_cue: {
    label: 'Por señal',
    help: 'Termina cada slide y se queda quieto hasta que alguien diga "sigamos" o equivalente.',
  },
  auto: {
    label: 'Automático',
    help: 'Avanza solo en cuanto termina el slide, sin esperar señales.',
  },
};

const GUION_MODE_OPTIONS: { value: GuionMode; label: string; help: string }[] = [
  {
    value: 'doc',
    label: 'Subir guion en documento (recomendado)',
    help: 'Subes tu guion narrativo en .pdf o .txt y la IA lo alinea con cada slide. Después puedes editar cada bloque antes de guardar. ~10s, costo aprox. 1¢.',
  },
  {
    value: 'auto',
    label: 'Generar a partir de las láminas',
    help: 'Solo subes el PDF; el sistema deriva speaker_notes del texto de cada slide. Bueno para slides con texto. Pobre para slides muy visuales.',
  },
  {
    value: 'json',
    label: 'Tengo el guion en JSON estructurado',
    help: 'Para usuarios técnicos: subes o pegas el JSON directamente.',
  },
];

const JSON_TEMPLATE = JSON.stringify(
  {
    blocks: [
      {
        slide: 1,
        summary: 'Bienvenida',
        start_sec: 0,
        duration_sec: 60,
        speaker_notes: 'Saluda con calidez. Presenta el tema.',
        talking_points: ['saludo', 'tema'],
      },
    ],
  },
  null,
  2
);

export default function NuevaPlaticaPage() {
  const router = useRouter();

  // Metadata
  const [title, setTitle] = useState('');
  const [presenterName, setPresenterName] = useState<string>(DEFAULT_PRESENTER.name);
  const [presenterGender, setPresenterGender] = useState<PresenterGender>(DEFAULT_PRESENTER.gender);
  const [presenterPersona, setPresenterPersona] = useState<string>(DEFAULT_PRESENTER.persona);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_PRESENTER.voice_id);
  const [model, setModel] = useState('');
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>('hybrid');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [glossaryText, setGlossaryText] = useState('');

  // PDF (always required)
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Guion mode + sources
  const [guionMode, setGuionMode] = useState<GuionMode>('doc');
  const [sourceFile, setSourceFile] = useState<File | null>(null); // for 'doc'
  const [guionJsonFile, setGuionJsonFile] = useState<File | null>(null); // for 'json'
  const [guionJsonText, setGuionJsonText] = useState(''); // for 'json'

  // Preview state (after generation in auto/doc modes)
  const [previewBlocks, setPreviewBlocks] = useState<GuionBlock[] | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePreview = async () => {
    setError(null);
    setPreviewBlocks(null);
    setPreviewWarnings([]);
    if (!pdfFile) {
      setError('Sube primero el PDF.');
      return;
    }
    if (guionMode === 'doc' && !sourceFile) {
      setError('Sube el documento del guion (.pdf o .txt) o cambia a otro modo.');
      return;
    }
    if (guionMode === 'doc' && !audience.trim()) {
      setError('Llena "Perfil de la audiencia" antes de generar — el LLM lo usa para alinear.');
      return;
    }

    const fd = new FormData();
    fd.append('mode', guionMode);
    fd.append('pdf', pdfFile);
    if (guionMode === 'doc') {
      fd.append('source', sourceFile!);
      fd.append('title', title || 'Plática');
      fd.append('audience_profile', audience);
      fd.append('narrative_tone', tone);
    }

    setGenerating(true);
    try {
      const r = await fetch('/api/platicas/preview-guion', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      const guion = body.guion as PlaticaGuion;
      setPreviewBlocks(guion.blocks);
      setPreviewWarnings(Array.isArray(body.meta?.warnings) ? body.meta.warnings : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const updateBlock = (idx: number, patch: Partial<GuionBlock>) => {
    setPreviewBlocks((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pdfFile) {
      setError('Falta el archivo PDF.');
      return;
    }

    // Resolve guion JSON depending on mode.
    let guionRaw: string;
    if (guionMode === 'json') {
      if (guionJsonFile) {
        guionRaw = await guionJsonFile.text();
      } else if (guionJsonText.trim()) {
        guionRaw = guionJsonText.trim();
      } else {
        setError('En modo JSON: sube un archivo .json o pega el JSON.');
        return;
      }
      try {
        JSON.parse(guionRaw);
      } catch {
        setError('El guion JSON no es válido.');
        return;
      }
    } else {
      if (!previewBlocks) {
        setError('Genera el preview del guion antes de guardar.');
        return;
      }
      // Recompute start_sec from current durations so any edits stay consistent.
      let acc = 0;
      const blocks = previewBlocks.map((b) => {
        const out = { ...b, start_sec: acc };
        acc += Math.max(0, Number(b.duration_sec) || 0);
        return out;
      });
      guionRaw = JSON.stringify({ blocks });
    }

    let glossary: Record<string, string> | undefined;
    if (glossaryText.trim()) {
      try {
        const parsed = JSON.parse(glossaryText);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('El glosario debe ser un objeto JSON.');
          return;
        }
        glossary = parsed;
      } catch {
        setError('El glosario no es JSON válido.');
        return;
      }
    }

    const manifest = {
      title: title.trim(),
      personality_key: 'custom',
      presenter_name: presenterName.trim() || undefined,
      presenter_gender: presenterGender,
      presenter_persona: presenterPersona.trim() || undefined,
      audience_profile: audience.trim(),
      narrative_tone: tone.trim(),
      advance_mode: advanceMode,
      ...(voiceId && { voice_id: voiceId }),
      ...(model.trim() && { model: model.trim() }),
      ...(glossary && { glossary }),
    };

    const fd = new FormData();
    fd.append('manifest', JSON.stringify(manifest));
    fd.append('guion', guionRaw);
    fd.append('pdf', pdfFile);

    setSubmitting(true);
    try {
      const r = await fetch('/api/platicas', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      router.push('/platicas');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Link href="/platicas" className="text-muted-foreground hover:text-foreground text-xs">
            ← Pláticas
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Nueva plática</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sube un PDF y elige cómo aportar el guion. Si el guion lo escribió la IA, podrás
            editarlo antes de guardar.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <Field label="Título" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input"
              placeholder="Plática vecinal de IA — Temixco"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Nombre" required>
              <input
                type="text"
                value={presenterName}
                onChange={(e) => setPresenterName(e.target.value)}
                required
                className="input"
                placeholder="Tato"
              />
            </Field>
            <Field label="Género" required>
              <select
                value={presenterGender}
                onChange={(e) => setPresenterGender(e.target.value as PresenterGender)}
                className="input"
              >
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
              </select>
            </Field>
            <Field label="Voz">
              <select
                value={voiceId}
                onChange={(e) => {
                  const newVoice = e.target.value;
                  setVoiceId(newVoice);
                  // Realinea género con la voz seleccionada (concordancias).
                  const inferred = newVoice ? VOICE_GENDER_MAP[newVoice] : undefined;
                  if (inferred) setPresenterGender(inferred);
                }}
                className="input"
              >
                <option value="">— sin asignar —</option>
                {CARTESIA_VOICES_ES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Personalidad del presentador"
            required
            help="Texto que se inyecta como system prompt del agente. Define cómo habla, qué reglas sigue y su tono."
          >
            <textarea
              value={presenterPersona}
              onChange={(e) => setPresenterPersona(e.target.value)}
              required
              rows={10}
              className="input text-sm"
            />
          </Field>

          <Field
            label="Modelo de IA (OpenRouter, opcional)"
            help="Si lo dejas en blanco, se usa el modelo configurado en la personalidad. Solo cámbialo si sabes lo que haces."
          >
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ej. google/gemini-2.0-flash-001, deepseek/deepseek-v3.2-exp, anthropic/claude-haiku-4.5"
              className="input font-mono text-xs"
            />
          </Field>

          <Field label="Modo de avance" required>
            <div className="space-y-2">
              {(['hybrid', 'on_cue', 'auto'] as AdvanceMode[]).map((m) => {
                const info = ADVANCE_MODE_DESCRIPTIONS[m];
                return (
                  <label
                    key={m}
                    className={`border-border flex cursor-pointer gap-3 rounded-lg border p-3 ${
                      advanceMode === m ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="advance_mode"
                      value={m}
                      checked={advanceMode === m}
                      onChange={() => setAdvanceMode(m)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-semibold">{info.label}</div>
                      <div className="text-muted-foreground text-xs">{info.help}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Field>

          <Field
            label="Perfil de la audiencia"
            required
            help="¿Para quién es la plática? Edad, conocimiento previo, contexto."
          >
            <textarea
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              required
              rows={3}
              className="input"
              placeholder="Adultos mayores de Temixco que conocen la IA por primera vez..."
            />
          </Field>

          <Field
            label="Tono narrativo"
            required
            help="Cómo debe sonar el presentador. Da metáforas, registros, instrucciones de estilo."
          >
            <textarea
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              required
              rows={3}
              className="input"
              placeholder="Cuenta cuentos cálido. Cada slide es un capítulo. Usa analogías de cocina y jardín..."
            />
          </Field>

          <Field
            label="Glosario (opcional)"
            help='Pega un objeto JSON: { "término técnico": "explicación coloquial" }'
          >
            <textarea
              value={glossaryText}
              onChange={(e) => setGlossaryText(e.target.value)}
              rows={2}
              className="input font-mono text-xs"
              placeholder='{"modelo": "como un cocinero entrenado"}'
            />
          </Field>

          <Field label="Presentación (PDF)" required>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                setPdfFile(e.target.files?.[0] ?? null);
                setPreviewBlocks(null); // invalidate preview if PDF changes
              }}
              required
              className="input"
            />
            {pdfFile && (
              <div className="text-muted-foreground mt-1 text-xs">
                {pdfFile.name} · {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
          </Field>

          <div className="border-border rounded-xl border p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold">Guion de la plática</div>
              <div className="text-muted-foreground text-xs">
                Elige cómo le vas a entregar el guion al presentador.
              </div>
            </div>
            <div className="space-y-2">
              {GUION_MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`border-border flex cursor-pointer gap-3 rounded-lg border p-3 ${
                    guionMode === opt.value ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="guion_mode"
                    value={opt.value}
                    checked={guionMode === opt.value}
                    onChange={() => {
                      setGuionMode(opt.value);
                      setPreviewBlocks(null);
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-muted-foreground text-xs">{opt.help}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Source upload for 'doc' mode */}
            {guionMode === 'doc' && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold">
                  Documento del guion <span className="text-red-500">*</span>
                </label>
                <p className="text-muted-foreground mb-1.5 text-xs">
                  Acepta .pdf o .txt. Tu narrativa puede estar en cualquier orden — el LLM la
                  alineará con cada slide del PDF.
                </p>
                <input
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                  className="input"
                />
                {sourceFile && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    {sourceFile.name} · {(sourceFile.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>
            )}

            {/* JSON inputs for 'json' mode */}
            {guionMode === 'json' && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Archivo .json</label>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => setGuionJsonFile(e.target.files?.[0] ?? null)}
                    className="input"
                  />
                </div>
                <details>
                  <summary className="text-muted-foreground cursor-pointer text-xs">
                    O pegar JSON directamente (ver plantilla)
                  </summary>
                  <textarea
                    value={guionJsonText}
                    onChange={(e) => setGuionJsonText(e.target.value)}
                    rows={10}
                    className="input mt-2 font-mono text-xs"
                    placeholder={JSON_TEMPLATE}
                  />
                </details>
              </div>
            )}

            {/* Generate button for auto/doc modes */}
            {(guionMode === 'auto' || guionMode === 'doc') && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={generatePreview}
                  disabled={generating || !pdfFile}
                  className="bg-secondary text-secondary-foreground rounded-full px-4 py-2 font-mono text-xs font-bold tracking-wider uppercase disabled:opacity-50"
                >
                  {generating
                    ? guionMode === 'doc'
                      ? 'Alineando con LLM (10-20s)…'
                      : 'Extrayendo texto…'
                    : previewBlocks
                      ? 'Regenerar preview'
                      : 'Generar guion preview'}
                </button>
              </div>
            )}
          </div>

          {/* Preview / editor */}
          {previewBlocks && previewBlocks.length > 0 && (
            <div className="border-border rounded-xl border p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    Preview del guion ({previewBlocks.length} bloques)
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Edita cualquier campo. Se guarda al crear la plática.
                  </div>
                </div>
                {previewWarnings.length > 0 && (
                  <div className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                    Slides con poco texto: {previewWarnings.join(', ')}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {previewBlocks.map((b, i) => (
                  <BlockEditor key={i} block={b} onChange={(patch) => updateBlock(i, patch)} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/platicas" className="text-muted-foreground hover:text-foreground text-sm">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-mono text-xs font-bold tracking-wider uppercase disabled:opacity-50"
            >
              {submitting ? 'Subiendo y rendirizando…' : 'Crear plática'}
            </button>
          </div>
        </form>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid var(--border);
            background: var(--background);
            color: var(--foreground);
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
          }
          :global(.input:focus) {
            outline: 2px solid var(--primary);
            outline-offset: -1px;
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {help && <p className="text-muted-foreground mb-1.5 text-xs">{help}</p>}
      {children}
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
}: {
  block: GuionBlock;
  onChange: (patch: Partial<GuionBlock>) => void;
}) {
  // Talking points are joined with newlines for editing convenience.
  const tpText = block.talking_points.join('\n');
  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Slide {block.slide}</div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          duración (seg)
          <input
            type="number"
            min={10}
            max={600}
            value={block.duration_sec}
            onChange={(e) => onChange({ duration_sec: parseInt(e.target.value, 10) || 60 })}
            className="input w-20 px-2 py-1 text-xs"
          />
        </label>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={block.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          className="input text-sm font-medium"
          placeholder="Resumen corto del slide"
        />
        <textarea
          value={block.speaker_notes}
          onChange={(e) => onChange({ speaker_notes: e.target.value })}
          rows={3}
          className="input text-sm"
          placeholder="Lo que el presentador dice en este slide"
        />
        <textarea
          value={tpText}
          onChange={(e) =>
            onChange({
              talking_points: e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          rows={2}
          className="input text-xs"
          placeholder="Talking points (uno por línea)"
        />
      </div>
    </div>
  );
}
