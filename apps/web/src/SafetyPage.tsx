import {
  CalendarDays,
  CarFront,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth";
import { api } from "./lib/api";

type RecallStatus = "PENDING" | "CONTACTED" | "SCHEDULED" | "COMPLETED";
type RecallTarget = {
  id: string;
  status: RecallStatus;
  notifiedAt: string | null;
  completedAt: string | null;
  vehicle: {
    vin: string;
    plate: string | null;
    model: string;
    modelYear: number;
    ownerships: Array<{
      user: { fullName: string; email: string; phone: string | null };
    }>;
  };
};
type Recall = {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  active: boolean;
  startsAt: string;
  targets: RecallTarget[];
};

const statusLabels: Record<RecallStatus, string> = {
  PENDING: "Pendente",
  CONTACTED: "Notificado",
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
};
const severityLabels = {
  LOW: "Baixa",
  MEDIUM: "Moderada",
  HIGH: "Alta",
  CRITICAL: "Crítica",
} as const;

export function SafetyPage() {
  const { user } = useAuth();
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canCreate =
    user?.role === "FORD_ADMIN" || user?.role === "DEALERSHIP_MANAGER";

  async function load() {
    setRecalls(await api<Recall[]>("/recalls"));
  }
  useEffect(() => {
    void load();
  }, []);
  const targets = useMemo(
    () => recalls.flatMap((recall) => recall.targets),
    [recalls],
  );
  const completed = targets.filter(
    (target) => target.status === "COMPLETED",
  ).length;

  async function notify(recall: Recall) {
    setBusy(recall.id);
    setError("");
    try {
      await api(`/recalls/${recall.id}/notify`, { method: "POST" });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao notificar.",
      );
    } finally {
      setBusy("");
    }
  }

  async function updateTarget(id: string, status: RecallStatus) {
    setBusy(id);
    setError("");
    try {
      await api(`/recalls/targets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao atualizar.",
      );
    } finally {
      setBusy("");
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/recalls", {
        method: "POST",
        body: JSON.stringify({
          code: form.get("code"),
          title: form.get("title"),
          description: form.get("description"),
          severity: form.get("severity"),
          startsAt: new Date(String(form.get("startsAt"))).toISOString(),
          vehicleVins: String(form.get("vehicleVins"))
            .split(/[\s,;]+/)
            .filter(Boolean),
        }),
      });
      setCreating(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao criar recall.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">SEGURANÇA DO VEÍCULO</span>
          <h1>Recalls e campanhas preventivas</h1>
          <p>
            Acompanhe cada veículo pelo VIN, do aviso até a conclusão do
            serviço.
          </p>
        </div>
        {canCreate && (
          <button className="primary" onClick={() => setCreating(true)}>
            <Plus size={17} />
            Nova campanha de recall
          </button>
        )}
      </div>
      <section className="stats-grid safety-stats">
        <article className="stat-card">
          <div className="stat-icon icon-red">
            <ShieldAlert size={20} />
          </div>
          <div className="stat-copy">
            <span>Campanhas ativas</span>
            <strong>{recalls.filter((item) => item.active).length}</strong>
            <small>Com veículos no seu escopo</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon icon-blue">
            <CarFront size={20} />
          </div>
          <div className="stat-copy">
            <span>Veículos envolvidos</span>
            <strong>{targets.length}</strong>
            <small>Identificados permanentemente pelo VIN</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon icon-amber">
            <Send size={20} />
          </div>
          <div className="stat-copy">
            <span>Aguardando ação</span>
            <strong>{targets.length - completed}</strong>
            <small>Notificação ou agendamento pendente</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon icon-green">
            <ShieldCheck size={20} />
          </div>
          <div className="stat-copy">
            <span>Concluídos</span>
            <strong>{completed}</strong>
            <small>Atendimentos finalizados</small>
          </div>
        </article>
      </section>
      {error && <div className="login-error safety-error">{error}</div>}
      <section className="recalls-list">
        {recalls.map((recall) => (
          <article className="card recall-card" key={recall.id}>
            <div className="recall-heading">
              <span
                className={`recall-severity severity-${recall.severity.toLowerCase()}`}
              >
                <ShieldAlert size={18} />
                {severityLabels[recall.severity]}
              </span>
              <div>
                <small>
                  {recall.code} · desde{" "}
                  {new Date(recall.startsAt).toLocaleDateString("pt-BR")}
                </small>
                <h2>{recall.title}</h2>
                <p>{recall.description}</p>
              </div>
              {canCreate && (
                <button
                  className="secondary"
                  disabled={busy === recall.id}
                  onClick={() => void notify(recall)}
                >
                  <Send size={15} />
                  {busy === recall.id ? "Enviando..." : "Notificar pendentes"}
                </button>
              )}
            </div>
            <div className="recall-progress">
              <i
                style={{
                  width: `${recall.targets.length ? Math.round((recall.targets.filter((target) => target.status === "COMPLETED").length / recall.targets.length) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="recall-targets">
              {recall.targets.map((target) => (
                <div key={target.id}>
                  <span className="vehicle-thumb">
                    <CarFront size={19} />
                  </span>
                  <span>
                    <b>
                      {target.vehicle.model} {target.vehicle.modelYear}
                    </b>
                    <small>
                      {target.vehicle.vin} ·{" "}
                      {target.vehicle.ownerships[0]?.user.fullName ??
                        "Sem vínculo ativo"}
                    </small>
                  </span>
                  {user?.role === "CUSTOMER" ? (
                    <span
                      className={`target-status target-${target.status.toLowerCase()}`}
                    >
                      {statusLabels[target.status]}
                    </span>
                  ) : (
                    <select
                      aria-label={`Status do recall ${target.vehicle.vin}`}
                      value={target.status}
                      disabled={busy === target.id}
                      onChange={(event) =>
                        void updateTarget(
                          target.id,
                          event.target.value as RecallStatus,
                        )
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                  {user?.role === "CUSTOMER" &&
                    target.status !== "COMPLETED" && (
                      <Link
                        className="primary compact-action"
                        to="/agendamentos"
                      >
                        <CalendarDays size={14} />
                        Agendar
                      </Link>
                    )}
                </div>
              ))}
            </div>
          </article>
        ))}
        {!recalls.length && (
          <div className="card empty-card">
            <ShieldCheck size={28} />
            <h3>Nenhum recall para os veículos deste perfil</h3>
            <p>
              Quando existir uma campanha, ela aparecerá aqui automaticamente.
            </p>
          </div>
        )}
      </section>
      {creating && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCreating(false)
          }
        >
          <section
            className="modal-card"
            role="dialog"
            aria-label="Nova campanha de recall"
          >
            <button className="modal-close" onClick={() => setCreating(false)}>
              ×
            </button>
            <span className="eyebrow">CAMPANHA DE SEGURANÇA</span>
            <h2>Nova campanha de recall</h2>
            <p>Associe a comunicação diretamente aos VINs afetados.</p>
            <form
              className="entity-form"
              onSubmit={(event) => void create(event)}
            >
              <div className="form-grid">
                <label>
                  Código
                  <input name="code" required placeholder="FORD-26-AX7" />
                </label>
                <label>
                  Severidade
                  <select name="severity" defaultValue="HIGH">
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Moderada</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </label>
              </div>
              <label>
                Título
                <input name="title" required />
              </label>
              <label>
                Descrição
                <textarea name="description" minLength={10} required />
              </label>
              <label>
                Início
                <input name="startsAt" type="date" required />
              </label>
              <label>
                VINs afetados
                <textarea
                  name="vehicleVins"
                  required
                  placeholder="Separe por vírgula ou linha"
                />
              </label>
              {error && <div className="login-error">{error}</div>}
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy === "create"}>
                  {busy === "create" ? "Criando..." : "Criar campanha"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
