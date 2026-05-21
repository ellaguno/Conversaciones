'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewInterviewForm() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'legado' | 'corporativo'>('legado');
  const [frequency, setFrequency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive a safe id from the entered name if the user hasn't typed an id.
  const effectiveId =
    id ||
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/entrevistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: effectiveId,
          intervieweeName: name,
          mode,
          frequency,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Error ${res.status}`);
      }
      const data = await res.json();
      router.push(`/entrevistas/${encodeURIComponent(data.id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="block">
        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Nombre (de quien será entrevistado)
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          placeholder="Mi abuelo Quique"
          required
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Identificador (slug)
        </span>
        <input
          value={id}
          onChange={(e) => setId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800"
          placeholder={effectiveId || 'auto'}
          maxLength={60}
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Modo</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'legado' | 'corporativo')}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="legado">Legado personal (memorias, anécdotas, consejos)</option>
          <option value="corporativo">Conocimiento profesional (transferencia)</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Frecuencia tentativa
        </span>
        <input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          placeholder="semanal, 2 veces por semana…"
        />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={busy || !name}
          className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white uppercase disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? 'Creando…' : 'Crear entrevista'}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </form>
  );
}
