import { createRoot } from 'react-dom/client';
import Recorder from './features/ask-work/Recorder';
import './styles.css';

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<div className="wrap"><Recorder /></div>);
