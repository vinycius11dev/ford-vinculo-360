import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';

export const REQUEST_STATUS_EVENT = 'ford360:request-status';
export function reportRequestStatus(path: string, message: string | null) {
  window.dispatchEvent(new CustomEvent(REQUEST_STATUS_EVENT, { detail: { path, message } }));
}

export function RequestStatus({ retry }: { retry(): void }) {
  const location = useLocation();
  const [failures, setFailures] = useState<Record<string, string>>({});
  useEffect(() => { setFailures({}); }, [location.pathname]);
  useEffect(() => {
    const update = (event: Event) => {
      const { path, message } = (event as CustomEvent<{ path: string; message: string | null }>).detail;
      setFailures((current) => { const next = { ...current }; if (message) next[path] = message; else delete next[path]; return next; });
    };
    window.addEventListener(REQUEST_STATUS_EVENT, update);
    return () => window.removeEventListener(REQUEST_STATUS_EVENT, update);
  }, []);
  if (!Object.keys(failures).length) return null;
  return <div className="request-status" role="alert">
    <WifiOff size={21} />
    <div><strong>Alguns dados não puderam ser atualizados</strong><p>{Object.values(failures)[0]}</p></div>
    <button className="secondary" onClick={retry}><RefreshCw size={15} />Tentar novamente</button>
  </div>;
}
