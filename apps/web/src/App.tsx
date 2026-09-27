import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BadgePercent,
  Bell,
  CalendarDays,
  CarFront,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Gift,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListFilter,
  Plus,
  KeyRound,
  Layers3,
  Menu,
  MonitorSmartphone,
  MessageCircleMore,
  MoreHorizontal,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  TriangleAlert,
  UserRound,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth";
import { LoginPage } from "./LoginPage";
import { api } from "./lib/api";
import { NotificationsMenu } from "./NotificationsMenu";
import { PrivacyPanel } from "./PrivacyPanel";
import { SafetyPage } from "./SafetyPage";
import { RequestStatus, reportRequestStatus } from './components/RequestStatus';
import { OperationalSettings } from './components/OperationalSettings';
import { CatalogManager } from './components/CatalogManager';
import { VehicleModelManager } from './components/VehicleModelManager';
import { ChallengeJourney } from './components/ChallengeJourney';
import {
  CampaignsManager,
  EnhancedCreateCampaignDialog,
  type ExtendedCampaign,
} from './components/CampaignsManager';

type Tone = "blue" | "green" | "amber" | "red" | "violet" | "slate";
type FordRelationship = "CURRENT_OWNER" | "FORMER_OWNER" | "NEW_TO_FORD";
type StoredFordRelationship = FordRelationship | "UNKNOWN";
type ApiVehicle = {
  vin: string;
  plate: string | null;
  model: string;
  version?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  engine?: string | null;
  fuelType?: string | null;
  transmission?: string | null;
  drive?: string | null;
  power?: string | null;
  doors?: number | null;
  seats?: number | null;
  features?: string | null;
  imageUrl?: string | null;
  modelYear: number;
  manufactureYear?: number;
  currentMileage: number;
  condition?: "NEW" | "USED";
  saleStatus?: "IN_STOCK" | "RESERVED" | "SOLD" | null;
  listPrice?: number | null;
  stockSince?: string | null;
  stockDealership?: { id: string; tradeName: string; city?: string; state?: string } | null;
  updatedAt: string;
  originDealership?: { tradeName: string; city: string; state: string } | null;
  ownerships?: Array<{
    startedAt?: string;
    user: { id: string; fullName: string; phone: string | null };
  }>;
  serviceOrders?: Array<{ completedAt: string | null; mileage: number }>;
};
type DashboardSummary = {
  vehicles: number;
  activeOrders: number;
  upcomingBookings: number;
  completedLastYear: number;
  retention: number;
  risk: { active: number; attention: number; atRisk: number; lost: number };
  pointsInCirculation: number;
  activeCampaigns: number;
  revenue: {
    service: number;
    sales: number;
    vehiclesSold: number;
    averageServiceTicket: number;
  };
  monthlyServices: Array<{ label: string; value: number }>;
};
type ApiOrder = {
  id: string;
  amount: number | null;
  mileage: number;
  status: string;
  description: string | null;
  createdAt: string;
  vehicle: ApiVehicle & {
    ownerships: Array<{ user: { fullName: string; phone: string | null } }>;
  };
  dealership: { tradeName: string };
};
type ApiBooking = {
  id: string;
  requestedFor: string;
  status: string;
  notes: string | null;
  user: { fullName: string };
  vehicle: ApiVehicle;
  dealership: ApiDealership;
};
type ApiCampaign = ExtendedCampaign;
type LoyaltySummary = {
  accounts: number;
  balance: number;
  generated: number;
  redeemed: number;
  availableVouchers: number;
  benefits: Array<{
    title: string;
    redemptions: number;
    points: number;
    code?: string;
    status?: string;
  }>;
};
type LoyaltyAccount = {
  balance: number;
  transactions: Array<{ amount: number; reason: string }>;
  vouchers: Array<{
    title: string;
    code: string;
    pointsCost: number;
    status: string;
  }>;
};
type ApiUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  customerType?: "INDIVIDUAL" | "COMPANY";
  fordRelationship?: StoredFordRelationship;
  companyReadyForPurchase?: boolean;
  dealershipId?: string | null;
  active: boolean;
  createdAt: string;
  loyalty: { balance: number } | null;
  ownerships: Array<{ vehicle: ApiVehicle }>;
  _count: { ownerships: number; bookings: number };
};
type ApiVehicleDetail = Omit<ApiVehicle, "serviceOrders" | "ownerships"> & {
  manufactureYear: number;
  warrantyUntil?: string | null;
  originDealership?: { tradeName: string; city: string; state: string } | null;
  serviceOrders: Array<{
    id: string;
    description: string | null;
    mileage: number;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  ownerships: Array<{
    id: string;
    startedAt: string;
    user: { id: string; fullName: string; email: string; phone: string | null };
  }>;
};

function vehicleImageFor(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  const transparentImage = "?v=cutout-20260914";
  if (m.includes("ranger")) return `/ranger-hero.png${transparentImage}`;
  if (m.includes("maverick")) return `/maverick-hero.png${transparentImage}`;
  if (m.includes("territory")) return `/territory-hero.png${transparentImage}`;
  if (m.includes("bronco")) return `/bronco-hero.png${transparentImage}`;
  if (m.includes("mach-e") || m.includes("mustang")) return `/mach-e-hero.png${transparentImage}`;
  if (m.includes("f-150") || m.includes("f150")) return `/f150-hero.png${transparentImage}`;
  return null;
}
type ApiCustomer = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  customerType: "INDIVIDUAL" | "COMPANY";
  fordRelationship: StoredFordRelationship;
  cpf: string | null;
  hasCpf?: boolean;
  cnpj: string | null;
  hasCnpj?: boolean;
  tradeName: string | null;
  stateRegistration: string | null;
  stateRegistrationExempt: boolean;
  companyRegistrationStatus: string | null;
  legalRepresentativeName: string | null;
  legalRepresentativeCpf: string | null;
  legalRepresentativeDocument: string | null;
  legalRepresentativeRole: string | null;
  representationBasis: "SOCIAL_CONTRACT" | "BYLAWS" | "POWER_OF_ATTORNEY" | null;
  representationDocumentChecked: boolean;
  rg: string | null;
  rgIssuer: string | null;
  birthDate: string | null;
  addressZip: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  active: boolean;
  passwordSetupRequired: boolean;
  createdAt: string;
  _count?: { ownerships: number; purchases: number };
};
type ApiCustomerProfile = ApiCustomer & {
  loyalty: { balance: number } | null;
  ownerships: Array<{
    startedAt: string;
    vehicle: {
      vin: string;
      plate: string | null;
      model: string;
      modelYear: number;
      currentMileage: number;
      warrantyUntil: string | null;
    };
  }>;
  purchases: Array<{
    id: string;
    price: number;
    soldAt: string;
    vehicle: { model: string; modelYear: number };
  }>;
};
type ApiStockVehicle = {
  vin: string;
  plate: string | null;
  model: string;
  version: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  engine: string | null;
  fuelType: string | null;
  transmission: string | null;
  drive: string | null;
  power: string | null;
  doors: number | null;
  seats: number | null;
  features: string | null;
  imageUrl: string | null;
  modelYear: number;
  manufactureYear: number;
  currentMileage: number;
  condition: "NEW" | "USED";
  saleStatus: string;
  listPrice: number | null;
  stockSince: string | null;
  daysInStock: number;
  serviceHistory: number;
  stockDealership: { id: string; tradeName: string } | null;
};
type ApiSale = {
  id: string;
  price: number;
  tradeInValue: number | null;
  warrantyMonths: number;
  condition: "NEW" | "USED";
  soldAt: string;
  vehicle: { vin: string; model: string; modelYear: number };
  customer: { id: string; fullName: string; email: string };
  soldBy: { fullName: string } | null;
  dealership: { tradeName: string };
  tradeInVehicle: { vin: string; model: string } | null;
};
type ChurnPrediction = {
  probability: number;
  classification: "ACTIVE" | "ATTENTION" | "AT_RISK" | "LOST";
  model_version: string;
  source: "ml-service" | "api-fallback";
};
type RepurchaseOpportunity = {
  vin: string;
  model: string;
  modelYear: number;
  currentMileage: number;
  imageUrl: string | null;
  owner: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string;
  } | null;
  completedServices: number;
  score: number;
  estimatedValue: number;
};
type RepurchaseLeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
type ApiRepurchaseLead = {
  id: string;
  score: number;
  estimatedValue: number;
  status: RepurchaseLeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    vin: string;
    plate: string | null;
    model: string;
    modelYear: number;
    currentMileage: number;
    imageUrl: string | null;
  };
  owner: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
  dealership: { id: string; tradeName: string; city: string; state: string };
  createdBy: { id: string; fullName: string } | null;
  events: Array<{
    id: string;
    fromStatus: RepurchaseLeadStatus | null;
    toStatus: RepurchaseLeadStatus;
    notes: string | null;
    createdAt: string;
    performedBy: { id: string; fullName: string } | null;
  }>;
};
type ApiAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  performedBy: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
};
type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type ApiSupportTicket = {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: SupportTicketStatus;
  resolution: string | null;
  validationDecision: "APPROVED" | "REJECTED" | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requester: { id: string; fullName: string; email: string };
  dealership: { id: string; tradeName: string } | null;
  assignedTo: { id: string; fullName: string } | null;
  unreadCount: number;
  messageCount: number;
};
type ApiSupportMessage = {
  id: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
};
type ApiTeamInvitation = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  developmentToken?: string;
};
type ApiAuthSession = {
  id: string;
  deviceName: string;
  ipAddress: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
};
type AdminSummary = {
  vehicles: number;
  customers: number;
  completedServices: number;
  vinShare: number;
  dealerships: Array<{
    id: string;
    tradeName: string;
    city: string;
    state: string;
    retention: number;
    _count: { vehiclesSold: number; serviceOrders: number };
  }>;
  models: Array<{ model: string; vehicles: number }>;
};
type ApiCatalogVariant = {
  id: string;
  modelId: string;
  name: string;
  version: string | null;
  modelYear: number | null;
  category: string;
  engine: string | null;
  fuelType: string | null;
  transmission: string | null;
  drive: string | null;
  power: string | null;
  seats: number | null;
  doors: number | null;
  highlights: string | null;
  imageUrl: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  additionalPrice: number;
  exteriorColors: string[] | null;
  interiorColors: string[] | null;
  published: boolean;
  vehicleModel: {
    id: string;
    name: string;
    modelYear: number;
    category: string;
    basePrice: number;
    seats: number | null;
    doors: number | null;
    imageUrl: string | null;
  };
};
type ApiVehicleModel = {
  id: string;
  name: string;
  modelCode: string | null;
  modelYear: number;
  category: string;
  summary: string;
  basePrice: number;
  imageUrl: string | null;
  published: boolean;
  _count: { variants: number };
};
type ChallengeRow = {
  label: string;
  eligibleVins: number;
  servicedVins: number;
  vinShare: number;
  services: number;
  serviceShare: number;
};
type ChallengeSummary = {
  period: { from: string; to: string };
  prediction: { modelVersion: string; source: string; generatedAt: string; evaluatedVehicles: number };
  definitions: { vinShare: string; serviceShare: string };
  kpis: { eligibleVins: number; servicedVins: number; vinShare: number; completedServices: number; serviceShare: number; leads: number };
  campaigns: { sent: number; viewed: number; scheduled: number; completed: number; converted: number; pending: number; conversionRate: number; latest: string | null; items: Array<{ id: string; name: string; sent: number; viewed: number; scheduled: number; completed: number; converted: number }> };
  revenue: { service: number; campaign: number; averageTicket: number };
  filters: {
    dealerships: Array<{ id: string; tradeName: string; city: string; state: string; country: string; region: string }>;
    countries: string[];
    regions: string[];
    models: string[];
    ageBuckets: string[];
    serviceTypes: string[];
  };
  trend: Array<{ label: string; vinShare: number; services: number }>;
  dealerships: Array<ChallengeRow & { id: string; tradeName: string; city: string; state: string }>;
  models: ChallengeRow[];
  ages: ChallengeRow[];
  serviceTypes: ChallengeRow[];
  leads: Array<{
    vin: string;
    model: string;
    age: number;
    customerName: string;
    returnStatus: string;
    score: number;
    reason: string;
    nextAction: string;
    lastService: string | null;
    modelVersion: string;
    modelSource: string;
    governance: {
      decision: "PENDING" | "APPROVED" | "DISMISSED";
      reason: string | null;
      reviewedAt: string | null;
      reviewedBy: string | null;
    };
  }>;
  alerts: Array<{ tone: string; title: string; description: string }>;
};
type ApiDealership = {
  id: string;
  tradeName: string;
  legalName?: string;
  city: string;
  state: string;
  timezone: string;
  businessDays: number[];
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  simultaneousCapacity: number;
  _count?: { staff: number; serviceOrders: number; vehiclesSold: number };
};

const STAFF_ROLES = [
  "DEALERSHIP_AGENT",
  "DEALERSHIP_MANAGER",
  "FORD_ADMIN",
] as const;

function RequireRoles({
  roles,
  children,
}: {
  roles: readonly string[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const DATA_CHANGED_EVENT = "ford360:data-changed";

function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

function downloadCsv(
  filename: string,
  rows: Array<Array<string | number>>,
) {
  const safeCell = (value: string | number) => {
    let text = String(value);
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const content = `\uFEFF${rows.map((row) => row.map(safeCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function useApiData<T>(path: string | null, initial: T, refreshMs?: number) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let live = true;
    const load = () => {
      setLoading(true);
      api<T>(path)
        .then((value) => { if (live) { setData(value); reportRequestStatus(path, null); } })
        .catch((reason) => { if (live) reportRequestStatus(path, reason instanceof Error ? reason.message : 'Confira sua conexão e tente novamente.'); })
        .finally(() => live && setLoading(false));
    };
    // Atualização periódica silenciosa: não liga o loading nem sinaliza falhas
    // passageiras, para a tela não piscar enquanto a pessoa trabalha nela.
    const refresh = () => {
      if (document.hidden) return;
      api<T>(path).then((value) => { if (live) setData(value); }).catch(() => undefined);
    };
    load();
    const timer = refreshMs ? window.setInterval(refresh, refreshMs) : undefined;
    window.addEventListener(DATA_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener(DATA_CHANGED_EVENT, load);
    };
  }, [path, refreshMs]);
  return { data, loading };
}

function riskFor(vehicle: ApiVehicle): {
  label: string;
  tone: Tone;
  next: string;
} {
  const last = vehicle.serviceOrders?.[0]?.completedAt
    ? new Date(vehicle.serviceOrders[0].completedAt)
    : null;
  const relationshipStartedAt = vehicle.ownerships?.[0]?.startedAt
    ? new Date(vehicle.ownerships[0].startedAt)
    : null;
  const referenceDate = last ?? relationshipStartedAt;
  const days = referenceDate
    ? Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / 86400000))
    : 0;
  if (!last && days <= 180)
    return { label: "Novo na rede", tone: "green", next: "Primeira revisão" };
  if (days > 730) return { label: "Perdido", tone: "slate", next: "Vencida" };
  if (days > 365)
    return { label: "Em risco", tone: "red", next: "Contato urgente" };
  if (days > 240)
    return { label: "Atenção", tone: "amber", next: "Agendar revisão" };
  const remainder = 10000 - (vehicle.currentMileage % 10000);
  return {
    label: "Ativo",
    tone: "green",
    next: `${remainder.toLocaleString("pt-BR")} km`,
  };
}
const navGroups: Array<{
  label: string;
  items: Array<{
    to: string;
    label: string;
    icon: LucideIcon;
    badgeKey?: "messages" | "validations";
  }>;
}> = [
  {
    label: "COMECE AQUI",
    items: [
      { to: "/", label: "Visão geral", icon: LayoutDashboard },
      { to: "/desafio-02", label: "Indicadores VIN Share", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "1 · PREPARE O CATÁLOGO",
    items: [
      { to: "/veiculos/modelos", label: "Modelos de veículos", icon: CarFront },
      { to: "/veiculos/variacoes", label: "Versões e opcionais", icon: Layers3 },
    ],
  },
  {
    label: "2 · MONTE O ESTOQUE",
    items: [
      { to: "/veiculos", label: "Estoque por VIN", icon: KeyRound },
    ],
  },
  {
    label: "3 · ATENDA E VENDA",
    items: [
      { to: "/clientes", label: "Clientes", icon: UsersRound },
      {
        to: "/atendimentos",
        label: "Mensagens dos clientes",
        icon: MessageCircleMore,
        badgeKey: "messages",
      },
      {
        to: "/validacoes",
        label: "Validar veículos",
        icon: ShieldCheck,
        badgeKey: "validations",
      },
      { to: "/estoque", label: "Registrar venda", icon: Store },
      { to: "/recompra", label: "Interesses de troca", icon: TrendingUp },
    ],
  },
  {
    label: "4 · CUIDE NO PÓS-VENDA",
    items: [
      { to: "/agendamentos", label: "Agenda da oficina", icon: CalendarDays },
      { to: "/servicos", label: "Ordens de serviço", icon: Wrench },
      { to: "/retencao", label: "Retenção de clientes", icon: Activity },
      { to: "/campanhas", label: "Campanhas de pós-venda", icon: Target },
      { to: "/fidelidade", label: "Pontos e benefícios", icon: Gift },
      { to: "/seguranca", label: "Recalls e segurança", icon: ShieldAlert },
    ],
  },
  {
    label: "ADMINISTRAÇÃO",
    items: [
      { to: "/ford-admin", label: "Visão da rede Ford", icon: ChartNoAxesCombined },
      { to: "/mensageria", label: "E-mails e notificações", icon: Send },
    ],
  },
];

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}
function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function StatCard({
  icon: Icon,
  label,
  value,
  change,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change: string;
  tone?: Tone;
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon icon-${tone}`}>
        <Icon size={20} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={change.startsWith("+") ? "positive" : ""}>
          {change}
        </small>
      </div>
      <MoreHorizontal size={18} className="stat-more" />
    </article>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose(): void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={19} />
        </button>
        <span className="eyebrow">NOVO REGISTRO</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </section>
    </div>
  );
}

function ActionForm({
  endpoint,
  method = "POST",
  submitLabel,
  onDone,
  onCancel,
  children,
  buildBody,
}: {
  endpoint: string;
  method?: string;
  submitLabel: string;
  onDone(result?: unknown): void;
  onCancel?(): void;
  children: ReactNode;
  buildBody(form: FormData): unknown;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api(endpoint, {
        method,
        body: JSON.stringify(buildBody(new FormData(event.currentTarget))),
      });
      onDone(result);
      notifyDataChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="entity-form" onSubmit={submit}>
      {children}
      {error && <div className="login-error">{error}</div>}
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => (onCancel ? onCancel() : onDone())}
        >
          Cancelar
        </button>
        <button className="primary" disabled={saving}>
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function VehicleModelsPage() {
  return (
    <>
      <PageHeader
        eyebrow="CATÁLOGO MESTRE"
        title="Versões e opcionais"
        description="Configure versões, cores, acabamentos, mecânica, equipamentos e acréscimos de preço para cada modelo."
        action={<div className="page-actions"><Link className="secondary" to="/veiculos/novo"><CarFront size={16} />Cadastrar modelo</Link><Link className="primary" to="/veiculos/unidades/nova"><Store size={17} />Adicionar VIN ao estoque</Link></div>}
      />
      <CatalogManager />
    </>
  );
}

/** Primeiro ponto do catálogo: consulta de modelos, sem abrir formulário. */
function VehicleModelsRegistryPage() {
  const { data: models, loading } = useApiData<ApiVehicleModel[]>("/catalog/models", []);
  return (
    <>
      <PageHeader
        eyebrow="CATÁLOGO MESTRE"
        title="Modelos de veículos"
        description="Consulte as fichas principais cadastradas antes de administrar versões, opcionais e VINs."
        action={<Link className="primary" to="/veiculos/novo"><Plus size={17} />Cadastrar modelo</Link>}
      />
      <section className="vehicle-model-list" aria-label="Modelos cadastrados">
        {models.map((model) => (
          <article className="vehicle-model-row" key={model.id}>
            <div className="vehicle-model-photo">
              <CarFront size={25} />
              {model.imageUrl && <img src={model.imageUrl} alt={`Foto do ${model.name}`} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
            </div>
            <div className="vehicle-model-copy">
              <span>MODELO PRINCIPAL</span>
              <strong>{model.name} <em>{model.modelYear}</em></strong>
              <small>{[model.category, model.modelCode].filter(Boolean).join(" · ") || "Ficha principal do veículo"}</small>
              <b>{model._count.variants} {model._count.variants === 1 ? "variação configurada" : "variações configuradas"} · base {brl(model.basePrice)}</b>
            </div>
            <div className="vehicle-model-actions">
              <Badge tone={model.published ? "green" : "slate"}>{model.published ? "Ativo" : "Rascunho"}</Badge>
              <Link className="secondary" to={`/veiculos/variacoes?modelId=${model.id}`}><Layers3 size={15} />Variações</Link>
              <Link className="secondary" to={`/veiculos/modelos/${model.id}/editar`}>Editar</Link>
            </div>
          </article>
        ))}
        {!loading && !models.length && (
          <article className="catalog-empty-callout">
            <CarFront size={26} />
            <div><b>Nenhum modelo cadastrado ainda</b><p>Comece criando a ficha principal. As versões e os VINs serão vinculados depois.</p></div>
            <Link className="primary" to="/veiculos/novo">Cadastrar modelo</Link>
          </article>
        )}
      </section>
    </>
  );
}

function CreateVehicleCatalogPage() {
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/veiculos">Estoque por VIN</Link><ChevronRight size={13} /><span>Novo modelo</span>
      </div>
      <section className="vehicle-entry-hero catalog-create-hero">
        <div className="vehicle-entry-hero-copy">
          <span className="eyebrow">ETAPA 1 · MODELO PRINCIPAL</span>
          <h1>Cadastrar modelo de veículo</h1>
          <p>Informe somente os dados principais compartilhados por todas as versões: nome, ano, categoria, estrutura, foto e preço base.</p>
          <div className="vehicle-entry-benefits">
            <span><CarFront size={15} />Dados principais</span>
            <span><CheckCircle2 size={15} />Preço base</span>
            <span><Layers3 size={15} />Pronto para receber versões</span>
          </div>
        </div>
        <Layers3 className="vehicle-entry-hero-car" size={142} strokeWidth={1.15} />
        <Link className="entry-manage-link" to="/veiculos/variacoes">Ir para versões e opcionais <ChevronRight size={15} /></Link>
      </section>
      <section className="catalog-flow-strip" aria-label="Fluxo do cadastro">
        <article><i>1</i><div><b>Modelo</b><span>Nome, categoria e ano</span></div></article>
        <ChevronRight size={18} />
        <article><i>2</i><div><b>Versão e opcionais</b><span>Motor, acabamento, cores e equipamentos</span></div></article>
        <ChevronRight size={18} />
        <article><i>3</i><div><b>Unidades do estoque</b><span>Um VIN exclusivo para cada carro físico</span></div></article>
      </section>
      <VehicleModelManager />
    </>
  );
}

function EditVehicleCatalogPage() {
  const { modelId } = useParams();
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/veiculos">Estoque por VIN</Link><ChevronRight size={13} /><Link to="/veiculos/modelos">Modelos de veículos</Link><ChevronRight size={13} /><span>Editar modelo</span>
      </div>
      <section className="vehicle-entry-hero catalog-create-hero edit-vehicle-hero">
        <div className="vehicle-entry-hero-copy">
          <span className="eyebrow">FICHA PRINCIPAL DO MODELO</span>
          <h1>Editar modelo de veículo</h1>
          <p>Atualize a identidade, a ficha técnica, os equipamentos comuns, o preço base e a foto principal sem alterar os VINs cadastrados.</p>
          <div className="vehicle-entry-benefits"><span><CarFront size={15} />Dados do modelo</span><span><CheckCircle2 size={15} />Versões preservadas</span><span><Store size={15} />VINs preservados</span></div>
        </div>
        <CarFront className="vehicle-entry-hero-car" size={142} strokeWidth={1.15} />
        <Link className="entry-manage-link" to="/veiculos/modelos">Voltar aos modelos <ChevronRight size={15} /></Link>
      </section>
      <VehicleModelManager modelId={modelId} />
    </>
  );
}

function CreateVehicleVariationPage() {
  return (
    <>
      <div className="breadcrumbs"><Link to="/veiculos">Estoque por VIN</Link><ChevronRight size={13} /><Link to="/veiculos/modelos">Modelos cadastrados</Link><ChevronRight size={13} /><span>Nova versão</span></div>
      <section className="vehicle-entry-hero catalog-create-hero">
        <div className="vehicle-entry-hero-copy">
          <span className="eyebrow">ETAPA 2 · CONFIGURAÇÃO COMERCIAL</span>
          <h1>Cadastrar versão e opcionais</h1>
          <p>Escolha o modelo principal e registre somente o que muda: versão, conjunto mecânico, cores, opcionais e o valor acrescentado ao preço base.</p>
          <div className="vehicle-entry-benefits"><span><Layers3 size={15} />Uma configuração reutilizável</span><span><BadgePercent size={15} />Acréscimo de preço calculado</span><span><CarFront size={15} />Vários VINs idênticos</span></div>
        </div>
        <Layers3 className="vehicle-entry-hero-car" size={142} strokeWidth={1.15} />
        <Link className="entry-manage-link" to="/veiculos/novo">Cadastrar outro modelo <ChevronRight size={15} /></Link>
      </section>
      <CatalogManager />
    </>
  );
}

function CreateVehicleUnitPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dealerships } = useApiData<ApiDealership[]>(
    user?.role === "FORD_ADMIN" ? "/dealerships" : null,
    [],
  );
  const { data: variants, loading } = useApiData<ApiCatalogVariant[]>(
    user?.role === "DEALERSHIP_AGENT" ? "/catalog" : "/catalog/admin",
    [],
  );
  const [variantId, setVariantId] = useState("");
  const [vinBatch, setVinBatch] = useState("");
  const selected = variants.find((item) => item.id === variantId) ?? null;
  const vinCount = vinBatch.split(/[\s,;]+/).map((vin) => vin.trim()).filter(Boolean).length;
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/veiculos">Estoque por VIN</Link><ChevronRight size={13} /><span>Adicionar VIN ao estoque</span>
      </div>
      <section className="vehicle-entry-hero">
        <div className="vehicle-entry-hero-copy">
          <span className="eyebrow">ENTRADA INTELIGENTE NO ESTOQUE</span>
          <h1>Adicionar VIN ao estoque</h1>
          <p>Escolha uma versão já configurada e informe os dados exclusivos de cada carro físico.</p>
          <div className="vehicle-entry-benefits">
            <span><CheckCircle2 size={15} />Ficha técnica automática</span>
            <span><ShieldCheck size={15} />VIN único e validado</span>
            <span><Store size={15} />Entrada direta no estoque</span>
          </div>
        </div>
        <CarFront className="vehicle-entry-hero-car" size={142} strokeWidth={1.2} />
        {user?.role !== "DEALERSHIP_AGENT" && <Link className="entry-manage-link" to="/veiculos/variacoes">Cadastrar versão e opcionais <ChevronRight size={15} /></Link>}
      </section>
      <section className="vehicle-entry-layout">
      <article className="card vehicle-unit-form">
      {!loading && !variants.length && (
        <div className="catalog-empty-callout">
          <CarFront size={26} />
          <div><b>Cadastre primeiro um modelo e uma versão</b><p>Na versão ficam a configuração exata, as cores, os opcionais e o valor adicional.</p></div>
          {user?.role === "DEALERSHIP_AGENT" ? <Badge tone="amber">Solicite ao gerente</Badge> : <Link className="primary" to="/veiculos/variacoes">Cadastrar versão</Link>}
        </div>
      )}
      <ActionForm
        endpoint="/vehicles/batch"
        submitLabel={vinCount > 1 ? `Adicionar ${vinCount} VINs ao estoque` : "Adicionar VIN ao estoque"}
        onDone={() => navigate("/veiculos")}
        onCancel={() => navigate("/veiculos")}
        buildBody={(form) => ({
          vins: String(form.get("vins") ?? "").split(/[\s,;]+/).map((vin) => vin.trim()).filter(Boolean),
          catalogItemId: form.get("catalogItemId"),
          manufactureYear: Number(form.get("manufactureYear")),
          currentMileage: Number(form.get("currentMileage") || 0),
          condition: form.get("condition"),
          listPrice: form.get("listPrice") ? Number(form.get("listPrice")) : undefined,
          stockDealershipId:
            user?.role === "FORD_ADMIN"
              ? form.get("stockDealershipId")
              : undefined,
        })}
      >
        <div className="form-section-heading">
          <span className="eyebrow">1 · ESCOLHA A CONFIGURAÇÃO</span>
          <strong>Escolha a variação exata destes carros</strong>
        </div>
        <label>
          Modelo, variação, cor e acabamento
          <select name="catalogItemId" required value={variantId} onChange={(event) => setVariantId(event.target.value)}>
            <option value="">Selecione uma variação</option>
            {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.version ?? "sem versão"} · {variant.exteriorColor ?? "sem cor"} · {variant.modelYear ?? "sem ano"}</option>)}
          </select>
        </label>
        {selected && (
          <div className="variant-preview">
            <div className={`vehicle-thumb large${selected.imageUrl ? " has-photo" : ""}`}><CarFront size={24} />{selected.imageUrl && <img src={selected.imageUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div>
            <div><b>{selected.name} {selected.version}</b><p>{[selected.engine, selected.transmission, selected.drive, selected.power].filter(Boolean).join(" · ")}</p><small>{selected.exteriorColor} · interior {selected.interiorColor} · {brl((selected.vehicleModel?.basePrice ?? 0) + selected.additionalPrice)}</small></div>
          </div>
        )}

        <div className="form-section-heading">
          <span className="eyebrow">2 · INFORME OS VINS PRODUZIDOS</span>
          <strong>Um por linha — até 1.000 unidades idênticas de uma vez</strong>
        </div>
        {user?.role === "FORD_ADMIN" && (
          <label>
            Concessionária responsável
            <select name="stockDealershipId" required defaultValue="">
              <option value="" disabled>Selecione a unidade</option>
              {dealerships.map((dealer) => (
                <option key={dealer.id} value={dealer.id}>{dealer.tradeName}</option>
              ))}
            </select>
          </label>
        )}
        <label className="vin-batch-field">
          Lista de VINs
          <textarea name="vins" required value={vinBatch} onChange={(event) => setVinBatch(event.target.value)} placeholder={'Cole ou digite um VIN por linha\n9BFXXXXXXXXXXXX01\n9BFXXXXXXXXXXXX02\n9BFXXXXXXXXXXXX03'} />
          <small className={vinCount > 1000 ? "limit-error" : ""}>{vinCount} {vinCount === 1 ? "unidade identificada" : "unidades identificadas"} · limite de 1.000</small>
        </label>
        <div className="form-grid form-grid-3">
          <label>
            Condição
            <select name="condition" defaultValue="NEW">
              <option value="NEW">Novo (0 km)</option>
              <option value="USED">Seminovo</option>
            </select>
          </label>
          <label>
            Ano fabricação
            <input
              name="manufactureYear"
              type="number"
              min="1990"
              max="2100"
              required
              defaultValue="2026"
            />
          </label>
          <label>Quilometragem atual<input name="currentMileage" type="number" min="0" required defaultValue="0" /></label>
        </div>
        <label>Preço por unidade (R$)<input name="listPrice" type="number" min="0" placeholder={selected ? `Automático: ${(selected.vehicleModel.basePrice + selected.additionalPrice).toLocaleString("pt-BR")}` : "Calculado pela variação"} /></label>
        <div className="privacy-note"><Store size={17} /><span>Todos os VINs receberão exatamente a mesma variação, cor, acabamento e preço. Só a identidade VIN será diferente.</span></div>
      </ActionForm>
      </article>
      <aside className="vehicle-entry-sidebar">
        <article className="card entry-guide-card">
          <span className="eyebrow">CADASTRO GUIADO</span>
          <h2>Uma variação, muitos VINs</h2>
          <p>Cadastre 1 ou até 1.000 carros idênticos sem repetir ficha, cor ou preço.</p>
          <div className="entry-guide-steps">
            <div className={selected ? "done" : "active"}><i>{selected ? <CheckCircle2 size={15} /> : "1"}</i><span><b>Variação</b><small>Versão, cor e acabamento</small></span></div>
            <div className={selected && vinCount ? "done" : selected ? "active" : ""}><i>{selected && vinCount ? <CheckCircle2 size={15} /> : "2"}</i><span><b>VINs</b><small>Uma identidade para cada carro</small></span></div>
            <div className={selected && vinCount ? "active" : ""}><i>3</i><span><b>Entrada no estoque</b><small>Todos com a mesma configuração</small></span></div>
          </div>
        </article>
        <article className={`card entry-selected-card${selected ? " has-selection" : ""}`}>
          {selected ? (
            <>
              <div className={`entry-selected-visual${selected.imageUrl ? " has-photo" : ""}`}>
                <CarFront size={62} />
                {selected.imageUrl && <img src={selected.imageUrl} alt={`${selected.name} ${selected.version ?? ""}`} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
              </div>
              <span className="eyebrow">CONFIGURAÇÃO ESCOLHIDA</span>
              <h3>{selected.name} {selected.version}</h3>
              <p>{selected.modelYear} · {selected.category}</p>
              <dl>
                <div><dt>Motor</dt><dd>{selected.engine ?? "—"}</dd></div>
                <div><dt>Câmbio</dt><dd>{selected.transmission ?? "—"}</dd></div>
                <div><dt>Tração</dt><dd>{selected.drive ?? "—"}</dd></div>
                <div><dt>Capacidade</dt><dd>{selected.seats ?? "—"} lugares</dd></div>
              </dl>
              <div className="entry-color-list"><span><i />{selected.exteriorColor}</span><span><i />Interior {selected.interiorColor}</span></div>
            </>
          ) : (
            <div className="entry-selected-empty">
              <div><CarFront size={42} /></div>
              <h3>Seu veículo aparecerá aqui</h3>
              <p>Selecione uma variação para visualizar a configuração exata, a foto e o preço final.</p>
            </div>
          )}
        </article>
      </aside>
      </section>
    </>
  );
}

function ClaimVehicleDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal
      title="Vincular meu Ford"
      description="Confirme VIN e placa para adicionar o veículo à sua conta."
      onClose={onClose}
    >
      <ActionForm
        endpoint="/ownerships/claim"
        submitLabel="Vincular veículo"
        onDone={onClose}
        buildBody={(form) => ({
          vin: form.get("vin"),
          plate: form.get("plate"),
        })}
      >
        <label>
          VIN
          <input
            name="vin"
            minLength={17}
            maxLength={17}
            required
            placeholder="17 caracteres"
          />
        </label>
        <label>
          Placa
          <input
            name="plate"
            minLength={7}
            maxLength={8}
            required
            placeholder="ABC1D23"
          />
        </label>
      </ActionForm>
    </Modal>
  );
}

