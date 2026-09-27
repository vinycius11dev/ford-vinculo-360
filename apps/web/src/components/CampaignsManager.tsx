import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  Target,
  Sparkles,
  Search,
  Filter,
  UsersRound,
  BadgePercent,
  CircleDollarSign,
  Send,
  BarChart3,
  ChevronRight,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  LayoutGrid,
  List,
  Download,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Car,
  Check,
  Mail,
  Smartphone,
  Eye,
  X,
  Wrench,
  HelpCircle,
  Crown,
  Briefcase,
  Gift,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";

export type CampaignTarget = {
  id?: string;
  sentAt: string | null;
  viewedAt?: string | null;
  convertedAt: string | null;
  vehicle?: {
    id?: string;
    vin: string;
    model: string;
    plate?: string | null;
    modelYear?: number | null;
  };
};

export type ExtendedCampaign = {
  id: string;
  name: string;
  description: string;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicCtaLabel?: string | null;
  publicCtaLink?: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  _count: { targets: number };
  targets: CampaignTarget[];
};

export type SmartSegment = {
  id: string;
  title: string;
  badge: string;
  description: string;
  count: number;
  vins: string[];
  suggestedTone?: "PREMIUM" | "FAMILIA" | "TRABALHO" | "OFERTA";
};

export type VoiceTone = "PREMIUM" | "FAMILIA" | "TRABALHO" | "OFERTA";
export type BenefitType = "NONE" | "DISCOUNT_100" | "DISCOUNT_150" | "DISCOUNT_200" | "POINTS_500" | "POINTS_1000";
export type ExecutionMode = "MANUAL" | "AUTO_TRIGGER";

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const safeCell = (value: string | number) => {
    let text = String(value);
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const content = `\uFEFF${rows.map((row) => row.map(safeCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ==========================================
// MODAL DE DESEMPENHO (PERFORMANCE MODAL)
// ==========================================
export function CampaignPerformanceModal({
  campaign,
  onClose,
  onOpenDispatch,
}: {
  campaign: ExtendedCampaign;
  onClose(): void;
  onOpenDispatch(c: ExtendedCampaign): void;
}) {
  const [targetSearch, setTargetSearch] = useState("");

  const totalTargets = campaign._count.targets;
  const sentCount = campaign.targets.filter((t) => t.sentAt).length;
  const viewedCount = campaign.targets.filter((t) => t.viewedAt).length;
  const convertedCount = campaign.targets.filter((t) => t.convertedAt).length;

  const deliveryRate = totalTargets ? Math.round((sentCount / totalTargets) * 100) : 0;
  const openRate = sentCount ? Math.round((viewedCount / sentCount) * 100) : 0;
  const conversionRate = totalTargets ? Math.round((convertedCount / totalTargets) * 1000) / 10 : 0;

  const filteredTargets = useMemo(() => {
    if (!targetSearch.trim()) return campaign.targets;
    const query = targetSearch.toLowerCase().trim();
    return campaign.targets.filter(
      (t) =>
        t.vehicle?.vin.toLowerCase().includes(query) ||
        t.vehicle?.model.toLowerCase().includes(query) ||
        t.vehicle?.plate?.toLowerCase().includes(query)
    );
  }, [campaign.targets, targetSearch]);

  function exportTargetsCsv() {
    const headers = ["VIN", "Modelo", "Placa", "Ano", "Status do Envio", "Data de Envio", "Visualizado", "Convertido"];
    const rows = campaign.targets.map((t) => [
      t.vehicle?.vin ?? "N/D",
      t.vehicle?.model ?? "N/D",
      t.vehicle?.plate ?? "N/D",
      t.vehicle?.modelYear ?? "",
      t.convertedAt ? "CONVERTIDO" : t.viewedAt ? "VISUALIZADO" : t.sentAt ? "ENVIADO" : "PENDENTE",
      t.sentAt ? new Date(t.sentAt).toLocaleDateString("pt-BR") : "Não enviado",
      t.viewedAt ? new Date(t.viewedAt).toLocaleDateString("pt-BR") : "Não",
      t.convertedAt ? new Date(t.convertedAt).toLocaleDateString("pt-BR") : "Não",
    ]);
    downloadCsv(`desempenho_campanha_${campaign.id.slice(0, 8)}.csv`, [headers, ...rows]);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal-card" style={{ maxWidth: "860px" }} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose}>
          <X size={19} />
        </button>
        <span className="eyebrow">RELATÓRIO DE DESEMPENHO</span>
        <h2>{campaign.name}</h2>
        <p>{campaign.description}</p>

        <div className="performance-modal-body">
          {/* FUNIL COMPLETO */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: "#0f172a", textTransform: "uppercase", letterSpacing: 0.6 }}>
                Funil de Conversão & Engajamento
              </h4>
              <button
                type="button"
                onClick={exportTargetsCsv}
                className="secondary"
                style={{ height: 32, padding: "0 10px", fontSize: 11, gap: 6 }}
              >
                <Download size={14} /> Exportar CSV
              </button>
            </div>
            <div className="perf-funnel-grid">
              <div className="perf-funnel-step">
                <div className="perf-funnel-icon">
                  <Target size={18} />
                </div>
                <small>1 · PÚBLICO ALVO</small>
                <strong>{totalTargets}</strong>
                <span className="rate-tag">100% da base</span>
              </div>

              <div className="perf-funnel-step">
                <div className="perf-funnel-icon" style={{ background: "#e0e7ff", color: "#4338ca" }}>
                  <Send size={18} />
                </div>
                <small>2 · DISPARADOS</small>
                <strong>{sentCount}</strong>
                <span className="rate-tag">{deliveryRate}% enviados</span>
              </div>

              <div className="perf-funnel-step">
                <div className="perf-funnel-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                  <Eye size={18} />
                </div>
                <small>3 · VISUALIZADOS</small>
                <strong>{viewedCount}</strong>
                <span className="rate-tag">{openRate}% abertos</span>
              </div>

              <div className="perf-funnel-step step-success">
                <div className="perf-funnel-icon">
                  <CheckCircle2 size={18} />
                </div>
                <small>4 · RETORNOS (OS)</small>
                <strong style={{ color: "#15803d" }}>{convertedCount}</strong>
                <span className="rate-tag">{conversionRate}% conversão</span>
              </div>
            </div>
          </div>

          {/* DISPARO PENDENTE SE HOUVER */}
          {sentCount < totalTargets && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 10,
              padding: "12px 16px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Send size={18} style={{ color: "#0284c7" }} />
                <div>
                  <b style={{ fontSize: 13, color: "#0369a1" }}>Disparos pendentes disponíveis</b>
                  <p style={{ margin: 0, fontSize: 11, color: "#0284c7" }}>
                    {totalTargets - sentCount} clientes deste público ainda não receberam a mensagem.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="primary"
                style={{ height: 34, padding: "0 14px", fontSize: 11 }}
                onClick={() => {
                  onClose();
                  onOpenDispatch(campaign);
                }}
              >
                Disparar agora
              </button>
            </div>
          )}

          {/* ESPELHO DA COMUNICAÇÃO RECEBIDA PELO CLIENTE */}
          <div className="message-preview-container">
            <div className="message-preview-header">
              <span>COMUNICAÇÃO ENVIADA AO CLIENTE (FORD APP & E-MAIL)</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>Canal: E-mail Oficial & FordPass</span>
            </div>
            <div className="message-phone-mockup">
              <div className="phone-mockup-brand">
                <span className="mockup-ford-logo">Ford</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#0284c7" }}>VÍNCULO 360</span>
              </div>
              <div className="phone-mockup-body">
                <h4>{campaign.publicTitle ?? campaign.name}</h4>
                <p>
                  {campaign.publicDescription ??
                    "Olá! Estamos acompanhando o ciclo do seu veículo Ford para que você mantenha sua jornada e revisões sempre em dia."}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="phone-mockup-cta">
                    {campaign.publicCtaLabel ?? "Acessar Ford App"} &nbsp;→
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Destino no app: <code>{campaign.publicCtaLink ?? "/agendamentos"}</code>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* LISTA DE VEÍCULOS ALVOS */}
          <div className="perf-targets-section">
            <div className="perf-targets-header">
              <h4>Veículos Segmentados nesta Campanha ({campaign.targets.length})</h4>
              <div style={{ position: "relative", width: 220 }}>
                <input
                  type="text"
                  placeholder="Filtrar VIN, modelo, placa..."
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    fontSize: 11,
                    padding: "0 10px 0 28px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    outline: 0,
                  }}
                />
                <Search size={14} style={{ position: "absolute", left: 8, top: 9, color: "#94a3b8" }} />
              </div>
            </div>

            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table className="perf-targets-table">
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Identificador VIN</th>
                    <th>Placa</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTargets.map((t, idx) => (
                    <tr key={t.id ?? idx}>
                      <td>
                        <b>{t.vehicle?.model ?? "Modelo Ford"}</b>
                        {t.vehicle?.modelYear ? ` · ${t.vehicle.modelYear}` : ""}
                      </td>
                      <td>
                        <code style={{ fontSize: 10, color: "#334155" }}>{t.vehicle?.vin ?? "—"}</code>
                      </td>
                      <td>{t.vehicle?.plate ?? "—"}</td>
                      <td>
                        {t.convertedAt ? (
                          <span className="badge badge-green" style={{ fontSize: 9 }}>
                            <i /> Convertido (OS Fechada)
                          </span>
                        ) : t.viewedAt ? (
                          <span className="badge badge-amber" style={{ fontSize: 9 }}>
                            <i /> Visualizado
                          </span>
                        ) : t.sentAt ? (
                          <span className="badge badge-blue" style={{ fontSize: 9 }}>
                            <i /> Mensagem Enviada
                          </span>
                        ) : (
                          <span className="badge badge-slate" style={{ fontSize: 9 }}>
                            <i /> Pendente de Envio
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredTargets.length && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8", padding: 18 }}>
                        Nenhum veículo encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button type="button" className="primary" onClick={onClose}>
            Fechar relatório
          </button>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// MODAL DE DISPARO COM CONFIRMAÇÃO SEGURA
// ==========================================
export function CampaignDispatchModal({
  campaign,
  onClose,
  onConfirm,
}: {
  campaign: ExtendedCampaign;
  onClose(): void;
  onConfirm(campaignId: string): Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");



  const pendingCount = campaign._count.targets - campaign.targets.filter((t) => t.sentAt).length;

  async function handleDispatch() {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(campaign.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao disparar mensagens.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal-card" style={{ maxWidth: "480px" }} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose}>
          <X size={19} />
        </button>

        <div className="dispatch-confirm-content">
          <div className="dispatch-confirm-icon">
            <Send size={26} />
          </div>
          <h3 className="dispatch-confirm-title">Disparar Campanha de Pós-Venda</h3>
          <p className="dispatch-confirm-desc">
            Você está prestes a disparar as comunicações da campanha <strong>"{campaign.name}"</strong> para os clientes da sua concessionária.
          </p>

          <div className="dispatch-stats-banner">
            <div className="dispatch-stats-item">
              <small>Público Total</small>
              <strong>{campaign._count.targets}</strong>
            </div>
            <div className="dispatch-stats-item">
              <small>Envios Pendentes</small>
              <strong style={{ color: "#0284c7" }}>{pendingCount}</strong>
            </div>
            <div className="dispatch-stats-item">
              <small>Canal Principal</small>
              <strong>E-mail & App</strong>
            </div>
          </div>

          <div className="dispatch-lgpd-note">
            <ShieldCheck size={20} style={{ flex: "0 0 auto" }} />
            <span>
              <strong>Conformidade LGPD Ativa:</strong> As mensagens são enviadas estritamente aos clientes que possuem consentimento de marketing ativo. Contatos sem autorização são preservados e ignorados automaticamente.
            </span>
          </div>

          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="dispatch-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="button" className="primary" onClick={handleDispatch} disabled={submitting}>
              {submitting ? "Disparando mensagens..." : `Confirmar disparo (${pendingCount})`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// MODAL AVANÇADO DE CRIAÇÃO (COM RECURSOS INTELIGENTES)
// ==========================================
export function EnhancedCreateCampaignDialog({
  initialVins = [],
  recommendationVins = [],
  recommendationModelVersion,
  reminderModel,
  onClose,
  onCreated,
}: {
  initialVins?: string[];
  recommendationVins?: string[];
  recommendationModelVersion?: string | null;
  reminderModel?: string | null;
  onClose(): void;
  onCreated?(): void;
}) {
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  // Segmentos Inteligentes da API
  const [smartSegments, setSmartSegments] = useState<SmartSegment[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Form states for Live Preview
  const [name, setName] = useState(reminderModel ? "Lembrete de revisão preventiva" : "Retorno Seguro Ford");
  const [description, setDescription] = useState(
    reminderModel ? `Acompanhamento preventivo para o ${reminderModel}.` : "Campanha de manutenção preventiva e fidelização."
  );
  const [publicTitle, setPublicTitle] = useState(
    reminderModel ? `Seu ${reminderModel} pode estar próximo da revisão` : "Cuidado Ford: Sua próxima revisão com condições exclusivas"
  );
  const [publicDescription, setPublicDescription] = useState(
    reminderModel
      ? `Vimos que pode ser um bom momento para revisar o seu ${reminderModel}. Abra o Ford App e escreva para nossa equipe se quiser planejar seu atendimento.`
      : "Identificamos uma oportunidade ideal para realizar a revisão do seu veículo. Garanta a garantia de fábrica e a máxima performance com a equipe Ford."
  );
  const [publicCtaLabel, setPublicCtaLabel] = useState("Agendar revisão");
  const [publicCtaLink, setPublicCtaLink] = useState("/agendamentos");

  // Novos Recursos: Tom de Voz, Benefício/Voucher e Modo de Execução
  const [voiceTone, setVoiceTone] = useState<VoiceTone>("FAMILIA");
  const [benefitType, setBenefitType] = useState<BenefitType>("DISCOUNT_150");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("MANUAL");

  // Dates
  const now = new Date();
  const defaultStarts = now.toISOString().slice(0, 16);
  const defaultEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [startsAt, setStartsAt] = useState(defaultStarts);
  const [endsAt, setEndsAt] = useState(defaultEnds);

  // VINs
  const [vinsText, setVinsText] = useState(initialVins.join("\n"));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // IA: Corretor Ortográfico, Gramatical e Aprimorador de Redação
  const [isPolishing, setIsPolishing] = useState(false);
  const [originalDraft, setOriginalDraft] = useState<{ title: string; desc: string; cta: string } | null>(null);
  const [polishedSuccess, setPolishedSuccess] = useState(false);

  function handlePolishTextWithAI() {
    setIsPolishing(true);
    setPolishedSuccess(false);

    // Salvar rascunho anterior para permitir 'Desfazer'
    setOriginalDraft({
      title: publicTitle,
      desc: publicDescription,
      cta: publicCtaLabel,
    });

    setTimeout(() => {
      const modelRef = reminderModel || "Ford";
      let inputDesc = publicDescription.trim();
      let inputTitle = publicTitle.trim();

      // Dicionário de correções ortográficas, gírias e abreviações
      const corrections: [RegExp, string][] = [
        [/\b(vc|voces|voce)\b/gi, "você"],
        [/\bpra\b/gi, "para"],
        [/\bpro\b/gi, "para o"],
        [/\bpras\b/gi, "para as"],
        [/\bpros\b/gi, "para os"],
        [/\bta\b/gi, "está"],
        [/\btão\b/gi, "estão"],
        [/\bto\b/gi, "estou"],
        [/\btb|tbm\b/gi, "também"],
        [/\bpq\b/gi, "porque"],
        [/\boq\b/gi, "o que"],
        [/\bqnd\b/gi, "quando"],
        [/\bblz\b/gi, "perfeito"],
        [/\bne\b/gi, "não é verdade?"],
        [/\bconcessionaria\b/gi, "concessionária"],
        [/\bveiculo\b/gi, "veículo"],
        [/\bveiculos\b/gi, "veículos"],
        [/\brevisao\b/gi, "revisão"],
        [/\brevisoes\b/gi, "revisões"],
        [/\bmanutencao\b/gi, "manutenção"],
        [/\bpecas\b/gi, "peças"],
        [/\bgenuinas\b/gi, "genuínas"],
        [/\btecnicos\b/gi, "técnicos"],
        [/\bdiagnostico\b/gi, "diagnóstico"],
        [/\bdiagnosticos\b/gi, "diagnósticos"],
        [/\bcondicoes\b/gi, "condições"],
        [/\bgarantia de fabrica\b/gi, "garantia de fábrica"],
        [/\bgarantia\b/gi, "garantia de fábrica"],
        [/\bseguranca\b/gi, "segurança"],
        [/\btranquilidade\b/gi, "tranquilidade"],
        [/\boficina\b/gi, "oficina autorizada Ford"],
        [/\bloja\b/gi, "concessionária oficial Ford"],
      ];

      // Se o usuário digitou muito pouco ou texto vazio, gera proposta completa de alto impacto
      if (!inputDesc || inputDesc.length < 15) {
        if (voiceTone === "PREMIUM") {
          inputTitle = `Excelência e Cuidado Superior para o seu ${modelRef}`;
          inputDesc = `Convidamos você para um atendimento executivo exclusivo na rede autorizada Ford. Nossa equipe certificada e ferramental de precisão preservam todo o desempenho e sofisticação do seu ${modelRef}.`;
        } else if (voiceTone === "TRABALHO") {
          inputTitle = `Máxima Produtividade e Força Total para o seu ${modelRef}`;
          inputDesc = `Garanta que o seu ${modelRef} mantenha alto padrão de disponibilidade operacional. Revisão preventiva ágil com peças genuínas para você seguir em frente sem imprevistos.`;
        } else if (voiceTone === "FAMILIA") {
          inputTitle = `Tranquilidade e Máxima Segurança para sua Família no ${modelRef}`;
          inputDesc = `A segurança da sua família é prioridade absoluta. Realize a inspeção preventiva de freios, suspensão e sistemas eletrônicos com o respaldo oficial da engenharia Ford.`;
        } else {
          inputTitle = `Revisão Periódica Ford: Condições Especiais para seu ${modelRef}`;
          inputDesc = `Chegou o momento ideal para a revisão preventiva do seu ${modelRef}. Aproveite condições facilitadas de agendamento e mantenha seu veículo 100% original e valorizado.`;
        }
      } else {
        // Aplica correção ortográfica e gramatical
        for (const [regex, replacement] of corrections) {
          inputDesc = inputDesc.replace(regex, replacement);
          inputTitle = inputTitle.replace(regex, replacement);
        }

        // Garante letra maiúscula no início de frases
        inputDesc = inputDesc.replace(/(^\w|\.\s+\w)/gm, (letter) => letter.toUpperCase());
        inputTitle = inputTitle.replace(/(^\w|\.\s+\w)/gm, (letter) => letter.toUpperCase());

        // Pontuação final
        if (!inputDesc.endsWith(".") && !inputDesc.endsWith("!") && !inputDesc.endsWith("?")) {
          inputDesc += ".";
        }

        // Se o título estiver curto ou vago, complementa
        if (!inputTitle || inputTitle.length < 8) {
          inputTitle = `Revisão Preventiva Oficial para o seu ${modelRef}`;
        }
      }

      setPublicTitle(inputTitle);
      setPublicDescription(inputDesc);
      setIsPolishing(false);
      setPolishedSuccess(true);
      setTimeout(() => setPolishedSuccess(false), 6000);
    }, 450);
  }

  function handleUndoPolish() {
    if (originalDraft) {
      setPublicTitle(originalDraft.title);
      setPublicDescription(originalDraft.desc);
      setPublicCtaLabel(originalDraft.cta);
      setOriginalDraft(null);
      setPolishedSuccess(false);
    }
  }

  // Buscar segmentos inteligentes da API
  useEffect(() => {
    setLoadingSegments(true);
    api<SmartSegment[]>("/campaigns/segments")
      .then((data) => setSmartSegments(data))
      .catch(() => {})
      .finally(() => setLoadingSegments(false));
  }, []);

  const parsedVins = useMemo(() => {
    return vinsText
      .split(/[\s,;]+/)
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);
  }, [vinsText]);

  const invalidVins = useMemo(() => {
    return parsedVins.filter((v) => v.length !== 17);
  }, [parsedVins]);

  // Assistente de IA de Copywriting: Tons de Voz
  function applyVoiceTone(tone: VoiceTone) {
    setVoiceTone(tone);
    const modelRef = reminderModel || "Ford";

    if (tone === "PREMIUM") {
      setName(`Experiência Ford Executive Care — ${modelRef}`);
      setPublicTitle(`Excelência e Cuidado Superior para o seu ${modelRef}`);
      setPublicDescription(
        `Seu ${modelRef} foi concebido com os mais altos padrões de tecnologia e desempenho. Convidamos você para um atendimento executivo exclusivo em nossa oficina autorizada, com diagnósticos precisos e técnicos certificados Ford.`
      );
      setPublicCtaLabel("Agendar Atendimento VIP");
      setPublicCtaLink("/agendamentos");
    } else if (tone === "FAMILIA") {
      setName(`Segurança & Viagem em Família — ${modelRef}`);
      setPublicTitle(`Tranquilidade e Máxima Segurança para a sua Família`);
      setPublicDescription(
        `Cada detalhe do seu ${modelRef} importa para garantir viagens protegidas. Realize a inspeção preventiva de freios, suspensão e sistemas eletrônicos antes do seu próximo trajeto com a garantia oficial da Ford.`
      );
      setPublicCtaLabel("Garantir Minha Segurança");
      setPublicCtaLink("/agendamentos");
    } else if (tone === "TRABALHO") {
      setName(`Prontidão Operacional e Força Total — ${modelRef}`);
      setPublicTitle(`Máxima Produtividade e Zero Tempo Parado para o seu ${modelRef}`);
      setPublicDescription(
        `Sabemos que o seu ${modelRef} é parte essencial da sua rotina produtiva. Agende uma revisão expressa com peças genuínas e mantenha a força e prontidão que você precisa em qualquer desafio.`
      );
      setPublicCtaLabel("Revisão de Alta Prontidão");
      setPublicCtaLink("/agendamentos");
    } else if (tone === "OFERTA") {
      setName(`Condição Exclusiva de Retorno — ${modelRef}`);
      setPublicTitle(`Oportunidade Exclusiva: Condições Especiais na sua Revisão`);
      setPublicDescription(
        `Preparamos um benefício especial para você cuidar do seu ${modelRef} na rede oficial. Aproveite condições facilitadas de pagamento e mão de obra qualificada agendando direto pelo Ford App.`
      );
      setPublicCtaLabel("Aproveitar Minha Oferta");
      setPublicCtaLink("/agendamentos");
    }
  }

  // Selecionar Segmento Inteligente
  function selectSmartSegment(seg: SmartSegment) {
    setSelectedSegmentId(seg.id);
    setVinsText(seg.vins.join("\n"));
    if (seg.suggestedTone) {
      applyVoiceTone(seg.suggestedTone);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalidVins.length > 0) {
      setError(`Existem ${invalidVins.length} VIN(s) fora do padrão de 17 caracteres. Corrija-os antes de continuar.`);
      return;
    }
    setSubmitting(true);
    setError("");

    // Construir metadados e enriquecer descrição com benefício e régua
    let fullDescription = description;
    if (executionMode === "AUTO_TRIGGER") {
      fullDescription = `[RÉGUA AUTOMÁTICA] ${fullDescription}`;
    }
    if (benefitType === "DISCOUNT_100") fullDescription += " [VOUCHER R$ 100 OFF]";
    if (benefitType === "DISCOUNT_150") fullDescription += " [VOUCHER R$ 150 OFF]";
    if (benefitType === "DISCOUNT_200") fullDescription += " [VOUCHER R$ 200 OFF]";
    if (benefitType === "POINTS_500") fullDescription += " [BÔNUS 500 PTS FIDELIDADE]";
    if (benefitType === "POINTS_1000") fullDescription += " [BÔNUS 1000 PTS FIDELIDADE]";

    let enrichedPublicDesc = publicDescription;
    if (benefitType.startsWith("DISCOUNT")) {
      const val = benefitType === "DISCOUNT_100" ? "R$ 100,00" : benefitType === "DISCOUNT_150" ? "R$ 150,00" : "R$ 200,00";
      enrichedPublicDesc += `\n\n🎁 Benefício Exclusivo: Você possui um voucher de ${val} de desconto válido para esta revisão.`;
    } else if (benefitType.startsWith("POINTS")) {
      const pts = benefitType === "POINTS_500" ? "500" : "1.000";
      enrichedPublicDesc += `\n\n⭐ Bônus Especial: Receba +${pts} pontos no Ford Fidelidade ao realizar o atendimento.`;
    }

    try {
      await api("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: fullDescription,
          publicTitle,
          publicDescription: enrichedPublicDesc,
          publicCtaLabel,
          publicCtaLink,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          vehicleVins: parsedVins,
          ...(recommendationVins.length ? { recommendationVins, recommendationModelVersion } : {}),
        }),
      });

      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar campanha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal-card" style={{ maxWidth: "840px" }} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose}>
          <X size={19} />
        </button>
        <span className="eyebrow">CONFIGURAÇÃO DE ENGAJAMENTO INTELIGENTE</span>
        <h2>Criar Nova Campanha de Pós-Venda</h2>
        <p>Utilize a inteligência de segmentação por IA, personalize o tom de voz e anexe incentivos de retorno.</p>

        {/* RECURSO 1: PÚBLICOS INTELIGENTES POR IA */}
        <div className="smart-segments-section">
          <div className="smart-segments-header">
            <span className="smart-segments-title">
              <Sparkles size={14} /> Públicos Inteligentes Sugeridos pela IA (1 Clique)
            </span>
            <span style={{ fontSize: 10, color: "#64748b" }}>
              {loadingSegments ? "Calculando segmentos..." : "Selecione para preencher os veículos"}
            </span>
          </div>
          <div className="smart-segments-grid">
            {smartSegments.map((seg) => (
              <div
                key={seg.id}
                className={`smart-segment-card ${selectedSegmentId === seg.id ? "active" : ""}`}
                onClick={() => selectSmartSegment(seg)}
              >
                <div className="segment-card-top">
                  <span className="segment-card-badge">{seg.badge}</span>
                  <span className="segment-card-count">{seg.count} carros</span>
                </div>
                <h4>{seg.title}</h4>
                <p>{seg.description}</p>
              </div>
            ))}
            {!smartSegments.length && !loadingSegments && (
              <div style={{ fontSize: 11, color: "#64748b", padding: 8 }}>
                Nenhum segmento qualificado no momento. Você pode colar os VINs livremente abaixo.
              </div>
            )}
          </div>
        </div>

        {/* ABAS DE VISUALIZAÇÃO: EDITOR / LIVE PREVIEW */}
        <div className="create-dialog-tabs">
          <button
            type="button"
            className={`dialog-tab-btn ${activeTab === "form" ? "active" : ""}`}
            onClick={() => setActiveTab("form")}
          >
            Formulário da Campanha
          </button>
          <button
            type="button"
            className={`dialog-tab-btn ${activeTab === "preview" ? "active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            Pré-visualização do E-mail (Live Preview)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="entity-form">
          {activeTab === "form" ? (
            <>
              {/* RECURSO 4: ASSISTENTE DE IA DE COPYWRITING */}
              <div className="ai-tone-section">
                <div className="ai-tone-header">
                  <span className="ai-tone-title">
                    <Sparkles size={14} /> Assistente de IA: Tom de Voz da Mensagem
                  </span>
                  <span style={{ fontSize: 10, color: "#0369a1" }}>Reformulação de texto em tempo real</span>
                </div>
                <div className="ai-tone-grid">
                  <button
                    type="button"
                    className={`ai-tone-btn ${voiceTone === "PREMIUM" ? "active" : ""}`}
                    onClick={() => applyVoiceTone("PREMIUM")}
                  >
                    <Crown size={16} />
                    <b>Premium & Executivo</b>
                    <small>Mustang, F-150</small>
                  </button>
                  <button
                    type="button"
                    className={`ai-tone-btn ${voiceTone === "FAMILIA" ? "active" : ""}`}
                    onClick={() => applyVoiceTone("FAMILIA")}
                  >
                    <ShieldCheck size={16} />
                    <b>Segurança & Família</b>
                    <small>Territory, Bronco</small>
                  </button>
                  <button
                    type="button"
                    className={`ai-tone-btn ${voiceTone === "TRABALHO" ? "active" : ""}`}
                    onClick={() => applyVoiceTone("TRABALHO")}
                  >
                    <Briefcase size={16} />
                    <b>Trabalho & Frotas</b>
                    <small>Ranger, Transit</small>
                  </button>
                  <button
                    type="button"
                    className={`ai-tone-btn ${voiceTone === "OFERTA" ? "active" : ""}`}
                    onClick={() => applyVoiceTone("OFERTA")}
                  >
                    <Gift size={16} />
                    <b>Oferta Especial</b>
                    <small>Foco em conversão</small>
                  </button>
                </div>
              </div>

              <label>
                Nome interno da campanha
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Campanha de Inverno Ranger 2026"
                />
              </label>

              <label>
                Descrição operacional (visível apenas para a equipe)
                <textarea
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={2}
                  placeholder="Objetivo da campanha, metas de agendamento e justificativa..."
                />
              </label>

              {/* RECURSO 2: VOUCHER / BENEFÍCIO FORD FIDELIDADE */}
              <div className="loyalty-benefit-section">
                <div className="loyalty-benefit-header">
                  <Gift size={16} /> Incentivo de Retorno: Voucher ou Pontos Ford Fidelidade
                </div>
                <div className="benefit-options-grid">
                  <button
                    type="button"
                    className={`benefit-option-btn ${benefitType === "NONE" ? "active" : ""}`}
                    onClick={() => setBenefitType("NONE")}
                  >
                    Nenhum incentivo
                  </button>
                  <button
                    type="button"
                    className={`benefit-option-btn ${benefitType === "DISCOUNT_100" ? "active" : ""}`}
                    onClick={() => setBenefitType("DISCOUNT_100")}
                  >
                    🏷️ Voucher R$ 100
                  </button>
                  <button
                    type="button"
                    className={`benefit-option-btn ${benefitType === "DISCOUNT_150" ? "active" : ""}`}
                    onClick={() => setBenefitType("DISCOUNT_150")}
                  >
                    🏷️ Voucher R$ 150
                  </button>
                  <button
                    type="button"
                    className={`benefit-option-btn ${benefitType === "DISCOUNT_200" ? "active" : ""}`}
                    onClick={() => setBenefitType("DISCOUNT_200")}
                  >
                    🏷️ Voucher R$ 200
                  </button>
                  <button
                    type="button"
                    className={`benefit-option-btn ${benefitType === "POINTS_500" ? "active" : ""}`}
                    onClick={() => setBenefitType("POINTS_500")}
                  >
                    ⭐ +500 Pontos
                  </button>
                  <button
                    type="button"
                    className={`benefit-option-btn ${benefitType === "POINTS_1000" ? "active" : ""}`}
                    onClick={() => setBenefitType("POINTS_1000")}
                  >
                    ⭐ +1.000 Pontos
                  </button>
                </div>
                <span style={{ fontSize: 10, color: "#92400e" }}>
                  O benefício anexado é entregue diretamente no Ford App do proprietário com validade vinculada ao término da campanha.
                </span>
              </div>

              {/* RECURSO 3: MODO DE EXECUÇÃO (MANUAL VS RÉGUA AUTOMÁTICA) */}
              <div className="execution-mode-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ fontSize: 12, color: "#0f172a" }}>Modo de Execução da Campanha</b>
                  <span style={{ fontSize: 10, color: "#64748b" }}>Escolha entre disparo pontual ou contínuo</span>
                </div>
                <div className="execution-mode-toggle">
                  <button
                    type="button"
                    className={`exec-mode-btn ${executionMode === "MANUAL" ? "active" : ""}`}
                    onClick={() => setExecutionMode("MANUAL")}
                  >
                    <Target size={15} /> Campanha Pontual (Disparo Manual)
                  </button>
                  <button
                    type="button"
                    className={`exec-mode-btn ${executionMode === "AUTO_TRIGGER" ? "active" : ""}`}
                    onClick={() => setExecutionMode("AUTO_TRIGGER")}
                  >
                    <Zap size={15} /> Régua Automática (Gatilho Contínuo)
                  </button>
                </div>
              </div>

              <div className="campaign-email-fields" style={{ background: "#f8fafc", padding: 16, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ color: "#034980", fontWeight: 700, fontSize: 11, letterSpacing: 0.8 }}>
                    CONTEÚDO DO E-MAIL & NOTIFICAÇÃO DO CLIENTE
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {originalDraft && (
                      <button
                        type="button"
                        onClick={handleUndoPolish}
                        style={{ background: "none", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                      >
                        Desfazer correção
                      </button>
                    )}
                    <button
                      type="button"
                      className="ai-polish-btn"
                      onClick={handlePolishTextWithAI}
                      disabled={isPolishing}
                      title="Corrige gramática, pontuação, gírias e aprimora a persuasão do texto com padrão executivo Ford"
                    >
                      <Sparkles size={13} className={isPolishing ? "spin" : ""} />
                      {isPolishing ? "Aprimorando redação..." : "✨ Corrigir & Aprimorar com IA"}
                    </button>
                  </div>
                </div>

                {polishedSuccess && (
                  <div className="ai-polish-alert">
                    <CheckCircle2 size={15} color="#16a34a" />
                    <span>Texto revisado ortograficamente, refinado e alinhado ao padrão de excelência Ford!</span>
                  </div>
                )}

                <label style={{ marginTop: 12 }}>
                  Título do e-mail
                  <input
                    name="publicTitle"
                    value={publicTitle}
                    onChange={(e) => setPublicTitle(e.target.value)}
                    required
                    placeholder="Assunto convidativo para o proprietário..."
                  />
                </label>

                <label>
                  Mensagem para o cliente
                  <textarea
                    name="publicDescription"
                    value={publicDescription}
                    onChange={(e) => setPublicDescription(e.target.value)}
                    required
                    rows={3}
                    placeholder="Texto personalizado convidando o cliente a realizar o atendimento..."
                  />
                </label>

                <div className="form-grid">
                  <label>
                    Texto do botão (CTA)
                    <input
                      name="publicCtaLabel"
                      value={publicCtaLabel}
                      onChange={(e) => setPublicCtaLabel(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Destino no Ford App
                    <select
                      name="publicCtaLink"
                      value={publicCtaLink}
                      onChange={(e) => setPublicCtaLink(e.target.value)}
                    >
                      <option value="/agendamentos">Agendar revisão na oficina (/agendamentos)</option>
                      <option value="/suporte">Falar com a equipe (/suporte)</option>
                      <option value="/fidelidade">Ver benefícios e pontos (/fidelidade)</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: 8 }}>
                <label>
                  Data de início
                  <input
                    name="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Data de término
                  <input
                    name="endsAt"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label style={{ marginTop: 12 }}>
                VINs do público segmentado
                <textarea
                  name="vehicleVins"
                  value={vinsText}
                  onChange={(e) => setVinsText(e.target.value)}
                  placeholder="Cole os VINs dos veículos ou selecione um Público Inteligente acima..."
                  rows={4}
                />
                <div className="vin-validator-helper">
                  <span>
                    Identificados: <strong>{parsedVins.length} veículo(s)</strong>
                  </span>
                  {invalidVins.length > 0 ? (
                    <span className="vin-invalid-badge">
                      ⚠️ {invalidVins.length} VIN(s) possuem tamanho diferente de 17 caracteres!
                    </span>
                  ) : parsedVins.length > 0 ? (
                    <span className="vin-valid-badge">✓ Todos os VINs estão no formato correto</span>
                  ) : null}
                </div>
              </label>

              {recommendationVins.length > 0 && (
                <div className="governance-dialog-note" style={{ marginTop: 10 }}>
                  <ShieldCheck size={16} />
                  Esta campanha foi liberada após revisão humana homologada da recomendação da IA.
                </div>
              )}
            </>
          ) : (
            /* LIVE PREVIEW TAB COM TICKET DE VOUCHER */
            <div className="message-phone-mockup" style={{ margin: "10px 0 20px" }}>
              <div className="phone-mockup-brand">
                <span className="mockup-ford-logo">Ford</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#0284c7" }}>COMUNICAÇÃO OFICIAL</span>
              </div>
              <div className="phone-mockup-body">
                <div style={{
                  background: "#eff6ff",
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 14,
                  border: "1px solid #dbeafe"
                }}>
                  <small style={{ color: "#1d4ed8", fontWeight: 700, letterSpacing: 0.5 }}>SEU FORD</small>
                  <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#1e3a8a", fontSize: 15 }}>
                    Nova Ford Ranger Limited 3.0 V6
                  </p>
                </div>
                <h4>{publicTitle || "Título da sua campanha aparecerá aqui"}</h4>
                <p>{publicDescription || "A mensagem para o cliente que você digitar no formulário aparecerá aqui em tempo real."}</p>

                {/* TICKET DE VOUCHER NO EMAIL */}
                {benefitType !== "NONE" && (
                  <div className="email-voucher-ticket">
                    <div className="voucher-ticket-info">
                      <div className="voucher-ticket-icon">
                        <Gift size={20} />
                      </div>
                      <div>
                        <small>BENEFÍCIO EXCLUSIVO FORD</small>
                        <strong>
                          {benefitType === "DISCOUNT_100" && "R$ 100 DE DESCONTO NA REVISÃO"}
                          {benefitType === "DISCOUNT_150" && "R$ 150 DE DESCONTO NA REVISÃO"}
                          {benefitType === "DISCOUNT_200" && "R$ 200 DE DESCONTO NA REVISÃO"}
                          {benefitType === "POINTS_500" && "+500 PONTOS FORD FIDELIDADE"}
                          {benefitType === "POINTS_1000" && "+1.000 PONTOS FORD FIDELIDADE"}
                        </strong>
                      </div>
                    </div>
                    <span className="voucher-ticket-badge">
                      {benefitType.startsWith("DISCOUNT") ? "CUPOM-FORD" : "FIDELIDADE"}
                    </span>
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <span className="phone-mockup-cta">
                    {publicCtaLabel || "Acessar Ford App"} &nbsp;→
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button className="primary" disabled={submitting || invalidVins.length > 0}>
              {submitting ? "Salvando campanha..." : "Criar campanha de pós-venda"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL (CAMPAIGNS MANAGER)
// ==========================================
export function CampaignsManager({
  campaigns,
  onDispatch,
  onOpenCreate,
}: {
  campaigns: ExtendedCampaign[];
  onDispatch(id: string): Promise<void>;
  onOpenCreate(): void;
}) {
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "ACTIVE" | "PENDING" | "CLOSED">("ALL");
  const [sortBy, setSortBy] = useState<"RECENT" | "CONVERSION" | "TARGETS">("RECENT");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");

  const [selectedPerformance, setSelectedPerformance] = useState<ExtendedCampaign | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<ExtendedCampaign | null>(null);

  // Cálculos globais
  const totalTargets = campaigns.reduce((sum, item) => sum + item._count.targets, 0);
  const totalSent = campaigns.reduce((sum, item) => sum + item.targets.filter((t) => t.sentAt).length, 0);
  const totalConverted = campaigns.reduce((sum, item) => sum + item.targets.filter((t) => t.convertedAt).length, 0);
  const averageConversion = totalTargets ? Math.round((totalConverted / totalTargets) * 1000) / 10 : 0;

  // Filtragem e busca
  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => {
        // Tab filter
        const isSentFull = c.targets.filter((t) => t.sentAt).length >= c._count.targets && c._count.targets > 0;
        if (filterTab === "ACTIVE" && !c.active) return false;
        if (filterTab === "CLOSED" && c.active) return false;
        if (filterTab === "PENDING" && isSentFull) return false;

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = c.name.toLowerCase().includes(q);
          const matchDesc = c.description.toLowerCase().includes(q);
          const matchTitle = c.publicTitle?.toLowerCase().includes(q) ?? false;
          if (!matchName && !matchDesc && !matchTitle) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "CONVERSION") {
          const rateA = a._count.targets ? a.targets.filter((t) => t.convertedAt).length / a._count.targets : 0;
          const rateB = b._count.targets ? b.targets.filter((t) => t.convertedAt).length / b._count.targets : 0;
          return rateB - rateA;
        }
        if (sortBy === "TARGETS") {
          return b._count.targets - a._count.targets;
        }
        // RECENT
        return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
      });
  }, [campaigns, filterTab, search, sortBy]);

  // Contagens das abas
  const counts = useMemo(() => {
    return {
      ALL: campaigns.length,
      ACTIVE: campaigns.filter((c) => c.active).length,
      PENDING: campaigns.filter((c) => c.targets.filter((t) => t.sentAt).length < c._count.targets).length,
      CLOSED: campaigns.filter((c) => !c.active).length,
    };
  }, [campaigns]);

  return (
    <>
      {/* CABEÇALHO DA PÁGINA */}
      <div className="page-header">
        <div>
          <span className="eyebrow">ENGAJAMENTO & PÓS-VENDA INTELIGENTE</span>
          <h1>Campanhas da Concessionária</h1>
          <p>Crie jornadas automatizadas, segmente públicos prioritários e meça o retorno à oficina em tempo real.</p>
        </div>
        <button className="primary" onClick={onOpenCreate} style={{ gap: 8 }}>
          <Sparkles size={16} /> Nova campanha
        </button>
      </div>

      {/* CARDS DE KPIS EXECUTIVOS */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon icon-blue">
            <Target size={20} />
          </div>
          <div className="stat-copy">
            <span>CAMPANHAS ATIVAS</span>
            <strong>{counts.ACTIVE}</strong>
            <small>De {campaigns.length} cadastradas</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-violet">
            <UsersRound size={20} />
          </div>
          <div className="stat-copy">
            <span>CLIENTES IMPACTADOS</span>
            <strong>{totalTargets}</strong>
            <small>{totalSent} mensagens disparadas</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-green">
            <BadgePercent size={20} />
          </div>
          <div className="stat-copy">
            <span>CONVERSÃO MÉDIA</span>
            <strong>{averageConversion}%</strong>
            <small className="positive">{totalConverted} conversões na oficina</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-amber">
            <CircleDollarSign size={20} />
          </div>
          <div className="stat-copy">
            <span>DISPAROS PENDENTES</span>
            <strong>{counts.PENDING}</strong>
            <small>Ações prontas para envio</small>
          </div>
        </div>
      </section>

      {/* BARRA DE CONTROLES: BUSCA, ABAS, ORDENAÇÃO E MODO DE EXIBIÇÃO */}
      <div className="campaign-controls-bar">
        <div className="campaign-search-box">
          <Search size={16} />
          <input
            placeholder="Buscar por nome, assunto ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{ background: "transparent", color: "#94a3b8", padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="campaign-filter-tabs">
          <button
            type="button"
            className={`campaign-tab-chip ${filterTab === "ALL" ? "active" : ""}`}
            onClick={() => setFilterTab("ALL")}
          >
            Todas <span className="chip-count">{counts.ALL}</span>
          </button>
          <button
            type="button"
            className={`campaign-tab-chip ${filterTab === "ACTIVE" ? "active" : ""}`}
            onClick={() => setFilterTab("ACTIVE")}
          >
            Ativas <span className="chip-count">{counts.ACTIVE}</span>
          </button>
          <button
            type="button"
            className={`campaign-tab-chip ${filterTab === "PENDING" ? "active" : ""}`}
            onClick={() => setFilterTab("PENDING")}
          >
            Com Disparos Pendentes <span className="chip-count">{counts.PENDING}</span>
          </button>
          <button
            type="button"
            className={`campaign-tab-chip ${filterTab === "CLOSED" ? "active" : ""}`}
            onClick={() => setFilterTab("CLOSED")}
          >
            Encerradas <span className="chip-count">{counts.CLOSED}</span>
          </button>
        </div>

        <div className="campaign-view-actions">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              height: 34,
              fontSize: 11,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 7,
              background: "#ffffff",
              color: "#334155",
            }}
          >
            <option value="RECENT">Mais recentes</option>
            <option value="CONVERSION">Maior conversão</option>
            <option value="TARGETS">Maior público</option>
          </select>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "GRID" ? "active" : ""}`}
              onClick={() => setViewMode("GRID")}
              title="Visualização em Cards"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "TABLE" ? "active" : ""}`}
              onClick={() => setViewMode("TABLE")}
              title="Visualização em Tabela"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO: GRID OU TABELA */}
      {viewMode === "GRID" ? (
        <section className="campaign-cards-grid">
          {filteredCampaigns.map((campaign, i) => {
            const total = campaign._count.targets;
            const sent = campaign.targets.filter((t) => t.sentAt).length;
            const conversions = campaign.targets.filter((t) => t.convertedAt).length;
            const rate = total ? Math.round((conversions / total) * 1000) / 10 : 0;
            const isCompleted = sent >= total && total > 0;

            const isAutoTrigger = campaign.description.includes("[RÉGUA AUTOMÁTICA]");
            const hasBenefit = campaign.description.includes("[VOUCHER") || campaign.description.includes("[BÔNUS") || campaign.name.includes("Voucher") || campaign.name.includes("Fidelidade");

            const daysLeft = Math.ceil((new Date(campaign.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <article className="premium-campaign-card" key={campaign.id}>
                <div className={`p-card-header ${!campaign.active ? "tone-slate" : i % 2 === 0 ? "" : "tone-emerald"}`}>
                  <div className="p-header-top">
                    <span className="p-ford-badge">
                      <Target size={12} /> Campanha Ford
                    </span>
                    <div className="p-header-badges">
                      {isAutoTrigger && (
                        <span className="p-tag-trigger" style={{ background: "rgba(147, 51, 234, 0.25)", color: "#e9d5ff", border: "1px solid rgba(233, 213, 255, 0.3)" }}>
                          <Zap size={10} /> Régua Automática
                        </span>
                      )}
                      {hasBenefit && (
                        <span className="p-tag-benefit" style={{ background: "rgba(245, 158, 11, 0.25)", color: "#fef3c7", border: "1px solid rgba(254, 243, 199, 0.3)" }}>
                          <Gift size={10} /> Benefício
                        </span>
                      )}
                      <span className={`p-status-pill ${campaign.active ? "active" : "closed"}`}>
                        <i /> {campaign.active ? "Ativa" : "Encerrada"}
                      </span>
                    </div>
                  </div>
                  <div className="p-header-bottom">
                    <span className="p-validity">
                      <Clock size={12} />
                      {campaign.active
                        ? daysLeft > 0
                          ? `Termina em ${daysLeft} dia(s)`
                          : "Termina hoje"
                        : "Encerrada"}
                    </span>
                    <span style={{ fontSize: 9, opacity: 0.85 }}>
                      {new Date(campaign.startsAt).toLocaleDateString("pt-BR")} —{" "}
                      {new Date(campaign.endsAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>

                <div className="p-card-body">
                  <div className="p-card-title-row">
                    <h3>{campaign.name}</h3>
                    <p className="p-card-desc">{campaign.description}</p>
                  </div>

                  {/* MINI FUNIL BAR */}
                  <div className="p-funnel-bar-wrapper">
                    <div className="p-funnel-bar-label">
                      <span>PROGRESSO DE DISPARO & RETORNO</span>
                      <span>
                        {conversions} de {total} convertidos
                      </span>
                    </div>
                    <div className="p-funnel-track">
                      <div
                        className="p-funnel-segment sent"
                        style={{ width: `${total ? (sent / total) * 100 : 0}%` }}
                        title={`${sent} enviados`}
                      />
                      <div
                        className="p-funnel-segment converted"
                        style={{ width: `${total ? (conversions / total) * 100 : 0}%` }}
                        title={`${conversions} convertidos`}
                      />
                    </div>
                  </div>

                  {/* MÉTRICAS EM DESTAQUE */}
                  <div className="p-metrics-strip">
                    <div className="p-metric-item">
                      <small>Público</small>
                      <strong>{total}</strong>
                    </div>
                    <div className="p-metric-item">
                      <small>Enviados</small>
                      <strong className="highlight-blue">{sent}</strong>
                    </div>
                    <div className="p-metric-item">
                      <small>Conversão</small>
                      <strong className={rate > 0 ? "highlight-green" : ""}>{rate}%</strong>
                    </div>
                  </div>

                  {/* AÇÕES DO CARD */}
                  <div className="p-card-actions">
                    {!isCompleted && campaign.active ? (
                      <>
                        <button
                          type="button"
                          className="p-btn-dispatch"
                          onClick={() => setSelectedDispatch(campaign)}
                        >
                          <Send size={14} /> Disparar ({total - sent})
                        </button>
                        <button
                          type="button"
                          className="p-btn-performance"
                          onClick={() => setSelectedPerformance(campaign)}
                        >
                          <BarChart3 size={14} /> Desempenho
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="p-btn-performance p-btn-completed"
                        onClick={() => setSelectedPerformance(campaign)}
                      >
                        <BarChart3 size={14} /> Ver Desempenho Completo
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredCampaigns.length && (
            <div className="empty-card" style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center" }}>
              <AlertCircle size={32} style={{ color: "#94a3b8", margin: "0 auto 10px" }} />
              <b style={{ display: "block", fontSize: 14, color: "#334155" }}>Nenhuma campanha encontrada</b>
              <p style={{ margin: "4px 0 16px", color: "#64748b", fontSize: 12 }}>
                Tente alterar a busca ou os filtros para encontrar outras ações da concessionária.
              </p>
              <button type="button" className="secondary" onClick={() => { setSearch(""); setFilterTab("ALL"); }}>
                Limpar filtros
              </button>
            </div>
          )}
        </section>
      ) : (
        /* TABELA EXECUTIVA */
        <div className="campaigns-table-container">
          <table className="campaigns-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Campanha & Período</th>
                <th>Público</th>
                <th>Enviados</th>
                <th>Conversões</th>
                <th>Taxa de Retorno</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((c) => {
                const total = c._count.targets;
                const sent = c.targets.filter((t) => t.sentAt).length;
                const conv = c.targets.filter((t) => t.convertedAt).length;
                const rate = total ? Math.round((conv / total) * 1000) / 10 : 0;
                const isAutoTrigger = c.description.includes("[RÉGUA AUTOMÁTICA]");

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className={`p-status-pill ${c.active ? "active" : "closed"}`}>
                          <i /> {c.active ? "Ativa" : "Encerrada"}
                        </span>
                        {isAutoTrigger && (
                          <span className="p-tag-trigger" style={{ fontSize: 8 }}>
                            <Zap size={8} /> Auto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-campaign-name">
                      <b>{c.name}</b>
                      <span>
                        {new Date(c.startsAt).toLocaleDateString("pt-BR")} até {new Date(c.endsAt).toLocaleDateString("pt-BR")}
                      </span>
                    </td>
                    <td>
                      <strong>{total}</strong> veículos
                    </td>
                    <td>
                      <span style={{ color: "#0284c7", fontWeight: 700 }}>{sent}</span> ({total ? Math.round((sent / total) * 100) : 0}%)
                    </td>
                    <td>
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>{conv}</span> retornos
                    </td>
                    <td>
                      <strong style={{ color: rate > 0 ? "#16a34a" : "#64748b" }}>{rate}%</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {sent < total && c.active && (
                          <button
                            type="button"
                            className="primary"
                            style={{ height: 30, padding: "0 10px", fontSize: 10, gap: 4 }}
                            onClick={() => setSelectedDispatch(c)}
                          >
                            <Send size={12} /> Disparar
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary"
                          style={{ height: 30, padding: "0 10px", fontSize: 10, gap: 4 }}
                          onClick={() => setSelectedPerformance(c)}
                        >
                          <BarChart3 size={12} /> Desempenho
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredCampaigns.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                    Nenhuma campanha encontrada neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE DESEMPENHO */}
      {selectedPerformance && (
        <CampaignPerformanceModal
          campaign={selectedPerformance}
          onClose={() => setSelectedPerformance(null)}
          onOpenDispatch={(c) => setSelectedDispatch(c)}
        />
      )}

      {/* MODAL DE DISPARO COM CONFIRMAÇÃO */}
      {selectedDispatch && (
        <CampaignDispatchModal
          campaign={selectedDispatch}
          onClose={() => setSelectedDispatch(null)}
          onConfirm={onDispatch}
        />
      )}
    </>
  );
}
