import { useState } from 'react';
import { CalendarDays, ChartNoAxesCombined, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Target, TriangleAlert, Wrench } from 'lucide-react';

type JourneyProps = {
  kpis: { leads: number; vinShare: number };
  campaigns: { sent: number; scheduled: number; completed: number };
  revenue: number;
  lead: { model: string; score: number; reason: string; nextAction: string } | null;
};

const steps = [
  { label: 'Sinal', icon: TriangleAlert, eyebrow: '1 · DETECÇÃO' },
  { label: 'Lead', icon: Target, eyebrow: '2 · EXPLICAÇÃO' },
  { label: 'Campanha', icon: Sparkles, eyebrow: '3 · AÇÃO' },
  { label: 'Agenda', icon: CalendarDays, eyebrow: '4 · RESPOSTA' },
  { label: 'Serviço', icon: Wrench, eyebrow: '5 · RETORNO' },
  { label: 'Aprendizado', icon: ChartNoAxesCombined, eyebrow: '6 · IMPACTO' },
];

export function ChallengeJourney({ kpis, campaigns, revenue, lead }: JourneyProps) {
  const [active, setActive] = useState(0);
  const current = steps[active];
  const Icon = current.icon;
  const content = [
    { title: 'O sistema encontra uma oportunidade', body: `${kpis.leads} veículo(s) foram priorizados no recorte selecionado porque o retorno à rede merece atenção.`, metric: kpis.leads ? `${kpis.leads} leads prioritários` : 'Nenhum lead no recorte' },
    { title: lead ? `${lead.model} tem um motivo claro` : 'O lead precisa de contexto', body: lead ? `${lead.reason} A recomendação é: ${lead.nextAction.toLowerCase()}.` : 'Escolha outro período ou filtro para encontrar um veículo com recomendação.', metric: lead ? `${lead.score}% de risco` : 'Aguardando dados' },
    { title: 'A concessionária transforma sinal em ação', body: 'A campanha pode ser criada com uma oferta relevante e respeitando o consentimento do cliente.', metric: `${campaigns.sent} ações enviadas` },
    { title: 'A resposta chega na agenda', body: 'Acompanhe se a comunicação virou um agendamento — o ponto em que a intenção começa a virar retorno.', metric: `${campaigns.scheduled} agendamento(s)` },
    { title: 'O retorno acontece na oficina', body: 'Quando a ordem é concluída, a ação deixa de ser apenas comunicação e passa a gerar resultado operacional.', metric: `${campaigns.completed} serviço(s) · ${revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}` },
    { title: 'O indicador fecha o ciclo', body: 'O VIN Share mostra se a rede conseguiu recuperar cobertura. Esse aprendizado alimenta a próxima priorização.', metric: `${kpis.vinShare}% de VIN Share` },
  ][active];

  return <section className="card challenge-journey" aria-labelledby="journey-title">
    <div className="card-heading challenge-journey-heading">
      <div><span className="eyebrow">MODO APRESENTAÇÃO</span><h2 id="journey-title">Da inteligência ao retorno</h2><p>Uma jornada guiada para explicar o valor do Vínculo 360 em poucos passos.</p></div>
      <span className="challenge-demo-badge"><Sparkles size={13} /> Dados do sistema</span>
    </div>
    <div className="challenge-journey-steps" role="tablist" aria-label="Etapas da jornada">
      {steps.map((step, index) => { const StepIcon = step.icon; return <button key={step.label} className={`challenge-journey-step${index === active ? ' is-active' : ''}${index < active ? ' is-complete' : ''}`} role="tab" aria-selected={index === active} onClick={() => setActive(index)}><span><StepIcon size={14} /></span><small>{step.label}</small></button>; })}
    </div>
    <div className="challenge-journey-detail" key={active}>
      <div className="challenge-journey-icon"><Icon size={23} /></div>
      <div className="challenge-journey-copy"><span className="eyebrow">{current.eyebrow}</span><h3>{content.title}</h3><p>{content.body}</p><strong>{content.metric}</strong></div>
      <div className="challenge-journey-progress"><span style={{ width: `${((active + 1) / steps.length) * 100}%` }} /></div>
    </div>
    <div className="challenge-journey-actions"><button className="secondary" onClick={() => setActive(0)} disabled={active === 0}><CheckCircle2 size={14} />Recomeçar</button><div><button className="secondary" onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={active === 0} aria-label="Etapa anterior"><ChevronLeft size={15} /></button><button className="primary" onClick={() => setActive((value) => Math.min(steps.length - 1, value + 1))} disabled={active === steps.length - 1}>{active === steps.length - 1 ? 'Jornada concluída' : 'Próxima etapa'}<ChevronRight size={15} /></button></div></div>
    <small className="challenge-journey-note">Os valores acompanham os filtros desta página e só mudam quando existem registros reais no sistema.</small>
  </section>;
}
