'use client';

import { RenderedMarkdown } from '@/components/markdown/rendered-markdown';

interface DetailBlockProps {
  title: string;
  body: string;
  downloadFilename: string;
}

/** A boxed section that renders markdown nicely and offers a download. The
 * download is client-side: we already have the content in memory so a Blob
 * URL is enough — no extra round trip to the server. */
export function DetailBlock({ title, body, downloadFilename }: DetailBlockProps) {
  function download() {
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">{title}</h2>
        <button
          onClick={download}
          className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          descargar
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto pr-1">
        <RenderedMarkdown content={body} />
      </div>
    </section>
  );
}
