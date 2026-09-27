import { Check, Download, FileLock2, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import { api } from "./lib/api";

type ConsentPurpose = "MARKETING" | "ANALYTICS" | "PERSONALIZATION";
type Consent = {
  purpose: ConsentPurpose;
  granted: boolean;
  updatedAt: string | null;
};
type DataRequest = {
  id: string;
  type: string;
  status: string;
  notes: string | null;
  resolution: string | null;
  createdAt: string;
  requestedBy?: { fullName: string; email: string };
  handledBy?: { fullName: string } | null;
};
type PrivacyMe = { consents: Consent[]; requests: DataRequest[] };

const consentCopy: Record<
  ConsentPurpose,
  { title: string; description: string }
> = {
  MARKETING: {
    title: "Comunicações e ofertas",
    description: "Autoriza campanhas personalizadas por canais cadastrados.",
  },
  ANALYTICS: {
    title: "Análise de experiência",
    description:
      "Ajuda a melhorar serviços usando dados agregados de utilização.",
  },
  PERSONALIZATION: {
    title: "Experiência personalizada",
    description:
      "Permite recomendações com base no veículo e no histórico Ford.",
  },
};
const requestLabels: Record<string, string> = {
  ACCESS: "Acesso aos dados",
  EXPORT: "Portabilidade",
  CORRECTION: "Correção",
  DELETION: "Exclusão/anônimização",
  RECEIVED: "Recebida",
  IN_REVIEW: "Em análise",
  COMPLETED: "Concluída",
  REJECTED: "Indeferida",
};

export function PrivacyPanel() {
  const { user } = useAuth();
  const [data, setData] = useState<PrivacyMe>({ consents: [], requests: [] });
  const [allRequests, setAllRequests] = useState<DataRequest[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setData(await api<PrivacyMe>("/privacy/me"));
    if (user?.role === "FORD_ADMIN")
      setAllRequests(await api<DataRequest[]>("/privacy/requests"));
  }
  useEffect(() => {
    void load();
  }, [user?.role]);

  async function toggle(consent: Consent) {
    setBusy(consent.purpose);
    setError("");
    try {
      await api(`/privacy/consents/${consent.purpose}`, {
        method: "PUT",
        body: JSON.stringify({ granted: !consent.granted, source: "WEB" }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao salvar consentimento.",
      );
    } finally {
      setBusy("");
    }
  }

  async function requestData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("request");
    setError("");
    try {
      await api("/privacy/requests", {
        method: "POST",
        body: JSON.stringify({
          type: form.get("type"),
          notes: form.get("notes"),
        }),
      });
      formElement.reset();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao registrar solicitação.",
      );
    } finally {
      setBusy("");
    }
  }

  async function exportData() {
    setBusy("export");
    setError("");
    try {
      const content = await api<unknown>("/privacy/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(content, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ford-vinculo-dados-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao exportar dados.",
      );
    } finally {
      setBusy("");
    }
  }

  async function updateRequest(request: DataRequest, status: string) {
    setBusy(request.id);
    setError("");
    try {
      await api(`/privacy/requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          resolution:
            status === "COMPLETED"
              ? "Solicitação processada pela equipe de privacidade."
              : undefined,
        }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao atualizar solicitação.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="privacy-center" id="privacidade">
      <div className="privacy-center-header">
        <div className="privacy-shield">
          <ShieldCheck size={24} />
        </div>
        <div>
          <span className="eyebrow">CENTRAL DE PRIVACIDADE</span>
          <h2>Consentimentos e direitos do titular</h2>
          <p>
            Controle transparente, revogável e registrado na trilha de
            auditoria.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => void exportData()}
          disabled={busy === "export"}
        >
          <Download size={15} />
          {busy === "export" ? "Preparando..." : "Baixar meus dados"}
        </button>
      </div>
      {error && <div className="login-error">{error}</div>}
      <div className="privacy-columns">
        <article className="card privacy-consents">
          <div className="card-heading">
            <div>
              <span className="eyebrow">PREFERÊNCIAS</span>
              <h2>Seus consentimentos</h2>
            </div>
          </div>
          {data.consents.map((consent) => (
            <div className="consent-row" key={consent.purpose}>
              <span>
                <b>{consentCopy[consent.purpose].title}</b>
                <small>{consentCopy[consent.purpose].description}</small>
              </span>
              <button
                role="switch"
                aria-checked={consent.granted}
                className={`consent-switch ${consent.granted ? "enabled" : ""}`}
                disabled={busy === consent.purpose}
                onClick={() => void toggle(consent)}
              >
                <i />
              </button>
            </div>
          ))}
        </article>
        <article className="card privacy-request-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">DIREITOS LGPD</span>
              <h2>Nova solicitação</h2>
            </div>
          </div>
          <form
            className="entity-form"
            onSubmit={(event) => void requestData(event)}
          >
            <label>
              Tipo de solicitação
              <select name="type">
                <option value="ACCESS">Acesso aos dados</option>
                <option value="EXPORT">Portabilidade</option>
                <option value="CORRECTION">Correção</option>
                <option value="DELETION">Exclusão/anônimização</option>
              </select>
            </label>
            <label>
              Detalhes
              <textarea
                name="notes"
                placeholder="Explique o que você precisa"
              />
            </label>
            <button className="primary" disabled={busy === "request"}>
              <FileLock2 size={15} />
              {busy === "request" ? "Registrando..." : "Registrar solicitação"}
            </button>
          </form>
        </article>
      </div>
      <article className="card privacy-history">
        <div className="card-heading">
          <div>
            <span className="eyebrow">ACOMPANHAMENTO</span>
            <h2>
              {user?.role === "FORD_ADMIN"
                ? "Solicitações recebidas"
                : "Minhas solicitações"}
            </h2>
          </div>
        </div>
        <div>
          {(user?.role === "FORD_ADMIN" ? allRequests : data.requests).map(
            (request) => (
              <div className="privacy-request-row" key={request.id}>
                <span className="privacy-request-icon">
                  <FileLock2 size={16} />
                </span>
                <span>
                  <b>{requestLabels[request.type] ?? request.type}</b>
                  <small>
                    {request.requestedBy
                      ? `${request.requestedBy.fullName} · `
                      : ""}
                    {new Date(request.createdAt).toLocaleString("pt-BR")}
                  </small>
                </span>
                <em
                  className={`request-status status-${request.status.toLowerCase()}`}
                >
                  {requestLabels[request.status] ?? request.status}
                </em>
                {user?.role === "FORD_ADMIN" && (
                  <select
                    value={request.status}
                    disabled={busy === request.id}
                    onChange={(event) =>
                      void updateRequest(request, event.target.value)
                    }
                  >
                    <option value="RECEIVED">Recebida</option>
                    <option value="IN_REVIEW">Em análise</option>
                    <option value="COMPLETED">Concluída</option>
                    <option value="REJECTED">Indeferida</option>
                  </select>
                )}
              </div>
            ),
          )}
          {!(user?.role === "FORD_ADMIN" ? allRequests : data.requests)
            .length && (
            <div className="privacy-empty">
              <Check size={18} />
              Nenhuma solicitação registrada.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
