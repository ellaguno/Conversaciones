'use client';

import { useCallback, useEffect } from 'react';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface MarkdownEditorProps {
  content: string;
  onSave: (markdown: string) => void;
  onCancel: () => void;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMarkdown(editor: { storage: Record<string, any> }): string {
  return editor.storage.markdown.getMarkdown();
}

export function MarkdownEditor({ content, onSave, onCancel }: MarkdownEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Escribe aqui...' }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none min-h-[300px] px-1 py-2',
      },
    },
  });

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (editor) {
          const md = getMarkdown(editor);
          onSave(md);
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave, onCancel]);

  const handleSave = useCallback(() => {
    if (editor) {
      const md = getMarkdown(editor);
      onSave(md);
    }
  }, [editor, onSave]);

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-border bg-muted/30 flex flex-shrink-0 flex-wrap items-center gap-0.5 rounded-t-lg border-b px-2 py-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Titulo 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Titulo 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Titulo 3"
        >
          H3
        </ToolbarButton>

        <div className="bg-border mx-1 h-4 w-px" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negrita (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italica (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>

        <div className="bg-border mx-1 h-4 w-px" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Lista"
        >
          &bull; Lista
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          1. Lista
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Tareas"
        >
          &#9745; Tareas
        </ToolbarButton>

        <div className="bg-border mx-1 h-4 w-px" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Cita"
        >
          &ldquo; Cita
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Linea horizontal"
        >
          &#8213;
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        <button
          onClick={onCancel}
          className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-3 py-1 text-xs font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-purple-700"
        >
          Guardar
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

      <div className="border-border text-muted-foreground flex-shrink-0 border-t px-3 py-1.5 text-[10px]">
        Ctrl+S guardar &middot; Esc cancelar &middot; Ctrl+B negrita &middot; Ctrl+I italica
      </div>
    </div>
  );
}
