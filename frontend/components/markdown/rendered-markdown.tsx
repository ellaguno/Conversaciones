'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  className?: string;
}

/** Styled markdown renderer — matches the look of notes-view.tsx (Dra. Ana). */
export function RenderedMarkdown({ content, className }: Props) {
  const cleaned = content.replace(/^```markdown\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return (
    <article className={className}>
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
              <span className="inline-block h-5 w-1 rounded-full bg-purple-500" />
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
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          hr: () => <hr className="border-border my-4" />,
          blockquote: ({ children }) => (
            <blockquote className="text-foreground/70 my-3 rounded-r-lg border-l-3 border-purple-400 bg-purple-50 py-2 pr-3 pl-4 text-sm italic dark:bg-purple-950/20">
              {children}
            </blockquote>
          ),
          code: ({ children, ...props }) => (
            <code
              {...props}
              className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs"
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted text-foreground my-3 overflow-x-auto rounded-lg p-3 font-mono text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="border-border my-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold uppercase">
              {children}
            </thead>
          ),
          td: ({ children }) => (
            <td className="border-border text-foreground/80 border-t px-3 py-2">{children}</td>
          ),
          th: ({ children }) => <th className="px-3 py-2 text-left">{children}</th>,
          input: (props) => {
            if (props.type === 'checkbox') {
              return (
                <span
                  className={`mr-2 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
                    props.checked
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-border bg-background'
                  }`}
                >
                  {props.checked && '✓'}
                </span>
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </article>
  );
}
