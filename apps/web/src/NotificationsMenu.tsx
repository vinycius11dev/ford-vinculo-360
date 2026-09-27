import { Bell, Check, ChevronRight, MessageCircleMore, ShieldAlert, TrendingUp, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./lib/api";
import "./trade-interest.css";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};
type NotificationFeed = { unread: number; items: NotificationItem[] };

export function NotificationsMenu() {
  const [feed, setFeed] = useState<NotificationFeed>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [tradeToast, setTradeToast] = useState<NotificationItem | null>(null);
  const [supportToast, setSupportToast] = useState<NotificationItem | null>(null);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const knownNotificationIds = useRef<Set<string> | null>(null);
  const dismissedToastIds = useRef(new Set<string>());
  const navigate = useNavigate();

  async function load() {
    try {
      const next = await api<NotificationFeed>("/notifications");
      const latestTradeInterest = next.items.find(
        (item) => !item.readAt && item.link?.startsWith("/recompra?lead="),
      );
      const latestSupportMessage = next.items.find(
        (item) =>
          !item.readAt &&
          (item.link?.startsWith("/atendimentos") ||
            item.link?.startsWith("/validacoes") ||
            item.link === "/suporte"),
      );
      if (
        latestTradeInterest &&
        knownNotificationIds.current &&
        !knownNotificationIds.current.has(latestTradeInterest.id)
      )
        setTradeToast(latestTradeInterest);
      if (
        latestSupportMessage &&
        !dismissedToastIds.current.has(latestSupportMessage.id) &&
        (!knownNotificationIds.current ||
          !knownNotificationIds.current.has(latestSupportMessage.id))
      )
        setSupportToast(latestSupportMessage);
      knownNotificationIds.current = new Set(next.items.map((item) => item.id));
      setFeed(next);
      setError('');
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar os avisos.'); }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    const close = (event: MouseEvent) =>
      !root.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("mousedown", close); window.clearInterval(timer); };
  }, []);

  async function openItem(item: NotificationItem) {
    try {
    if (!item.readAt)
      await api(`/notifications/${item.id}/read`, { method: "PATCH" });
    setOpen(false);
    setTradeToast(null);
    setSupportToast(null);
    await load();
    if (item.link?.startsWith('/') && !item.link.startsWith('//')) navigate(item.link);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o aviso.'); }
  }

  return (
    <div className="notifications-root" ref={root}>
      {supportToast && (
        <aside className="support-message-toast" role="alert" aria-live="assertive">
          <span className="support-message-toast-icon"><MessageCircleMore size={21} /></span>
          <span>
            <small>
              {supportToast.link?.startsWith("/validacoes")
                ? "NOVA VALIDAÇÃO PELO APP"
                : "NOVA MENSAGEM PELO APP"}
            </small>
            <b>{supportToast.title}</b>
            <p>{supportToast.message}</p>
            <button onClick={() => void openItem(supportToast)}>
              {supportToast.link?.startsWith("/validacoes") ? "Analisar agora" : "Abrir conversa"}
              <ChevronRight size={13} />
            </button>
          </span>
          <button
            className="support-message-toast-close"
            aria-label="Fechar alerta"
            onClick={() => {
              dismissedToastIds.current.add(supportToast.id);
              setSupportToast(null);
            }}
          >
            <X size={15} />
          </button>
        </aside>
      )}
      {tradeToast && (
        <aside className="trade-interest-toast" role="alert" aria-live="assertive">
          <span className="trade-interest-toast-icon"><TrendingUp size={20} /></span>
          <span>
            <small>NOVA OPORTUNIDADE PELO APP</small>
            <b>{tradeToast.title}</b>
            <p>{tradeToast.message}</p>
            <button onClick={() => void openItem(tradeToast)}>Abrir oportunidade <ChevronRight size={13} /></button>
          </span>
          <button className="trade-interest-toast-close" aria-label="Fechar alerta" onClick={() => setTradeToast(null)}><X size={15} /></button>
        </aside>
      )}
      <button
        className="icon-button"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); if (!open) void load(); }}
      >
        <Bell size={19} />
        {feed.unread > 0 && <i />}
        {feed.unread > 0 && (
          <span className="notification-count">
            {feed.unread > 9 ? "9+" : feed.unread}
          </span>
        )}
      </button>
      {open && (
        <section className="notifications-popover">
          <div className="notifications-heading">
            <span>
              <small>CENTRAL</small>
              <b>Notificações</b>
            </span>
            <em>
              {feed.unread} não lida{feed.unread === 1 ? "" : "s"}
            </em>
          </div>
          <div className="notifications-list">
            {error && <div className="login-error" role="alert">{error}<button className="secondary" onClick={() => void load()}>Tentar novamente</button></div>}
            {feed.items.slice(0, 8).map((item) => (
              <button
                key={item.id}
                className={item.readAt ? "read" : ""}
                onClick={() => void openItem(item)}
              >
                <span
                  className={`notification-icon notification-${item.type.toLowerCase()}`}
                >
                  {item.link?.startsWith("/recompra?lead=") ? (
                    <TrendingUp size={16} />
                  ) : item.link?.startsWith("/atendimentos") ||
                    item.link?.startsWith("/validacoes") ||
                    item.link === "/suporte" ? (
                    <MessageCircleMore size={16} />
                  ) : item.type === "RECALL" ? (
                    <ShieldAlert size={16} />
                  ) : item.type === "SERVICE" ? (
                    <Wrench size={16} />
                  ) : (
                    <Bell size={16} />
                  )}
                </span>
                <span>
                  <b>{item.title}</b>
                  <small>{item.message}</small>
                  <em>{new Date(item.createdAt).toLocaleString("pt-BR")}</em>
                </span>
                {item.readAt ? <Check size={14} /> : <ChevronRight size={14} />}
              </button>
            ))}
            {!feed.items.length && (
              <div className="notifications-empty">
                <Check size={20} />
                <span>Tudo em dia por aqui.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
