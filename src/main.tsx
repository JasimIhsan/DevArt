import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { registerPwa } from './pwa.tsx';
import './index.css';
import './codemirror.css';

registerPwa();
createRoot(document.getElementById('root')!).render(<App />);
