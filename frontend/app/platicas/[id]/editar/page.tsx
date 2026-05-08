'use client';

// Edición de una plática existente. Reusa los mismos campos del formulario de
// creación, pero el PDF es inmutable (cambiar el PDF requiere recrear la plática
// para mantener la integridad slide_count ↔ blocks). Cada bloque del guion se
// edita en una tarjeta independiente.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CARTESIA_VOICES_ES } from '@/lib/personalities-config';
import type { AdvanceMode, GuionBlock, PlaticaGuion, PlaticaManifest } from '@/lib/platica-schema';

const PRESENTER_PERSONALITIES: { key: string; label: string }[] = [
  { key: 'tato', label: 'Tato — Vecino cálido' },
  { key: 'ia_honesta', label: 'I.A. Honesta' },
  { key: 'instructor_historia', label: 'Profesor de Historia' },
  { key: 'coach_oratoria', label: 'Coach de Oratoria' },
];

const ADVANCE_MODE_DESCRIPTIONS: Record<AdvanceMode, { label: string; help: string }> = {
  hybrid: {
    label: 'Híbrido (recomendado)',
    help: 'Avanza solo cuando termina el slide; pausa si la audiencia pregunta. Evita silencios largos.',
  },
  on_cue: {
    label: 'Por señal',
    help: 'Termina cada slide y se queda quieto hasta que alguien diga "sigamos" o equivalente. Acepta silencios.',
  },
  auto: {
    label: 'Automático',
    help: 'Avanza solo en cuanto termina. Evita silencios.',
  },
};

export default function EditarPlaticaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [manifest, setManifest] = useState<PlaticaManifest | null>(null);
  const [blocks, setBlocks] = useState<GuionBlock[] | null>(null);
  const [glossaryText, setGlossaryText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/platicas/${id}`, { credentials: 'include' })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        return body;
      })
      .then((data) => {
        const m = data.manifest as PlaticaManifest;
        const g = data.guion as PlaticaGuion;
        setManifest(m);
        setBlocks(g.blocks);
        setGlossaryText(m.glossary ? JSON.stringify(m.glossary, null, 2) : '');
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  const updateManifest = (patch: Partial<PlaticaManifest>) => {
    setManifest((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateBlock = (idx: number, patch: Partial<GuionBlock>) => {
    setBlocks((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manifest || !blocks) return;
    setError(null);

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
    } else {
      glossary = undefined;
    }

    // Recompute start_sec from durations to keep them consistent.
    let acc = 0;
    const cleanedBlocks = blocks.map((b) => {
      const out = { ...b, start_sec: acc };
      acc += Math.max(0, Number(b.duration_sec) || 0);
      return out;
    });

    const manifestPatch = {
      title: manifest.title,
      personality_key: manifest.personality_key,
      audience_profile: manifest.audience_profile,
      narrative_tone: manifest.narrative_tone,
      advance_mode: manifest.advance_mode,
      voice_id: manifest.voice_id || undefined,
      model: manifest.model || undefined,
      glossary,
      story_arcs: manifest.story_arcs,
      key_moments: manifest.key_moments,
    };

    setSaving(true);
    try {
      const r = await fetch(`/api/platicas/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest: manifestPatch,
          guion: { blocks: cleanedBlocks },
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="bg-background text-foreground min-h-svh">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link href="/platicas" className="text-muted-foreground hover:text-foreground text-xs">
            ← Pláticas
          </Link>
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {loadError}
          </div>
        </div>
      </div>
    );
  }
  if (!manifest || !blocks) {
    return (
      <div className="bg-background text-foreground min-h-svh">
        <div className="text-muted-foreground mx-auto max-w-2xl px-4 py-8 text-sm">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <Link href="/platicas" className="text-muted-foreground hover:text-foreground text-xs">
              ← Pláticas
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Editar plática</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {manifest.slide_count} slides — el PDF es inmutable; para cambiar diapositivas crea
              una plática nueva.
            </p>
          </div>
          {savedAt && Date.now() - savedAt < 4000 && (
            <div className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
              ✓ Guardado
            </div>
          )}
        </div>

        <form onSubmit={submit} className="space-y-5">
          <Field label="Título" required>
            <input
              type="text"
              value={manifest.title}
              onChange={(e) => updateManifest({ title: e.target.value })}
              required
              className="input"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Personalidad del presentador" required>
              <select
                value={manifest.personality_key}
                onChange={(e) => updateManifest({ personality_key: e.target.value })}
                className="input"
              >
                {PRESENTER_PERSONALITIES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                {/* Si el manifest tiene una personality que no está en la lista,
                    la mostramos como opción extra para no perder el valor. */}
                {!PRESENTER_PERSONALITIES.some((p) => p.key === manifest.personality_key) && (
                  <option value={manifest.personality_key}>
                    {manifest.personality_key} (custom)
                  </option>
                )}
              </select>
            </Field>
            <Field label="Voz (opcional)">
              <select
                value={manifest.voice_id ?? ''}
                onChange={(e) => updateManifest({ voice_id: e.target.value || undefined })}
                className="input"
              >
                <option value="">— voz default de la personalidad —</option>
                {CARTESIA_VOICES_ES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Modelo de IA (OpenRouter, opcional)"
            help="Si lo dejas en blanco, se usa el modelo configurado en la personalidad. Solo cámbialo si sabes lo que haces."
          >
            <input
              type="text"
              value={manifest.model ?? ''}
              onChange={(e) => updateManifest({ model: e.target.value || undefined })}
              placeholder="ej. google/gemini-2.0-flash-001, anthropic/claude-haiku-4.5, deepseek/deepseek-v3.2-exp"
              className="input font-mono text-xs"
            />
          </Field>

          <Field label="Modo de avance" required>
            <div className="space-y-2">
              {(['hybrid', 'on_cue', 'auto'] as AdvanceMode[]).map((m) => {
                const info = ADVANCE_MODE_DESCRIPTIONS[m];
                const checked = (manifest.advance_mode ?? 'hybrid') === m;
                return (
                  <label
                    key={m}
                    className={`border-border flex cursor-pointer gap-3 rounded-lg border p-3 ${
                      checked ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="advance_mode"
                      value={m}
                      checked={checked}
                      onChange={() => updateManifest({ advance_mode: m })}
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

          <Field label="Perfil de la audiencia" required>
            <textarea
              value={manifest.audience_profile}
              onChange={(e) => updateManifest({ audience_profile: e.target.value })}
              required
              rows={3}
              className="input"
            />
          </Field>

          <Field label="Tono narrativo" required>
            <textarea
              value={manifest.narrative_tone}
              onChange={(e) => updateManifest({ narrative_tone: e.target.value })}
              required
              rows={3}
              className="input"
            />
          </Field>

          <Field
            label="Glosario (opcional)"
            help='Objeto JSON: { "término": "explicación coloquial" }'
          >
            <textarea
              value={glossaryText}
              onChange={(e) => setGlossaryText(e.target.value)}
              rows={3}
              className="input font-mono text-xs"
              placeholder='{"modelo": "como un cocinero entrenado"}'
            />
          </Field>

          <div className="border-border rounded-xl border p-4">
            <div className="mb-3 text-sm font-semibold">Bloques del guion ({blocks.length})</div>
            <div className="space-y-3">
              {blocks.map((b, i) => (
                <BlockEditor key={i} block={b} onChange={(patch) => updateBlock(i, patch)} />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/platicas')}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-mono text-xs font-bold tracking-wider uppercase disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
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
          placeholder="Lo que el presentador dice"
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
