import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, Download, FileUp, Gift, Mail, Plug, RefreshCw, Save, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth';

type Policy = { minimumPoints: number; mileagePerPoint: number };
type Connections = { database: boolean; prediction: boolean; email: string; sms: string; push: string; checkedAt: string };
type Notice = { id: string; title: string; message: string; readAt: string | null; createdAt: string };
type PilotImportPayload = { sourceSystem: string; vehicles: Array<Record<string, unknown>>; serviceOrders: Array<Record<string, unknown>> };
type PilotImportResult = { sourceSystem: string; vehicles: { created: number; updated: number }; serviceOrders: { created: number; updated: number } };

export function OperationalSettings() {
  const { user } = useAuth();
  const canManage = ['FORD_ADMIN', 'DEALERSHIP_MANAGER'].includes(user?.role ?? '');
  const canEdit = user?.role === 'FORD_ADMIN';
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [connections, setConnections] = useState<Connections | null>(null);
  const [feed, setFeed] = useState<Notice[]>([]);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importPayload, setImportPayload] = useState<PilotImportPayload | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [testRecipient, setTestRecipient] = useState(user?.email ?? '');
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setBusy(true); setError('');
    try {
      const [rules, notifications, integration] = await Promise.all([
        api<Policy>('/settings/program'), api<{ items: Notice[] }>('/notifications'),
        canManage ? api<Connections>('/settings/integrations') : Promise.resolve(null),
      ]);
      setPolicy(rules); setFeed(notifications.items); setConnections(integration);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as configurações.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [canManage]);
  useEffect(() => { if (user?.email && !testRecipient) setTestRecipient(user.email); }, [user?.email, testRecipient]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!policy || !canEdit || busy) return;
    setBusy(true); setMessage(''); setError('');
    try {
      setPolicy(await api<Policy>('/settings/program', { method: 'PATCH', body: JSON.stringify({ minimumPoints: policy.minimumPoints, mileagePerPoint: policy.mileagePerPoint }) }));
      setMessage('Regras salvas. Novas conclusões de serviço usarão estes critérios.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function markRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      setFeed((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o aviso.'); }
  }

  async function readImportFile(file: File) {
    setImportMessage(''); setImportError(''); setImportPayload(null); setImportFileName(file.name);
    try {
      const parsed = JSON.parse(await file.text()) as Partial<PilotImportPayload>;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.sourceSystem !== 'string' || !Array.isArray(parsed.vehicles) || !Array.isArray(parsed.serviceOrders)) {
        throw new Error('O arquivo precisa conter sourceSystem, vehicles e serviceOrders.');
      }
      if (!parsed.sourceSystem.trim()) throw new Error('Informe um sourceSystem identificável.');
      setImportPayload({ sourceSystem: parsed.sourceSystem, vehicles: parsed.vehicles as Array<Record<string, unknown>>, serviceOrders: parsed.serviceOrders as Array<Record<string, unknown>> });
    } catch (reason) {
      setImportFileName(''); setImportError(reason instanceof Error ? reason.message : 'Arquivo JSON inválido.');
    }
  }

  async function submitImport() {
    if (!importPayload || importBusy) return;
    setImportBusy(true); setImportMessage(''); setImportError('');
    try {
      const result = await api<PilotImportResult>('/pilot-import', { method: 'POST', body: JSON.stringify(importPayload) });
      setImportMessage(`${result.sourceSystem}: ${result.vehicles.created} veículo(s) criado(s), ${result.vehicles.updated} atualizado(s), ${result.serviceOrders.created} ordem(ns) criada(s) e ${result.serviceOrders.updated} atualizada(s).`);
      setImportPayload(null); setImportFileName('');
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : 'Não foi possível importar o lote.'); }
    finally { setImportBusy(false); }
  }

  async function sendTestEmail(event: FormEvent) {
    event.preventDefault();
    if (testBusy || !testRecipient.trim()) return;
    setTestBusy(true); setTestMessage(''); setTestError('');
    try {
      const result = await api<{ status: string; error?: string }>('/settings/email/test', { method: 'POST', body: JSON.stringify({ recipient: testRecipient.trim() }) });
      if (result.status === 'sent') setTestMessage('Teste enviado. Confira a caixa de entrada e a pasta de spam.');
      else setTestError(result.error ?? 'O teste não foi entregue. Confira a configuração SMTP.');
    } catch (reason) { setTestError(reason instanceof Error ? reason.message : 'Não foi possível enviar o teste.'); }
    finally { setTestBusy(false); }
  }

  function downloadImportTemplate() {
    const template: PilotImportPayload = {
      sourceSystem: 'dms-exemplo',
      vehicles: [{ externalId: 'veiculo-001', vin: '9BFXXXXXXXXXXXXXX', model: 'Ranger Limited', modelYear: 2024, manufactureYear: 2024, currentMileage: 1200, plate: 'ABC1D23' }],
      serviceOrders: [{ externalId: 'os-001', vin: '9BFXXXXXXXXXXXXXX', mileage: 1200, status: 'COMPLETED', description: 'Revisão periódica', amount: 980, completedAt: '2026-08-20T12:00:00.000Z' }],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'modelo-importacao-ford-vinculo.json'; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className="operations-settings">
    {error && <div className="request-status" role="alert"><p>{error}</p><button className="secondary" onClick={() => void load()} disabled={busy}>Tentar novamente</button></div>}
    <article className="card operation-card" id="regras-pontos">
      <div className="operation-heading"><span className="stat-icon icon-blue"><Gift size={21} /></span><div><span className="eyebrow">PROGRAMA DE FIDELIDADE</span><h2>Regras de pontuação</h2></div></div>
      <p>Defina a pontuação automática dos próximos atendimentos. Pontos já creditados permanecem no histórico.</p>
      {!policy ? <p>{busy ? 'Carregando regras…' : 'Regras indisponíveis.'}</p> : <form className="entity-form" onSubmit={save}>
        <div className="form-grid">
          <label>Pontos mínimos por atendimento<input type="number" min="0" max="100000" required disabled={!canEdit || busy} value={policy.minimumPoints} onChange={(event) => setPolicy({ ...policy, minimumPoints: Number(event.target.value) })} /></label>
          <label>Quilômetros do odômetro por ponto<input type="number" min="1" max="100000" required disabled={!canEdit || busy} value={policy.mileagePerPoint} onChange={(event) => setPolicy({ ...policy, mileagePerPoint: Number(event.target.value) })} /></label>
        </div>
        <div className="rule-preview"><strong>Exemplo: atendimento aos 40.000 km</strong><span>{Math.max(policy.minimumPoints, Math.round(40000 / Math.max(1, policy.mileagePerPoint))).toLocaleString('pt-BR')} pontos automáticos</span></div>
        <p className="operation-note">Vale o maior valor entre o mínimo e a quilometragem dividida pelo fator, arredondada. A equipe pode informar uma pontuação específica ao concluir a ordem. A validade de cada voucher é definida na emissão.</p>
        {canEdit ? <button className="primary" disabled={busy}><Save size={16} />{busy ? 'Salvando…' : 'Salvar regras'}</button> : <p className="operation-note">As regras são administradas pelo perfil Administrador Ford.</p>}
        {message && <div className="login-notice" role="status">{message}</div>}
      </form>}
    </article>
    <article className="card operation-card" id="notificacoes-conta">
      <div className="operation-heading"><span className="stat-icon icon-blue"><Bell size={21} /></span><div><span className="eyebrow">SUA CONTA</span><h2>Central de avisos</h2></div></div>
      <p>Acompanhe as últimas atualizações de atendimentos, segurança e relacionamento.</p>
      {feed.slice(0, 8).map((item) => <div className="settings-notice" key={item.id}><span className={item.readAt ? 'notice-dot read' : 'notice-dot'} /><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small></div>{!item.readAt && <button className="settings-row-action" onClick={() => void markRead(item.id)} aria-label={`Marcar como lido: ${item.title}`}><Check size={17} /></button>}</div>)}
      {!feed.length && <p>{busy ? 'Carregando avisos…' : 'Tudo em dia. Novos avisos aparecerão aqui.'}</p>}
    </article>
    {canManage && <article className="card operation-card integration-card" id="integracoes">
      <div className="operation-heading"><span className="stat-icon icon-blue"><Plug size={21} /></span><div><span className="eyebrow">CONEXÕES DA PLATAFORMA</span><h2>Integrações</h2></div><button className="secondary" disabled={busy} onClick={() => void load()}><RefreshCw size={15} />Verificar</button></div>
      <p>Disponibilidade dos serviços e preparação dos canais externos. As credenciais são configuradas no servidor.</p>
      <div className="connections-grid">{[
        ['Banco de dados', connections ? connections.database ? 'Conectado' : 'Indisponível' : 'Verificando', connections?.database],
        ['Previsão de evasão', connections ? connections.prediction ? 'Baseline disponível' : 'Estimativa local' : 'Verificando', connections?.prediction],
        ['E-mail transacional', connections ? connections.email === 'smtp' ? 'SMTP configurado' : 'Simulação local' : 'Verificando', connections?.email === 'smtp'],
        ['SMS', connections ? 'Simulação local' : 'Verificando', false], ['Push', connections ? 'Simulação local' : 'Verificando', false], ['DMS e CRM', 'Aguardando integração', false], ['Telemetria', 'Aguardando integração', false],
      ].map(([label, status, available]) => <div className="connection-item" key={String(label)}><strong>{label}</strong><span className={available ? 'connection-ok' : 'connection-pending'}>{status}</span></div>)}</div>
      {connections?.email === 'smtp' && <form className="email-test-form" onSubmit={sendTestEmail}>
        <div className="email-test-heading"><Mail size={17} /><div><strong>Validar envio real</strong><span>Faça um disparo controlado para confirmar o SMTP antes do piloto.</span></div></div>
        <div className="email-test-controls"><input type="email" required value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="seu-email@exemplo.com" /><button className="primary" disabled={testBusy}><Send size={15} />{testBusy ? 'Enviando…' : 'Enviar teste'}</button></div>
        {testMessage && <div className="login-notice" role="status">{testMessage}</div>}
        {testError && <div className="request-status" role="alert"><p>{testError}</p></div>}
      </form>}
      {connections && <small className="operation-note">Última verificação: {new Date(connections.checkedAt).toLocaleString('pt-BR')}</small>}
    </article>}
    {canManage && <article className="card operation-card pilot-import-card" id="importacao-piloto">
      <div className="operation-heading"><span className="stat-icon icon-blue"><FileUp size={21} /></span><div><span className="eyebrow">ENTRADA DE DADOS</span><h2>Importar lote do piloto</h2></div><button className="secondary" onClick={downloadImportTemplate}><Download size={15} />Baixar modelo</button></div>
      <p>Carregue um JSON exportado do DMS/CRM. O lote é validado, respeita o escopo da concessionária, evita duplicidade por origem + identificador e registra auditoria.</p>
      <div className="pilot-import-actions"><label className="secondary pilot-file-button"><FileUp size={15} />{importFileName || 'Selecionar arquivo JSON'}<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImportFile(file); }} /></label>{importPayload && <button className="primary" onClick={() => void submitImport()} disabled={importBusy}>{importBusy ? 'Importando…' : 'Importar lote'}</button>}</div>
      {importPayload && <div className="pilot-import-preview" role="status"><strong>{importPayload.sourceSystem}</strong><span>{importPayload.vehicles.length} veículo(s) · {importPayload.serviceOrders.length} ordem(ns)</span></div>}
      {importMessage && <div className="login-notice" role="status">{importMessage}</div>}
      {importError && <div className="request-status" role="alert"><p>{importError}</p></div>}
      <small className="operation-note">O arquivo não é armazenado no navegador. Apenas os registros validados são enviados para a API.</small>
    </article>}
  </section>;
}
