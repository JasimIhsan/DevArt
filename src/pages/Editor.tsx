import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { toastError, toggleTheme, useLoad, useTheme } from '../lib/ui.ts';
import { getFile, renameFile, saveElements, type DiagramFile } from '../lib/files.ts';
import { Canvas, removeElements } from '../components/Canvas.tsx';
import { DiagramPanel } from '../components/DiagramPanel.tsx';
import { Icon } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';
import type { CanvasElement, DiagramSelection } from '../core/types.ts';

type SaveState = 'saved' | 'saving' | 'error';
const SAVE_DELAY_MS = 800, RETRY_MS = 5000;

/**
 * The canvas edits a Yjs document in memory (for undo and fine-grained updates).
 * It is loaded from the saved elements, and each change is written back to Supabase after a short pause.
 */
function useFileDoc(file: DiagramFile) {
  const [save, setSave] = useState<SaveState>('saved');
  const doc = useMemo(() => {
    const d = new Y.Doc();
    // The 'load' origin keeps the initial content out of the undo history.
    d.transact(() => { const m = d.getMap<CanvasElement>('elements'); for (const e of file.elements) m.set(e.id, e); }, 'load');
    return d;
  }, [file.id]);

  useEffect(() => {
    const els = doc.getMap<CanvasElement>('elements');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    let chain: Promise<void> = Promise.resolve();

    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      if (!dirty) return chain;
      dirty = false;
      const snapshot = [...els.values()];
      chain = chain.then(() => saveElements(file.id, snapshot)).then(() => { if (!dirty && !timer) setSave('saved'); }).catch((e) => {
        dirty = true;
        setSave('error');
        toastError(e);
        timer = setTimeout(flush, RETRY_MS);
      });
      return chain;
    };
    const onUpdate = () => { dirty = true; setSave('saving'); clearTimeout(timer); timer = setTimeout(flush, SAVE_DELAY_MS); };
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    const onLeave = (e: BeforeUnloadEvent) => { if (dirty || timer) { void flush(); e.preventDefault(); } };

    doc.on('update', onUpdate);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      doc.off('update', onUpdate);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [doc, file.id]);

  return { doc, save };
}

export function EditorPage() {
  const { id } = useParams();
  return <EditorLoader key={id} fileId={id!} />;
}

function EditorLoader({ fileId }: { fileId: string }) {
  const { data: file, error } = useLoad(`file:${fileId}`, () => getFile(fileId));
  if (error) return <div className="center"><div><h2>Couldn't open this diagram</h2><p className="muted">{error}</p><Link to="/">Back to home</Link></div></div>;
  if (file === undefined) return <div className="center muted">Loading…</div>;
  if (file === null) return <div className="center"><div><h2>Diagram not found</h2><p className="muted">It may have been deleted.</p><Link to="/">Back to home</Link></div></div>;
  return <Editor file={file} />;
}

const SAVE_TEXT: Record<SaveState, string> = {
  saved: 'All changes saved',
  saving: 'Saving…',
  error: "Couldn't save. Retrying…",
};

function Editor({ file }: { file: DiagramFile }) {
  const theme = useTheme();
  const { doc, save } = useFileDoc(file);
  const [selected, setSelected] = useState<string | null>(null);
  const [part, setPart] = useState<DiagramSelection | null>(null);
  const [title, setTitle] = useState(file.title);
  const [savedTitle, setSavedTitle] = useState(file.title);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  useEffect(() => { document.title = `${savedTitle} · DevArt`; return () => { document.title = 'DevArt'; }; }, [savedTitle]);

  useEffect(() => {
    const yEls = doc.getMap<CanvasElement>('elements');
    const on = () => setElements([...yEls.values()]);
    on();
    yEls.observe(on);
    return () => yEls.unobserve(on);
  }, [doc]);

  // Hide UI (Mod+\): the palette, properties panel and zoom bar step aside. Mod+\ again or Esc brings them back.
  const [uiHidden, setUiHidden] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'Backslash') { e.preventDefault(); setUiHidden((h) => !h); return; }
      if (e.key === 'Escape' && uiHidden && !(e.target as HTMLElement | null)?.closest?.('input, textarea, select, .cm-editor')) setUiHidden(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [uiHidden]);

  const saveTitle = () => {
    const next = title.trim();
    if (!next || next === savedTitle) return;
    renameFile(file.id, next).then(() => setSavedTitle(next)).catch(toastError);
  };

  // The panel follows the selection, and otherwise shows the file's first diagram.
  const selectedEl = selected ? elements.find((e) => e.id === selected) : undefined;
  const diagram = selectedEl?.type === 'diagram' ? selectedEl : selectedEl ? undefined : elements.find((e) => e.type === 'diagram');

  return (
    <div className="editor">
      <header className="topbar">
        <Link to="/" className="ghost-link" aria-label="Back to home"><Icon name="back" /></Link>
        <input className="title-input" aria-label="Diagram name" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <span className={`save-state ${save === 'saved' ? 'muted' : 'warn'}`} role="status">{SAVE_TEXT[save]}</span>
        <div className="grow" />
        <button className="ghost" aria-label="Switch theme" onClick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        <ExportMenu elements={elements} title={title} theme={theme} />
      </header>
      <div className="editor-body">
        <Canvas
          doc={doc} theme={theme} synced selected={selected} onSelect={setSelected}
          diagramSelection={part} onDiagramSelection={setPart}
          uiHidden={uiHidden} onToggleUi={() => setUiHidden((h) => !h)}
        />
        {!uiHidden && diagram && <DiagramPanel doc={doc} element={diagram} canDelete={elements.length > 1} selection={part} onSelection={setPart} />}
        {!uiHidden && selectedEl && selectedEl.type !== 'diagram' && (
          <aside className="dpanel" aria-label="Properties">
            <div className="visual">
              <p className="muted small">This shape was made with an earlier version of DevArt. You can move, resize, and retype it on the canvas.</p>
              <button className="danger" onClick={() => { removeElements(doc, [selectedEl.id]); setSelected(null); }}><Icon name="trash" size={14} /> Delete</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
