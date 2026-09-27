import {
  useState,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
import { useAuth } from "./auth";
import { api } from "./lib/api";

type AccessMode = "login" | "reset-request" | "reset-confirm" | "invite";

const VEHICLES = [
  {
    id: "ranger",
    name: "Nova Ford Ranger",
    version: "Limited 3.0 V6 4WD",
    badge: "Picape Média Premium",
    tag: "Motor V6 250cv · FordPass Connect · Prontidão Total",
    metric: "14.820 veículos monitorados",
    image: "/ranger-hero.png",
  },
  {
    id: "mach-e",
    name: "Mustang Mach-E GT",
    version: "Performance All-Wheel Drive",
    badge: "100% Elétrico",
    tag: "0-100 km/h em 3,7s · Telemetria em Tempo Real",
    metric: "Saúde de Bateria & Recarga 360",
    image: "/mach-e-hero.png",
  },
  {
    id: "f150",
    name: "Ford F-150",
    version: "Platinum V8 5.0L",
    badge: "Picape Full-Size",
    tag: "Pro Power Onboard · Conforto & Tecnologia Executiva",
    metric: "Manutenção Preditiva Ativa",
    image: "/f150-hero.png",
  },
  {
    id: "bronco",
    name: "Ford Bronco Sport",
    version: "Wildtrak 2.0 EcoBoost",
    badge: "Ícone Off-Road 4x4",
    tag: "G.O.A.T. Modes · Tração Inteligente · Robustez",
    metric: "Fidelidade e Revisão Preventiva",
    image: "/bronco-hero.png",
  },
];

const DEMO_ACCOUNTS = [
  { role: "Gerente", email: "gerente@ford360.local", name: "André Martins", desc: "Gestão Concessionária" },
  { role: "Consultora", email: "consultora@ford360.local", name: "Beatriz Santos", desc: "Atendimento Oficina" },
  { role: "Admin HQ", email: "admin@ford360.local", name: "Administrador Ford", desc: "Ford Brasil" },
];

function getPasswordStrength(pwd: string) {
  if (!pwd) return { score: 0, label: "", percent: 0, color: "#d8e1e8" };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 1) return { score: 1, label: "Muito fraca", percent: 25, color: "#e05252" };
  if (score === 2) return { score: 2, label: "Razoável", percent: 50, color: "#e59f38" };
  if (score === 3 || score === 4) return { score: 3, label: "Boa", percent: 75, color: "#2ea068" };
  return { score: 4, label: "Excelente", percent: 100, color: "#1684c9" };
}

