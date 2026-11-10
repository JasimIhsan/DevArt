// "Start from a template" on the home page: each card creates a file holding a copy of that template.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toastError } from '../lib/ui.ts';
import { createFromTemplate } from '../lib/files.ts';
import { TEMPLATES, type DiagramTemplate } from '../core/templates.ts';
import type { DiagramType } from '../core/types.ts';

// Matches the home page's .choice cards, which the page keeps to its one main action.
const CARD = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 16, textAlign: 'left', whiteSpace: 'normal',
  border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg)', color: 'var(--fg)', cursor: 'pointer', height: '100%',
} as const;

const TYPE_LABEL: Partial<Record<DiagramType, string>> = { architecture: 'Architecture', sequence: 'Sequence', erd: 'ERD', flowchart: 'Flow chart' };

export function TemplatePicker() {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (t: DiagramTemplate) => {
    setBusy(t.id);
    try {
      nav(`/f/${await createFromTemplate(t)}`);
    } catch (e) {
      toastError(e);
      setBusy(null);
    }
  };

  return (
    <section className="templates" aria-label="Start from a template">
      <h2>Start from a template</h2>
      <div className="file-grid">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="template-card" style={CARD} disabled={busy !== null} onClick={() => start(t)}>
            <b>{t.name}</b>
            <span className="small">{t.description}</span>
            <span className="muted small">{TYPE_LABEL[t.type] ?? t.type}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
