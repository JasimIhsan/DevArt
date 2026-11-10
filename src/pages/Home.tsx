import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { timeAgo, toast, toastError, toggleTheme, useLoad, useTheme } from '../lib/ui.ts';
import { createFile, deleteFile, listFiles, type FileSummary } from '../lib/files.ts';
import { svgDataUrl } from '../lib/export.ts';
import type { Theme } from '../core/types.ts';
import { UserMenu } from '../components/UserMenu.tsx';
import { confirmDialog } from '../components/ConfirmDialog.tsx';
import { Icon, Logo } from '../components/ui.tsx';
import { InstallButton } from '../pwa.tsx';
import { TemplatePicker } from '../components/TemplatePicker.tsx';

function Thumb({ file, theme }: { file: FileSummary; theme: Theme }) {
  const src = useMemo(() => svgDataUrl(file.elements, { theme }), [file.id, file.updatedAt, theme]);
  return <img loading="lazy" alt="" src={src} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

export function HomePage() {
  const theme = useTheme();
  const nav = useNavigate();
  const { data: files, error, reload } = useLoad('files', listFiles);

  const drawManually = () => createFile('Untitled architecture').then((id) => nav(`/f/${id}`)).catch(toastError);
  const remove = async (f: FileSummary) => {
    const ok = await confirmDialog({ title: `Delete "${f.title}"?`, message: 'It will be removed from your diagrams.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    deleteFile(f.id).then(() => { toast('Diagram deleted'); reload(); }).catch(toastError);
  };

  return (
    <div className="home">
      <header className="home-bar">
        <InstallButton />
        <button className="ghost" aria-label="Switch theme" onClick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        <UserMenu />
      </header>
      <main className="home-main">
        <div className="home-hero">
          <Logo large />
          <p>Design and visualize system architectures effortlessly.</p>
        </div>
        <div className="choices">
          <button className="choice" onClick={drawManually}>
            <Icon name="pen" size={24} />
            <b>Draw Manually</b>
            <span>Build architecture diagrams using a visual editor.</span>
          </button>
        </div>
        {error && <p className="warn small" role="alert">Couldn't load your diagrams: {error}</p>}
        {!!files?.length && (
          <section className="recent" aria-label="Your diagrams">
            <h2>Your diagrams</h2>
            <div className="file-grid">
              {files.map((f) => (
                <div key={f.id} className="file-card">
                  <Link to={`/f/${f.id}`} className="file-open">
                    <div className="thumb"><Thumb file={f} theme={theme} /></div>
                    <div className="file-meta"><b className="truncate">{f.title}</b><span className="muted small">{timeAgo(f.updatedAt)}</span></div>
                  </Link>
                  <button className="ghost file-delete" aria-label={`Delete ${f.title}`} onClick={() => remove(f)}><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          </section>
        )}
        <TemplatePicker />
      </main>
    </div>
  );
}