function TransferVehicleDialog({
  vin,
  onClose,
}: {
  vin: string;
  onClose(): void;
}) {
  return (
    <Modal
      title="Transferir vínculo"
      description="O histórico do veículo será preservado; apenas o proprietário ativo será alterado."
      onClose={onClose}
    >
      <ActionForm
        endpoint="/ownerships/transfer"
        submitLabel="Confirmar transferência"
        onDone={onClose}
        buildBody={(form) => ({
          vin,
          newOwnerEmail: form.get("newOwnerEmail"),
        })}
      >
        <label>
          VIN
          <input value={vin} readOnly />
        </label>
        <label>
          E-mail do novo proprietário
          <input
            name="newOwnerEmail"
            type="email"
            required
            placeholder="cliente@email.com"
          />
        </label>
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>
            Os dados pessoais do proprietário anterior não serão compartilhados.
          </span>
        </div>
      </ActionForm>
    </Modal>
  );
}

function CreateOrderDialog({ onClose }: { onClose(): void }) {
  const { user } = useAuth();
  const { data: dealerships } = useApiData<ApiDealership[]>(user?.role === 'FORD_ADMIN' ? '/dealerships' : null, []);
  return (
    <Modal
      title="Abrir ordem de serviço"
      description="O atendimento será incorporado ao histórico do VIN."
      onClose={onClose}
    >
      <ActionForm
        endpoint="/service-orders"
        submitLabel="Abrir ordem"
        onDone={onClose}
        buildBody={(form) => ({
          vin: form.get("vin"),
          mileage: Number(form.get("mileage")),
          description: form.get("description"),
          amount: form.get('amount') ? Number(form.get('amount')) : undefined,
          dealershipId: user?.role === 'FORD_ADMIN' ? form.get('dealershipId') : undefined,
        })}
      >
        {user?.role === 'FORD_ADMIN' && <label>Concessionária<select name="dealershipId" required><option value="">Selecione a unidade</option>{dealerships.map((item) => <option key={item.id} value={item.id}>{item.tradeName}</option>)}</select></label>}
        <label>
          VIN
          <input name="vin" minLength={17} maxLength={17} required />
        </label>
        <label>
          Quilometragem
          <input name="mileage" type="number" min="0" required />
        </label>
        <label>
          Descrição
          <textarea
            name="description"
            required
            placeholder="Revisão, diagnóstico ou reparo realizado"
          />
        </label>
        <label>Valor do atendimento (R$, sem centavos)<input name="amount" type="number" min="0" max="2000000000" step="1" placeholder="Ex.: 850" /></label>
      </ActionForm>
    </Modal>
  );
}

function ManageOrderDialog({
  order,
  onClose,
}: {
  order: ApiOrder;
  onClose(): void;
}) {
  return (
    <Modal
      title={`Ordem ${order.id.replace("seed-os-", "OS-")}`}
      description={`${order.vehicle.model} · ${order.vehicle.vin}`}
      onClose={onClose}
    >
      <ActionForm
        endpoint={`/service-orders/${order.id}`}
        method="PATCH"
        submitLabel="Salvar ordem"
        onDone={onClose}
        buildBody={(form) => {
          const points = String(form.get("points") ?? "");
          return {
            status: form.get("status"),
            mileage: Number(form.get("mileage")),
            description: form.get("description"),
            amount: form.get('amount') !== '' ? Number(form.get('amount')) : undefined,
            ...(points ? { points: Number(points) } : {}),
          };
        }}
      >
        <label>
          Status
          <select name="status" defaultValue={order.status}>
            {Object.entries({ OPEN: 'Aberta', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída e pontuada', CANCELLED: 'Cancelada' }).filter(([value]) => !['COMPLETED', 'CANCELLED'].includes(order.status) || value === order.status).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Quilometragem
          <input
            name="mileage"
            type="number"
            min="0"
            defaultValue={order.mileage}
            required
          />
        </label>
        <label>
          Descrição
          <textarea
            name="description"
            defaultValue={order.description ?? ""}
            required
          />
        </label>
        <label>
          Pontos ao concluir
          <input
            name="points"
            type="number"
            min="0"
            placeholder="Automático quando vazio"
          />
        </label>
        <label>Valor do atendimento (R$, sem centavos)<input name="amount" type="number" min="0" max="2000000000" step="1" defaultValue={order.amount ?? ''} /></label>
        <div className="privacy-note">
          <Gift size={17} />
          <span>
            Ao concluir, os pontos são creditados uma única vez ao proprietário
            atual.
          </span>
        </div>
      </ActionForm>
    </Modal>
  );
}

function CreateBookingDialog({
  onClose,
  initialVin = "",
}: {
  onClose(): void;
  initialVin?: string;
}) {
  const { user } = useAuth();
  const customerMode = user?.role === "CUSTOMER";
  const canChooseDealership = customerMode || user?.role === "FORD_ADMIN";
  const { data: users } = useApiData<ApiUser[]>("/users", []);
  const { data: dealerships } = useApiData<ApiDealership[]>("/dealerships", []);
  const [dealershipId, setDealershipId] = useState(user?.dealershipId ?? "");
  const selectedDealership = dealerships.find(
    (item) => item.id === dealershipId,
  );
  const minimumDate = new Date(Date.now() + 15 * 60_000);
  minimumDate.setMinutes(minimumDate.getMinutes() - minimumDate.getTimezoneOffset());
  return (
    <Modal
      title="Novo agendamento"
      description="Reserve um horário para o cliente e seu veículo."
      onClose={onClose}
    >
      <ActionForm
        endpoint="/bookings"
        submitLabel="Agendar serviço"
        onDone={onClose}
        buildBody={(form) => ({
          vin: form.get("vin"),
          userId: customerMode ? undefined : form.get("userId"),
          dealershipId: canChooseDealership
            ? form.get("dealershipId")
            : user?.dealershipId,
          requestedFor: new Date(
            String(form.get("requestedFor")),
          ).toISOString(),
          notes: form.get("notes"),
        })}
      >
        {!customerMode && (
          <label>
            Cliente
            <select name="userId" required>
              <option value="">Selecione</option>
              {users
                .filter((item) => item.role === "CUSTOMER")
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.fullName}
                  </option>
                ))}
            </select>
          </label>
        )}
        {canChooseDealership ? (
          <label>
            Concessionária
            <select
              name="dealershipId"
              required
              value={dealershipId}
              onChange={(event) => setDealershipId(event.target.value)}
            >
              <option value="">Selecione</option>
              {dealerships.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.tradeName} · {item.city}/{item.state}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="schedule-policy-note">
            <Clock3 size={17} />
            <span>Agendamento vinculado à sua concessionária.</span>
          </div>
        )}
        {selectedDealership && (
          <div className="schedule-policy-note">
            <Clock3 size={17} />
            <span>
              Atendimento das {selectedDealership.openingTime} às{" "}
              {selectedDealership.closingTime}, em intervalos de{" "}
              {selectedDealership.slotDurationMinutes} minutos.
            </span>
          </div>
        )}
        <label>
          VIN
          <input
            name="vin"
            minLength={17}
            maxLength={17}
            defaultValue={initialVin}
            required
          />
        </label>
        <label>
          Data e horário
          <input
            name="requestedFor"
            type="datetime-local"
            min={minimumDate.toISOString().slice(0, 16)}
            step="900"
            required
          />
        </label>
        <label>
          Serviço solicitado
          <textarea name="notes" required />
        </label>
      </ActionForm>
    </Modal>
  );
}

