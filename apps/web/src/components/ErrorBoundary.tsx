import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="recovery-screen" role="alert"><TriangleAlert size={34} /><h1>Vamos retomar de onde você parou.</h1><p>Não foi possível exibir esta tela. Recarregue para tentar novamente.</p><button className="primary" onClick={() => window.location.reload()}>Recarregar plataforma</button></main>;
  }
}
