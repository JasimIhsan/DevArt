import { Link } from 'react-router-dom';
import { Logo } from '../components/ui.tsx';

export function NotFoundPage() {
  return (
    <div className="center">
      <div className="notfound">
        <Logo large />
        <div className="notfound-code" aria-hidden="true">404</div>
        <h2>Page not found</h2>
        <p className="muted">This page may have been moved, removed, or never existed.</p>
        <Link to="/" className="notfound-home">Back to DevArt</Link>
      </div>
    </div>
  );
}
