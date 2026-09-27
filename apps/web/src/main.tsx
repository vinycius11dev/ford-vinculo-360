import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './schedule.css';
import './mobile-brand.css';
import './login.css';
import './safety.css';
import './refinements.css';
import './professional.css';
import './vehicles-premium.css';
import './challenge-experience.css';
import './customer-form.css';
import './retention.css';
import './sidebar-flow.css';
import './campaigns-premium.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