export function LoginPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const invitationFromUrl = urlParams.get("invite");
  const resetFromUrl = urlParams.get("reset");
  const { login, acceptInvitation } = useAuth();

  const [mode, setMode] = useState<AccessMode>(
    invitationFromUrl ? "invite" : resetFromUrl ? "reset-confirm" : "login",
  );

  const [rememberEmail, setRememberEmail] = useState(() => {
    try {
      return Boolean(localStorage.getItem("ford360_remember_email"));
    } catch {
      return false;
    }
  });

  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("ford360_saved_email") ?? "";
    } catch {
      return "";
    }
  });

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState(invitationFromUrl ?? resetFromUrl ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const [activeVehicleIdx, setActiveVehicleIdx] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  useEffect(() => {
    if (!isAutoRotating) return;
    const interval = setInterval(() => {
      setActiveVehicleIdx((prev) => (prev + 1) % VEHICLES.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isAutoRotating]);

  function handleKeyModifier(event: KeyboardEvent<HTMLInputElement>) {
    if (event.getModifierState) {
      setCapsLockActive(event.getModifierState("CapsLock"));
    }
  }

  function switchMode(next: AccessMode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (next !== "invite") setToken("");
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Ford@360");
    setError("");
    setNotice("Credenciais de demonstração carregadas.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        try {
          if (rememberEmail) {
            localStorage.setItem("ford360_remember_email", "true");
            localStorage.setItem("ford360_saved_email", email.trim());
          } else {
            localStorage.removeItem("ford360_remember_email");
            localStorage.removeItem("ford360_saved_email");
          }
        } catch {
          // LocalStorage fallback
        }
        await login(email, password);
        return;
      }

      if (mode === "reset-request") {
        const result = await api<{
          message: string;
          developmentToken?: string;
        }>("/auth/password-reset/request", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setNotice(result.message);
        if (result.developmentToken) setToken(result.developmentToken);
        setMode("reset-confirm");
        return;
      }

      if (password !== confirmation) {
        throw new Error("As senhas informadas não são iguais.");
      }

      if (mode === "reset-confirm") {
        const result = await api<{ message: string }>(
          "/auth/password-reset/confirm",
          {
            method: "POST",
            body: JSON.stringify({ token, password }),
          },
        );
        switchMode("login");
        setNotice(result.message);
        return;
      }

      await acceptInvitation(token, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao continuar.");
    } finally {
      setSubmitting(false);
    }
  }

  const titles: Record<AccessMode, [string, string]> = {
    login: ["Bem-vindo de volta", "Acesse com sua conta profissional da rede Ford."],
    "reset-request": [
      "Recuperar acesso",
      "Informe seu e-mail para gerar um código seguro de recuperação.",
    ],
    "reset-confirm": [
      "Criar nova senha",
      "Use o código recebido e escolha uma senha segura para sua conta.",
    ],
    invite: [
      "Ativar convite",
      "Defina sua senha individual para entrar na equipe Vínculo 360.",
    ],
  };

  const activeVehicle = VEHICLES[activeVehicleIdx];
  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = confirmation && password && password === confirmation;

  return (
    <main className="login-page">
      {/* PAINEL INSTITUCIONAL E SHOWCASE FORD */}
      <section
        className="login-brand-panel"
        onMouseEnter={() => setIsAutoRotating(false)}
        onMouseLeave={() => setIsAutoRotating(true)}
      >
        <header className="brand-panel-header">
          <div className="login-brand-logo">
            <img src="/ford-vinculo-logo.svg" alt="Ford Vínculo 360" />
          </div>
          <span className="network-pill">
            <span className="network-live-dot" />
            REDE AUTORIZADA FORD BRASIL
          </span>
        </header>

        {/* VEÍCULO SHOWCASE */}
        <div className="vehicle-showcase-container">
          <div className="vehicle-stage">
            <div className="vehicle-header-row">
              <div className="vehicle-header-left">
                <span className="vehicle-badge">{activeVehicle.badge}</span>
                <h3 className="vehicle-title">{activeVehicle.name}</h3>
                <p className="vehicle-version">{activeVehicle.version}</p>
              </div>
              <div className="vehicle-header-right">
                <div className="vehicle-feature">
                  <Zap size={13} />
                  <span>{activeVehicle.tag}</span>
                </div>
              </div>
            </div>

            <div className="vehicle-hero-wrapper">
              <div className="vehicle-glow" />
              <img
                key={activeVehicle.id}
                src={activeVehicle.image}
                alt={activeVehicle.name}
                className="vehicle-image-hero"
              />
            </div>

            {/* SELETOR INTERATIVO DE MODELOS */}
            <div className="vehicle-pills-bar">
              {VEHICLES.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className={`vehicle-pill-btn ${idx === activeVehicleIdx ? "active" : ""}`}
                  onClick={() => {
                    setActiveVehicleIdx(idx);
                    setIsAutoRotating(false);
                  }}
                >
                  <span>{item.name.replace("Nova Ford ", "").replace("Ford ", "")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PROMETE & PROPÓSITO */}
        <div className="login-promise">
          <span className="promise-eyebrow">
            <Sparkles size={16} />
            CONEXÃO DE PONTA A PONTA
          </span>
          <h1>
            Cada Ford, uma história.
            <br />
            Cada cliente, um vínculo.
          </h1>
          <p>
            Plataforma corporativa de inteligência de pós-venda, retenção inteligente
            e acompanhamento do ciclo de vida automotivo da Rede Ford.
          </p>

          <div className="login-benefits">
            <div className="benefit-chip">
              <CheckCircle2 size={16} />
              <span>Histórico contínuo e telemetria pelo VIN</span>
            </div>
            <div className="benefit-chip">
              <CheckCircle2 size={16} />
              <span>Retenção preditiva e recompra inteligente</span>
            </div>
            <div className="benefit-chip">
              <CheckCircle2 size={16} />
              <span>Agendamento integrado e fidelidade em oficina</span>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO PAINEL */}
        <footer className="brand-panel-footer">
          <small>
            Acesso restrito à Rede Autorizada Ford · Protegido por criptografia TLS 1.3 · Em conformidade com a LGPD
          </small>
        </footer>
      </section>

      {/* PAINEL DO FORMULÁRIO */}
      <section className="login-form-panel">
        <div className="form-wrapper">
          <div className="compact-login-brand">
            <img src="/ford-vinculo-logo.svg" alt="Ford Vínculo 360" />
            <span className="compact-dealer-badge">Rede Conectada Ford</span>
          </div>

          {mode !== "login" && (
            <button
              className="access-back"
              type="button"
              onClick={() => switchMode("login")}
            >
              <ArrowLeft size={16} /> Voltar ao login principal
            </button>
          )}

          <div className="form-header">
            <div className="login-shield">
              {mode === "invite" ? (
                <UserPlus size={26} />
              ) : (
                <ShieldCheck size={26} />
              )}
            </div>
            <div>
              <span className="eyebrow">PORTAL DO CONCESSIONÁRIO</span>
              <h2>{titles[mode][0]}</h2>
              <p>{titles[mode][1]}</p>
            </div>
          </div>

          {/* CHIPS DE ACESSO RÁPIDO PARA TESTE / DEMO */}
          {mode === "login" && (
            <div className="demo-shortcuts-panel">
              <div className="demo-shortcuts-header">
                <span className="demo-title">
                  <Info size={13} />
                  Perfis de Demonstração (1 Clique):
                </span>
              </div>
              <div className="demo-chips-grid">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    className="demo-chip-btn"
                    onClick={() => fillDemo(acc.email)}
                    title={`Entrar como ${acc.name} (${acc.email})`}
                  >
                    <b>{acc.role}</b>
                    <small>{acc.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={submit} noValidate={false} className="login-form">
            {(mode === "login" || mode === "reset-request") && (
              <label className="field-group">
                <span className="field-label">E-mail corporativo</span>
                <div className="input-field-wrapper">
                  <Mail size={18} className="field-icon" />
                  <input
                    type="email"
                    placeholder="seu.email@ford.com.br"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </label>
            )}

            {(mode === "invite" || mode === "reset-confirm") && (
              <label className="field-group">
                <span className="field-label">Código de segurança ou token</span>
                <div className="input-field-wrapper">
                  <KeyRound size={18} className="field-icon" />
                  <input
                    placeholder="Insira o código de validação recebido"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    minLength={16}
                    autoComplete="one-time-code"
                    required
                  />
                </div>
              </label>
            )}

            {mode !== "reset-request" && (
              <label className="field-group">
                <div className="field-label-row">
                  <span className="field-label">
                    {mode === "login" ? "Senha de acesso" : "Nova senha"}
                  </span>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="link-forgot-password"
                      onClick={() => switchMode("reset-request")}
                    >
                      Esqueceu?
                    </button>
                  )}
                </div>
                <div className="input-field-wrapper">
                  <LockKeyhole size={18} className="field-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "login" ? "••••••••" : "Mínimo 8 caracteres"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={handleKeyModifier}
                    onKeyUp={handleKeyModifier}
                    minLength={8}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {/* AVISO DE CAPS LOCK */}
            {capsLockActive && (
              <div className="capslock-alert">
                <ShieldAlert size={14} />
                <span>Atenção: A tecla Fixa (Caps Lock) está ativada.</span>
              </div>
            )}

            {/* FORÇA DE SENHA NO MODO DE RESET OU CONVITE */}
            {(mode === "invite" || mode === "reset-confirm") && password && (
              <div className="password-strength-container">
                <div className="strength-header">
                  <span>Força da senha:</span>
                  <strong style={{ color: pwdStrength.color }}>{pwdStrength.label}</strong>
                </div>
                <div className="strength-bar-track">
                  <div
                    className="strength-bar-fill"
                    style={{
                      width: `${pwdStrength.percent}%`,
                      backgroundColor: pwdStrength.color,
                    }}
                  />
                </div>
              </div>
            )}

            {(mode === "invite" || mode === "reset-confirm") && (
              <label className="field-group">
                <span className="field-label">Confirmar nova senha</span>
                <div className="input-field-wrapper">
                  <LockKeyhole size={18} className="field-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    onKeyDown={handleKeyModifier}
                    onKeyUp={handleKeyModifier}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Ocultar confirmação" : "Exibir confirmação"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmation && (
                  <div className={`password-match-indicator ${passwordsMatch ? "matched" : "mismatched"}`}>
                    {passwordsMatch ? (
                      <>
                        <Check size={14} /> As senhas conferem
                      </>
                    ) : (
                      <>As senhas não coincidem</>
                    )}
                  </div>
                )}
              </label>
            )}

            {/* LEMBRAR MEU E-MAIL (MODO LOGIN) */}
            {mode === "login" && (
              <div className="remember-me-row">
                <label className="remember-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                  />
                  <span>Lembrar meu e-mail neste navegador</span>
                </label>
              </div>
            )}

            {/* FEEDBACK DE AVISO E ERRO */}
            {notice && (
              <div className="login-notice animate-fade">
                <CheckCircle2 size={16} />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div className="login-error animate-fade">
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* BOTÃO PRINCIPAL DE SUBMISSÃO */}
            <button
              type="submit"
              className="primary login-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  <span>Autenticando na Rede...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? "Entrar no Vínculo 360"
                      : mode === "reset-request"
                        ? "Gerar Código Seguro"
                        : mode === "reset-confirm"
                          ? "Atualizar Minha Senha"
                          : "Ativar Meu Acesso"}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {mode === "login" && (
              <div className="access-options-footer">
                <span>Novo integrante da equipe?</span>
                <button
                  type="button"
                  className="invite-action-link"
                  onClick={() => switchMode("invite")}
                >
                  Ativar meu convite com código
                </button>
              </div>
            )}

            {/* SELOS DE AUDITORIA E SEGURANÇA */}
            <div className="security-guarantee-box">
              <div className="guarantee-badge">
                <ShieldCheck size={15} />
                <span>Sessão corporativa criptografada (TLS 1.3 & JWT seguro).</span>
              </div>
              <small className="guarantee-note">
                Todos os acessos são monitorados em conformidade com as diretrizes de segurança da Ford Motor Company e LGPD.
              </small>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
