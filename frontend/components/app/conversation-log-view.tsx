'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ConversationFile {
  filename: string;
  date: string;
  time: string;
}

interface ConversationLogViewProps {
  personality: string;
  personalityName: string;
  onBack: () => void;
  onStartCall: () => void;
}

function MarkdownContent({ content }: { content: string }) {
  const cleaned = content.replace(/^```markdown\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return (
    <article>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-foreground border-border mt-6 mb-4 border-b pb-2 text-xl font-bold">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-foreground mt-5 mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="bg-primary inline-block h-5 w-1 rounded-full" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-foreground mt-4 mb-2 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/80 mb-3 text-sm leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-foreground/80 mb-3 ml-1 space-y-1.5 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-foreground/80 mb-3 ml-1 list-decimal space-y-1.5 pl-4 text-sm">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="bg-primary/60 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          hr: () => <hr className="border-border my-4" />,
          blockquote: ({ children }) => (
            <blockquote className="text-foreground/70 border-primary/40 bg-primary/5 my-3 rounded-r-lg border-l-3 py-2 pr-3 pl-4 text-sm italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </article>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function ConversationLogView({
  personality,
  personalityName,
  onBack,
  onStartCall,
}: ConversationLogViewProps) {
  const [conversations, setConversations] = useState<ConversationFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [viewingFilename, setViewingFilename] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data) => {
        const match = (data.personalities || []).find(
          (p: { personality: string }) => p.personality === personality
        );
        setConversations(match?.conversations || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [personality]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [viewingFilename]);

  const handleView = async (filename: string) => {
    try {
      const res = await fetch(
        `/api/conversations/${filename}?personality=${encodeURIComponent(personality)}`
      );
      const data = await res.json();
      setViewingContent(data.content);
      setViewingFilename(filename);
    } catch {
      setViewingContent('Error al cargar la conversacion.');
      setViewingFilename(filename);
    }
  };

  if (loading) {
    return (
      <div className="bg-background text-muted-foreground fixed inset-0 flex items-center justify-center">
        <p className="text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      {/* Header */}
      <header className="border-border bg-background/95 flex-shrink-0 border-b px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (viewingFilename) {
                  setViewingFilename(null);
                  setViewingContent(null);
                } else {
                  onBack();
                }
              }}
              className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
              title="Volver"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h2 className="text-foreground text-base leading-tight font-bold">
                {personalityName}
              </h2>
              <p className="text-muted-foreground text-[11px]">
                {conversations.length}{' '}
                {conversations.length === 1 ? 'conversacion' : 'conversaciones'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onStartCall}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-1.5 text-xs font-bold transition-colors"
            >
              Nueva conversacion
            </button>
            <button
              onClick={onBack}
              className="border-border text-muted-foreground hover:text-foreground rounded-full border px-4 py-1.5 text-xs font-medium transition-colors"
            >
              Inicio
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 pb-16">
          {viewingFilename && viewingContent ? (
            <MarkdownContent content={viewingContent} />
          ) : conversations.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
              <div className="mb-3 text-4xl opacity-30">💬</div>
              <p className="text-sm">No hay conversaciones guardadas.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((c, i) => (
                <button
                  key={c.filename}
                  onClick={() => handleView(c.filename)}
                  className="group border-border bg-background hover:border-primary/50 flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold">
                      #{conversations.length - i}
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{formatDate(c.date)}</p>
                      <p className="text-muted-foreground text-xs">{c.time} hrs</p>
                    </div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