function ManageBookingDialog({
  booking,
  onClose,
}: {
  booking: ApiBooking;
  onClose(): void;
}) {
  const { user } = useAuth();
  const customerMode = user?.role === "CUSTOMER";
  async function cancelBooking() {
    await api(`/bookings/${booking.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    onClose();
    notifyDataChanged();
  }
  const localDate = new Date(
    new Date(booking.requestedFor).getTime() -
      new Date(booking.requestedFor).getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
  return (
    <Modal
      title="Gerenciar agendamento"
      description={`${booking.user.fullName} · ${booking.vehicle.model}`}
      onClose={onClose}
    >
      <ActionForm
        endpoint={`/bookings/${booking.id}`}
        method="PATCH"
        submitLabel="Salvar alterações"
        onDone={onClose}
        buildBody={(form) => ({
          ...(!customerMode ? { status: form.get("status") } : {}),
          requestedFor: new Date(
            String(form.get("requestedFor")),
          ).toISOString(),
          notes: form.get("notes"),
        })}
      >
        {!customerMode && (
          <label>
            Status
            <select name="status" defaultValue={booking.status}>
              <option value="REQUESTED">A confirmar</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </label>
        )}
        <label>
          Data e horário
          <input
            name="requestedFor"
            type="datetime-local"
            defaultValue={localDate}
            required
          />
        </label>
        <label>
          Serviço solicitado
          <textarea name="notes" defaultValue={booking.notes ?? ""} required />
        </label>
        {customerMode && booking.status !== "CANCELLED" && (
          <button
            type="button"
            className="danger-button"
            onClick={() => void cancelBooking()}
          >
            Cancelar este agendamento
          </button>
        )}
      </ActionForm>
    </Modal>
  );
}

function CreateVoucherDialog({ onClose }: { onClose(): void }) {
  const { data: users } = useApiData<ApiUser[]>("/users", []);
  return (
    <Modal
      title="Emitir benefício"
      description="Converta pontos do cliente em um voucher rastreável."
      onClose={onClose}
    >
      <ActionForm
        endpoint="/loyalty/vouchers"
        submitLabel="Emitir voucher"
        onDone={onClose}
        buildBody={(form) => {
          const expiresAt = String(form.get("expiresAt") ?? "");
          return {
            userId: form.get("userId"),
            title: form.get("title"),
            pointsCost: Number(form.get("pointsCost")),
            ...(expiresAt
              ? { expiresAt: new Date(expiresAt).toISOString() }
              : {}),
          };
        }}
      >
        <label>
          Cliente
          <select name="userId" required>
            <option value="">Selecione</option>
            {users
              .filter((item) => item.role === "CUSTOMER")
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.fullName} · {item.loyalty?.balance ?? 0} pts
                </option>
              ))}
          </select>
        </label>
        <label>
          Benefício
          <input
            name="title"
            required
            placeholder="R$ 250 na próxima revisão"
          />
        </label>
        <div className="form-grid">
          <label>
            Custo em pontos
            <input name="pointsCost" type="number" min="0" required />
          </label>
          <label>
            Validade
            <input name="expiresAt" type="date" />
          </label>
        </div>
      </ActionForm>
    </Modal>
  );
}

function CreateCampaignDialog({
  onClose,
  initialVins = [],
  recommendationVins = [],
  recommendationModelVersion,
  reminderModel,
}: {
  onClose(): void;
  initialVins?: string[];
  recommendationVins?: string[];
  recommendationModelVersion?: string | null;
  reminderModel?: string | null;
}) {
  return (
    <EnhancedCreateCampaignDialog
      initialVins={initialVins}
      recommendationVins={recommendationVins}
      recommendationModelVersion={recommendationModelVersion}
      reminderModel={reminderModel}
      onClose={onClose}
      onCreated={() => notifyDataChanged()}
    />
  );
}

function EditDealershipDialog({
  dealership,
  onClose,
}: {
  dealership: ApiDealership;
  onClose(): void;
}) {
  return (
    <Modal
      title="Editar concessionária"
      description="Atualize os dados exibidos em toda a operação."
      onClose={onClose}
    >
      <ActionForm
        endpoint={`/dealerships/${dealership.id}`}
        method="PATCH"
        submitLabel="Salvar unidade"
        onDone={onClose}
        buildBody={(form) => ({
          tradeName: form.get("tradeName"),
          legalName: form.get("legalName"),
          city: form.get("city"),
          state: form.get("state"),
          timezone: form.get("timezone"),
          businessDays: form.getAll("businessDays").map(Number),
          openingTime: form.get("openingTime"),
          closingTime: form.get("closingTime"),
          slotDurationMinutes: Number(form.get("slotDurationMinutes")),
          simultaneousCapacity: Number(form.get("simultaneousCapacity")),
        })}
      >
        <label>
          Nome da unidade
          <input
            name="tradeName"
            defaultValue={dealership.tradeName}
            required
          />
        </label>
        <label>
          Razão social
          <input
            name="legalName"
            defaultValue={dealership.legalName ?? dealership.tradeName}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Cidade
            <input name="city" defaultValue={dealership.city} required />
          </label>
          <label>
            UF
            <input
              name="state"
              defaultValue={dealership.state}
              minLength={2}
              maxLength={2}
              required
            />
          </label>
        </div>
        <div className="form-section-heading">
          <span className="eyebrow">AGENDA DA OFICINA</span>
          <strong>Expediente e capacidade</strong>
        </div>
        <div className="weekday-picker" aria-label="Dias de atendimento">
          {[
            [1, "Seg"],
            [2, "Ter"],
            [3, "Qua"],
            [4, "Qui"],
            [5, "Sex"],
            [6, "Sáb"],
            [0, "Dom"],
          ].map(([day, label]) => (
            <label key={day}>
              <input
                type="checkbox"
                name="businessDays"
                value={day}
                defaultChecked={dealership.businessDays.includes(Number(day))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Abertura
            <input
              name="openingTime"
              type="time"
              defaultValue={dealership.openingTime}
              required
            />
          </label>
          <label>
            Fechamento
            <input
              name="closingTime"
              type="time"
              defaultValue={dealership.closingTime}
              required
            />
          </label>
          <label>
            Duração do atendimento
            <select
              name="slotDurationMinutes"
              defaultValue={dealership.slotDurationMinutes}
            >
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1h30</option>
              <option value="120">2 horas</option>
            </select>
          </label>
          <label>
            Atendimentos simultâneos
            <input
              name="simultaneousCapacity"
              type="number"
              min="1"
              max="50"
              defaultValue={dealership.simultaneousCapacity}
              required
            />
          </label>
        </div>
        <label>
          Fuso horário
          <input
            name="timezone"
            defaultValue={dealership.timezone}
            required
          />
        </label>
      </ActionForm>
    </Modal>
  );
}

function CreateTeamMemberDialog({ onClose }: { onClose(): void }) {
  const { user } = useAuth();
  const { data: dealerships } = useApiData<ApiDealership[]>("/dealerships", []);
  const [invitation, setInvitation] = useState<ApiTeamInvitation | null>(null);
  const activationLink = invitation?.developmentToken
    ? `${window.location.origin}/?invite=${invitation.developmentToken}`
    : "";
  return (
    <Modal
      title="Adicionar integrante"
      description="Crie um acesso individual e rastreável para a equipe."
      onClose={onClose}
    >
      {invitation ? (
        <div className="invitation-success">
          <div className="success-seal">
            <ShieldCheck size={24} />
          </div>
          <h3>Convite criado com segurança</h3>
          <p>
            {invitation.fullName} poderá definir a própria senha. O convite
            vence em {new Date(invitation.expiresAt).toLocaleString("pt-BR")}.
          </p>
          {activationLink ? (
            <>
              <label>
                Link de ativação local
                <textarea readOnly value={activationLink} />
              </label>
              <button
                className="primary wide"
                type="button"
                onClick={() => navigator.clipboard.writeText(activationLink)}
              >
                Copiar link de ativação
              </button>
            </>
          ) : (
            <div className="privacy-note">
              O convite foi preparado para envio pelo provedor de e-mail.
            </div>
          )}
          <button className="secondary wide" type="button" onClick={onClose}>
            Concluir
          </button>
        </div>
      ) : (
      <ActionForm
        endpoint="/users/team/invitations"
        submitLabel="Gerar convite"
        onDone={(result) => setInvitation(result as ApiTeamInvitation)}
        onCancel={onClose}
        buildBody={(form) => ({
          fullName: form.get("fullName"),
          email: form.get("email"),
          phone: form.get("phone"),
          role: form.get("role"),
          ...(user?.role === "FORD_ADMIN"
            ? { dealershipId: form.get("dealershipId") }
            : {}),
        })}
      >
        <label>
          Nome completo
          <input name="fullName" required />
        </label>
        <div className="form-grid">
          <label>
            E-mail
            <input name="email" type="email" required />
          </label>
          <label>
            Telefone
            <input name="phone" />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Perfil
            <select name="role" required>
              <option value="DEALERSHIP_AGENT">Consultor</option>
              {user?.role === "FORD_ADMIN" && (
                <option value="DEALERSHIP_MANAGER">Gerente</option>
              )}
            </select>
          </label>
          <div className="invite-security-copy">
            <KeyRound size={18} />
            <span>O integrante criará a própria senha ao aceitar.</span>
          </div>
        </div>
        {user?.role === "FORD_ADMIN" && (
          <label>
            Concessionária
            <select name="dealershipId" required>
              <option value="">Selecione</option>
              {dealerships.map((dealer) => (
                <option key={dealer.id} value={dealer.id}>
                  {dealer.tradeName} · {dealer.city}/{dealer.state}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>
            O integrante deverá usar credenciais próprias. Todas as ações serão
            registradas na auditoria.
          </span>
        </div>
      </ActionForm>
      )}
    </Modal>
  );
}

function ManageTeamMemberDialog({
  member,
  onClose,
}: {
  member: ApiUser;
  onClose(): void;
}) {
  const { user } = useAuth();
  return (
    <Modal
      title="Gerenciar integrante"
      description={`${member.fullName} · ${member.email}`}
      onClose={onClose}
    >
      <ActionForm
        endpoint={`/users/${member.id}/team`}
        method="PATCH"
        submitLabel="Salvar acesso"
        onDone={onClose}
        buildBody={(form) => {
          const password = String(form.get("password") ?? "");
          return {
            fullName: form.get("fullName"),
            phone: form.get("phone"),
            active: form.get("active") === "true",
            role: form.get("role"),
            ...(password ? { password } : {}),
          };
        }}
      >
        <label>
          Nome completo
          <input name="fullName" defaultValue={member.fullName} required />
        </label>
        <label>
          Telefone
          <input name="phone" defaultValue={member.phone ?? ""} />
        </label>
        <div className="form-grid">
          <label>
            Perfil
            <select name="role" defaultValue={member.role}>
              <option value="DEALERSHIP_AGENT">Consultor</option>
              {user?.role === "FORD_ADMIN" && (
                <>
                  <option value="DEALERSHIP_MANAGER">Gerente</option>
                  <option value="FORD_ADMIN">Admin Ford</option>
                </>
              )}
            </select>
          </label>
          <label>
            Situação
            <select name="active" defaultValue={String(member.active)}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </label>
        </div>
        <label>
          Nova senha
          <input
            name="password"
            type="password"
            minLength={8}
            placeholder="Deixe vazio para manter a atual"
          />
        </label>
      </ActionForm>
    </Modal>
  );
}

const leadStatusLabels: Record<RepurchaseLeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contato realizado",
  QUALIFIED: "Qualificado",
  WON: "Venda conquistada",
  LOST: "Oportunidade perdida",
};

function CreateRepurchaseLeadDialog({
  opportunity,
  onClose,
}: {
  opportunity: RepurchaseOpportunity;
  onClose(): void;
}) {
  const { user } = useAuth();
  const { data: dealerships } = useApiData<ApiDealership[]>("/dealerships", []);
  return (
    <Modal
      title="Criar lead de recompra"
      description={`${opportunity.model} ${opportunity.modelYear} · ${opportunity.owner?.fullName ?? "Sem proprietário ativo"}`}
      onClose={onClose}
    >
      <ActionForm
        endpoint="/repurchase-leads"
        submitLabel="Criar e iniciar acompanhamento"
        onDone={onClose}
        buildBody={(form) => ({
          vin: opportunity.vin,
          score: opportunity.score,
          estimatedValue: opportunity.estimatedValue,
          ...(user?.role === "FORD_ADMIN"
            ? { dealershipId: form.get("dealershipId") }
            : {}),
          notes: form.get("notes"),
        })}
      >
        <div className="lead-preview">
          <span>
            <small>PROPENSÃO</small>
            <b>{opportunity.score}%</b>
          </span>
          <span>
            <small>VALOR ESTIMADO</small>
            <b>
              {opportunity.estimatedValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              })}
            </b>
          </span>
        </div>
        {user?.role === "FORD_ADMIN" && (
          <label>
            Concessionária responsável
            <select name="dealershipId" required>
              <option value="">Selecione</option>
              {dealerships.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.tradeName} · {item.city}/{item.state}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Observação inicial
          <textarea
            name="notes"
            placeholder="Contexto comercial, preferência do cliente ou próximo passo"
          />
        </label>
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>
            O contato e cada mudança de etapa ficarão registrados na trilha de
            auditoria.
          </span>
        </div>
      </ActionForm>
    </Modal>
  );
}

function ManageRepurchaseLeadDialog({
  lead,
  onClose,
}: {
  lead: ApiRepurchaseLead;
  onClose(): void;
}) {
  return (
    <Modal
      title="Acompanhar oportunidade"
      description={`${lead.vehicle.model} ${lead.vehicle.modelYear} · ${lead.owner?.fullName ?? "Sem proprietário ativo"}`}
      onClose={onClose}
    >
      <ActionForm
        endpoint={`/repurchase-leads/${lead.id}`}
        method="PATCH"
        submitLabel="Salvar acompanhamento"
        onDone={onClose}
        buildBody={(form) => ({
          status: form.get("status"),
          notes: form.get("notes"),
        })}
      >
        <label>
          Etapa do funil
          <select name="status" defaultValue={lead.status}>
            {Object.entries(leadStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nota de acompanhamento
          <textarea
            name="notes"
            defaultValue={lead.notes ?? ""}
            placeholder="Registre o resultado do contato e o próximo passo"
          />
        </label>
        <div className="lead-history">
          <span className="eyebrow">HISTÓRICO DO LEAD</span>
          {lead.events.slice(0, 5).map((event) => (
            <div key={event.id}>
              <i />
              <span>
                <b>{leadStatusLabels[event.toStatus]}</b>
                <small>
                  {event.performedBy?.fullName ?? "Sistema"} ·{" "}
                  {new Date(event.createdAt).toLocaleString("pt-BR")}
                </small>
                {event.notes && <em>{event.notes}</em>}
              </span>
            </div>
          ))}
        </div>
      </ActionForm>
    </Modal>
  );
}

const supportStatusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em atendimento",
  RESOLVED: "Resolvido",
  CLOSED: "Encerrado",
};
const supportStatusTones: Record<SupportTicketStatus, Tone> = {
  OPEN: "amber",
  IN_PROGRESS: "blue",
  RESOLVED: "green",
  CLOSED: "slate",
};
const supportCategoryLabels: Record<string, string> = {
  ACCESS: "Acesso e permissões",
  SCHEDULING: "Agenda da oficina",
  DATA_INTEGRATION: "Dados e integrações",
  BILLING: "Plano e cobrança",
  OTHER: "Outro assunto",
};

function isVehicleValidation(ticket: Pick<ApiSupportTicket, "subject">) {
  return ticket.subject.startsWith("Validação de veículo informado pelo cliente");
}

function CreateSupportTicketDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal
      title="Abrir chamado"
      description="Conte o que aconteceu. O histórico ficará disponível até a solução."
      onClose={onClose}
    >
      <ActionForm
        endpoint="/support-tickets"
        submitLabel="Enviar para o suporte"
        onDone={onClose}
        buildBody={(form) => ({
          subject: form.get("subject"),
          message: form.get("message"),
          category: form.get("category"),
          priority: form.get("priority"),
        })}
      >
        <label>
          Assunto
          <input
            name="subject"
            minLength={5}
            maxLength={160}
            required
            placeholder="Ex.: não consigo confirmar um agendamento"
          />
        </label>
        <div className="form-grid">
          <label>
            Categoria
            <select name="category" defaultValue="OTHER">
              {Object.entries(supportCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridade
            <select name="priority" defaultValue="NORMAL">
              <option value="LOW">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </label>
        </div>
        <label>
          Detalhes
          <textarea
            name="message"
            minLength={15}
            maxLength={5000}
            required
            placeholder="Descreva a tela, o resultado esperado e a mensagem exibida."
          />
        </label>
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>
            Não inclua senhas. O chamado será visível apenas para você e para a
            equipe autorizada de atendimento.
          </span>
        </div>
      </ActionForm>
    </Modal>
  );
}

function SupportConversation({ ticket }: { ticket: ApiSupportTicket }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ApiSupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const threadEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    const load = async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const next = await api<ApiSupportMessage[]>(
          `/support-tickets/${ticket.id}/messages`,
        );
        if (!live) return;
        setMessages(next);
        await api(`/support-tickets/${ticket.id}/messages/read`, {
          method: "PATCH",
        });
        notifyDataChanged();
      } catch (reason) {
        if (live && !quiet)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar a conversa.",
          );
      } finally {
        if (live && !quiet) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [ticket.id]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const sent = await api<ApiSupportMessage>(
        `/support-tickets/${ticket.id}/messages`,
        { method: "POST", body: JSON.stringify({ body }) },
      );
      setMessages((current) => [...current, sent]);
      setDraft("");
      notifyDataChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível enviar.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="support-chat">
      <div className="support-chat-head">
        <div>
          <span className="eyebrow">CONVERSA COM O CLIENTE</span>
          <h3>Atendimento em tempo quase real</h3>
        </div>
        <span className="chat-live"><i /> Atualiza automaticamente</span>
      </div>
      <div className="support-chat-thread">
        {loading && <p className="chat-loading">Carregando conversa...</p>}
        {messages.map((message) => {
          const own = message.sender.id === user?.id;
          return (
            <div
              className={`chat-message ${own ? "chat-message-own" : ""}`}
              key={message.id}
            >
              <span>{own ? "Você" : message.sender.fullName}</span>
              <p>{message.body}</p>
              <small>
                {new Date(message.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          );
        })}
        <div ref={threadEnd} />
      </div>
      {error && <div className="login-error">{error}</div>}
      <form className="support-chat-composer" onSubmit={sendMessage}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escreva uma resposta clara para o cliente..."
          maxLength={2000}
          rows={2}
        />
        <button className="primary" disabled={!draft.trim() || sending}>
          <Send size={16} /> {sending ? "Enviando..." : "Enviar"}
        </button>
      </form>
      <p className="chat-security-note">
        Não solicite senhas ou códigos. Toda mensagem fica registrada na auditoria.
      </p>
    </section>
  );
}

function ManageSupportTicketDialog({
  ticket,
  onClose,
}: {
  ticket: ApiSupportTicket;
  onClose(): void;
}) {
  const { user } = useAuth();
  const vehicleValidation = isVehicleValidation(ticket);
  const canManage =
    user?.role === "DEALERSHIP_MANAGER" || user?.role === "FORD_ADMIN";
  return (
    <Modal
      title={vehicleValidation ? "Validar veículo informado" : "Tratar chamado"}
      description={`${ticket.requester.fullName} · ${ticket.subject}`}
      onClose={onClose}
    >
      {vehicleValidation && (
        <div className="ticket-message">
          <span>{supportCategoryLabels[ticket.category] ?? ticket.category}</span>
          <p>{ticket.message}</p>
        </div>
      )}
      {/* Quem aguarda validação está com a conta bloqueada: não há conversa possível. */}
      {!vehicleValidation && <SupportConversation ticket={ticket} />}
      {vehicleValidation && ticket.validationDecision ? (
        <div className={`validation-outcome validation-outcome-${ticket.validationDecision.toLowerCase()}`}>
          {ticket.validationDecision === "APPROVED" ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          <div>
            <b>{ticket.validationDecision === "APPROVED" ? "Cadastro aprovado" : "Cadastro recusado"}</b>
            <small>
              {ticket.assignedTo ? `Por ${ticket.assignedTo.fullName}` : "Decisão registrada"}
              {ticket.resolvedAt ? ` · ${new Date(ticket.resolvedAt).toLocaleString("pt-BR")}` : ""}
            </small>
            {ticket.resolution && <p>{ticket.resolution}</p>}
          </div>
        </div>
      ) : vehicleValidation && canManage ? (
        <ActionForm
          endpoint={`/support-tickets/${ticket.id}/vehicle-validation`}
          method="PATCH"
          submitLabel="Confirmar decisão"
          onDone={onClose}
          buildBody={(form) => ({
            decision: form.get("decision"),
            resolution: form.get("resolution"),
          })}
        >
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>Confira documento e posse antes de aprovar. Ao aprovar, o sistema libera a conta e a garagem do cliente e envia o e-mail para criar a senha. Ao recusar, a conta continua bloqueada e o cliente recebe por e-mail o texto abaixo como motivo. Tudo fica registrado na auditoria.</span>
          </div>
          <label>
            Decisão
            <select name="decision" defaultValue="APPROVE">
              <option value="APPROVE">Aprovar vínculo do veículo</option>
              <option value="REJECT">Recusar e solicitar correção</option>
            </select>
          </label>
          <label>
            Registro da conferência (enviado ao cliente em caso de recusa)
            <textarea
              name="resolution"
              minLength={8}
              required
              placeholder="Ex.: Documento conferido e posse confirmada na unidade."
            />
          </label>
        </ActionForm>
      ) : !vehicleValidation && canManage ? (
        <ActionForm
          endpoint={`/support-tickets/${ticket.id}`}
          method="PATCH"
          submitLabel="Salvar atendimento"
          onDone={onClose}
          buildBody={(form) => ({
            status: form.get("status"),
            resolution: form.get("resolution"),
          })}
        >
          <label>
            Situação
            <select name="status" defaultValue={ticket.status}>
              {Object.entries(supportStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Solução ou andamento
            <textarea
              name="resolution"
              defaultValue={ticket.resolution ?? ""}
              placeholder="Registre o diagnóstico, a orientação ou a solução aplicada."
            />
          </label>
        </ActionForm>
      ) : (
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>
            Você pode conversar com o cliente. A conclusão e a aprovação formal
            permanecem sob responsabilidade do gerente ou administrador Ford.
          </span>
        </div>
      )}
    </Modal>
  );
}

type ApiOutboundMessage = {
  id: string;
  channel: string;
  templateKey: string;
  recipient: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

const MESSAGE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Na fila", tone: "amber" },
  SENDING: { label: "Enviando", tone: "blue" },
  SENT: { label: "Entregue", tone: "green" },
  FAILED: { label: "Falhou", tone: "red" },
  CANCELLED: { label: "Cancelada", tone: "slate" },
};

const MESSAGE_TEMPLATES: Record<string, string> = {
  TEAM_INVITATION: "Convite de equipe",
  CUSTOMER_ACTIVATION: "Ativação da conta do cliente",
  VEHICLE_APPROVED: "Veículo aprovado no Ford App",
  VEHICLE_REGISTRATION_RECEIVED: "Cadastro de veículo recebido",
  VEHICLE_REJECTED: "Cadastro de veículo recusado",
  PASSWORD_RESET: "Recuperação de senha",
  CAMPAIGN_OFFER: "Oferta de campanha",
  EMAIL_TEST: "Teste de e-mail",
  BOOKING_CONFIRMATION: "Confirmação de agendamento",
  SERVICE_COMPLETED: "Serviço concluído",
  RECALL_NOTICE: "Campanha de segurança",
};

/**
 * Fila transacional. O motor já existia com retentativa e rastreio, mas não
 * havia como olhar para ele — nem provar entrega numa auditoria.
 */
function MessagingPage() {
  const [status, setStatus] = useState("");
  const { data: messages, loading } = useApiData<ApiOutboundMessage[]>(
    `/messaging${status ? `?status=${status}` : ""}`,
    [],
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(id: string, action: "retry" | "cancel") {
    setBusy(id);
    setError("");
    try {
      await api(`/messaging/${id}/${action}`, { method: "POST" });
      notifyDataChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy("");
    }
  }

  const count = (value: string) =>
    messages.filter((item) => item.status === value).length;

  return (
    <>
      <PageHeader
        eyebrow="INFRAESTRUTURA"
        title="Fila de mensageria"
        description="Toda comunicação transacional da plataforma, com tentativas, falhas e prova de entrega."
      />
      <section className="stats-grid">
        <StatCard
          icon={Clock3}
          label="Na fila"
          value={String(count("PENDING"))}
          change="Aguardando envio"
          tone="amber"
        />
        <StatCard
          icon={CheckCircle2}
          label="Entregues"
          value={String(count("SENT"))}
          change="Confirmadas pelo provedor"
          tone="green"
        />
        <StatCard
          icon={TriangleAlert}
          label="Falhas"
          value={String(count("FAILED"))}
          change="Esgotaram as tentativas"
          tone="red"
        />
        <StatCard
          icon={Send}
          label="Total"
          value={String(messages.length)}
          change="Últimas 100 mensagens"
          tone="blue"
        />
      </section>

      <section className="filter-bar">
        {(
          [
            ["", "Todas"],
            ["PENDING", "Na fila"],
            ["SENT", "Entregues"],
            ["FAILED", "Falhas"],
            ["CANCELLED", "Canceladas"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value || "all"}
            className={status === value ? "chip chip-active" : "chip"}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </section>

      {error && <div className="login-error">{error}</div>}

      <div className="data-table">
        <div className="table-row table-head messaging-row">
          <span>Mensagem</span>
          <span>Destinatário</span>
          <span>Tentativas</span>
          <span>Registro</span>
          <span>Status</span>
          <span />
        </div>
        {loading && <div className="empty-row">Carregando fila...</div>}
        {!loading && !messages.length && (
          <div className="empty-row">
            Nenhuma mensagem neste filtro. A fila fica vazia quando tudo foi
            entregue.
          </div>
        )}
        {messages.map((message) => {
          const meta = MESSAGE_STATUS[message.status] ?? {
            label: message.status,
            tone: "slate" as Tone,
          };
          const canRetry = message.status === "FAILED";
          return (
            <div className="table-row messaging-row" key={message.id}>
              <span>
                <b>
                  {MESSAGE_TEMPLATES[message.templateKey] ??
                    message.templateKey}
                </b>
                <small>{message.channel}</small>
              </span>
              <span>
                <b>{message.recipient}</b>
                <small>
                  {message.lastError
                    ? message.lastError.slice(0, 60)
                    : "Sem erros registrados"}
                </small>
              </span>
              <span>
                <b>
                  {message.attempts} de {message.maxAttempts}
                </b>
                <small>
                  {message.status === "PENDING"
                    ? `Próxima ${new Date(message.nextAttemptAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "—"}
                </small>
              </span>
              <span>
                <b>
                  {new Date(
                    message.sentAt ?? message.failedAt ?? message.createdAt,
                  ).toLocaleDateString("pt-BR")}
                </b>
                <small>
                  {new Date(
                    message.sentAt ?? message.failedAt ?? message.createdAt,
                  ).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </span>
              <span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </span>
              <span className="messaging-actions">
                {canRetry && (
                  <button
                    className="secondary"
                    disabled={busy === message.id}
                    onClick={() => void act(message.id, "retry")}
                  >
                    Reenviar
                  </button>
                )}
                {message.status === "PENDING" && (
                  <button
                    className="secondary"
                    disabled={busy === message.id}
                    onClick={() => void act(message.id, "cancel")}
                  >
                    Cancelar
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

type SupportView = "messages" | "validations";
type ValidationState = "PENDING" | "APPROVED" | "REJECTED";
type ValidationFilter = ValidationState | "ALL";

function validationState(ticket: ApiSupportTicket): ValidationState {
  if (ticket.validationDecision) return ticket.validationDecision;
  return ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "APPROVED" : "PENDING";
}

const validationStateMeta: Record<ValidationState, { label: string; tone: Tone }> = {
  PENDING: { label: "Aguardando aprovação", tone: "amber" },
  APPROVED: { label: "Aprovado", tone: "green" },
  REJECTED: { label: "Recusado", tone: "red" },
};

const SUPPORT_REFRESH_MS = 5000;

function SupportPage({ view }: { view: SupportView }) {
  const { user } = useAuth();
  const { data: allTickets, loading } = useApiData<ApiSupportTicket[]>(
    "/support-tickets",
    [],
    SUPPORT_REFRESH_MS,
  );
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("PENDING");
  // Ids já vistos nesta visita: o que chegar depois ganha o selo "Novo".
  const seenTicketIds = useRef<Set<string> | null>(null);
  const [freshTicketIds, setFreshTicketIds] = useState<Set<string>>(new Set());
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  useEffect(() => {
    if (loading) return;
    setLastSyncAt(new Date());
    const ids = allTickets.map((ticket) => ticket.id);
    const seen = seenTicketIds.current;
    if (!seen) {
      seenTicketIds.current = new Set(ids);
      return;
    }
    const arrived = ids.filter((id) => !seen.has(id));
    if (!arrived.length) return;
    arrived.forEach((id) => seen.add(id));
    setFreshTicketIds((current) => new Set([...current, ...arrived]));
  }, [allTickets, loading]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ApiSupportTicket | null>(null);
  const canManage =
    user?.role === "DEALERSHIP_MANAGER" || user?.role === "FORD_ADMIN";
  const canChat =
    canManage || user?.role === "DEALERSHIP_AGENT";
  const tickets = allTickets.filter((ticket) =>
    view === "validations"
      ? isVehicleValidation(ticket)
      : !isVehicleValidation(ticket),
  );
  const active = tickets.filter(
    (ticket) => ticket.status === "IN_PROGRESS",
  ).length;
  const resolved = tickets.filter(
    (ticket) => ticket.status === "RESOLVED" || ticket.status === "CLOSED",
  ).length;
  const pendingVehicleValidations = tickets.filter(
    (ticket) => ticket.status === "OPEN" && isVehicleValidation(ticket),
  ).length;
  const unreadMessages = tickets.reduce(
    (total, ticket) => total + ticket.unreadCount,
    0,
  );
  const validationCounts: Record<ValidationState, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  tickets.forEach((ticket) => { validationCounts[validationState(ticket)] += 1; });
  const visibleTickets =
    view === "validations" && validationFilter !== "ALL"
      ? tickets.filter((ticket) => validationState(ticket) === validationFilter)
      : tickets;
  const orderedTickets = [...visibleTickets].sort((left, right) => {
    if (view !== "validations")
      return (
        right.unreadCount - left.unreadCount ||
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    // Pendentes formam uma fila (mais antigo primeiro); decididos, histórico (mais recente primeiro).
    const leftPending = validationState(left) === "PENDING";
    const rightPending = validationState(right) === "PENDING";
    if (leftPending !== rightPending) return leftPending ? -1 : 1;
    if (leftPending)
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return (
      new Date(right.resolvedAt ?? right.updatedAt).getTime() -
      new Date(left.resolvedAt ?? left.updatedAt).getTime()
    );
  });

  const requestedTicketId = searchParams.get("ticket");
  useEffect(() => {
    if (!requestedTicketId || selected) return;
    const requested = tickets.find((ticket) => ticket.id === requestedTicketId);
    if (requested) setSelected(requested);
  }, [requestedTicketId, selected, tickets]);

  function closeSelected() {
    setSelected(null);
    if (requestedTicketId) {
      const next = new URLSearchParams(searchParams);
      next.delete("ticket");
      setSearchParams(next, { replace: true });
    }
  }

  const validationsView = view === "validations";
  return (
    <>
      <PageHeader
        eyebrow={validationsView ? "GOVERNANÇA" : "RELACIONAMENTO"}
        title={validationsView ? "Validações de veículos" : "Mensagens dos clientes"}
        description={
          validationsView
            ? "Confira os veículos informados pelo Ford App antes de liberar o vínculo com a conta do cliente."
            : "Receba dúvidas do Ford App, assuma conversas e acompanhe cada atendimento até a solução."
        }
        action={
          validationsView ? (
            <Link className="secondary" to="/atendimentos">
              <MessageCircleMore size={17} /> Ir para mensagens
            </Link>
          ) : (
            <button className="primary" onClick={() => setCreating(true)}>
              <MessageCircleMore size={17} /> Abrir atendimento
            </button>
          )
        }
      />
      {validationsView ? (
        <section className="support-summary-grid">
          <StatCard
            icon={ShieldAlert}
            label="Aguardando aprovação"
            value={String(validationCounts.PENDING)}
            change="Contas bloqueadas até a decisão"
            tone="amber"
          />
          <StatCard
            icon={ShieldCheck}
            label="Aprovados"
            value={String(validationCounts.APPROVED)}
            change="Conta liberada e e-mail enviado"
            tone="green"
          />
          <StatCard
            icon={X}
            label="Recusados"
            value={String(validationCounts.REJECTED)}
            change="Cliente avisado com o motivo"
            tone="red"
          />
        </section>
      ) : (
      <section className="support-summary-grid">
        <StatCard
          icon={Bell}
          label="Mensagens não lidas"
          value={String(unreadMessages)}
          change="Pedem retorno da equipe"
          tone="amber"
        />
        <StatCard
          icon={Activity}
          label="Em atendimento"
          value={String(active)}
          change="Com especialista"
          tone="blue"
        />
        <StatCard
          icon={ShieldCheck}
          label="Concluídos"
          value={String(resolved)}
          change="Histórico preservado"
          tone="green"
        />
      </section>
      )}
      <section className="card support-workspace">
        <div className="card-heading">
          <div>
            <span className="eyebrow">{validationsView ? "ANÁLISE HUMANA" : "CAIXA DE ENTRADA"}</span>
            <h2>
              {validationsView
                ? "Cadastros de proprietários"
                : canManage
                  ? "Conversas da concessionária"
                  : "Meus atendimentos"}
            </h2>
            <p>
              {validationsView
                ? "Aprovar ou recusar exige um gerente responsável. Tudo fica guardado no histórico."
                : "Novas mensagens aparecem primeiro e também acionam a central de notificações."}
            </p>
          </div>
          <div className="support-live">
            <span className="live-dot" aria-hidden="true" />
            <small>
              Atualiza sozinho
              {lastSyncAt ? ` · ${lastSyncAt.toLocaleTimeString("pt-BR")}` : ""}
            </small>
            <Badge tone="blue">{visibleTickets.length} registros</Badge>
          </div>
        </div>
        {validationsView && (
          <div className="campaign-filter-tabs validation-filter-tabs" role="tablist">
            {([
              ["PENDING", "A aprovar", validationCounts.PENDING],
              ["APPROVED", "Aprovados", validationCounts.APPROVED],
              ["REJECTED", "Recusados", validationCounts.REJECTED],
              ["ALL", "Histórico completo", tickets.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={validationFilter === key}
                className={`campaign-tab-chip ${validationFilter === key ? "active" : ""}`}
                onClick={() => setValidationFilter(key)}
              >
                {label} <b>{count}</b>
              </button>
            ))}
          </div>
        )}
        <div className="support-ticket-list">
          {orderedTickets.map((ticket) => (
            <article key={ticket.id} className={freshTicketIds.has(ticket.id) ? "ticket-fresh" : undefined}>
              <div className={`ticket-priority ${validationsView ? `validation-${validationState(ticket)}` : `priority-${ticket.priority}`}`} />
              <div className="ticket-main">
                <div>
                  {validationsView ? (
                    <Badge tone={validationStateMeta[validationState(ticket)].tone}>
                      {validationStateMeta[validationState(ticket)].label}
                    </Badge>
                  ) : (
                    <>
                      <Badge tone={supportStatusTones[ticket.status]}>
                        {supportStatusLabels[ticket.status]}
                      </Badge>
                      <span>{supportCategoryLabels[ticket.category]}</span>
                    </>
                  )}
                  {freshTicketIds.has(ticket.id) && <Badge tone="violet">Novo</Badge>}
                  {ticket.unreadCount > 0 && (
                    <Badge tone="violet">
                      {ticket.unreadCount} {ticket.unreadCount === 1 ? "nova mensagem" : "novas mensagens"}
                    </Badge>
                  )}
                </div>
                <h3>{ticket.subject}</h3>
                <p>{ticket.message}</p>
                {ticket.resolution && (
                  <div className={`ticket-resolution ${ticket.validationDecision === "REJECTED" ? "ticket-resolution-rejected" : ""}`}>
                    {ticket.validationDecision === "REJECTED" ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
                    <span>{ticket.resolution}</span>
                  </div>
                )}
              </div>
              <div className="ticket-meta">
                <b>{ticket.requester.fullName}</b>
                <small>{ticket.requester.email}</small>
                <small>{ticket.dealership?.tradeName ?? "Cliente Ford"}</small>
                <small>
                  {validationsView ? "Recebido em " : ""}
                  {new Date(ticket.createdAt).toLocaleString("pt-BR")}
                </small>
                <em>
                  {validationsView && validationState(ticket) !== "PENDING"
                    ? `${validationState(ticket) === "APPROVED" ? "Aprovado" : "Recusado"} por ${ticket.assignedTo?.fullName ?? "gestor"}${ticket.resolvedAt ? ` em ${new Date(ticket.resolvedAt).toLocaleString("pt-BR")}` : ""}`
                    : validationsView
                      ? "Aguardando análise de um gerente"
                      : ticket.assignedTo
                        ? `Responsável: ${ticket.assignedTo.fullName}`
                        : "Aguardando responsável"}
                </em>
                {!validationsView && (
                  <small>{ticket.messageCount} {ticket.messageCount === 1 ? "mensagem" : "mensagens"}</small>
                )}
                {canChat && (
                  <button
                    className="settings-row-action"
                    onClick={() => {
                      setSelected(ticket);
                      setFreshTicketIds((current) => {
                        const next = new Set(current);
                        next.delete(ticket.id);
                        return next;
                      });
                    }}
                  >
                    {validationsView
                      ? validationState(ticket) === "PENDING" && canManage
                        ? "Analisar cadastro"
                        : "Ver análise"
                      : ticket.assignedTo
                        ? "Abrir conversa"
                        : "Assumir atendimento"}
                  </button>
                )}
              </div>
            </article>
          ))}
          {!loading && !visibleTickets.length && (
            <div className="support-empty">
              {validationsView ? <ShieldCheck size={30} /> : <MessageCircleMore size={30} />}
              <h3>
                {!validationsView
                  ? "Nenhuma conversa por aqui"
                  : validationFilter === "PENDING"
                    ? "Nenhum cadastro aguardando"
                    : validationFilter === "APPROVED"
                      ? "Nenhum cadastro aprovado ainda"
                      : validationFilter === "REJECTED"
                        ? "Nenhum cadastro recusado"
                        : "Nenhum cadastro recebido"}
              </h3>
              <p>
                {validationsView
                  ? "Novos cadastros do Ford App aparecem aqui sozinhos, sem precisar atualizar a página."
                  : "Quando um cliente falar pelo Ford App, a conversa aparecerá nesta caixa de entrada."}
              </p>
            </div>
          )}
        </div>
      </section>
      {creating && (
        <CreateSupportTicketDialog onClose={() => setCreating(false)} />
      )}
      {selected && (
        <ManageSupportTicketDialog
          ticket={selected}
          onClose={closeSelected}
        />
      )}
    </>
  );
}

function Shell() {
  const searchInput = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [supportCounts, setSupportCounts] = useState({
    messages: 0,
    validations: 0,
  });
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    const isStaff = [
      "DEALERSHIP_AGENT",
      "DEALERSHIP_MANAGER",
      "FORD_ADMIN",
    ].includes(user?.role ?? "");
    if (!isStaff) {
      setSupportCounts({ messages: 0, validations: 0 });
      return;
    }
    let live = true;
    const loadSupportCounts = async () => {
      try {
        const tickets = await api<ApiSupportTicket[]>("/support-tickets");
        if (!live) return;
        setSupportCounts({
          messages: tickets
            .filter((ticket) => !isVehicleValidation(ticket))
            .reduce((total, ticket) => total + ticket.unreadCount, 0),
          validations: tickets.filter(
            (ticket) =>
              isVehicleValidation(ticket) && ticket.status === "OPEN",
          ).length,
        });
      } catch {
        // O menu mantém o último contador válido quando a atualização falha.
      }
    };
    void loadSupportCounts();
    const timer = window.setInterval(() => void loadSupportCounts(), 8000);
    window.addEventListener(DATA_CHANGED_EVENT, loadSupportCounts);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener(DATA_CHANGED_EVENT, loadSupportCounts);
    };
  }, [user?.role]);
  const initials =
    user?.fullName
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("") ?? "FV";
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        user?.role === "CUSTOMER"
          ? [
              "/veiculos",
              "/agendamentos",
              "/fidelidade",
              "/seguranca",
            ].includes(item.to)
          : (!['/ford-admin', '/mensageria'].includes(item.to) || user?.role === "FORD_ADMIN") &&
            (item.to !== "/modelos" || ["DEALERSHIP_MANAGER", "FORD_ADMIN"].includes(user?.role ?? "")) &&
            (item.to !== "/validacoes" || ["DEALERSHIP_MANAGER", "FORD_ADMIN"].includes(user?.role ?? "")),
      ),
    }))
    .filter((group) => group.items.length);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/ford-vinculo-logo.svg" alt="Ford Vínculo 360" />
          <button className="mobile-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>
            <X />
          </button>
        </div>
        <div className="dealer-switch">
          <div className="dealer-mark">
            <Store size={18} />
          </div>
          <div>
            <small>CONCESSIONÁRIA</small>
            <b>{user?.dealershipName ?? "Ford Brasil"}</b>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav>
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map(({ to, label, icon: Icon, badgeKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={18} />
                  <em>{label}</em>
                  {badgeKey && supportCounts[badgeKey] > 0 && (
                    <strong className="nav-notification-badge" aria-label={`${supportCounts[badgeKey]} pendentes`}>
                      {supportCounts[badgeKey] > 99 ? "99+" : supportCounts[badgeKey]}
                    </strong>
                  )}
                  <ChevronRight className="nav-arrow" size={14} />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/configuracoes">
            <Settings size={18} />
            Configurações
          </NavLink>
          <div className="support-card">
            <div>
              <MessageCircleMore size={18} />
              <b>Central de suporte</b>
            </div>
            <p>Precisa de ajuda com a plataforma?</p>
            <button
              onClick={() => {
                navigate("/atendimentos");
                setMenuOpen(false);
              }}
            >
              Falar com especialista
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="main-area">
        <header className="topbar">
          <button className="menu-button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div className="mobile-logo">
            <img src="/ford-vinculo-logo.svg" alt="Ford Vínculo 360" />
          </div>
          <div className="global-search">
            <Search size={18} />
            <input
              aria-label="Busca global"
              ref={searchInput}
              placeholder="Buscar VIN, placa, cliente ou modelo..."
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && globalSearch.trim()) {
                  navigate(
                    `/veiculos?search=${encodeURIComponent(globalSearch.trim())}`,
                  );
                }
              }}
            />
            <kbd>Ctrl K</kbd>
          </div>
          <div className="top-actions">
            <NotificationsMenu />
            <button
              className="user-menu user-menu-button"
              onClick={logout}
              title="Sair da plataforma"
            >
              <div className="avatar">{initials}</div>
              <div>
                <b>{user?.fullName}</b>
                <small>
                  {user?.role === "FORD_ADMIN"
                    ? "Administrador Ford"
                    : user?.role === "CUSTOMER"
                      ? "Cliente Ford"
                      : user?.role === 'DEALERSHIP_AGENT' ? 'Consultor de pós-venda' : "Gerente de pós-venda"}
                </small>
              </div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="page-content">
          <RequestStatus retry={notifyDataChanged} />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/desafio-02"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <ChallengeDashboard />
                </RequireRoles>
              }
            />
            <Route path="/veiculos" element={<Vehicles />} />
            <Route
              path="/modelos"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <Navigate to="/veiculos/modelos" replace />
                </RequireRoles>
              }
            />
            <Route
              path="/veiculos/modelos"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <VehicleModelsRegistryPage />
                </RequireRoles>
              }
            />
            <Route
              path="/veiculos/variacoes"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <VehicleModelsPage />
                </RequireRoles>
              }
            />
            <Route
              path="/veiculos/novo"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <CreateVehicleCatalogPage />
                </RequireRoles>
              }
            />
            <Route
              path="/veiculos/modelos/:modelId/editar"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <EditVehicleCatalogPage />
                </RequireRoles>
              }
            />
            <Route
              path="/veiculos/variacoes/nova"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <CreateVehicleVariationPage />
                </RequireRoles>
              }
            />
            <Route
              path="/veiculos/unidades/nova"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <CreateVehicleUnitPage />
                </RequireRoles>
              }
            />
            <Route path="/veiculos/:vin" element={<VehicleDetail />} />
            <Route
              path="/clientes"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <CustomerRegistry />
                </RequireRoles>
              }
            />
            <Route
              path="/retencao"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <Customers />
                </RequireRoles>
              }
            />
            <Route
              path="/clientes/novo"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <CustomerFormPage mode="create" />
                </RequireRoles>
              }
            />
            <Route
              path="/clientes/:id"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <CustomerProfilePage />
                </RequireRoles>
              }
            />
            <Route
              path="/clientes/:id/editar"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <CustomerFormPage mode="edit" />
                </RequireRoles>
              }
            />
            <Route
              path="/servicos"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <Services />
                </RequireRoles>
              }
            />
            <Route path="/agendamentos" element={<Appointments />} />
            <Route
              path="/campanhas"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <Campaigns />
                </RequireRoles>
              }
            />
            <Route path="/fidelidade" element={<Loyalty />} />
            <Route
              path="/recompra"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <Repurchase />
                </RequireRoles>
              }
            />
            <Route path="/seguranca" element={<SafetyPage />} />
            <Route
              path="/estoque"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <StockAndSales />
                </RequireRoles>
              }
            />
            <Route
              path="/ford-admin"
              element={
                <RequireRoles roles={["FORD_ADMIN"]}>
                  <FordAdmin />
                </RequireRoles>
              }
            />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/suporte" element={<Navigate to="/atendimentos" replace />} />
            <Route
              path="/atendimentos"
              element={
                <RequireRoles roles={STAFF_ROLES}>
                  <SupportPage view="messages" />
                </RequireRoles>
              }
            />
            <Route
              path="/validacoes"
              element={
                <RequireRoles roles={["DEALERSHIP_MANAGER", "FORD_ADMIN"]}>
                  <SupportPage view="validations" />
                </RequireRoles>
              }
            />
            <Route
              path="/mensageria"
              element={
                <RequireRoles roles={["FORD_ADMIN"]}>
                  <MessagingPage />
                </RequireRoles>
              }
            />
            <Route path="*" element={<section className="recovery-screen"><CarFront size={36} /><span className="eyebrow">CAMINHO NÃO ENCONTRADO</span><h1>Vamos voltar à sua operação.</h1><p>O endereço solicitado não corresponde a uma página da plataforma.</p><Link className="primary" to="/">Ir para a visão geral</Link></section>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { data: summary } = useApiData<DashboardSummary>("/dashboard/summary", {
    vehicles: 0,
    activeOrders: 0,
    upcomingBookings: 0,
    completedLastYear: 0,
    retention: 0,
    risk: { active: 0, attention: 0, atRisk: 0, lost: 0 },
    pointsInCirculation: 0,
    activeCampaigns: 0,
    revenue: { service: 0, sales: 0, vehiclesSold: 0, averageServiceTicket: 0 },
    monthlyServices: [],
  });
  const { data: repurchase } = useApiData<RepurchaseOpportunity[]>(
    "/dashboard/repurchase",
    [],
  );
  const { data: campaigns } = useApiData<ApiCampaign[]>("/campaigns", []);
  const highRepurchase = repurchase.filter((item) => item.score >= 70);
  const estimatedPortfolio = highRepurchase.reduce(
    (total, item) => total + item.estimatedValue,
    0,
  );
  const bestCampaign = campaigns[0];
  const sent =
    bestCampaign?.targets.filter((target) => target.sentAt).length ?? 0;
  const converted =
    bestCampaign?.targets.filter((target) => target.convertedAt).length ?? 0;
  const conversion = sent ? Math.round((converted / sent) * 1000) / 10 : 0;
  const maxMonthlyServices = Math.max(
    1,
    ...summary.monthlyServices.map((item) => item.value),
  );
  const clients =
    summary.risk.active +
    summary.risk.attention +
    summary.risk.atRisk +
    summary.risk.lost;
  const emptyOperation =
    summary.vehicles === 0 &&
    summary.activeOrders === 0 &&
    summary.upcomingBookings === 0 &&
    summary.completedLastYear === 0 &&
    summary.activeCampaigns === 0 &&
    summary.revenue.service === 0 &&
    summary.revenue.sales === 0 &&
    repurchase.length === 0 &&
    campaigns.length === 0;
  const share = (value: number) =>
    clients ? `${Math.round((value / clients) * 1000) / 10}%` : "0%";
  // Anel proporcional à distribuição real da carteira.
  const riskRingGradient = (() => {
    const slices = [
      ["#2ba06a", summary.risk.active],
      ["#e5ae42", summary.risk.attention],
      ["#de554f", summary.risk.atRisk],
      ["#90a0ad", summary.risk.lost],
    ] as const;
    if (!clients) return "conic-gradient(#e7edf2 0 100%)";
    let cursor = 0;
    const stops = slices.map(([color, value]) => {
      const start = cursor;
      cursor += (value / clients) * 100;
      return `${color} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(",")})`;
  })();

  if (emptyOperation) {
    return (
      <div className="dashboard-page dashboard-empty-page">
        <section className="dashboard-empty-hero">
          <div className="dashboard-empty-mark"><CarFront size={30} /></div>
          <span className="eyebrow">BASE LIMPA E PRONTA</span>
          <h1>Vamos começar do zero.</h1>
          <p>
            Não há clientes, veículos ou movimentações cadastradas. Siga a
            ordem abaixo para alimentar o sistema sem misturar as etapas.
          </p>
          <Link className="primary" to="/veiculos/novo">
            Cadastrar primeiro veículo <ChevronRight size={17} />
          </Link>
        </section>

        <section className="dashboard-start-flow" aria-label="Ordem de cadastro">
          <article>
            <span>01</span>
            <div><CarFront size={20} /></div>
            <h2>Cadastre o veículo</h2>
            <p>Informe os dados principais do modelo, sem VIN e sem cor.</p>
            <Link to="/veiculos/novo">Abrir cadastro <ChevronRight size={14} /></Link>
          </article>
          <article>
            <span>02</span>
            <div><Layers3 size={20} /></div>
            <h2>Crie as variações</h2>
            <p>Defina versão, motorização, acabamento, cor e valor adicional.</p>
            <Link to="/veiculos/variacoes">Abrir variações <ChevronRight size={14} /></Link>
          </article>
          <article>
            <span>03</span>
            <div><KeyRound size={20} /></div>
            <h2>Adicione os VINs</h2>
            <p>Vincule cada unidade física à variação correta para formar o estoque.</p>
            <Link to="/veiculos">Abrir estoque por VIN <ChevronRight size={14} /></Link>
          </article>
          <article>
            <span>04</span>
            <div><Store size={20} /></div>
            <h2>Cadastre e venda</h2>
            <p>Cadastre o cliente com e-mail válido e conclua a venda pelo estoque.</p>
            <Link to="/estoque">Abrir vendas <ChevronRight size={14} /></Link>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
              .format(new Date())
              .toUpperCase()}
          </span>
          <h1>Visão geral</h1>
          <p>
            Acompanhe o relacionamento, a saúde da carteira e as oportunidades
            da sua operação.
          </p>
          <div className="dashboard-status-line" aria-label="Status da operação">
            <span><i /> Operação online</span>
            <span>{summary.vehicles.toLocaleString("pt-BR")} veículos monitorados</span>
          </div>
        </div>
        <button className="primary" onClick={() => navigate("/campanhas")}>
          <Sparkles size={17} />
          Criar campanha inteligente
        </button>
      </section>
      <section className="stats-grid dashboard-stats">
        <StatCard
          icon={CarFront}
          label="Veículos vinculados"
          value={summary.vehicles.toLocaleString("pt-BR")}
          change="Base atualizada em tempo real"
        />
        <StatCard
          icon={UsersRound}
          label="Clientes em risco"
          value={summary.risk.atRisk.toLocaleString("pt-BR")}
          change={`${summary.risk.lost} classificados como perdidos`}
          tone="red"
        />
        <StatCard
          icon={Wrench}
          label="Ordens em atendimento"
          value={summary.activeOrders.toLocaleString("pt-BR")}
          change={`${summary.upcomingBookings} próximos agendamentos`}
          tone="amber"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Receita de pós-venda (12 meses)"
          value={brl(summary.revenue.service)}
          change={`Ticket médio ${brl(summary.revenue.averageServiceTicket)}`}
          tone="green"
        />
      </section>
      <section className="dashboard-grid">
        <article className="card chart-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">RETENÇÃO</span>
              <h2>Retorno à rede autorizada</h2>
              <p>Veículos que realizaram serviço nos últimos 12 meses</p>
            </div>
            <select>
              <option>Últimos 12 meses</option>
            </select>
          </div>
          <div className="chart-summary">
            <strong>{summary.retention}%</strong>
            <Badge tone="green">
              {summary.completedLastYear}{" "}
              {summary.completedLastYear === 1 ? "retorno" : "retornos"}
            </Badge>
          </div>
          <div className="bar-chart">
            {summary.monthlyServices.map((item, i) => (
              <div className="bar-col" key={i}>
                <div
                  style={{
                    height: `${Math.max(5, Math.round((item.value / maxMonthlyServices) * 100))}%`,
                  }}
                  className={
                    i === summary.monthlyServices.length - 1
                      ? "bar active"
                      : "bar"
                  }
                  title={`${item.value} ${item.value === 1 ? "serviço concluído" : "serviços concluídos"}`}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="card risk-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">CARTEIRA</span>
              <h2>Saúde dos clientes</h2>
              <p>Classificação por recência de serviços</p>
            </div>
            <Link to="/retencao">Detalhes</Link>
          </div>
          <div className="donut-wrap">
            <div className="donut" style={{ background: riskRingGradient }}>
              <div>
                <strong>{clients.toLocaleString("pt-BR")}</strong>
                <small>clientes</small>
              </div>
            </div>
          </div>
          <div className="risk-legend">
            <div>
              <Badge tone="green">Ativos</Badge>
              <b>
                {summary.risk.active}{" "}
                <small>{share(summary.risk.active)}</small>
              </b>
            </div>
            <div>
              <Badge tone="amber">Atenção</Badge>
              <b>
                {summary.risk.attention}{" "}
                <small>{share(summary.risk.attention)}</small>
              </b>
            </div>
            <div>
              <Badge tone="red">Em risco</Badge>
              <b>
                {summary.risk.atRisk}{" "}
                <small>{share(summary.risk.atRisk)}</small>
              </b>
            </div>
            <div>
              <Badge tone="slate">Perdidos</Badge>
              <b>
                {summary.risk.lost} <small>{share(summary.risk.lost)}</small>
              </b>
            </div>
          </div>
        </article>
      </section>
      <section className="card opportunity-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">PRIORIDADES DO DIA</span>
            <h2>Oportunidades recomendadas</h2>
            <p>
              Ações com maior potencial de retorno identificadas pela
              inteligência da plataforma.
            </p>
          </div>
          <Link to="/retencao">
            Ver todas <ChevronRight size={15} />
          </Link>
        </div>
        <VehicleTable compact />
      </section>
      <section className="insight-row">
        <article className="insight-card dark">
          <div className="insight-icon">
            <Sparkles />
          </div>
          <div>
            <span>INSIGHT VÍNCULO AI</span>
            <h3>
              {highRepurchase.length}{" "}
              {highRepurchase.length === 1 ? "cliente tem" : "clientes têm"}{" "}
              alta chance de recompra.
            </h3>
            <p>
              Carteira estimada:{" "}
              <b>
                {estimatedPortfolio.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              </b>{" "}
              em veículos usados.
            </p>
          </div>
          <button onClick={() => navigate("/recompra")}>
            Ver recomendação <ChevronRight size={16} />
          </button>
        </article>
        <article className="insight-card">
          <div className="insight-icon pale">
            <BadgePercent />
          </div>
          <div>
            <span>MELHOR CAMPANHA</span>
            <h3>{bestCampaign?.name ?? "Nenhuma campanha ativa"}</h3>
            <p>
              {sent} {sent === 1 ? "envio" : "envios"} · {conversion}% de
              conversão
            </p>
          </div>
          <Link to="/campanhas">Abrir campanha</Link>
        </article>
      </section>
    </div>
  );
}

function MercosulPlate({ plate }: { plate: string | null | undefined }) {
  if (!plate) {
    return (
      <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic", fontWeight: 600 }}>
        Sem placa
      </span>
    );
  }
  return (
    <div className="mercosul-plate-box" title={`Placa Mercosul: ${plate.toUpperCase()}`}>
      <div className="mercosul-plate-header">
        <span>BRASIL</span>
        <div className="mercosul-plate-flag" />
      </div>
      <div className="mercosul-plate-number">{plate.toUpperCase()}</div>
    </div>
  );
}

function VinCopyButton({ vin }: { vin: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    navigator.clipboard.writeText(vin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      className={`btn-copy-vin${copied ? " copied" : ""}`}
      onClick={handleCopy}
      title="Copiar VIN para área de transferência"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function VehicleCardGrid({ vehicles }: { vehicles: ApiVehicle[] }) {
  return (
    <div className="vehicles-showcase-grid">
      {vehicles.map((v) => {
        const risk = riskFor(v);
        const owner = v.ownerships?.[0]?.user;
        const inStock = ["IN_STOCK", "RESERVED"].includes(v.saleStatus ?? "");
        const image = v.imageUrl ?? vehicleImageFor(v.model);
        const isNew = v.condition === "NEW";
        const ownerInitials = owner?.fullName
          ? owner.fullName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
          : null;

        return (
          <article className="vehicle-showcase-card" key={v.vin}>
            <div className="card-vehicle-stage">
              <span className="ford-stage-watermark">FORD</span>
              {image ? (
                <img
                  src={image}
                  alt={`${v.model} ${v.version ?? ""}`}
                  className="card-vehicle-img"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <CarFront size={64} style={{ color: "rgba(255,255,255,0.3)" }} />
              )}
              <div className="card-stage-badges">
                <span className={`stage-badge-condition${isNew ? " new" : ""}`}>
                  {isNew ? "0 KM" : "Seminovo"}
                </span>
                <Badge
                  tone={
                    inStock
                      ? v.saleStatus === "RESERVED"
                        ? "amber"
                        : "blue"
                      : risk.tone
                  }
                >
                  {inStock
                    ? v.saleStatus === "RESERVED"
                      ? "Reservado"
                      : "Em estoque"
                    : risk.label}
                </Badge>
              </div>
            </div>

            <div className="card-vehicle-body">
              <div className="card-vehicle-title-row">
                <div>
                  <h3>
                    {v.model}{" "}
                    <small style={{ fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
                      {v.modelYear}
                    </small>
                  </h3>
                  <p className="card-vehicle-version">
                    {v.version || (v.exteriorColor ? `Cor: ${v.exteriorColor}` : "Versão Oficial")}
                  </p>
                </div>
                {inStock && v.listPrice ? (
                  <span className="card-vehicle-price">{brl(v.listPrice)}</span>
                ) : (
                  <MercosulPlate plate={v.plate} />
                )}
              </div>

              <div className="card-vin-strip">
                <div className="card-vin-copy">
                  <small>IDENTIDADE DIGITAL (VIN)</small>
                  <code>{v.vin}</code>
                </div>
                <VinCopyButton vin={v.vin} />
              </div>

              <div className="card-specs-grid">
                <div className="card-spec-item">
                  <span>Odômetro</span>
                  <strong>{v.currentMileage.toLocaleString("pt-BR")} km</strong>
                </div>
                <div className="card-spec-item">
                  <span>Unidade</span>
                  <strong title={v.stockDealership?.tradeName ?? v.originDealership?.tradeName ?? "Rede Ford"}>
                    {v.stockDealership?.tradeName ?? v.originDealership?.tradeName ?? "Rede Ford"}
                  </strong>
                </div>
                <div className="card-spec-item">
                  <span>Câmbio</span>
                  <strong>{v.transmission ?? "Automático"}</strong>
                </div>
                <div className="card-spec-item">
                  <span>{inStock ? "Placa" : "Revisão / Status"}</span>
                  <strong>
                    {inStock ? (v.plate ?? "A emplacar") : (risk.next || "Em dia")}
                  </strong>
                </div>
              </div>

              <div className="card-vehicle-footer">
                <div className="card-owner-info">
                  {owner ? (
                    <>
                      <div className="card-owner-avatar">{ownerInitials}</div>
                      <div className="card-owner-text">
                        <span title={owner.fullName}>{owner.fullName}</span>
                        <small>Proprietário ativo</small>
                      </div>
                    </>
                  ) : (
                    <div className="card-owner-text">
                      <span style={{ color: "#0066d6" }}>Disponível no pátio</span>
                      <small>Pronto para venda</small>
                    </div>
                  )}
                </div>
                <Link className="btn-card-action" to={`/veiculos/${v.vin}`}>
                  Ver ficha <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function VehicleTable({
  compact = false,
  search = "",
  model = "",
  status = "",
  vehicles,
}: {
  compact?: boolean;
  search?: string;
  model?: string;
  status?: string;
  vehicles?: ApiVehicle[];
}) {
  const { data: fetched, loading } = useApiData<ApiVehicle[]>("/vehicles", []);
  const data = vehicles ?? fetched;
  const filtered = data.filter((vehicle) => {
    const owner = vehicle.ownerships?.[0]?.user.fullName ?? "";
    const haystack =
      `${vehicle.vin} ${vehicle.plate ?? ""} ${vehicle.model} ${vehicle.version ?? ""} ${vehicle.exteriorColor ?? ""} ${owner}`.toLocaleLowerCase(
        "pt-BR",
      );
    const matchesSearch =
      !search || haystack.includes(search.toLocaleLowerCase("pt-BR"));
    const matchesModel =
      !model ||
      vehicle.model
        .toLocaleLowerCase("pt-BR")
        .includes(model.toLocaleLowerCase("pt-BR"));
    const matchesStatus =
      !status ||
      (status === "stock" && vehicle.saleStatus === "IN_STOCK") ||
      (status === "reserved" && vehicle.saleStatus === "RESERVED") ||
      (status === "linked" && Boolean(vehicle.ownerships?.length)) ||
      (status === "new" && vehicle.condition === "NEW") ||
      (status === "used" && vehicle.condition === "USED") ||
      (status === "risk" && (riskFor(vehicle).tone === "red" || riskFor(vehicle).tone === "amber"));
    return matchesSearch && matchesModel && matchesStatus;
  });
  const list = compact
    ? filtered.filter((vehicle) => vehicle.ownerships?.length).slice(0, 4)
    : filtered;

  if (compact) {
    return (
      <div className="data-table">
        <div className="table-row table-head">
          <span>Veículo / VIN</span>
          <span>Configuração</span>
          <span>Preço / KM</span>
          <span>Vínculo</span>
          <span>Status</span>
          <span />
        </div>
        {loading && <div className="empty-row">Carregando veículos...</div>}
        {!loading && !list.length && (
          <div className="empty-row">Nenhum veículo encontrado para este perfil.</div>
        )}
        {list.map((v) => {
          const risk = riskFor(v);
          const owner = v.ownerships?.[0]?.user;
          const inStock = ["IN_STOCK", "RESERVED"].includes(v.saleStatus ?? "");
          const image = v.imageUrl ?? vehicleImageFor(v.model);
          return (
            <div className="table-row" key={v.vin}>
              <span className="vehicle-cell">
                <div className={`vehicle-thumb${image ? " has-photo" : ""}`}>
                  <CarFront size={20} />
                  {image && <img src={image} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                </div>
                <span>
                  <b>{v.model} {v.modelYear}</b>
                  <small>{v.vin}</small>
                </span>
              </span>
              <span>
                <b>{v.version ?? "Versão não informada"}</b>
                <small>{[v.exteriorColor, v.transmission].filter(Boolean).join(" · ") || "Configuração básica"}</small>
              </span>
              <span>
                <b>{inStock && v.listPrice ? brl(v.listPrice) : `${v.currentMileage.toLocaleString("pt-BR")} km`}</b>
                <small>{inStock ? `${v.currentMileage.toLocaleString("pt-BR")} km` : `atualizado em ${new Date(v.updatedAt).toLocaleDateString("pt-BR")}`}</small>
              </span>
              <span>
                <b>{owner?.fullName ?? "Ainda não vendido"}</b>
                <small>{v.stockDealership?.tradeName ?? v.originDealership?.tradeName ?? "Unidade não informada"}</small>
              </span>
              <span>
                {inStock ? (
                  <Badge tone={v.saleStatus === "RESERVED" ? "amber" : "blue"}>
                    {v.saleStatus === "RESERVED" ? "Reservado" : "Em estoque"}
                  </Badge>
                ) : (
                  <Badge tone={risk.tone}>{risk.label}</Badge>
                )}
              </span>
              <span>
                <Link className="row-action" to={`/veiculos/${v.vin}`}>
                  <ChevronRight size={17} />
                </Link>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="executive-table-container">
      <table className="executive-table">
        <thead>
          <tr>
            <th>Veículo &amp; VIN</th>
            <th>Placa Mercosul</th>
            <th>Versão &amp; Acabamento</th>
            <th>Odômetro / Preço</th>
            <th>Proprietário &amp; Unidade</th>
            <th>Status / Risco</th>
            <th style={{ textAlign: "right" }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                Carregando frota de veículos...
              </td>
            </tr>
          )}
          {!loading && !list.length && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                Nenhum veículo encontrado com os filtros selecionados.
              </td>
            </tr>
          )}
          {list.map((v) => {
            const risk = riskFor(v);
            const owner = v.ownerships?.[0]?.user;
            const inStock = ["IN_STOCK", "RESERVED"].includes(v.saleStatus ?? "");
            const image = v.imageUrl ?? vehicleImageFor(v.model);
            return (
              <tr key={v.vin}>
                <td>
                  <div className="table-vehicle-cell">
                    <div className="table-vehicle-thumb">
                      {image ? (
                        <img src={image} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <CarFront size={22} style={{ color: "#94a3b8" }} />
                      )}
                    </div>
                    <div className="table-vehicle-info">
                      <strong>{v.model} {v.modelYear}</strong>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                        <code>{v.vin}</code>
                        <VinCopyButton vin={v.vin} />
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <MercosulPlate plate={v.plate} />
                </td>
                <td>
                  <strong style={{ fontSize: "13px", color: "#1e293b", display: "block" }}>
                    {v.version ?? "Oficial"}
                  </strong>
                  <small style={{ color: "#64748b", fontSize: "11px" }}>
                    {[v.exteriorColor, v.transmission].filter(Boolean).join(" · ") || "Padrão"}
                  </small>
                </td>
                <td>
                  <strong style={{ fontSize: "13.5px", color: inStock ? "#0066d6" : "#0f172a", display: "block" }}>
                    {inStock && v.listPrice ? brl(v.listPrice) : `${v.currentMileage.toLocaleString("pt-BR")} km`}
                  </strong>
                  <small style={{ color: "#64748b", fontSize: "11px" }}>
                    {inStock ? `${v.currentMileage.toLocaleString("pt-BR")} km` : `revisão: ${risk.next}`}
                  </small>
                </td>
                <td>
                  <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                    {owner?.fullName ?? "Disponível no pátio"}
                  </strong>
                  <small style={{ color: "#64748b", fontSize: "11px" }}>
                    {v.stockDealership?.tradeName ?? v.originDealership?.tradeName ?? "Rede Ford"}
                  </small>
                </td>
                <td>
                  {inStock ? (
                    <Badge tone={v.saleStatus === "RESERVED" ? "amber" : "blue"}>
                      {v.saleStatus === "RESERVED" ? "Reservado" : "Em estoque"}
                    </Badge>
                  ) : (
                    <Badge tone={risk.tone}>{risk.label}</Badge>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link className="btn-card-action" to={`/veiculos/${v.vin}`}>
                    Abrir <ArrowUpRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Vehicles() {
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [model, setModel] = useState("");
  const [chipFilter, setChipFilter] = useState<"all" | "stock" | "linked" | "new" | "used" | "risk">("all");
  const [sortBy, setSortBy] = useState<"recent" | "mileage_asc" | "mileage_desc" | "year_desc">("recent");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const navigate = useNavigate();

  useEffect(() => setSearch(params.get("search") ?? ""), [params]);
  const { user } = useAuth();
  const { data } = useApiData<ApiVehicle[]>("/vehicles", []);

  const inStock = data.filter((v) => v.saleStatus === "IN_STOCK");
  const reserved = data.filter((v) => v.saleStatus === "RESERVED");
  const linked = data.filter((v) => Boolean(v.ownerships?.length));
  const atRisk = data.filter((v) => {
    const r = riskFor(v);
    return r.tone === "red" || r.tone === "amber";
  });
  const newVehicles = data.filter((v) => v.condition === "NEW");
  const inventoryValue = [...inStock, ...reserved].reduce(
    (sum, v) => sum + (v.listPrice ?? 0),
    0,
  );
  const linkRate = data.length > 0 ? Math.round((linked.length / data.length) * 100) : 0;

  // Filtragem
  const filteredVehicles = data.filter((v) => {
    const ownerName = v.ownerships?.[0]?.user?.fullName ?? "";
    const haystack = `${v.vin} ${v.plate ?? ""} ${v.model} ${v.version ?? ""} ${v.exteriorColor ?? ""} ${ownerName}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesModel = !model || v.model.toLowerCase().includes(model.toLowerCase());

    let matchesChip = true;
    if (chipFilter === "stock") matchesChip = ["IN_STOCK", "RESERVED"].includes(v.saleStatus ?? "");
    else if (chipFilter === "linked") matchesChip = Boolean(v.ownerships?.length);
    else if (chipFilter === "new") matchesChip = v.condition === "NEW";
    else if (chipFilter === "used") matchesChip = v.condition === "USED";
    else if (chipFilter === "risk") {
      const r = riskFor(v);
      matchesChip = r.tone === "red" || r.tone === "amber";
    }

    return matchesSearch && matchesModel && matchesChip;
  });

  // Ordenação
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    if (sortBy === "mileage_asc") return a.currentMileage - b.currentMileage;
    if (sortBy === "mileage_desc") return b.currentMileage - a.currentMileage;
    if (sortBy === "year_desc") return b.modelYear - a.modelYear;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Contagem por modelo Ford
  const fordModels = [
    "Ranger",
    "Maverick",
    "Territory",
    "Bronco Sport",
    "Mustang Mach-E",
    "F-150",
  ];

  return (
    <div className="vehicles-page-wrapper">
      {/* Cockpit Hero */}
      <section className="vehicles-hero-cockpit">
        <div className="vehicles-hero-content">
          <div className="vehicles-hero-header">
            <span className="ford-executive-tag">
              <Sparkles size={13} />
              ECOSSISTEMA FORD CONECTADO
            </span>
            <h1>Estoque por VIN</h1>
            <p>
              Consulte cada unidade física vinculada a uma versão, seu status de estoque,
              proprietário, odômetro e histórico de pós-venda.
            </p>
          </div>
          <div className="vehicles-hero-actions">
            {user?.role === "CUSTOMER" ? (
              <button
                type="button"
                className="btn-ford-primary"
                onClick={() => setCreating(true)}
              >
                <CarFront size={16} /> Vincular meu Ford
              </button>
            ) : (
              <Link to="/veiculos/novo" className="btn-ford-primary">
                <Plus size={16} /> Cadastrar modelo
              </Link>
            )}
            <button
              type="button"
              className="btn-ford-secondary"
              onClick={() => navigate("/estoque")}
            >
              <Store size={16} /> Estoque e vendas
            </button>
          </div>
        </div>

        {/* 4 KPIs Executivos */}
        <div className="vehicles-kpis-grid">
          <div className="kpi-card">
            <div className="kpi-icon-badge blue">
              <CarFront size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">FROTA TOTAL</span>
              <strong className="kpi-value">{data.length}</strong>
              <small className="kpi-subtext">
                {newVehicles.length} 0km · {data.length - newVehicles.length} seminovos
              </small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-badge dark-blue">
              <Store size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">ESTOQUE / SALÃO</span>
              <strong className="kpi-value">{inStock.length + reserved.length}</strong>
              <small className="kpi-subtext">
                {inventoryValue > 0 ? brl(inventoryValue) : "Patrimônio ativo"}
              </small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-badge green">
              <UsersRound size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">TAXA DE VÍNCULO</span>
              <strong className="kpi-value">{linkRate}%</strong>
              <small className="kpi-subtext">
                {linked.length} veículos associados a clientes
              </small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-badge red">
              <TriangleAlert size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">RADAR DE RETENÇÃO</span>
              <strong className="kpi-value">{atRisk.length}</strong>
              <small className="kpi-subtext">
                Oportunidades ou revisões vencidas
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* Barra de Ferramentas & Filtros */}
      <section className="vehicles-controls-section">
        <div className="vehicles-search-bar">
          <div className="search-input-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por placa (ex: BRA2E19), VIN, modelo, versão ou proprietário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          <div className="vehicles-select-group">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="model-select"
            >
              <option value="">Todos os modelos ({data.length})</option>
              {fordModels.map((m) => {
                const count = data.filter((v) =>
                  v.model.toLowerCase().includes(m.toLowerCase()),
                ).length;
                return (
                  <option key={m} value={m}>
                    {m} {count > 0 ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="recent">Mais recentes</option>
              <option value="mileage_asc">Menor KM</option>
              <option value="mileage_desc">Maior KM</option>
              <option value="year_desc">Mais novos (Ano)</option>
            </select>

            <div className="view-mode-toggle" role="group" aria-label="Modo de visualização">
              <button
                type="button"
                className={`view-btn${viewMode === "cards" ? " active" : ""}`}
                onClick={() => setViewMode("cards")}
                title="Visualização em Vitrine (Cards)"
              >
                <LayoutGrid size={17} />
                <span>Vitrine</span>
              </button>
              <button
                type="button"
                className={`view-btn${viewMode === "table" ? " active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Visualização em Tabela Executiva"
              >
                <List size={17} />
                <span>Tabela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chips de filtro rápido */}
        <div className="chips-filter-row">
          <button
            type="button"
            className={`chip-btn${chipFilter === "all" ? " active" : ""}`}
            onClick={() => setChipFilter("all")}
          >
            Todos <span className="chip-count">{data.length}</span>
          </button>
          <button
            type="button"
            className={`chip-btn${chipFilter === "stock" ? " active" : ""}`}
            onClick={() => setChipFilter("stock")}
          >
            Em estoque <span className="chip-count">{inStock.length + reserved.length}</span>
          </button>
          <button
            type="button"
            className={`chip-btn${chipFilter === "linked" ? " active" : ""}`}
            onClick={() => setChipFilter("linked")}
          >
            Vinculados a Clientes <span className="chip-count">{linked.length}</span>
          </button>
          <button
            type="button"
            className={`chip-btn${chipFilter === "new" ? " active" : ""}`}
            onClick={() => setChipFilter("new")}
          >
            0 KM <span className="chip-count">{newVehicles.length}</span>
          </button>
          <button
            type="button"
            className={`chip-btn${chipFilter === "used" ? " active" : ""}`}
            onClick={() => setChipFilter("used")}
          >
            Seminovos <span className="chip-count">{data.length - newVehicles.length}</span>
          </button>
          <button
            type="button"
            className={`chip-btn risk${chipFilter === "risk" ? " active" : ""}`}
            onClick={() => setChipFilter("risk")}
          >
            Atenção / Risco <span className="chip-count">{atRisk.length}</span>
          </button>

          {(search || model || chipFilter !== "all") && (
            <button
              type="button"
              className="chip-btn clear-all"
              onClick={() => {
                setSearch("");
                setModel("");
                setChipFilter("all");
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      {/* Resultados de contagem */}
      <div className="vehicles-results-meta">
        <span>
          Mostrando <strong>{sortedVehicles.length}</strong> de{" "}
          <strong>{data.length}</strong> veículos encontrados
        </span>
      </div>

      {/* Exibição do Grid ou Tabela */}
      {viewMode === "cards" ? (
        <VehicleCardGrid vehicles={sortedVehicles} />
      ) : (
        <VehicleTable vehicles={sortedVehicles} />
      )}

      {/* Dialog para vincular se for cliente */}
      {creating && user?.role === "CUSTOMER" && (
        <ClaimVehicleDialog onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function VehicleDetail() {
  const { vin = "" } = useParams();
  const { user } = useAuth();
  const [transferring, setTransferring] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [creatingRetention, setCreatingRetention] = useState(false);
  const fallback: ApiVehicleDetail = {
    vin,
    plate: null,
    model: "Carregando veículo",
    modelYear: 0,
    manufactureYear: 0,
    currentMileage: 0,
    updatedAt: new Date().toISOString(),
    serviceOrders: [],
    ownerships: [],
  };
  const { data: vehicle } = useApiData<ApiVehicleDetail>(
    `/vehicles/${encodeURIComponent(vin)}`,
    fallback,
  );
  const risk = riskFor(vehicle);
  const owner = vehicle.ownerships[0]?.user;
  const nextMileage = Math.ceil((vehicle.currentMileage + 1) / 10000) * 10000;
  const { data: prediction } = useApiData<ChurnPrediction>(
    `/predictions/vehicles/${encodeURIComponent(vin)}/churn`,
    { probability: 0, classification: "ACTIVE", model_version: "", source: "api-fallback" },
  );
  const score = Math.round(prediction.probability * 100);
  const vehicleImage = vehicle.imageUrl ?? vehicleImageFor(vehicle.model);
  const inStock = ["IN_STOCK", "RESERVED"].includes(vehicle.saleStatus ?? "");
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/veiculos">Veículos</Link>
        <ChevronRight size={13} />
        <span>{vehicle.model}</span>
      </div>
      <section className="vehicle-hero">
        <div className={`vehicle-illustration${vehicleImage ? " has-photo" : ""}`}>
          {vehicleImage ? (
            <>
              <CarFront size={76} />
              <span>FORD</span>
              <img src={vehicleImage} alt={`${vehicle.model} Ford`} decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} />
            </>
          ) : (
            <>
              <CarFront size={76} />
              <span>FORD</span>
            </>
          )}
        </div>
        <div className="vehicle-identity">
          <div>
            <Badge tone={inStock ? "blue" : risk.tone}>
              {inStock
                ? vehicle.saleStatus === "RESERVED"
                  ? "Reservado"
                  : "Em estoque"
                : risk.label}
            </Badge>
            <span className="verified">
              <ShieldCheck size={15} />
              VIN verificado
            </span>
          </div>
          <h1>
            {vehicle.model} {vehicle.modelYear || ""}
          </h1>
          <p>
            {vehicle.vin} · Placa {vehicle.plate ?? "não informada"}
          </p>
          <div className="vehicle-numbers">
            <span>
              <small>QUILOMETRAGEM</small>
              <b>{vehicle.currentMileage.toLocaleString("pt-BR")} km</b>
            </span>
            <span>
              <small>PRÓXIMA REVISÃO</small>
              <b>{nextMileage.toLocaleString("pt-BR")} km</b>
            </span>
            <span>
              <small>HISTÓRICO FORD</small>
              <b>
                {vehicle.serviceOrders.length}{" "}
                {vehicle.serviceOrders.length === 1 ? "serviço" : "serviços"}
              </b>
            </span>
            <span>
              <small>GARANTIA DE FÁBRICA</small>
              <b>
                {vehicle.warrantyUntil
                  ? new Date(vehicle.warrantyUntil) > new Date()
                    ? `até ${new Date(vehicle.warrantyUntil).toLocaleDateString("pt-BR")}`
                    : "Encerrada"
                  : "Não informada"}
              </b>
            </span>
          </div>
        </div>
        {inStock ? (
          <Link className="primary" to="/estoque">
            <CircleDollarSign size={17} />
            Ir para venda
          </Link>
        ) : (
          <button className="primary" onClick={() => setScheduling(true)}>
            <CalendarDays size={17} />
            Agendar serviço
          </button>
        )}
      </section>
      <section className="detail-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">HISTÓRICO CONTÍNUO</span>
              <h2>Linha do tempo do veículo</h2>
            </div>
          </div>
          <div className="timeline">
            {vehicle.serviceOrders.map((order, i) => (
              <div className="timeline-item" key={order.id}>
                <div
                  className={i === 0 ? "timeline-dot current" : "timeline-dot"}
                />
                <span>
                  {new Date(
                    order.completedAt ?? order.createdAt,
                  ).toLocaleDateString("pt-BR")}
                </span>
                <div>
                  <b>{order.description ?? "Serviço Ford"}</b>
                  <p>
                    {order.mileage.toLocaleString("pt-BR")} km ·{" "}
                    {order.status === "COMPLETED"
                      ? "Concluído"
                      : "Em atendimento"}
                  </p>
                </div>
                <ChevronRight size={16} />
              </div>
            ))}
            {!vehicle.serviceOrders.length && (
              <div className="empty-row">
                Nenhum serviço registrado para este VIN.
              </div>
            )}
          </div>
        </article>
        <aside className="side-stack">
          <article className="card owner-card">
            <span className="eyebrow">FICHA DESTA UNIDADE</span>
            <dl className="vehicle-specs">
              <div><dt>Versão</dt><dd>{vehicle.version ?? "Não informada"}</dd></div>
              <div><dt>Cor exterior</dt><dd>{vehicle.exteriorColor ?? "Não informada"}</dd></div>
              <div><dt>Interior</dt><dd>{vehicle.interiorColor ?? "Não informado"}</dd></div>
              <div><dt>Motor</dt><dd>{vehicle.engine ?? "Não informado"}</dd></div>
              <div><dt>Câmbio</dt><dd>{vehicle.transmission ?? "Não informado"}</dd></div>
              <div><dt>Tração</dt><dd>{vehicle.drive ?? "Não informada"}</dd></div>
              {inStock && <div><dt>Preço cadastrado</dt><dd>{vehicle.listPrice ? brl(vehicle.listPrice) : "—"}</dd></div>}
            </dl>
            {vehicle.features && <p className="vehicle-features">{vehicle.features}</p>}
          </article>
          <article className="card owner-card">
            <span className="eyebrow">PROPRIETÁRIO ATUAL</span>
            <div className="owner-info">
              <div className="avatar large">
                {owner?.fullName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("") ?? "—"}
              </div>
              <div>
                <b>{owner?.fullName ?? "Sem proprietário ativo"}</b>
                <p>Vínculo atual protegido por LGPD</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Telefone</dt>
                <dd>{owner?.phone ?? "Não informado"}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{owner?.email ?? "Não informado"}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>
                  {vehicle.originDealership?.tradeName ?? "Não informada"}
                </dd>
              </div>
            </dl>
            {user?.role !== "CUSTOMER" && !inStock && (
              <button
                className="secondary wide"
                onClick={() => setTransferring(true)}
              >
                Transferir proprietário
              </button>
            )}
          </article>
          {!inStock && <article className="card prediction-card">
            <div className="prediction-title">
              <Activity size={20} />
              <span>Risco de evasão</span>
              <strong>{score}%</strong>
            </div>
            <div className="progress">
              <i style={{ width: `${score}%` }} />
            </div>
            <p>
              {prediction.source === "ml-service"
                ? "Classificação pelo modelo analítico Python em execução."
                : "Estimativa baseada em recência, histórico e uso de benefícios (serviço de ML indisponível no momento)."}
            </p>
            <button
              className="primary wide"
              onClick={() => setCreatingRetention(true)}
            >
              Criar ação de retenção
            </button>
          </article>}
        </aside>
      </section>
      {transferring && (
        <TransferVehicleDialog
          vin={vehicle.vin}
          onClose={() => setTransferring(false)}
        />
      )}
      {scheduling && (
        <CreateBookingDialog
          initialVin={vehicle.vin}
          onClose={() => setScheduling(false)}
        />
      )}
      {creatingRetention && (
        <CreateCampaignDialog
          initialVins={[vehicle.vin]}
          onClose={() => setCreatingRetention(false)}
        />
      )}
    </>
  );
}

function Customers() {
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const { data: users } = useApiData<ApiUser[]>("/users", []);
  const { data: predictions } = useApiData<
    Array<{ userId?: string; probability: number }>
  >("/predictions/customers/churn", []);
  const { data: campaignHistory } = useApiData<ApiCampaign[]>("/campaigns", []);
  const customers = users.filter((user) => user.role === "CUSTOMER");
  const retentionCustomers = customers.filter((user) => user.ownerships.length > 0);
  const conversionOpportunities = customers
    .filter((user) => user.ownerships.length === 0)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const classified = retentionCustomers
    .map((user) => {
      const vehicle = user.ownerships[0].vehicle;
      const risk = riskFor(vehicle);
      const predicted = predictions.find((item) => item.userId === user.id);
      const score = predicted
        ? Math.round(predicted.probability * 100)
        : 0;
      return { user, vehicle, risk, score };
    })
    .sort((a, b) => b.score - a.score);
  const counts = {
    green: classified.filter((x) => x.risk.tone === "green").length,
    amber: classified.filter((x) => x.risk.tone === "amber").length,
    red: classified.filter((x) => x.risk.tone === "red").length,
    slate: classified.filter((x) => x.risk.tone === "slate").length,
  };
  const total = Math.max(1, retentionCustomers.length);
  const segments = [
    ["Ativos", counts.green, "green"],
    ["Atenção", counts.amber, "amber"],
    ["Em risco", counts.red, "red"],
    ["Perdidos", counts.slate, "slate"],
  ] as const;
  const priorityVins = classified
    .filter((item) => ["red", "slate"].includes(item.risk.tone))
    .flatMap((item) => (item.vehicle ? [item.vehicle.vin] : []));
  // Projeção baseada na conversão histórica das campanhas já disparadas.
  const estimatedConversion = (() => {
    const targets = campaignHistory.flatMap((campaign) => campaign.targets);
    const sent = targets.filter((target) => target.sentAt).length;
    if (!sent) return "—";
    const converted = targets.filter((target) => target.convertedAt).length;
    return `${(Math.round((converted / sent) * 1000) / 10)
      .toString()
      .replace(".", ",")}%`;
  })();
  function exportPriorityList() {
    downloadCsv(
      `clientes-prioritarios-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["CLIENTE", "E-MAIL", "TELEFONE", "VEÍCULO", "VIN", "RISCO", "CLASSIFICAÇÃO"],
        ...classified.map(({ user, vehicle, risk, score }) => [
          user.fullName,
          user.email,
          user.phone ?? "",
          vehicle.model,
          vehicle.vin,
          `${score}%`,
          risk.label,
        ]),
      ],
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="RELACIONAMENTO"
        title="Retenção de clientes"
        description="Acompanhe somente clientes com veículo vinculado e priorize quem precisa retornar à rede."
        action={
          <button
            className="primary"
            onClick={exportPriorityList}
            disabled={!classified.length}
          >
            <Sparkles size={17} />
            Gerar lista inteligente
          </button>
        }
      />
      <section className="segment-grid">
        {segments.map(([name, count, tone]) => (
          <article className="segment-card" key={name}>
            <Badge tone={tone}>{name}</Badge>
            <strong>{count}</strong>
            <span>{Math.round((count / total) * 1000) / 10}% da carteira</span>
            <div className={`segment-line line-${tone}`} />
          </article>
        ))}
      </section>
      <section className="two-column">
        <article className="card list-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">ALTA PRIORIDADE</span>
              <h2>Clientes para recuperar</h2>
              <p>Somente clientes com veículo ativo, ordenados por risco.</p>
            </div>
            <select>
              <option>Maior risco</option>
            </select>
          </div>
          <div className="customer-list">
            {classified.map(({ user, vehicle, risk, score }) => (
              <div className="customer-row" key={user.id}>
                <div className="avatar soft">
                  {user.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <Link className="customer-name" to={`/clientes/${user.id}`}>
                    {user.fullName}
                  </Link>
                  <p>
                    {vehicle.model} · {vehicle.currentMileage.toLocaleString("pt-BR")} km
                  </p>
                </div>
                <div className="score">
                  <small>RISCO</small>
                  <strong>{score}%</strong>
                </div>
                <Badge tone={risk.tone}>{risk.label}</Badge>
                <Link className="icon-button" to={`/veiculos/${vehicle.vin}`}>
                  <ChevronRight size={17} />
                </Link>
              </div>
            ))}
            {!classified.length && (
              <div className="retention-empty">
                <span><ShieldCheck size={20} /></span>
                <div>
                  <b>Nenhum cliente com veículo para classificar</b>
                  <p>O risco começa a ser acompanhado somente depois que um VIN é vinculado ao cliente.</p>
                </div>
              </div>
            )}
          </div>
        </article>
        <article className="card action-panel">
          <span className="eyebrow">AÇÃO RECOMENDADA</span>
          <div className="action-visual">
            <Target size={32} />
          </div>
          <h2>Campanha Retorno Seguro</h2>
          <p>
            Crie uma abordagem personalizada para os {counts.red + counts.slate}{" "}
            clientes que exigem atenção imediata.
          </p>
          <div className="forecast">
            <span>
              <small>PÚBLICO</small>
              <b>
                {counts.red + counts.slate}{" "}
                {counts.red + counts.slate === 1 ? "cliente" : "clientes"}
              </b>
            </span>
            <span>
              <small>CONVERSÃO EST.</small>
              <b>{estimatedConversion}</b>
            </span>
          </div>
          <button
            className="primary wide"
            onClick={() => setCreatingCampaign(true)}
            disabled={!priorityVins.length}
          >
            Preparar campanha
          </button>
          <button
            className="text-button"
            onClick={() => setShowCriteria((visible) => !visible)}
          >
            {showCriteria ? "Ocultar critérios" : "Ver critérios da recomendação"}
          </button>
          {showCriteria && (
            <div className="criteria-note">
              Priorizamos clientes classificados como em risco ou perdidos,
              considerando quilometragem, idade do veículo e recência do último
              serviço registrado na rede Ford. Cadastros sem veículo nunca entram
              nesta classificação.
            </div>
          )}
        </article>
      </section>
      <section className="card conversion-card">
        <div className="conversion-heading">
          <div>
            <span className="eyebrow">FUNIL COMERCIAL</span>
            <h2>Oportunidades de conversão</h2>
            <p>Clientes cadastrados que ainda não possuem um veículo vinculado.</p>
          </div>
          <div className="conversion-total">
            <span>SEM COMPRA</span>
            <strong>{conversionOpportunities.length}</strong>
          </div>
        </div>
        <div className="conversion-flow" aria-label="Etapas sugeridas do atendimento comercial">
          <div className="active"><small>1</small><span><b>Cadastro recebido</b><em>Confirmar interesse</em></span></div>
          <ChevronRight size={16} />
          <div><small>2</small><span><b>Orçamento enviado</b><em>Registrar modelo e valor</em></span></div>
          <ChevronRight size={16} />
          <div><small>3</small><span><b>Retorno agendado</b><em>Definir dia e canal</em></span></div>
          <ChevronRight size={16} />
          <div><small>4</small><span><b>Venda concluída</b><em>Vincular o VIN</em></span></div>
        </div>
        <div className="conversion-list">
          {conversionOpportunities.map((customer) => {
            const daysSinceRegistration = Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(customer.createdAt).getTime()) / 86_400_000,
              ),
            );
            return (
              <article className="conversion-row" key={customer.id}>
                <div className="avatar soft">
                  {customer.fullName
                    .split(" ")
                    .map((name) => name[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="conversion-person">
                  <Link className="customer-name" to={`/clientes/${customer.id}`}>
                    {customer.fullName}
                  </Link>
                  <p>{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
                </div>
                <div className="conversion-age">
                  <small>CADASTRADO HÁ</small>
                  <b>{daysSinceRegistration === 0 ? "Hoje" : `${daysSinceRegistration} dia${daysSinceRegistration === 1 ? "" : "s"}`}</b>
                </div>
                <Badge tone="blue">Contato novo</Badge>
                <Link className="secondary conversion-action" to={`/clientes/${customer.id}`}>
                  <MessageCircleMore size={14} />
                  Retomar atendimento
                </Link>
              </article>
            );
          })}
          {!conversionOpportunities.length && (
            <div className="retention-empty compact">
              <span><CheckCircle2 size={20} /></span>
              <div>
                <b>Nenhuma oportunidade pendente</b>
                <p>Todos os clientes cadastrados já possuem um veículo vinculado.</p>
              </div>
            </div>
          )}
        </div>
        <div className="conversion-guidance">
          <Target size={18} />
          <p><b>Como trazer esse cliente de volta:</b> registre o modelo desejado, o valor do orçamento, o motivo da pausa e a data do próximo contato. Assim ele deixa de ser apenas um cadastro e passa a ter uma oportunidade comercial acompanhável.</p>
        </div>
      </section>
      {creatingCampaign && (
        <CreateCampaignDialog
          initialVins={priorityVins}
          onClose={() => setCreatingCampaign(false)}
        />
      )}
    </>
  );
}

function Services() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [creating, setCreating] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const { data: orders, loading } = useApiData<ApiOrder[]>(
    "/service-orders",
    [],
  );
  const statusLabel: Record<string, [string, Tone]> = {
    OPEN: ["Aberta", "amber"],
    IN_PROGRESS: ["Em andamento", "blue"],
    COMPLETED: ["Concluída", "green"],
    CANCELLED: ["Cancelada", "slate"],
  };
  const active = orders.filter((order) =>
    ["OPEN", "IN_PROGRESS"].includes(order.status),
  ).length;
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const filteredOrders = orders.filter((order) => (!statusFilter || order.status === statusFilter) &&
    [order.id, order.description, order.vehicle.vin, order.vehicle.plate, order.vehicle.model, order.vehicle.ownerships?.[0]?.user.fullName]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedSearch)))
    .sort((a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * (sortOrder === 'oldest' ? 1 : -1));
  return (
    <>
      <PageHeader
        eyebrow="OFICINA"
        title="Ordens de serviço"
        description="Acompanhe cada atendimento do check-in à geração de pontos."
        action={
          <button className="primary" onClick={() => setCreating(true)}>
            <Wrench size={17} />
            Nova ordem de serviço
          </button>
        }
      />
      <section className="stats-grid">
        <StatCard
          icon={Clock3}
          label="Em atendimento"
          value={String(active)}
          change="Ordens abertas ou em andamento"
        />
        <StatCard
          icon={CalendarDays}
          label="Total de ordens"
          value={String(orders.length)}
          change="Na carteira acessível"
          tone="green"
        />
        <StatCard
          icon={Wrench}
          label="Concluídas"
          value={String(orders.filter((o) => o.status === "COMPLETED").length)}
          change="Histórico preservado pelo VIN"
          tone="amber"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Quilometragem média"
          value={
            orders.length
              ? `${Math.round(orders.reduce((sum, o) => sum + o.mileage, 0) / orders.length).toLocaleString("pt-BR")} km`
              : "0 km"
          }
          change="Atualizada pelas ordens"
          tone="violet"
        />
      </section>
      <section className="card list-card">
        <div className="toolbar">
          <div className="local-search">
            <Search size={17} />
            <input aria-label="Buscar ordens de serviço" placeholder="Buscar ordem, VIN ou cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select aria-label="Status da ordem" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(statusLabel).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select aria-label="Ordenar ordens" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </div>
        <div className="service-board">
          {loading && <div className="empty-row">Carregando ordens...</div>}
          {!loading && !filteredOrders.length && <div className="empty-row"><Search size={24} /><p>Nenhuma ordem encontrada para estes filtros.</p><button className="secondary" onClick={() => { setSearch(''); setStatusFilter(''); }}>Limpar filtros</button></div>}
          {filteredOrders.map((order) => {
            const [status, tone] = statusLabel[order.status] ?? [
              order.status,
              "slate",
            ];
            return (
              <article key={order.id}>
                <div className="order-top">
                  <b>{order.id.replace("seed-os-", "OS-")}</b>
                  <Badge tone={tone}>{status}</Badge>
                </div>
                <h3>{order.description ?? "Atendimento Ford"}</h3>
                <p>
                  <CarFront size={15} />
                  {order.vehicle.model} · {order.vehicle.vin}
                </p>
                <p>
                  <UserRound size={15} />
                  {order.vehicle.ownerships?.[0]?.user.fullName ??
                    "Sem proprietário ativo"}
                </p>
                <div>
                  <Clock3 size={15} />
                  <span>
                    {new Date(order.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <button onClick={() => setSelectedOrder(order)}>
                    {order.status === "COMPLETED"
                      ? "Ver histórico"
                      : "Gerenciar OS"}{" "}
                    <ChevronRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {creating && <CreateOrderDialog onClose={() => setCreating(false)} />}
      {selectedOrder && (
        <ManageOrderDialog
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}

function Appointments() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ApiBooking | null>(
    null,
  );
  const [editingSchedule, setEditingSchedule] =
    useState<ApiDealership | null>(null);
  const initialDay = new Date();
  initialDay.setHours(0, 0, 0, 0);
  const [calendarStart, setCalendarStart] = useState(initialDay);
  const [selectedDate, setSelectedDate] = useState(initialDay);
  const { data: bookings } = useApiData<ApiBooking[]>("/bookings", []);
  const { data: dealerships } = useApiData<ApiDealership[]>("/dealerships", []);
  const currentDealership =
    dealerships.find((item) => item.id === user?.dealershipId) ??
    dealerships.find((item) =>
      bookings.some((booking) => booking.dealership.tradeName === item.tradeName),
    ) ??
    dealerships[0];
  const calendarDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(day.getDate() + index);
    return day;
  });
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  const selectedBookings = bookings.filter(
    (booking) =>
      sameDay(new Date(booking.requestedFor), selectedDate) &&
      (!currentDealership ||
        booking.dealership.tradeName === currentDealership.tradeName),
  );
  const labels: Record<string, [string, Tone]> = {
    REQUESTED: ["A confirmar", "amber"],
    CONFIRMED: ["Confirmado", "green"],
    COMPLETED: ["Concluído", "blue"],
    CANCELLED: ["Cancelado", "slate"],
  };
  const confirmed = selectedBookings.filter(
    (item) => item.status === "CONFIRMED",
  ).length;
  const requested = selectedBookings.filter(
    (item) => item.status === "REQUESTED",
  ).length;
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const isBusinessDay = Boolean(
    currentDealership?.businessDays.includes(selectedDate.getDay()),
  );
  const dailyCapacity = currentDealership && isBusinessDay
    ? Math.floor(
        (toMinutes(currentDealership.closingTime) -
          toMinutes(currentDealership.openingTime)) /
          currentDealership.slotDurationMinutes,
      ) * currentDealership.simultaneousCapacity
    : 0;
  const occupied = selectedBookings.filter(
    (item) => item.status !== "CANCELLED",
  ).length;
  const occupancy = Math.min(
    100,
    dailyCapacity ? Math.round((occupied / dailyCapacity) * 100) : 0,
  );
  const moveCalendar = (days: number) => {
    const next = new Date(calendarStart);
    next.setDate(next.getDate() + days);
    setCalendarStart(next);
    setSelectedDate(next);
  };
  const canManageSchedule =
    user?.role === "DEALERSHIP_MANAGER" || user?.role === "FORD_ADMIN";
  return (
    <>
      <PageHeader
        eyebrow="AGENDA DA OFICINA"
        title="Agendamentos"
        description="Organize a capacidade da oficina e reduza faltas."
        action={
          <button className="primary" onClick={() => setCreating(true)}>
            <CalendarDays size={17} />
            Novo agendamento
          </button>
        }
      />
      <div className="calendar-strip">
        <button aria-label="Semana anterior" onClick={() => moveCalendar(-7)}>
          ‹
        </button>
        {calendarDays.map((day) => (
          <button
            type="button"
            className={`calendar-day ${sameDay(day, selectedDate) ? "selected" : ""}`}
            key={day.toISOString()}
            onClick={() => setSelectedDate(day)}
          >
            <span>
              {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
            </span>
            <strong>{String(day.getDate()).padStart(2, "0")}</strong>
          </button>
        ))}
        <button aria-label="Próxima semana" onClick={() => moveCalendar(7)}>
          ›
        </button>
      </div>
      <section className="two-column schedule-layout">
        <article className="card schedule">
          <div className="card-heading">
            <div>
              <span className="eyebrow">AGENDA</span>
              <h2>
                Atendimentos de {selectedDate.toLocaleDateString("pt-BR")}
              </h2>
            </div>
            <Badge tone="blue">
              {selectedBookings.length}{" "}
              {selectedBookings.length === 1 ? "agendamento" : "agendamentos"}
            </Badge>
          </div>
          {selectedBookings.map((item) => {
            const date = new Date(item.requestedFor);
            const [status, tone] = labels[item.status] ?? [
              item.status,
              "slate",
            ];
            return (
              <div className="schedule-row" key={item.id}>
                <time>
                  {date.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <div className="schedule-line" />
                <div className="schedule-info">
                  <div>
                    <b>{item.user.fullName}</b>
                    <Badge tone={tone}>{status}</Badge>
                  </div>
                  <p>
                    {item.vehicle.model} · {item.notes ?? "Serviço agendado"} ·{" "}
                    {date.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Gerenciar agendamento de ${item.user.fullName}`}
                  onClick={() => setSelectedBooking(item)}
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            );
          })}
          {!selectedBookings.length && (
            <div className="empty-row">
              {isBusinessDay
                ? "Nenhum atendimento agendado para este dia."
                : "A oficina não atende neste dia."}
            </div>
          )}
        </article>
        <article className="card capacity">
          <span className="eyebrow">CAPACIDADE</span>
          <h2>{currentDealership?.tradeName ?? "Ocupação da oficina"}</h2>
          <p className="capacity-policy">
            {currentDealership
              ? `${currentDealership.openingTime}–${currentDealership.closingTime} · ${currentDealership.slotDurationMinutes} min · ${currentDealership.simultaneousCapacity} simultâneos`
              : "Selecione uma concessionária"}
          </p>
          <div
            className="capacity-ring"
            style={{
              background: `conic-gradient(#1682c7 0 ${occupancy}%, #e7edf2 ${occupancy}% 100%)`,
            }}
          >
            <div>
              <strong>{occupancy}%</strong>
              <span>ocupada</span>
            </div>
          </div>
          <div className="capacity-items">
            <span>
              <i className="c-blue" />
              Confirmados <b>{confirmed}</b>
            </span>
            <span>
              <i className="c-amber" />A confirmar <b>{requested}</b>
            </span>
            <span>
              <i className="c-slate" />
              Vagas livres <b>{Math.max(0, dailyCapacity - occupied)}</b>
            </span>
          </div>
          {canManageSchedule && currentDealership && (
            <button
              className="secondary wide"
              onClick={() => setEditingSchedule(currentDealership)}
            >
              Ajustar capacidade
            </button>
          )}
        </article>
      </section>
      {creating && <CreateBookingDialog onClose={() => setCreating(false)} />}
      {selectedBooking && (
        <ManageBookingDialog
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
      {editingSchedule && (
        <EditDealershipDialog
          dealership={editingSchedule}
          onClose={() => setEditingSchedule(null)}
        />
      )}
    </>
  );
}

function Campaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedVin = searchParams.get("vin") ?? "";
  const comesFromApprovedRecommendation = searchParams.get("governed") === "1";
  const recommendationModelVersion = searchParams.get("modelVersion");
  const reminderModel = searchParams.get("reminderModel");
  const [creating, setCreating] = useState(Boolean(preselectedVin));
  const { data: campaigns } = useApiData<ExtendedCampaign[]>("/campaigns", []);

  async function dispatchCampaign(id: string) {
    await api(`/campaigns/${id}/dispatch`, { method: "POST" });
    notifyDataChanged();
  }

  function closeCampaignDialog() {
    setCreating(false);
    if (searchParams.has("vin") || searchParams.has("governed")) {
      const next = new URLSearchParams(searchParams);
      next.delete("vin");
      next.delete("governed");
      next.delete("modelVersion");
      next.delete("reminderModel");
      setSearchParams(next, { replace: true });
    }
  }

  return (
    <>
      <CampaignsManager
        campaigns={campaigns}
        onDispatch={dispatchCampaign}
        onOpenCreate={() => setCreating(true)}
      />
      {creating && (
        <EnhancedCreateCampaignDialog
          initialVins={preselectedVin ? [preselectedVin] : []}
          recommendationVins={comesFromApprovedRecommendation && preselectedVin ? [preselectedVin] : []}
          recommendationModelVersion={comesFromApprovedRecommendation ? recommendationModelVersion : null}
          reminderModel={comesFromApprovedRecommendation ? reminderModel : null}
          onClose={closeCampaignDialog}
          onCreated={() => notifyDataChanged()}
        />
      )}
    </>
  );
}

function Loyalty() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const customerMode = user?.role === "CUSTOMER";
  const { data: raw } = useApiData<LoyaltySummary | LoyaltyAccount>(
    customerMode ? "/loyalty/me" : "/loyalty/summary",
    {
      accounts: 0,
      balance: 0,
      generated: 0,
      redeemed: 0,
      availableVouchers: 0,
      benefits: [],
    },
  );
  const data: LoyaltySummary =
    "transactions" in raw
      ? {
          accounts: 1,
          balance: raw.balance,
          generated: raw.transactions
            .filter((item) => item.amount > 0)
            .reduce((sum, item) => sum + item.amount, 0),
          redeemed: Math.abs(
            raw.transactions
              .filter((item) => item.amount < 0)
              .reduce((sum, item) => sum + item.amount, 0),
          ),
          availableVouchers: raw.vouchers.filter(
            (item) => item.status === "AVAILABLE",
          ).length,
          benefits: raw.vouchers.map((item) => ({
            title: item.title,
            redemptions: 1,
            points: item.pointsCost,
            code: item.code,
            status: item.status,
          })),
        }
      : raw;
  const benefits = data.benefits.length
    ? data.benefits
    : [{ title: "Nenhum benefício emitido", redemptions: 0, points: 0 }];
  async function redeem(code: string) {
    await api(`/loyalty/vouchers/${encodeURIComponent(code)}/redeem`, {
      method: "POST",
    });
    notifyDataChanged();
  }
  return (
    <>
      <PageHeader
        eyebrow="FORD POINTS"
        title="Fidelidade e benefícios"
        description="Transforme cada serviço em uma razão para o cliente voltar."
        action={
          customerMode ? undefined : (
            <button className="primary" onClick={() => setCreating(true)}>
              <Gift size={17} />
              Criar benefício
            </button>
          )
        }
      />
      <section className="loyalty-hero">
        <div>
          <span>FORD POINTS NA REDE</span>
          <h2>{data.balance.toLocaleString("pt-BR")}</h2>
          <p>pontos disponíveis</p>
          <Badge tone="green">
            {data.accounts} {data.accounts === 1 ? "conta ativa" : "contas ativas"}
          </Badge>
        </div>
        <div className="loyalty-art">
          <Gift size={72} />
          <span>360</span>
        </div>
        <div>
          <span>BENEFÍCIOS DISPONÍVEIS</span>
          <h2>{data.availableVouchers}</h2>
          <p>vouchers prontos para uso</p>
          <Badge tone="blue">Atualização em tempo real</Badge>
        </div>
      </section>
      <section className="two-column">
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">CATÁLOGO</span>
              <h2>Benefícios emitidos</h2>
            </div>
            {!customerMode && (
              <button className="text-button" onClick={() => setCreating(true)}>
                Gerenciar
              </button>
            )}
          </div>
          <div className="benefit-list">
            {benefits.map((benefit, i) => (
              <div key={`${benefit.title}-${benefit.code ?? i}`}>
                <div
                  className={`benefit-icon icon-${["blue", "violet", "green", "amber"][i % 4]}`}
                >
                  <Gift size={18} />
                </div>
                <span>
                  <b>{benefit.title}</b>
                  <small>
                    {benefit.redemptions}{" "}
                    {benefit.redemptions === 1 ? "emissão" : "emissões"}
                  </small>
                </span>
                <strong>{benefit.points.toLocaleString("pt-BR")} pts</strong>
                {customerMode &&
                benefit.code &&
                benefit.status === "AVAILABLE" ? (
                  <button
                    className="inline-action"
                    onClick={() => void redeem(benefit.code!)}
                  >
                    Resgatar
                  </button>
                ) : (
                  <ChevronRight size={16} />
                )}
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">MOVIMENTAÇÃO</span>
              <h2>Saldo e movimentações</h2>
            </div>
          </div>
          <div className="points-chart">
            {[36, 48, 45, 62, 72, 88].map((h, i) => (
              <div key={i}>
                <b style={{ height: `${h}%` }} />
                <span>{["Abr", "Mai", "Jun", "Jul", "Ago", "Set"][i]}</span>
              </div>
            ))}
          </div>
          <div className="points-summary">
            <span>
              <small>GERADOS</small>
              <b>{data.generated.toLocaleString("pt-BR")}</b>
            </span>
            <span>
              <small>RESGATADOS</small>
              <b>{data.redeemed.toLocaleString("pt-BR")}</b>
            </span>
            <span>
              <small>SALDO</small>
              <b>{data.balance.toLocaleString("pt-BR")}</b>
            </span>
          </div>
        </article>
      </section>
      {creating && <CreateVoucherDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function desiredModelFromLead(notes: string | null) {
  return notes?.match(/Modelo desejado:\s*([^.]+)/i)?.[1]?.trim() ?? "Novo Ford";
}

function Repurchase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: opportunities } = useApiData<RepurchaseOpportunity[]>(
    "/dashboard/repurchase",
    [],
  );
  const { data: leads } = useApiData<ApiRepurchaseLead[]>(
    "/repurchase-leads",
    [],
  );
  const [creating, setCreating] = useState<RepurchaseOpportunity | null>(null);
  const [managing, setManaging] = useState<ApiRepurchaseLead | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const high = opportunities.filter((item) => item.score >= 70);
  const portfolio = opportunities.reduce(
    (sum, item) => sum + item.estimatedValue,
    0,
  );
  const openLeads = leads.filter(
    (lead) => !["WON", "LOST"].includes(lead.status),
  );
  const appLeads = leads.filter((lead) =>
    lead.notes?.includes("Interesse declarado pelo cliente no app"),
  );
  const leadByVin = new Map(leads.map((lead) => [lead.vehicle.vin, lead]));
  useEffect(() => {
    const requestedLeadId = searchParams.get("lead");
    if (!requestedLeadId) return;
    const requestedLead = leads.find((lead) => lead.id === requestedLeadId);
    if (requestedLead) setManaging(requestedLead);
  }, [leads, searchParams]);
  return (
    <>
      <PageHeader
        eyebrow="JORNADA DE TROCA"
        title="Interesses de troca"
        description="Veja quem demonstrou no app que pretende trocar de veículo e acompanhe o atendimento comercial."
        action={
          <button className="secondary" onClick={() => setShowAnalysis((value) => !value)}>
            <ChartNoAxesCombined size={17} />
            {showAnalysis ? "Ocultar análise completa" : "Ver análise completa"}
          </button>
        }
      />
      <section className="card repurchase-presentation-flow">
        <div className="card-heading">
          <div>
            <span className="eyebrow">PASSO A PASSO</span>
            <h2>Como o sistema transforma intenção em oportunidade</h2>
            <p>Quatro etapas para explicar a jornada completa.</p>
          </div>
        </div>
        <div className="repurchase-flow-grid">
          <article><span><MonitorSmartphone size={20} /></span><small>1</small><b>Cliente sinaliza</b><p>No app, escolhe o próximo Ford e toca em “Tenho interesse”.</p></article>
          <article><span><Sparkles size={20} /></span><small>2</small><b>Sistema prioriza</b><p>Interesse declarado recebe prioridade máxima; o Python complementa o risco de evasão.</p></article>
          <article><span><Bell size={20} /></span><small>3</small><b>Equipe recebe</b><p>Consultores, gerentes e Ford são avisados no painel.</p></article>
          <article><span><UsersRound size={20} /></span><small>4</small><b>Vendedor acompanha</b><p>O lead abre com cliente, carro atual, desejo e histórico do atendimento.</p></article>
        </div>
      </section>

      <section className="card list-card app-interest-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">ENTRADA PELO APLICATIVO</span>
            <h2>{appLeads.length} {appLeads.length === 1 ? "cliente demonstrou" : "clientes demonstraram"} interesse</h2>
            <p>Somente sinais explícitos enviados pelo cliente aparecem nesta visão.</p>
          </div>
          <Badge tone="green">Python online</Badge>
        </div>
        {appLeads.map((lead) => {
          const image = lead.vehicle.imageUrl ?? vehicleImageFor(lead.vehicle.model);

          return (
            <article className="app-interest-row" key={lead.id}>
              <span className="app-interest-score"><strong>{lead.score}</strong><small>prioridade</small></span>
              <span className={`repurchase-vehicle-photo${image ? " has-photo" : ""}`}>
                <span>FORD</span>
                <CarFront size={25} />
                {image && (
                  <img
                    src={image}
                    alt={`${lead.vehicle.model} ${lead.vehicle.modelYear}`}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </span>
              <div><small>CLIENTE</small><b>{lead.owner?.fullName ?? "Cliente Ford"}</b><p>{lead.owner?.phone ?? lead.owner?.email}</p></div>
              <div><small>QUER CONHECER</small><b>{desiredModelFromLead(lead.notes)}</b><p>Possível troca: {lead.vehicle.model} {lead.vehicle.modelYear}</p></div>
              <div><small>ORIGEM</small><b>{lead.dealership.tradeName}</b><p>{lead.dealership.city} · {lead.dealership.state}</p></div>
              <button className="primary" onClick={() => setManaging(lead)}>Abrir atendimento <ChevronRight size={15} /></button>
            </article>
          );
        })}
        {!appLeads.length && <div className="empty-row">Nenhum interesse enviado pelo app. Use “Tenho interesse” para iniciar a demonstração.</div>}
      </section>

      {showAnalysis && (
        <>
      <section className="stats-grid repurchase-analysis">
        <StatCard
          icon={TrendingUp}
          label="Alta propensão"
          value={String(high.length)}
          change="Score igual ou superior a 70%"
          tone="green"
        />
        <StatCard
          icon={CarFront}
          label="Valor da carteira"
          value={portfolio.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })}
          change="Valor estimado dos usados"
        />
        <StatCard
          icon={Store}
          label="Leads em andamento"
          value={String(openLeads.length)}
          change="Com acompanhamento comercial"
          tone="violet"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Histórico completo"
          value={String(
            opportunities.filter((item) => item.completedServices > 0).length,
          )}
          change="Com serviços registrados"
          tone="amber"
        />
      </section>
      <section className="card list-card repurchase-analysis">
        <div className="card-heading">
          <div>
            <span className="eyebrow">MELHORES OPORTUNIDADES</span>
            <h2>Clientes prontos para trocar</h2>
            <p>
              Score combina idade, quilometragem, histórico e comportamento.
            </p>
          </div>
          <select>
            <option>Maior probabilidade</option>
          </select>
        </div>
        {opportunities.map((item) => {
          const lead = leadByVin.get(item.vin);
          const image = item.imageUrl ?? vehicleImageFor(item.model);
          return (
            <div
              className={`repurchase-row ${lead ? "has-lead" : ""}`}
              key={item.vin}
            >
              <div className="propensity">
                <strong>{item.score}%</strong>
                <small>propensão</small>
              </div>
              <div className={`repurchase-vehicle-photo compact${image ? " has-photo" : ""}`}>
                <span>FORD</span>
                <CarFront size={26} />
                {image && (
                  <img
                    src={image}
                    alt={`${item.model} ${item.modelYear}`}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </div>
              <div>
                <b>
                  {item.model} {item.modelYear}
                </b>
                <p>
                  {item.currentMileage.toLocaleString("pt-BR")} km ·{" "}
                  {item.completedServices}{" "}
                  {item.completedServices === 1 ? "serviço" : "serviços"} Ford
                </p>
              </div>
              <div>
                <small>PROPRIETÁRIO</small>
                <b>{item.owner?.fullName ?? "Sem vínculo ativo"}</b>
              </div>
              <div>
                <small>VALOR ESTIMADO</small>
                <b>
                  {item.estimatedValue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })}
                </b>
              </div>
              <button
                className={lead ? "lead-stage-button" : "secondary"}
                onClick={() => (lead ? setManaging(lead) : setCreating(item))}
              >
                {lead ? leadStatusLabels[lead.status] : "Criar lead"}
              </button>
            </div>
          );
        })}
        {!opportunities.length && (
          <div className="empty-row">Nenhuma oportunidade calculada.</div>
        )}
      </section>
        </>
      )}
      {creating && (
        <CreateRepurchaseLeadDialog
          opportunity={creating}
          onClose={() => setCreating(null)}
        />
      )}
      {managing && (
        <ManageRepurchaseLeadDialog
          lead={managing}
          onClose={() => {
            setManaging(null);
            if (searchParams.has("lead")) {
              const next = new URLSearchParams(searchParams);
              next.delete("lead");
              setSearchParams(next, { replace: true });
            }
          }}
        />
      )}
    </>
  );
}

function FordAdmin() {
  const { data } = useApiData<AdminSummary>("/dashboard/admin", {
    vehicles: 0,
    customers: 0,
    completedServices: 0,
    vinShare: 0,
    dealerships: [],
    models: [],
  });
  const maxModel = Math.max(1, ...data.models.map((item) => item.vehicles));
  function exportReport() {
    const generatedAt = new Date();
    downloadCsv(
      `ford-vinculo-360-${generatedAt.toISOString().slice(0, 10)}.csv`,
      [
        ["FORD VÍNCULO 360 — RELATÓRIO NACIONAL", ""],
        ["Gerado em", generatedAt.toLocaleString("pt-BR")],
        ["Veículos monitorados", data.vehicles],
        ["Clientes", data.customers],
        ["Serviços concluídos", data.completedServices],
        ["VIN Share", `${data.vinShare}%`],
        ["", ""],
        ["CONCESSIONÁRIA", "CIDADE", "UF", "SERVIÇOS", "RETENÇÃO"],
        ...data.dealerships.map((dealer) => [
          dealer.tradeName,
          dealer.city,
          dealer.state,
          dealer._count.serviceOrders,
          `${dealer.retention}%`,
        ]),
        ["", ""],
        ["MODELO", "VEÍCULOS"],
        ...data.models.map((model) => [model.model, model.vehicles]),
      ],
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="VISÃO CORPORATIVA"
        title="Ford Admin Brasil"
        description="Inteligência consolidada da rede, por região, modelo e concessionária."
        action={
          <div className="admin-actions">
            <Badge tone="blue">Brasil</Badge>
            <button className="primary" onClick={exportReport}>
              Exportar relatório
            </button>
          </div>
        }
      />
      <section className="admin-banner">
        <div>
          <span>VIN SHARE BRASIL</span>
          <strong>{data.vinShare}%</strong>
          <Badge tone="green">
            {data.vehicles}{" "}
            {data.vehicles === 1 ? "veículo monitorado" : "veículos monitorados"}
          </Badge>
        </div>
        <div className="admin-map">
          {data.dealerships.slice(0, 3).map((dealer, i) => (
            <span className={`map-dot d${i + 1}`} key={dealer.id}>
              {dealer.retention}%
            </span>
          ))}
          <svg viewBox="0 0 190 160">
            <path
              d="M59 8L112 16L130 38L173 58L145 87L132 124L101 151L81 121L49 99L35 72L13 53L40 39Z"
              fill="#1479C9"
              opacity=".2"
              stroke="#6CB7F2"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="admin-ranking">
          <span>DESTAQUES REGIONAIS</span>
          {data.dealerships.slice(0, 3).map((dealer, i) => (
            <div key={dealer.id}>
              <i>{i + 1}</i>
              <b>{dealer.state}</b>
              <strong>{dealer.retention}%</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">VIN SHARE POR MODELO</span>
              <h2>Permanência no ecossistema</h2>
            </div>
          </div>
          <div className="model-bars">
            {data.models.map((item) => (
              <div key={item.model}>
                <b>{item.model}</b>
                <div>
                  <i
                    style={{
                      width: `${Math.round((item.vehicles / maxModel) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{item.vehicles}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">REDE AUTORIZADA</span>
              <h2>Desempenho das concessionárias</h2>
            </div>
          </div>
          <div className="dealer-ranking">
            {data.dealerships.map((dealer, i) => (
              <div key={dealer.id}>
                <span>{i + 1}</span>
                <div>
                  <b>{dealer.tradeName}</b>
                  <small>
                    {dealer.city}, {dealer.state} ·{" "}
                    {dealer._count.serviceOrders}{" "}
                    {dealer._count.serviceOrders === 1 ? "serviço" : "serviços"}
                  </small>
                </div>
                <strong>{dealer.retention}%</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function ChallengeDashboard() {
  const [period, setPeriod] = useState("12");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [dealershipId, setDealershipId] = useState("");
  const [model, setModel] = useState("");
  const [ageBucket, setAgeBucket] = useState("");
  const [serviceType, setServiceType] = useState("");
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setMonth(fromDate.getMonth() - Number(period));
  const from = fromDate.toISOString().slice(0, 10);
  const params = new URLSearchParams({ from, to });
  if (country) params.set("country", country);
  if (region) params.set("region", region);
  if (dealershipId) params.set("dealershipId", dealershipId);
  if (model) params.set("model", model);
  if (ageBucket) params.set("ageBucket", ageBucket);
  if (serviceType) params.set("serviceType", serviceType);
  const { data, loading } = useApiData<ChallengeSummary>(
    `/dashboard/challenge?${params.toString()}`,
    {
      period: { from, to },
      prediction: { modelVersion: "carregando", source: "not-run", generatedAt: new Date().toISOString(), evaluatedVehicles: 0 },
      definitions: { vinShare: "", serviceShare: "" },
      kpis: { eligibleVins: 0, servicedVins: 0, vinShare: 0, completedServices: 0, serviceShare: 0, leads: 0 },
      campaigns: { sent: 0, viewed: 0, scheduled: 0, completed: 0, converted: 0, pending: 0, conversionRate: 0, latest: null, items: [] },
      revenue: { service: 0, campaign: 0, averageTicket: 0 },
      filters: { dealerships: [], countries: [], regions: [], models: [], ageBuckets: [], serviceTypes: [] },
      trend: [],
      dealerships: [],
      models: [],
      ages: [],
      serviceTypes: [],
      leads: [],
      alerts: [],
    },
  );
  const maxTrend = Math.max(1, ...data.trend.map((item) => item.services));
  async function reviewLead(vin: string, decision: "APPROVED" | "DISMISSED") {
    const reason = decision === "DISMISSED"
      ? window.prompt("Por que esta oportunidade não deve ser acionada agora?")
      : window.prompt("Observação da revisão (opcional):");
    if (decision === "DISMISSED" && !reason?.trim()) return;
    await api(`/predictions/vehicles/${encodeURIComponent(vin)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, ...(reason?.trim() ? { reason: reason.trim() } : {}) }),
    });
    notifyDataChanged();
  }
  const clearFilters = () => {
    setCountry("");
    setRegion("");
    setDealershipId("");
    setModel("");
    setAgeBucket("");
    setServiceType("");
  };
  function exportChallenge() {
    downloadCsv(
      `desafio-02-vin-share-${to}.csv`,
      [
        ["FORD VÍNCULO 360 — DESAFIO 02", ""],
        ["Período", `${from} a ${to}`],
        ["VIN Share", `${data.kpis.vinShare}%`],
        ["Service Share", `${data.kpis.serviceShare}%`],
        ["VINs elegíveis", data.kpis.eligibleVins],
        ["VINs atendidos", data.kpis.servicedVins],
        ["Serviços concluídos", data.kpis.completedServices],
        ["Leads prioritários", data.kpis.leads],
        ["Modelo de risco", data.prediction.modelVersion],
        ["Fonte da previsão", data.prediction.source],
        ["Ações enviadas", data.campaigns.sent],
        ["Ofertas visualizadas", data.campaigns.viewed],
        ["Ações agendadas", data.campaigns.scheduled],
        ["Serviços concluídos após ação", data.campaigns.completed],
        ["Ações convertidas", data.campaigns.converted],
        ["Conversão de campanhas", `${data.campaigns.conversionRate}%`],
        ["Receita de pós-venda", data.revenue.service],
        ["Receita atribuída às campanhas", data.revenue.campaign],
        ["Ticket médio", data.revenue.averageTicket],
        ["", "", "", ""],
        ["CAMPANHA", "ENVIADAS", "VISUALIZADAS", "AGENDADAS", "CONCLUÍDAS", "CONVERTIDAS"],
        ...data.campaigns.items.map((item) => [item.name, item.sent, item.viewed, item.scheduled, item.completed, item.converted]),
        ["", ""],
        ["MODELO", "VIN SHARE", "SERVICE SHARE", "SERVIÇOS"],
        ...data.models.map((item) => [item.label, `${item.vinShare}%`, `${item.serviceShare}%`, item.services]),
        ["", "", "", ""],
        ["CONCESSIONÁRIA", "VIN SHARE", "SERVICE SHARE", "SERVIÇOS"],
        ...data.dealerships.map((item) => [item.tradeName, `${item.vinShare}%`, `${item.serviceShare}%`, item.services]),
      ],
    );
  }
  function exportExecutive() {
    downloadCsv(`relatorio-executivo-vin-share-${to}.csv`, [
      ["FORD VÍNCULO 360 — RESUMO EXECUTIVO", ""],
      ["Recorte", `${country || "Brasil"} · ${region || "Todas as regiões"} · ${period} meses`],
      ["VIN Share", `${data.kpis.vinShare}%`],
      ["Service Share", `${data.kpis.serviceShare}%`],
      ["Leads prioritários", data.kpis.leads],
      ["Modelo de risco", data.prediction.modelVersion],
      ["Fonte da previsão", data.prediction.source],
      ["Campanhas enviadas", data.campaigns.sent],
      ["Ofertas visualizadas", data.campaigns.viewed],
      ["Agendamentos", data.campaigns.scheduled],
      ["Serviços concluídos", data.campaigns.completed],
      ["Conversão", `${data.campaigns.conversionRate}%`],
      ["Receita de pós-venda", data.revenue.service],
      ["Receita atribuída às campanhas", data.revenue.campaign],
      ["Ticket médio", data.revenue.averageTicket],
      ["Recomendação", data.alerts[0]?.description ?? "Escalar a abordagem personalizada para os segmentos com maior oportunidade."],
    ]);
  }
  return (
    <div className="challenge-page">
      <section className="challenge-hero" aria-labelledby="challenge-title">
        <div className="challenge-hero-copy">
          <span className="challenge-hero-eyebrow"><Sparkles size={14} /> DESAFIO 02 · INTELIGÊNCIA DE PÓS-VENDA</span>
          <h1 id="challenge-title">Cada VIN conta uma história.<br /><em>A rede aprende com ela.</em></h1>
          <p>O Vínculo 360 identifica veículos que estão se afastando da rede, explica o motivo e transforma o sinal em uma próxima ação clara para a concessionária.</p>
          <div className="challenge-hero-actions">
            <button className="challenge-hero-primary" onClick={() => document.getElementById("challenge-journey")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Ver como funciona <ArrowUpRight size={17} />
            </button>
            <button className="challenge-hero-secondary" onClick={exportExecutive}><BadgePercent size={16} /> Resumo executivo</button>
          </div>
          <div className="challenge-hero-status" aria-live="polite">
            <span><i className={loading ? "is-loading" : ""} />{loading ? "Atualizando análise" : "Análise conectada ao sistema"}</span>
            <span>{period} meses de histórico</span>
          </div>
        </div>
        <div className="challenge-hero-visual" aria-label="Fluxo visual do VIN até a ação de pós-venda">
          <div className="challenge-orbit challenge-orbit-one" />
          <div className="challenge-orbit challenge-orbit-two" />
          <div className="challenge-signal challenge-signal-vin"><CarFront size={18} /><span>VIN</span></div>
          <div className="challenge-signal challenge-signal-insight"><Activity size={18} /><span>Sinal</span></div>
          <div className="challenge-signal challenge-signal-action"><Target size={18} /><span>Ação</span></div>
          <div className="challenge-intelligence-core">
            <span><ChartNoAxesCombined size={27} /></span>
            <strong>VIN<br />Share</strong>
            <small>INTELIGÊNCIA ATIVA</small>
          </div>
        </div>
      </section>

      <section className="challenge-purpose" aria-label="Como a inteligência VIN gera resultado">
        <article><span>01</span><div className="challenge-purpose-icon"><CarFront size={20} /></div><h2>Entenda cada veículo</h2><p>O VIN reúne modelo, idade e histórico de relacionamento em uma identidade única.</p></article>
        <article><span>02</span><div className="challenge-purpose-icon"><Activity size={20} /></div><h2>Descubra a oportunidade</h2><p>Os sinais mostram quem precisa de atenção e explicam por que agir agora.</p></article>
        <article><span>03</span><div className="challenge-purpose-icon"><Target size={20} /></div><h2>Transforme em retorno</h2><p>A equipe cria uma ação, acompanha a resposta e mede o retorno à oficina.</p></article>
      </section>

      <div id="challenge-journey" className="challenge-section-intro">
        <span className="eyebrow">VEJA O SISTEMA FUNCIONANDO</span>
        <h2>Do primeiro sinal ao retorno do cliente</h2>
        <p>Clique nas etapas para acompanhar, de forma simples, o caminho completo da inteligência VIN.</p>
      </div>
      <ChallengeJourney kpis={data.kpis} campaigns={data.campaigns} revenue={data.revenue.service} lead={data.leads[0] ? { model: data.leads[0].model, score: data.leads[0].score, reason: data.leads[0].reason, nextAction: data.leads[0].nextAction } : null} />

      <div className="challenge-section-heading" id="challenge-results">
        <div><span className="eyebrow">PAINEL DE RESULTADOS</span><h2>Acompanhe a operação</h2><p>Aplique um recorte e veja somente os indicadores relevantes para a sua análise.</p></div>
        <button className="primary" onClick={exportChallenge}><ChartNoAxesCombined size={16} />Exportar análise</button>
      </div>
      <section className="card challenge-filter-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">RECORTE DA ANÁLISE</span>
            <h2>Escolha o público que deseja entender</h2>
            <p>Os indicadores são recalculados com VINs únicos e ordens concluídas no período.</p>
          </div>
          <button className="secondary" onClick={clearFilters}>Limpar filtros</button>
        </div>
        <div className="toolbar challenge-filters">
          <label>Período<select aria-label="Período da análise" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option></select></label>
          <label>País<select aria-label="País da análise" value={country} onChange={(event) => { setCountry(event.target.value); setRegion(""); }}><option value="">Todos os países</option>{data.filters.countries.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Região<select aria-label="Região da análise" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">Todas as regiões</option>{data.filters.regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Concessionária<select aria-label="Concessionária da análise" value={dealershipId} onChange={(event) => setDealershipId(event.target.value)}><option value="">Todas as unidades</option>{data.filters.dealerships.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.tradeName}</option>)}</select></label>
          <label>Modelo<select aria-label="Modelo da análise" value={model} onChange={(event) => setModel(event.target.value)}><option value="">Todos os modelos</option>{data.filters.models.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Idade<select aria-label="Idade do veículo" value={ageBucket} onChange={(event) => setAgeBucket(event.target.value)}><option value="">Todas as idades</option>{data.filters.ageBuckets.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Tipo de serviço<select aria-label="Tipo de serviço" value={serviceType} onChange={(event) => setServiceType(event.target.value)}><option value="">Todos os serviços</option>{data.filters.serviceTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
      </section>
      <section className="stats-grid challenge-kpi-grid">
        <StatCard icon={ChartNoAxesCombined} label="VIN Share" value={`${data.kpis.vinShare}%`} change={`${data.kpis.servicedVins} de ${data.kpis.eligibleVins} VINs atendidos`} tone="blue" />
        <StatCard icon={Wrench} label="Service Share" value={`${data.kpis.serviceShare}%`} change={`${data.kpis.completedServices} serviços no recorte`} tone="green" />
        <StatCard icon={TriangleAlert} label="Leads prioritários" value={String(data.kpis.leads)} change="Veículos que precisam de atenção" tone="amber" />
        <StatCard icon={BadgePercent} label="Conversão de campanhas" value={`${data.campaigns.conversionRate}%`} change={`${data.campaigns.converted} de ${data.campaigns.sent} ações converteram`} tone="violet" />
      </section>
      <section className="challenge-revenue-grid"><article className="card challenge-revenue-card"><span className="eyebrow">IMPACTO FINANCEIRO</span><h2>Receita de pós-venda</h2><strong>{data.revenue.service.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><p>Valor das ordens concluídas no recorte.</p></article><article className="card challenge-revenue-card"><span className="eyebrow">ATRIBUIÇÃO DE CAMPANHA</span><h2>Receita influenciada</h2><strong>{data.revenue.campaign.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><p>Serviços realizados por veículos impactados.</p></article><article className="card challenge-revenue-card"><span className="eyebrow">TICKET MÉDIO</span><h2>Valor por serviço</h2><strong>{data.revenue.averageTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><p>Referência para priorizar ofertas.</p></article></section>
      <section className="challenge-segment-grid">
        <article className="card list-card">
          <div className="card-heading"><div><span className="eyebrow">COBERTURA DA REDE</span><h2>Ranking por concessionária</h2><p>Compare onde a rede está recuperando mais VINs.</p></div></div>
          <div className="challenge-mini-list">{data.dealerships.slice(0, 6).map((item, index) => <div className="challenge-mini-row" key={item.id}><span className="challenge-rank">{index + 1}</span><div><b>{item.tradeName}</b><small>{item.city}/{item.state} · {item.services} serviços</small></div><strong>{item.vinShare}%</strong></div>)}{!data.dealerships.length && <div className="empty-row">Nenhuma unidade encontrada.</div>}</div>
        </article>
        <article className="card list-card">
          <div className="card-heading"><div><span className="eyebrow">IDADE DA FROTA</span><h2>Onde recuperar</h2><p>Segmentos com menor retorno à rede.</p></div></div>
          <div className="challenge-mini-list">{data.ages.map((item) => <div className="challenge-mini-row" key={item.label}><div><b>{item.label}</b><small>{item.eligibleVins} VINs elegíveis · {item.services} serviços</small></div><strong>{item.vinShare}%</strong></div>)}{!data.ages.length && <div className="empty-row">Sem dados de idade.</div>}</div>
        </article>
        <article className="card list-card">
          <div className="card-heading"><div><span className="eyebrow">MIX DE SERVIÇOS</span><h2>Oportunidade de oferta</h2><p>Entenda quais serviços puxam o retorno.</p></div></div>
          <div className="challenge-mini-list">{data.serviceTypes.map((item) => <div className="challenge-mini-row" key={item.label}><div><b>{item.label}</b><small>{item.services} ordens concluídas</small></div><strong>{item.serviceShare}%</strong></div>)}{!data.serviceTypes.length && <div className="empty-row">Sem serviços no recorte.</div>}</div>
        </article>
      </section>
      <section className="card challenge-campaign-summary">
        <div className="card-heading"><div><span className="eyebrow">JORNADA FECHADA</span><h2>O que aconteceu depois do lead?</h2><p>Conecte a recomendação do painel ao retorno efetivo do cliente.</p></div><Link className="challenge-action-link primary-action" to="/campanhas">Ver campanhas <ChevronRight size={13} /></Link></div>
        <div className="challenge-campaign-metrics"><div><small>ENVIADAS</small><strong>{data.campaigns.sent}</strong><span>Ações disparadas para o recorte</span></div><div><small>VISUALIZADAS</small><strong>{data.campaigns.viewed}</strong><span>Oferta aberta no app</span></div><div><small>AGENDADAS</small><strong>{data.campaigns.scheduled}</strong><span>Cliente entrou na agenda</span></div><div><small>SERVIÇOS CONCLUÍDOS</small><strong>{data.campaigns.completed}</strong><span>Retorno efetivo à oficina</span></div><div><small>CONVERTIDAS</small><strong>{data.campaigns.converted}</strong><span>Conversão registrada</span></div><div><small>EM ACOMPANHAMENTO</small><strong>{data.campaigns.pending}</strong><span>Sem próxima etapa registrada</span></div></div>
        <div className="challenge-campaign-table"><div className="challenge-campaign-row challenge-campaign-head"><span>CAMPANHA</span><span>ENV.</span><span>VIS.</span><span>AG.</span><span>OS</span><span>CONV.</span></div>{data.campaigns.items.map((item) => <div className="challenge-campaign-row" key={item.id}><b>{item.name}</b><span>{item.sent}</span><span>{item.viewed}</span><span>{item.scheduled}</span><span>{item.completed}</span><strong>{item.converted}</strong></div>)}{!data.campaigns.items.length && <div className="empty-row">Nenhuma campanha enviada neste recorte.</div>}</div>
      </section>
      <section className="dashboard-grid">
        <article className="card">
          <div className="card-heading"><div><span className="eyebrow">EVOLUÇÃO DO PERÍODO</span><h2>Retorno à rede por mês</h2><p>VIN Share e volume de serviços do recorte selecionado.</p></div><Badge tone={loading ? "amber" : "green"}>{loading ? "Atualizando" : "Dados atualizados"}</Badge></div>
          <div className="bar-chart challenge-chart">{data.trend.map((item) => <div className="bar-col" key={`${item.label}-${item.services}`}><b>{item.services}</b><div className="bar" style={{ height: `${Math.max(6, (item.services / maxTrend) * 100)}%` }} /><span>{item.label}</span></div>)}</div>
        </article>
        <article className="card challenge-definition-card">
          <div className="card-heading"><div><span className="eyebrow">COMO LER</span><h2>Indicadores do desafio</h2></div><InfoIcon /></div>
          <div className="challenge-definition"><b>VIN Share</b><span>{data.definitions.vinShare}</span></div>
          <div className="challenge-definition"><b>Service Share</b><span>{data.definitions.serviceShare}</span></div>
          {data.alerts.map((alert) => <div className="challenge-alert" key={alert.title}><TriangleAlert size={18} /><div><b>{alert.title}</b><span>{alert.description}</span></div></div>)}
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="card list-card">
          <div className="card-heading"><div><span className="eyebrow">ANÁLISE COMPARATIVA</span><h2>Desempenho por modelo</h2><p>Use o recorte para encontrar onde existe maior oportunidade.</p></div></div>
          <div className="challenge-table"><div className="challenge-table-row challenge-table-head"><span>MODELO</span><span>VIN SHARE</span><span>SERVICE SHARE</span><span>SERVIÇOS</span></div>{data.models.map((item) => <div className="challenge-table-row" key={item.label}><b>{item.label}</b><span><Badge tone={item.vinShare >= 60 ? "green" : "amber"}>{item.vinShare}%</Badge></span><span>{item.serviceShare}%</span><strong>{item.services}</strong></div>)}{!data.models.length && <div className="empty-row">Nenhum modelo encontrado para os filtros selecionados.</div>}</div>
        </article>
        <article className="card list-card">
          <div className="card-heading"><div><span className="eyebrow">PRÓXIMA AÇÃO</span><h2>Leads recomendados</h2><p>Priorize os veículos com maior chance de evasão.</p><small>Previsão: {data.prediction.source === "trained-model" ? "modelo treinado" : "estimativa de contingência"} · {data.prediction.modelVersion} · {data.prediction.evaluatedVehicles} veículos analisados</small></div></div>
          <div className="challenge-lead-list">
            {data.leads.map((lead) => {
              const image = vehicleImageFor(lead.model);
              const approved = lead.governance.decision === "APPROVED";
              const dismissed = lead.governance.decision === "DISMISSED";
              return <div className="challenge-lead-row" key={lead.vin}>
                <div className={`avatar soft challenge-lead-visual${image ? " has-photo" : ""}`}>
                  {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <TriangleAlert size={15} />}
                </div>
                <div>
                  <b>{lead.model}</b>
                  <small>{lead.vin} · {lead.age} anos · Cliente: {lead.customerName}</small>
                  <span>{lead.returnStatus}</span>
                  <span>{lead.reason}</span>
                  <small>Modelo {lead.modelVersion} · {lead.modelSource === "trained-model" ? "previsão treinada" : "contingência"}</small>
                  <div className="governance-state">
                    {approved ? <Badge tone="green"><CheckCircle2 size={11} />Aprovada por {lead.governance.reviewedBy}</Badge> : dismissed ? <Badge tone="slate">Não priorizada</Badge> : <Badge tone="amber"><ShieldAlert size={11} />Aguardando revisão humana</Badge>}
                    {lead.governance.reason && <small>{lead.governance.reason}</small>}
                  </div>
                  <div className="challenge-lead-actions">
                    <Link className="challenge-action-link" to={`/veiculos/${encodeURIComponent(lead.vin)}`}><CarFront size={12} />Ver veículo</Link>
                    {approved ? (
                      <Link className="challenge-action-link primary-action" to={`/campanhas?vin=${encodeURIComponent(lead.vin)}&governed=1&modelVersion=${encodeURIComponent(lead.modelVersion)}&reminderModel=${encodeURIComponent(lead.model)}`}><Target size={12} />Enviar e-mail de revisão</Link>
                    ) : (
                      <>
                        <button className="challenge-action-link primary-action" onClick={() => void reviewLead(lead.vin, "APPROVED")}><Check size={12} />Aprovar abordagem</button>
                        <button className="challenge-action-link" onClick={() => void reviewLead(lead.vin, "DISMISSED")}><X size={12} />Não priorizar</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="challenge-lead-score"><strong>{lead.score}%</strong><small>{lead.nextAction}</small></div>
              </div>;
            })}
            {!data.leads.length && <div className="empty-row">Nenhum lead prioritário no recorte atual.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}

function InfoIcon() {
  return <span className="challenge-info" aria-label="Informação sobre os indicadores">i</span>;
}

function SessionSecurityPanel() {
  const { logoutAll } = useAuth();
  const { data: sessions } = useApiData<ApiAuthSession[]>(
    "/auth/sessions",
    [],
  );
  return (
    <article className="card settings-panel session-panel">
      <div className="card-heading">
        <div>
          <span className="eyebrow">SEGURANÇA DA CONTA</span>
          <h2>Sessões e credenciais</h2>
          <p>
            Revogue imediatamente os acessos abertos em outros navegadores ou
            dispositivos.
          </p>
        </div>
        <ShieldCheck size={22} />
      </div>
      <div className="session-security-row">
        <div className="stat-icon icon-green">
          <KeyRound size={20} />
        </div>
        <span>
          <b>Proteção de acesso ativa</b>
          <small>
            Token curto em memória, renovação HttpOnly e bloqueio após
            tentativas consecutivas.
          </small>
        </span>
        <button className="secondary" onClick={() => logoutAll()}>
          Encerrar todas as sessões
        </button>
      </div>
      <div className="device-session-list">
        {sessions.map((session) => (
          <div key={session.id}>
            <div className="device-icon">
              <MonitorSmartphone size={18} />
            </div>
            <span>
              <b>{session.deviceName}</b>
              <small>
                {session.ipAddress ?? "Endereço local"} · atividade em{" "}
                {new Date(session.lastUsedAt).toLocaleString("pt-BR")}
              </small>
            </span>
            {session.isCurrent ? (
              <Badge tone="green">Sessão atual</Badge>
            ) : (
              <button
                className="settings-row-action danger-action"
                onClick={async () => {
                  await api(`/auth/sessions/${session.id}`, {
                    method: "DELETE",
                  });
                  notifyDataChanged();
                }}
              >
                Encerrar acesso
              </button>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

const formatCpf = (value: string | null) =>
  value && value.length === 11
    ? `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`
    : (value ?? "Não informado");

const formatCpfInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

const representationBasisLabel = (value: ApiCustomer["representationBasis"]) => {
  if (value === "SOCIAL_CONTRACT") return "Contrato social";
  if (value === "BYLAWS") return "Estatuto ou ata de eleição";
  if (value === "POWER_OF_ATTORNEY") return "Procuração";
  return "Não informado";
};

const fordRelationshipLabel = (value: StoredFordRelationship | null | undefined) => {
  if (value === "CURRENT_OWNER") return "Já possui um Ford";
  if (value === "FORMER_OWNER") return "Já teve um Ford";
  if (value === "NEW_TO_FORD") return "Ainda não teve um Ford";
  return "Não informado";
};

const isFordRelationship = (value: StoredFordRelationship | null | undefined): value is FordRelationship =>
  value === "CURRENT_OWNER" || value === "FORMER_OWNER" || value === "NEW_TO_FORD";

const formatCnpj = (value: string | null) => {
  if (!value) return "Não informado";
  if (value.includes("*")) return value;
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatZip = (value: string | null) =>
  value && value.length === 8
    ? `${value.slice(0, 5)}-${value.slice(5)}`
    : (value ?? "");

/** Base cadastral de clientes físicos e jurídicos da unidade. */
function CustomerRegistry() {
  const { data: customers, loading } = useApiData<ApiCustomer[]>(
    "/users/customers",
    [],
  );
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const filtered = customers.filter((customer) =>
    [
      customer.fullName,
      customer.email,
      customer.phone ?? "",
      customer.addressCity ?? "",
      customer.cpf ?? "",
      customer.cnpj ?? "",
      customer.tradeName ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
  const withVehicle = customers.filter(
    (customer) => (customer._count?.ownerships ?? 0) > 0,
  ).length;
  const activated = customers.filter(
    (customer) => customer.active && !customer.passwordSetupRequired,
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="BASE DE CLIENTES"
        title="Clientes"
        description="Cadastro dos proprietários atendidos pela unidade."
        action={
          <Link className="primary" to="/clientes/novo">
            <UserRound size={17} />
            Cadastrar cliente
          </Link>
        }
      />
      <section className="stats-grid">
        <StatCard
          icon={UsersRound}
          label="Clientes cadastrados"
          value={String(customers.length)}
          change="Na carteira da unidade"
        />
        <StatCard
          icon={CarFront}
          label="Com veículo vinculado"
          value={String(withVehicle)}
          change="Identidade ativa pelo VIN"
          tone="green"
        />
        <StatCard
          icon={ShieldCheck}
          label="Contas ativadas"
          value={String(activated)}
          change={`${customers.length - activated} aguardando criação de senha`}
          tone="violet"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Compras registradas"
          value={String(
            customers.reduce(
              (sum, customer) => sum + (customer._count?.purchases ?? 0),
              0,
            ),
          )}
          change="Veículos vendidos pela rede"
          tone="amber"
        />
      </section>
      <section className="card list-card">
        <div className="toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Buscar por nome, e-mail, telefone ou cidade"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="data-table">
          <div className="table-row table-head customer-table">
            <span>Cliente</span>
            <span>CPF / CNPJ</span>
            <span>Contato</span>
            <span>Cidade</span>
            <span>Veículos</span>
            <span />
          </div>
          {filtered.map((customer) => (
            <Link
              className="table-row customer-table"
              key={customer.id}
              to={`/clientes/${customer.id}`}
            >
              <span className="vehicle-cell">
                <span className="avatar soft">
                  {customer.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <b>{customer.tradeName || customer.fullName}</b>
                  <small>
                    {customer.customerType === "COMPANY"
                      ? customer.fullName
                      : customer.passwordSetupRequired
                      ? "Aguardando cliente criar a senha"
                      : `Conta ativa desde ${new Date(customer.createdAt).toLocaleDateString("pt-BR")}`}
                  </small>
                </span>
              </span>
              <span>
                <b>{customer.customerType === "COMPANY" ? customer.cnpj ?? "—" : customer.cpf ?? "—"}</b>
                {customer.customerType === "COMPANY" ? (!customer.hasCnpj && <small>Cadastro incompleto</small>) : (!customer.hasCpf && <small>Cadastro incompleto</small>)}
              </span>
              <span>
                <b>{customer.email}</b>
                <small>{customer.phone ?? "Sem telefone"}</small>
              </span>
              <span>
                <b>
                  {customer.addressCity
                    ? `${customer.addressCity}/${customer.addressState ?? ""}`
                    : "—"}
                </b>
              </span>
              <span>
                <b>{customer._count?.ownerships ?? 0}</b>
              </span>
              <ChevronRight size={16} />
            </Link>
          ))}
          {!filtered.length && (
            <div className="empty-row">
              {loading
                ? "Carregando clientes..."
                : term
                  ? "Nenhum cliente encontrado para esta busca."
                  : "Nenhum cliente cadastrado nesta unidade."}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/** Cadastro completo do proprietário: dados exigidos em nota fiscal, contrato
 *  e emplacamento. Usado tanto para criar quanto para editar. */
function CustomerFormPage({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const editing = mode === "edit";
  const empty: ApiCustomer = {
    id: "",
    fullName: "",
    email: "",
    phone: null,
    customerType: "INDIVIDUAL",
    fordRelationship: "UNKNOWN",
    cpf: null,
    cnpj: null,
    tradeName: null,
    stateRegistration: null,
    stateRegistrationExempt: false,
    companyRegistrationStatus: null,
    legalRepresentativeName: null,
    legalRepresentativeCpf: null,
    legalRepresentativeDocument: null,
    legalRepresentativeRole: null,
    representationBasis: null,
    representationDocumentChecked: false,
    rg: null,
    rgIssuer: null,
    birthDate: null,
    addressZip: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressDistrict: null,
    addressCity: null,
    addressState: null,
    active: true,
    passwordSetupRequired: false,
    createdAt: new Date().toISOString(),
  };
  const { data: customer } = useApiData<ApiCustomer>(
    editing ? `/users/customers/${id}` : null,
    empty,
  );
  const [customerType, setCustomerType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [fordRelationship, setFordRelationship] = useState<FordRelationship | null>(null);
  const [identity, setIdentity] = useState({
    fullName: "",
    cnpj: "",
    tradeName: "",
    stateRegistration: "",
    stateRegistrationExempt: false,
    companyRegistrationStatus: "",
  });
  const [representative, setRepresentative] = useState({
    name: "",
    cpf: "",
    document: "",
    role: "",
    basis: "" as "" | "SOCIAL_CONTRACT" | "BYLAWS" | "POWER_OF_ATTORNEY",
    documentChecked: false,
  });
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [address, setAddress] = useState({
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [zipStatus, setZipStatus] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState("");
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (editing && customer.id && !hydrated) {
      setCustomerType(customer.customerType ?? "INDIVIDUAL");
      setFordRelationship(isFordRelationship(customer.fordRelationship) ? customer.fordRelationship : null);
      setIdentity({
        fullName: customer.fullName,
        cnpj: formatCnpj(customer.cnpj) === "Não informado" ? "" : formatCnpj(customer.cnpj),
        tradeName: customer.tradeName ?? "",
        stateRegistration: customer.stateRegistration ?? "",
        stateRegistrationExempt: customer.stateRegistrationExempt ?? false,
        companyRegistrationStatus: customer.companyRegistrationStatus ?? "",
      });
      setRepresentative({
        name: customer.legalRepresentativeName ?? "",
        cpf: customer.legalRepresentativeCpf ? formatCpfInput(customer.legalRepresentativeCpf) : "",
        document: customer.legalRepresentativeDocument ?? "",
        role: customer.legalRepresentativeRole ?? "",
        basis: customer.representationBasis ?? "",
        documentChecked: customer.representationDocumentChecked ?? false,
      });
      setContact({ email: customer.email, phone: customer.phone ?? "" });
      setAddress({
        zip: formatZip(customer.addressZip),
        street: customer.addressStreet ?? "",
        number: customer.addressNumber ?? "",
        complement: customer.addressComplement ?? "",
        district: customer.addressDistrict ?? "",
        city: customer.addressCity ?? "",
        state: customer.addressState ?? "",
      });
      setHydrated(true);
    }
  }, [editing, customer, hydrated]);

  /** Preenche o endereço pelo CEP; se a consulta falhar, segue manual. */
  async function lookupZip(value: string) {
    const digits = value.replace(/\D/g, "");
    setAddress((current) => ({ ...current, zip: value }));
    if (digits.length !== 8) return;
    setZipStatus("Buscando endereço...");
    try {
      const data = await api<{
        zip: string;
        street: string;
        complement: string;
        district: string;
        city: string;
        state: string;
      }>(`/users/customers/lookup/cep/${digits}`);
      setAddress((current) => ({
        ...current,
        zip: formatZip(data.zip),
        street: data.street || current.street,
        complement: data.complement || current.complement,
        district: data.district || current.district,
        city: data.city || current.city,
        state: data.state || current.state,
      }));
      setZipStatus("Endereço preenchido pelo CEP.");
    } catch (reason) {
      setZipStatus(reason instanceof Error ? reason.message : "Não foi possível consultar o CEP. Preencha manualmente.");
    }
  }

  /** Consulta cadastral pontual; o usuário escolhe quando preencher pela fonte pública. */
  async function lookupCnpj() {
    const digits = identity.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjStatus("Digite os 14 números do CNPJ.");
      return;
    }
    setLookingUpCnpj(true);
    setCnpjStatus("Consultando dados da empresa...");
    try {
      const data = await api<{
        cnpj: string;
        legalName: string;
        tradeName: string;
        stateRegistration: string;
        registrationStatus: string;
        email: string;
        phone: string;
        address: { zip: string; street: string; number: string; complement: string; district: string; city: string; state: string };
      }>(`/users/customers/lookup/cnpj/${digits}`);
      setIdentity((current) => ({
        ...current,
        cnpj: formatCnpj(data.cnpj),
        fullName: data.legalName || current.fullName,
        tradeName: data.tradeName || current.tradeName,
        stateRegistration: data.stateRegistration || current.stateRegistration,
        stateRegistrationExempt: data.stateRegistration ? false : current.stateRegistrationExempt,
        companyRegistrationStatus: data.registrationStatus,
      }));
      setContact((current) => ({
        email: data.email || current.email,
        phone: data.phone || current.phone,
      }));
      setAddress((current) => ({
        zip: data.address.zip ? formatZip(data.address.zip) : current.zip,
        street: data.address.street || current.street,
        number: data.address.number || current.number,
        complement: data.address.complement || current.complement,
        district: data.address.district || current.district,
        city: data.address.city || current.city,
        state: data.address.state || current.state,
      }));
      setCnpjStatus(`Empresa encontrada${data.registrationStatus ? ` · Situação ${data.registrationStatus}` : ""}.`);
    } catch (reason) {
      setCnpjStatus(reason instanceof Error ? reason.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setLookingUpCnpj(false);
    }
  }

  return (
    <div className="customer-form-page">
      <div className="breadcrumbs">
        <Link to="/clientes">Clientes</Link>
        <ChevronRight size={13} />
        <span>{editing ? customer.fullName : "Novo cliente"}</span>
      </div>
      <PageHeader
        eyebrow="CADASTRO"
        title={editing ? "Editar cliente" : "Cadastrar cliente"}
        description="Dados exigidos para nota fiscal, contrato de venda e emplacamento."
      />
      <section className="card customer-form-card">
        <ActionForm
          endpoint={editing ? `/users/customers/${id}` : "/users/customers"}
          method={editing ? "PATCH" : "POST"}
          submitLabel={editing ? "Salvar cadastro" : "Cadastrar cliente"}
          onDone={(result) => {
            const saved = result as ApiCustomer | undefined;
            navigate(saved?.id ? `/clientes/${saved.id}` : "/clientes");
          }}
          buildBody={(form) => ({
            customerType,
            fordRelationship: fordRelationship || undefined,
            fullName: form.get("fullName"),
            email: form.get("email"),
            phone: form.get("phone") || undefined,
            cpf: form.get("cpf") || undefined,
            cnpj: form.get("cnpj") || undefined,
            tradeName: form.get("tradeName") || undefined,
            stateRegistration: identity.stateRegistrationExempt ? undefined : form.get("stateRegistration") || undefined,
            stateRegistrationExempt: identity.stateRegistrationExempt,
            companyRegistrationStatus: identity.companyRegistrationStatus || undefined,
            legalRepresentativeName: representative.name || undefined,
            legalRepresentativeCpf: representative.cpf || undefined,
            legalRepresentativeDocument: representative.document || undefined,
            legalRepresentativeRole: representative.role || undefined,
            representationBasis: representative.basis || undefined,
            representationDocumentChecked: representative.documentChecked,
            rg: form.get("rg") || undefined,
            rgIssuer: form.get("rgIssuer") || undefined,
            birthDate: form.get("birthDate")
              ? new Date(String(form.get("birthDate"))).toISOString()
              : undefined,
            addressZip: form.get("addressZip") || undefined,
            addressStreet: form.get("addressStreet") || undefined,
            addressNumber: form.get("addressNumber") || undefined,
            addressComplement: form.get("addressComplement") || undefined,
            addressDistrict: form.get("addressDistrict") || undefined,
            addressCity: form.get("addressCity") || undefined,
            addressState: form.get("addressState") || undefined,
          })}
        >
          <div className="form-section-heading" data-step="01">
            <span className="eyebrow">DADOS PESSOAIS</span>
            <strong>Identificação do cliente</strong>
          </div>
          <div className="customer-type-selector">
            <span>Tipo de cliente</span>
            <div role="group" aria-label="Tipo de cliente">
              <button type="button" className={customerType === "INDIVIDUAL" ? "is-active" : ""} aria-pressed={customerType === "INDIVIDUAL"} onClick={() => { setCustomerType("INDIVIDUAL"); setCnpjStatus(""); }}><UserRound size={17} /><b>Pessoa Física</b><small>Cadastro com CPF</small></button>
              <button type="button" className={customerType === "COMPANY" ? "is-active" : ""} aria-pressed={customerType === "COMPANY"} onClick={() => setCustomerType("COMPANY")}><Store size={17} /><b>Pessoa Jurídica</b><small>Cadastro com CNPJ</small></button>
            </div>
          </div>

          <div className="ford-relationship-selector">
            <span>Relação com a Ford</span>
            <small>Escolha uma opção para entender o momento do cliente e orientar o próximo contato.</small>
            <div role="group" aria-label="Relação do cliente com a Ford">
              <button type="button" className={fordRelationship === "CURRENT_OWNER" ? "is-active" : ""} aria-pressed={fordRelationship === "CURRENT_OWNER"} onClick={() => setFordRelationship("CURRENT_OWNER")}><CarFront size={17} /><b>Já possui um Ford</b><small>Tem um veículo Ford atualmente</small></button>
              <button type="button" className={fordRelationship === "FORMER_OWNER" ? "is-active" : ""} aria-pressed={fordRelationship === "FORMER_OWNER"} onClick={() => setFordRelationship("FORMER_OWNER")}><TrendingUp size={17} /><b>Já teve um Ford</b><small>Já foi cliente, mas não possui hoje</small></button>
              <button type="button" className={fordRelationship === "NEW_TO_FORD" ? "is-active" : ""} aria-pressed={fordRelationship === "NEW_TO_FORD"} onClick={() => setFordRelationship("NEW_TO_FORD")}><Sparkles size={17} /><b>Ainda não teve um Ford</b><small>Primeira relação com a marca</small></button>
            </div>
          </div>

          {customerType === "INDIVIDUAL" ? <>
            <label>
              Nome completo
              <input name="fullName" required minLength={3} value={identity.fullName} onChange={(event) => setIdentity((current) => ({ ...current, fullName: event.target.value }))} placeholder="Como consta no documento" />
            </label>
            <div className="form-grid customer-document-grid">
              <label>
                CPF
                <input name="cpf" defaultValue={formatCpf(customer.cpf) === "Não informado" ? "" : formatCpf(customer.cpf)} placeholder="000.000.000-00" />
              </label>
              <label>
                Data de nascimento
                <input name="birthDate" type="date" defaultValue={customer.birthDate?.slice(0, 10) ?? ""} />
              </label>
              <label>
                RG
                <input name="rg" defaultValue={customer.rg ?? ""} />
              </label>
              <label>
                Órgão emissor
                <input name="rgIssuer" defaultValue={customer.rgIssuer ?? ""} placeholder="SSP/SP" />
              </label>
            </div>
          </> : <>
            <div className="company-lookup-panel">
              <label>
                CNPJ
                <span className="field-with-action">
                  <input name="cnpj" required value={identity.cnpj} onChange={(event) => { setIdentity((current) => ({ ...current, cnpj: formatCnpj(event.target.value), companyRegistrationStatus: "" })); setCnpjStatus(""); }} placeholder="00.000.000/0000-00" inputMode="numeric" />
                  <button type="button" className="secondary" onClick={() => void lookupCnpj()} disabled={lookingUpCnpj}><Search size={16} />{lookingUpCnpj ? "Consultando..." : "Consultar CNPJ"}</button>
                </span>
              </label>
              <small>Consulta automática em bases públicas. Revise os dados antes de salvar.</small>
              {cnpjStatus && <div className={`company-lookup-status${cnpjStatus.startsWith("Empresa encontrada") ? " is-success" : ""}`}>{cnpjStatus}</div>}
            </div>
            <div className="form-grid company-identity-grid">
              <label>
                Razão social
                <input name="fullName" required minLength={3} value={identity.fullName} onChange={(event) => setIdentity((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nome empresarial" />
              </label>
              <label>
                Nome fantasia
                <input name="tradeName" value={identity.tradeName} onChange={(event) => setIdentity((current) => ({ ...current, tradeName: event.target.value }))} placeholder="Nome comercial" />
              </label>
              <label>
                Inscrição estadual
                <input name="stateRegistration" value={identity.stateRegistration} disabled={identity.stateRegistrationExempt} onChange={(event) => setIdentity((current) => ({ ...current, stateRegistration: event.target.value }))} placeholder={identity.stateRegistrationExempt ? "Empresa isenta" : "Número da inscrição"} />
                <span className="company-exempt-control"><input type="checkbox" checked={identity.stateRegistrationExempt} onChange={(event) => setIdentity((current) => ({ ...current, stateRegistrationExempt: event.target.checked, stateRegistration: event.target.checked ? "" : current.stateRegistration }))} /> Empresa isenta de inscrição estadual</span>
              </label>
            </div>
          </>}

          {customerType === "COMPANY" && <>
            <div className="form-section-heading" data-step="02">
              <span className="eyebrow">REPRESENTAÇÃO DA EMPRESA</span>
              <strong>Responsável autorizado pela compra</strong>
            </div>
            <div className="company-representative-note">
              <ShieldCheck size={19} />
              <span><b>Conferência necessária antes da venda</b><small>Confira os dados abaixo no contrato social, estatuto ou procuração apresentada.</small></span>
            </div>
            <div className="form-grid company-representative-grid">
              <label>
                Nome do representante legal
                <input required value={representative.name} onChange={(event) => setRepresentative((current) => ({ ...current, name: event.target.value }))} placeholder="Como consta no documento" />
              </label>
              <label>
                CPF do representante
                <input required value={representative.cpf} onChange={(event) => setRepresentative((current) => ({ ...current, cpf: formatCpfInput(event.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" />
              </label>
              <label>
                Documento com foto
                <input required value={representative.document} onChange={(event) => setRepresentative((current) => ({ ...current, document: event.target.value }))} placeholder="RG ou CNH" />
              </label>
              <label>
                Cargo ou função
                <input required value={representative.role} onChange={(event) => setRepresentative((current) => ({ ...current, role: event.target.value }))} placeholder="Sócio administrador, diretor..." />
              </label>
              <label className="company-basis-field">
                Documento que comprova os poderes
                <select required value={representative.basis} onChange={(event) => setRepresentative((current) => ({ ...current, basis: event.target.value as typeof current.basis }))}>
                  <option value="">Selecione</option>
                  <option value="SOCIAL_CONTRACT">Contrato social / alteração</option>
                  <option value="BYLAWS">Estatuto / ata de eleição</option>
                  <option value="POWER_OF_ATTORNEY">Procuração</option>
                </select>
              </label>
            </div>
            <label className="company-document-confirmation">
              <input type="checkbox" required checked={representative.documentChecked} onChange={(event) => setRepresentative((current) => ({ ...current, documentChecked: event.target.checked }))} />
              <span><b>Documentação conferida</b><small>Confirmo que o documento apresentado identifica este representante e autoriza a compra em nome da empresa.</small></span>
            </label>
          </>}

          <div className="form-section-heading" data-step={customerType === "COMPANY" ? "03" : "02"}>
            <span className="eyebrow">CONTATO</span>
            <strong>{customerType === "COMPANY" ? "Contato que receberá o acesso da empresa" : "Canais de relacionamento"}</strong>
          </div>
          <div className="form-grid">
            <label>
              {customerType === "COMPANY" ? "E-mail corporativo ou do representante" : "E-mail"}
              <input
                name="email"
                type="email"
                required
                value={contact.email}
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              Telefone
              <input
                name="phone"
                value={contact.phone}
                onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
                placeholder="(11) 90000-0000"
              />
            </label>
          </div>

          <div className="form-section-heading" data-step={customerType === "COMPANY" ? "04" : "03"}>
            <span className="eyebrow">ENDEREÇO</span>
            <strong>Local de emplacamento e entrega</strong>
          </div>
          <div className="form-grid customer-address-region-grid">
            <label>
              CEP
              <input
                name="addressZip"
                value={address.zip}
                onChange={(event) => void lookupZip(event.target.value)}
                placeholder="00000-000"
              />
            </label>
            <label>
              Cidade
              <input
                name="addressCity"
                value={address.city}
                onChange={(event) =>
                  setAddress((c) => ({ ...c, city: event.target.value }))
                }
              />
            </label>
            <label>
              UF
              <input
                name="addressState"
                value={address.state}
                maxLength={2}
                onChange={(event) =>
                  setAddress((c) => ({
                    ...c,
                    state: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
            <label>
              Bairro
              <input
                name="addressDistrict"
                value={address.district}
                onChange={(event) =>
                  setAddress((c) => ({ ...c, district: event.target.value }))
                }
              />
            </label>
          </div>
          {zipStatus && <div className="login-notice">{zipStatus}</div>}
          <div className="form-grid customer-address-line-grid">
            <label>
              Logradouro
              <input
                name="addressStreet"
                value={address.street}
                onChange={(event) =>
                  setAddress((c) => ({ ...c, street: event.target.value }))
                }
              />
            </label>
            <label>
              Número
              <input
                name="addressNumber"
                value={address.number}
                onChange={(event) => setAddress((current) => ({ ...current, number: event.target.value }))}
              />
            </label>
            <label>
              Complemento
              <input
                name="addressComplement"
                value={address.complement}
                onChange={(event) => setAddress((current) => ({ ...current, complement: event.target.value }))}
                placeholder="Apto, bloco, referência"
              />
            </label>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              Documentos e endereço são tratados sob a LGPD: aparecem mascarados
              nas listagens e cada criação ou alteração fica registrada na
              trilha de auditoria. O cliente define a própria senha no primeiro
              acesso.
            </span>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}

function CustomerProfilePage() {
  const { id = "" } = useParams();
  const { data: customer } = useApiData<ApiCustomerProfile | null>(
    `/users/customers/${id}`,
    null,
  );
  if (!customer)
    return (
      <>
        <div className="breadcrumbs">
          <Link to="/clientes">Clientes</Link>
        </div>
        <section className="card">
          <div className="empty-row">Carregando cadastro...</div>
        </section>
      </>
    );
  const address = [
    customer.addressStreet,
    customer.addressNumber && `nº ${customer.addressNumber}`,
    customer.addressComplement,
    customer.addressDistrict,
    customer.addressCity && `${customer.addressCity}/${customer.addressState ?? ""}`,
    customer.addressZip && `CEP ${formatZip(customer.addressZip)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/clientes">Clientes</Link>
        <ChevronRight size={13} />
        <span>{customer.fullName}</span>
      </div>
      <PageHeader
        eyebrow="FICHA DO CLIENTE"
        title={customer.fullName}
        description={
          customer.passwordSetupRequired
            ? "Cadastro criado pela venda · aguardando o cliente definir a senha"
            : `Conta ativa desde ${new Date(customer.createdAt).toLocaleDateString("pt-BR")}`
        }
        action={
          <Link className="primary" to={`/clientes/${customer.id}/editar`}>
            <UserRound size={17} />
            Editar cadastro
          </Link>
        }
      />
      <section className="detail-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">DADOS CADASTRAIS</span>
              <h2>Identificação e contato</h2>
            </div>
            <Badge tone={customer.active ? "green" : "slate"}>
              {customer.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <dl className="customer-data">
            <div>
              <dt>Tipo de cliente</dt>
              <dd>{customer.customerType === "COMPANY" ? "Pessoa Jurídica" : "Pessoa Física"}</dd>
            </div>
            <div>
              <dt>Relação com a Ford</dt>
              <dd>{fordRelationshipLabel(customer.fordRelationship)}</dd>
            </div>
            {customer.customerType === "COMPANY" ? <>
              <div><dt>CNPJ</dt><dd>{formatCnpj(customer.cnpj)}</dd></div>
              <div><dt>Razão social</dt><dd>{customer.fullName}</dd></div>
              <div><dt>Nome fantasia</dt><dd>{customer.tradeName ?? "Não informado"}</dd></div>
              <div><dt>Situação cadastral</dt><dd>{customer.companyRegistrationStatus ?? "Consulta pendente"}</dd></div>
              <div><dt>Inscrição estadual</dt><dd>{customer.stateRegistrationExempt ? "Isento" : customer.stateRegistration ?? "Não informado"}</dd></div>
              <div><dt>Representante legal</dt><dd>{customer.legalRepresentativeName ?? "Não informado"}</dd></div>
              <div><dt>CPF do representante</dt><dd>{formatCpf(customer.legalRepresentativeCpf)}</dd></div>
              <div><dt>Documento do representante</dt><dd>{customer.legalRepresentativeDocument ?? "Não informado"}</dd></div>
              <div><dt>Cargo ou função</dt><dd>{customer.legalRepresentativeRole ?? "Não informado"}</dd></div>
              <div><dt>Poderes comprovados por</dt><dd>{representationBasisLabel(customer.representationBasis)}</dd></div>
              <div><dt>Documentação</dt><dd>{customer.representationDocumentChecked ? "Conferida" : "Conferência pendente"}</dd></div>
            </> : <>
              <div><dt>CPF</dt><dd>{formatCpf(customer.cpf)}</dd></div>
              <div>
                <dt>RG</dt>
                <dd>{customer.rg ? `${customer.rg}${customer.rgIssuer ? ` · ${customer.rgIssuer}` : ""}` : "Não informado"}</dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{customer.birthDate ? new Date(customer.birthDate).toLocaleDateString("pt-BR") : "Não informado"}</dd>
              </div>
            </>}
            <div>
              <dt>E-mail</dt>
              <dd>{customer.email}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{customer.phone ?? "Não informado"}</dd>
            </div>
            <div>
              <dt>Endereço</dt>
              <dd>{address || "Não informado"}</dd>
            </div>
          </dl>
        </article>
        <div className="side-stack">
          <article className="card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">FORD POINTS</span>
                <h2>{(customer.loyalty?.balance ?? 0).toLocaleString("pt-BR")}</h2>
                <p>pontos disponíveis</p>
              </div>
              <Gift size={22} />
            </div>
          </article>
          <article className="card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">VEÍCULOS</span>
                <h2>Vínculos ativos</h2>
              </div>
            </div>
            <div className="customer-vehicles">
              {customer.ownerships.map((link) => (
                <Link
                  key={link.vehicle.vin}
                  to={`/veiculos/${link.vehicle.vin}`}
                >
                  <b>
                    {link.vehicle.model} {link.vehicle.modelYear}
                  </b>
                  <small>
                    {link.vehicle.vin} ·{" "}
                    {link.vehicle.currentMileage.toLocaleString("pt-BR")} km
                  </small>
                  {link.vehicle.warrantyUntil && (
                    <em>
                      Garantia até{" "}
                      {new Date(link.vehicle.warrantyUntil).toLocaleDateString(
                        "pt-BR",
                      )}
                    </em>
                  )}
                </Link>
              ))}
              {!customer.ownerships.length && (
                <div className="empty-row">Nenhum veículo vinculado.</div>
              )}
            </div>
          </article>
          {customer.purchases.length > 0 && (
            <article className="card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">COMPRAS</span>
                  <h2>Histórico comercial</h2>
                </div>
              </div>
              <div className="customer-vehicles">
                {customer.purchases.map((purchase) => (
                  <div key={purchase.id}>
                    <b>
                      {purchase.vehicle.model} {purchase.vehicle.modelYear}
                    </b>
                    <small>
                      {new Date(purchase.soldAt).toLocaleDateString("pt-BR")} ·{" "}
                      {brl(purchase.price)}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>
      </section>
    </>
  );
}

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function RegisterSaleDialog({
  vehicle,
  onClose,
}: {
  vehicle: ApiStockVehicle;
  onClose(): void;
}) {
  const { data: users } = useApiData<ApiUser[]>("/users", []);
  const [newCustomer, setNewCustomer] = useState(true);
  const [withTradeIn, setWithTradeIn] = useState(false);
  const customers = users.filter((item) => item.role === "CUSTOMER");
  return (
    <Modal
      title="Registrar venda"
      description={`${vehicle.model} ${vehicle.modelYear} · ${vehicle.vin}`}
      onClose={onClose}
    >
      <ActionForm
        endpoint="/sales"
        submitLabel="Concluir venda"
        onDone={onClose}
        buildBody={(form) => ({
          vin: vehicle.vin,
          ...(newCustomer
            ? {
                customer: {
                  fullName: form.get("fullName"),
                  email: form.get("email"),
                  phone: form.get("phone") || undefined,
                  cpf: form.get("cpf") || undefined,
                },
              }
            : { customerId: form.get("customerId") }),
          warrantyMonths: Number(form.get("warrantyMonths")),
          ...(withTradeIn && form.get("tradeInVin")
            ? {
                tradeInVin: form.get("tradeInVin"),
                tradeInValue: Number(form.get("tradeInValue") || 0),
              }
            : {}),
          notes: form.get("notes") || undefined,
        })}
      >
        <div className="sale-vehicle-summary">
          <div className={`vehicle-thumb large${vehicle.imageUrl ? " has-photo" : ""}`}>
            <CarFront size={24} />
            {vehicle.imageUrl && <img src={vehicle.imageUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
          </div>
          <span>
            <small>VEÍCULO SELECIONADO DO ESTOQUE</small>
            <b>{vehicle.model} {vehicle.version} {vehicle.modelYear}</b>
            <em>{vehicle.vin} · {vehicle.exteriorColor ?? "cor não informada"}</em>
          </span>
          <strong>{vehicle.listPrice ? brl(vehicle.listPrice) : "Preço não cadastrado"}</strong>
        </div>
        <div className="sale-toggle">
          <button
            type="button"
            className={newCustomer ? "" : "active"}
            onClick={() => setNewCustomer(false)}
          >
            Cliente já cadastrado
          </button>
          <button
            type="button"
            className={newCustomer ? "active" : ""}
            onClick={() => setNewCustomer(true)}
          >
            Cadastrar novo cliente
          </button>
        </div>
        {newCustomer ? (
          <>
            <label>
              Nome completo
              <input name="fullName" required minLength={3} />
            </label>
            <div className="form-grid">
              <label>
                CPF
                  <input name="cpf" placeholder="000.000.000-00" />
              </label>
              <label>
                E-mail
                <input name="email" type="email" required />
              </label>
              <label>
                Telefone
                <input name="phone" />
              </label>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={17} />
              <span>
                Este cadastro rápido é para Pessoa Física. Para vender a uma empresa, faça antes o <Link to="/clientes/novo">cadastro completo da Pessoa Jurídica</Link> e confira o representante legal.
              </span>
            </div>
          </>
        ) : (
          <label>
            Cliente
            <select name="customerId" required>
              <option value="">Selecione</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id} disabled={item.customerType === "COMPANY" && !item.companyReadyForPurchase}>
                  {item.fullName} · {item.email}{item.customerType === "COMPANY" ? item.companyReadyForPurchase ? " · PJ conferida" : " · PJ pendente" : ""}
                </option>
              ))}
            </select>
            <small>Empresas só ficam disponíveis depois da consulta do CNPJ e da conferência do representante.</small>
          </label>
        )}
        <div className="form-grid">
          <label>
            Valor da venda
            <input value={vehicle.listPrice ? brl(vehicle.listPrice) : "Preço não cadastrado"} readOnly />
          </label>
          <label>
            Garantia (meses)
            <select name="warrantyMonths" defaultValue="36">
              <option value="12">12 meses</option>
              <option value="24">24 meses</option>
              <option value="36">36 meses</option>
              <option value="60">60 meses</option>
            </select>
          </label>
        </div>
        <label className="sale-checkbox">
          <input
            type="checkbox"
            checked={withTradeIn}
            onChange={(event) => setWithTradeIn(event.target.checked)}
          />
          <span>Receber um usado na troca</span>
        </label>
        {withTradeIn && (
          <div className="form-grid">
            <label>
              VIN do usado
              <input name="tradeInVin" minLength={17} maxLength={17} />
            </label>
            <label>
              Valor avaliado (R$)
              <input name="tradeInValue" type="number" min="0" />
            </label>
          </div>
        )}
        <label>
          Observações
          <textarea name="notes" placeholder="Condições negociadas, acessórios, prazo de entrega" />
        </label>
        <div className="privacy-note">
          <CarFront size={17} />
          <span>
            Ao concluir, o cliente entra na base de Clientes, recebe o convite
            de senha e este VIN fica vinculado à conta dele.
          </span>
        </div>
      </ActionForm>
    </Modal>
  );
}

function StockAndSales() {
  const { data: stock, loading } = useApiData<ApiStockVehicle[]>(
    "/sales/stock",
    [],
  );
  const { data: sales } = useApiData<ApiSale[]>("/sales", []);
  const [selling, setSelling] = useState<ApiStockVehicle | null>(null);
  const stockValue = stock.reduce((sum, item) => sum + (item.listPrice ?? 0), 0);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const recentSales = sales.filter(
    (sale) => new Date(sale.soldAt) >= twelveMonthsAgo,
  );
  const revenue = recentSales.reduce((sum, sale) => sum + sale.price, 0);
  const used = stock.filter((item) => item.condition === "USED").length;
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL"
        title="Registrar venda"
        description="Escolha uma unidade já disponível em estoque e conclua a venda. O estoque é formado por VINs vinculados às versões dos veículos."
        action={
          <Link className="secondary" to="/veiculos">
            <KeyRound size={17} />
            Ver estoque por VIN
          </Link>
        }
      />
      <section className="stats-grid">
        <StatCard
          icon={Store}
          label="Unidades disponíveis"
          value={String(stock.length)}
          change={`${used} ${used === 1 ? "usado" : "usados"} na vitrine`}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Valor disponível"
          value={brl(stockValue)}
          change="Preço anunciado"
          tone="violet"
        />
        <StatCard
          icon={TrendingUp}
          label="Vendas (12 meses)"
          value={brl(revenue)}
          change={`${recentSales.length} ${
            recentSales.length === 1 ? "veículo vendido" : "veículos vendidos"
          }`}
          tone="green"
        />
        <StatCard
          icon={Clock3}
          label="Permanência média"
          value={
            stock.length
              ? `${Math.round(
                  stock.reduce((sum, item) => sum + item.daysInStock, 0) /
                    stock.length,
                )} dias`
              : "—"
          }
          change="Tempo em estoque"
          tone="amber"
        />
      </section>
      <section className="two-column">
        <article className="card list-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">VITRINE</span>
              <h2>Disponíveis para venda</h2>
              <p>Preço e ficha vêm do cadastro original e não são digitados novamente.</p>
            </div>
          </div>
          <div className="stock-list">
            {stock.map((item) => {
              const stockImage = item.imageUrl ?? vehicleImageFor(item.model);

              return (
                <div key={item.vin} className="stock-row stock-showcase-row">
                  <div className={`stock-vehicle-photo${stockImage ? " has-photo" : ""}`}>
                    <span>FORD</span>
                    <CarFront size={26} />
                    {stockImage && (
                      <img
                        src={stockImage}
                        alt={`${item.model} ${item.version}`}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <span className="stock-vehicle-copy">
                    <b>
                      {item.model} {item.version} {item.modelYear}
                    </b>
                    <small>
                      VIN {item.vin} · {item.exteriorColor ?? "cor não informada"} ·{" "}
                      {item.currentMileage.toLocaleString("pt-BR")} km
                    </small>
                    <em className="stock-tags">
                      <Badge tone={item.condition === "NEW" ? "blue" : "amber"}>
                        {item.condition === "NEW" ? "0 km" : "Seminovo"}
                      </Badge>
                      {item.serviceHistory > 0 && (
                        <Badge tone="green">
                          {item.serviceHistory}{" "}
                          {item.serviceHistory === 1
                            ? "serviço no histórico"
                            : "serviços no histórico"}
                        </Badge>
                      )}
                      <Badge tone="slate">{item.daysInStock} dias em estoque</Badge>
                    </em>
                  </span>
                  <strong className="stock-price">{item.listPrice ? brl(item.listPrice) : "—"}</strong>
                  <button className="primary stock-sale-button" onClick={() => setSelling(item)}>
                    Vender
                  </button>
                </div>
              );
            })}
            {!stock.length && (
              <div className="empty-row">
                {loading
                  ? "Carregando estoque..."
                  : "Nenhum veículo disponível para venda nesta unidade."}
              </div>
            )}
          </div>
        </article>
        <article className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">HISTÓRICO</span>
              <h2>Vendas recentes</h2>
              <p>Cada venda inicia um vínculo e a garantia do veículo.</p>
            </div>
          </div>
          <div className="sales-history">
            {sales.slice(0, 8).map((sale) => (
              <div key={sale.id}>
                <span className="audit-dot" />
                <span>
                  <b>
                    {sale.vehicle.model} {sale.vehicle.modelYear}
                  </b>
                  <small>
                    {sale.customer.fullName} ·{" "}
                    {new Date(sale.soldAt).toLocaleDateString("pt-BR")}
                    {sale.tradeInVehicle
                      ? ` · troca: ${sale.tradeInVehicle.model}`
                      : ""}
                  </small>
                </span>
                <strong>{brl(sale.price)}</strong>
              </div>
            ))}
            {!sales.length && (
              <div className="empty-row">
                As vendas registradas aparecerão aqui.
              </div>
            )}
          </div>
        </article>
      </section>
      {selling && (
        <RegisterSaleDialog
          vehicle={selling}
          onClose={() => setSelling(null)}
        />
      )}
    </>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'DEALERSHIP_MANAGER' || user?.role === 'FORD_ADMIN';
  const [editingDealership, setEditingDealership] =
    useState<ApiDealership | null>(null);
  const [creatingMember, setCreatingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<ApiUser | null>(null);
  const { data: dealerships } = useApiData<ApiDealership[]>("/dealerships", []);
  const { data: users } = useApiData<ApiUser[]>(canManage ? "/users" : null, []);
  const { data: audit } = useApiData<ApiAuditLog[]>(canManage ? "/audit-logs" : null, []);
  const { data: invitations } = useApiData<ApiTeamInvitation[]>(
    canManage ? "/users/team/invitations" : null,
    [],
  );
  const visibleDealerships =
    user?.role === "FORD_ADMIN"
      ? dealerships
      : dealerships.filter((item) => item.id === user?.dealershipId);
  const team = users.filter((item) => item.role !== "CUSTOMER");
  const pendingInvitations = invitations.filter(
    (item) =>
      !item.acceptedAt &&
      !item.cancelledAt &&
      new Date(item.expiresAt) > new Date(),
  );
  const actionLabels: Record<string, string> = {
    AUTH_LOGIN: "Acesso à plataforma",
    VEHICLE_CREATE: "Veículo cadastrado",
    OWNERSHIP_CLAIM: "Vínculo confirmado",
    OWNERSHIP_TRANSFER: "Proprietário transferido",
    SERVICE_ORDER_CREATE: "Ordem de serviço aberta",
    SERVICE_ORDER_UPDATE: "Ordem de serviço atualizada",
    BOOKING_CREATE: "Agendamento criado",
    BOOKING_UPDATE: "Agendamento atualizado",
    CAMPAIGN_CREATE: "Campanha criada",
    CAMPAIGN_DISPATCH: "Campanha disparada",
    REPURCHASE_LEAD_CREATE: "Lead de recompra criado",
    REPURCHASE_LEAD_UPDATE: "Lead de recompra atualizado",
    TEAM_MEMBER_CREATE: "Integrante adicionado",
    TEAM_MEMBER_UPDATE: "Acesso da equipe atualizado",
    TEAM_INVITATION_CREATE: "Convite de equipe criado",
    TEAM_INVITATION_ACCEPT: "Convite de equipe aceito",
    TEAM_INVITATION_CANCEL: "Convite de equipe cancelado",
    PASSWORD_RESET_REQUEST: "Recuperação de senha solicitada",
    PASSWORD_RESET_CONFIRM: "Senha recuperada com sucesso",
    AUTH_REVOKE_SESSIONS: "Sessões de acesso encerradas",
    AUTH_REVOKE_SESSION: "Acesso de dispositivo encerrado",
    SUPPORT_TICKET_CREATE: "Chamado de suporte aberto",
    SUPPORT_TICKET_UPDATE: "Chamado de suporte atualizado",
    DEALERSHIP_UPDATE: "Dados da concessionária atualizados",
    NOTIFICATION_CREATE: "Notificação criada",
    RECALL_CREATE: "Campanha de recall criada",
    RECALL_NOTIFY: "Proprietários notificados sobre recall",
    RECALL_TARGET_UPDATE: "Atendimento de recall atualizado",
    CONSENT_GRANT: "Consentimento concedido",
    CONSENT_REVOKE: "Consentimento revogado",
    DATA_REQUEST_CREATE: "Solicitação LGPD registrada",
    DATA_REQUEST_UPDATE: "Solicitação LGPD atualizada",
    DATA_EXPORT: "Cópia de dados exportada",
    MESSAGE_RETRY: "Reenvio de mensagem solicitado",
    MESSAGE_CANCEL: "Mensagem cancelada",
    CATALOG_ITEM_CREATE: "Item do catálogo criado",
    CATALOG_ITEM_UPDATE: "Item do catálogo atualizado",
    CATALOG_ITEM_DELETE: "Item do catálogo removido",
    CATALOG_IMAGE_UPLOAD: "Imagem do catálogo enviada",
  };
  return (
    <>
      <PageHeader
        eyebrow="PREFERÊNCIAS"
        title="Configurações"
        description="Administre a unidade, equipe, integrações e regras da operação."
        action={
          canManage ? (
            <button className="primary" onClick={() => setCreatingMember(true)}>
              <UsersRound size={17} />
              Adicionar integrante
            </button>
          ) : undefined
        }
      />
      <section className="settings-grid">
        {(
          [
            ...(canManage
              ? ([
                  [
                    Store,
                    "Concessionária",
                    "Dados da unidade, horários e capacidade",
                    "concessionaria",
                  ],
                  [
                    UsersRound,
                    "Equipe e permissões",
                    "Usuários, funções e acessos",
                    "equipe",
                  ],
                ] as const)
              : []),
            [
              ShieldCheck,
              "Privacidade e LGPD",
              "Consentimentos, retenção e auditoria",
              "privacidade",
            ],
            [Gift, "Regras de pontos", "Critérios de pontuação do programa", 'regras-pontos'],
            [Bell, "Notificações", "Central de avisos da sua conta", 'notificacoes-conta'],
            ...(canManage ? [[Activity, 'Integrações', 'Conectividade e canais da plataforma', 'integracoes']] as const : []),
          ] as const
        ).map(([Icon, title, desc, anchor]) => (
            <a href={`#${anchor}`} className="card settings-card" key={title}>
              <div className="stat-icon icon-blue">
                <Icon size={20} />
              </div>
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
              <ChevronRight size={18} />
            </a>
          ),
        )}
      </section>
      <OperationalSettings />
      {canManage ? (
        <section className="settings-workspace">
          <article className="card settings-panel" id="concessionaria">
            <div className="card-heading">
              <div>
                <span className="eyebrow">OPERAÇÃO</span>
                <h2>
                  {user?.role === "FORD_ADMIN"
                    ? "Rede cadastrada"
                    : "Minha unidade"}
                </h2>
                <p>Dados sincronizados com a operação da rede autorizada.</p>
              </div>
              <Badge tone="green">Ativo</Badge>
            </div>
            <div className="dealership-settings-list">
              {visibleDealerships.map((dealer) => (
                <div key={dealer.id} className="dealership-settings-row">
                  <div className="dealer-mark">
                    <Store size={18} />
                  </div>
                  <span>
                    <b>{dealer.tradeName}</b>
                    <small>
                      {dealer.legalName ?? "Concessionária Ford"} ·{" "}
                      {dealer.city}/{dealer.state}
                    </small>
                  </span>
                  <div>
                    <strong>{dealer._count?.staff ?? 0}</strong>
                    <small>equipe</small>
                  </div>
                  <div>
                    <strong>{dealer._count?.serviceOrders ?? 0}</strong>
                    <small>serviços</small>
                  </div>
                  <div>
                    <strong>{dealer._count?.vehiclesSold ?? 0}</strong>
                    <small>veículos</small>
                  </div>
                  <button
                    className="settings-row-action"
                    onClick={() => setEditingDealership(dealer)}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </article>
          <article className="card settings-panel" id="equipe">
            <div className="card-heading">
              <div>
                <span className="eyebrow">ACESSO</span>
                <h2>Equipe e permissões</h2>
                <p>Usuários internos com acesso à operação.</p>
              </div>
              <Badge tone="blue">
                {team.length} {team.length === 1 ? "usuário" : "usuários"}
              </Badge>
            </div>
            <div className="team-settings-list">
              {team.map((member) => (
                <div key={member.id}>
                  <span className="avatar small-avatar">
                    {member.fullName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <b>{member.fullName}</b>
                    <small>{member.email}</small>
                  </span>
                  <Badge tone={member.active ? "green" : "slate"}>
                    {member.active ? "Ativo" : "Inativo"}
                  </Badge>
                  <em>
                    {member.role === "FORD_ADMIN"
                      ? "Admin Ford"
                      : member.role === "DEALERSHIP_MANAGER"
                        ? "Gerente"
                        : "Consultor"}
                  </em>
                  {(user?.role === "FORD_ADMIN" ||
                    member.role === "DEALERSHIP_AGENT") && (
                    <button
                      className="settings-row-action"
                      onClick={() => setEditingMember(member)}
                    >
                      Gerenciar
                    </button>
                  )}
                </div>
              ))}
              {!team.length && (
                <div className="empty-row">
                  Nenhum integrante disponível para este acesso.
                </div>
              )}
            </div>
            {pendingInvitations.length > 0 && (
              <div className="pending-invitations">
                <span className="eyebrow">CONVITES PENDENTES</span>
                {pendingInvitations.map((invitation) => (
                    <div key={invitation.id}>
                      <span>
                        <b>{invitation.fullName}</b>
                        <small>
                          {invitation.email} · vence em{" "}
                          {new Date(invitation.expiresAt).toLocaleDateString(
                            "pt-BR",
                          )}
                        </small>
                      </span>
                      <button
                        className="settings-row-action danger-action"
                        onClick={async () => {
                          await api(
                            `/users/team/invitations/${invitation.id}/cancel`,
                            { method: "PATCH" },
                          );
                          notifyDataChanged();
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </article>
          <SessionSecurityPanel />
          <article className="card settings-panel audit-panel">
            <div className="card-heading">
              <div>
                <span className="eyebrow">PRIVACIDADE E LGPD</span>
                <h2>Trilha de auditoria</h2>
                <p>
                  Registro imutável das ações sensíveis realizadas na
                  plataforma.
                </p>
              </div>
              <ShieldCheck size={22} />
            </div>
            <div className="audit-list">
              {audit.slice(0, 12).map((entry) => (
                <div key={entry.id}>
                  <span className="audit-dot" />
                  <span>
                    <b>
                      {actionLabels[entry.action] ??
                        entry.action.replaceAll("_", " ")}
                    </b>
                    <small>
                      {entry.performedBy?.fullName ?? "Sistema"} ·{" "}
                      {new Date(entry.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </span>
                  <em>{entry.entityType}</em>
                </div>
              ))}
              {!audit.length && (
                <div className="empty-row">
                  A trilha será exibida conforme as operações forem realizadas.
                </div>
              )}
            </div>
          </article>
        </section>
      ) : (
        <>
          <section className="card privacy-customer-card">
            <ShieldCheck size={28} />
            <div>
              <span className="eyebrow">SEUS DADOS</span>
              <h2>Privacidade protegida</h2>
              <p>
                Seus vínculos, serviços, pontos e agendamentos são exibidos
                apenas na sua conta. Alterações sensíveis ficam registradas
                para segurança.
              </p>
            </div>
          </section>
          <section className="settings-workspace customer-settings-workspace">
            <SessionSecurityPanel />
          </section>
        </>
      )}
      {editingDealership && (
        <EditDealershipDialog
          dealership={editingDealership}
          onClose={() => setEditingDealership(null)}
        />
      )}
      {creatingMember && (
        <CreateTeamMemberDialog onClose={() => setCreatingMember(false)} />
      )}
      {editingMember && (
        <ManageTeamMemberDialog
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
      <PrivacyPanel />
    </>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="app-loading">
        <img src="/ford-vinculo-logo.svg" alt="Ford Vínculo 360" />
        <span>Preparando sua operação...</span>
      </div>
    );
  return user ? <Shell /> : <LoginPage />;
}
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
