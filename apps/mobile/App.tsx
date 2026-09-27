import { useEffect, useRef, useState } from "react";
import { request, restoreSession, signIn, signOut, subscribeSession, SessionExpiredError } from './src/session';
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gift,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  X,
  LogOut,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Send,
  Plus,
  Zap,
} from "lucide-react-native";

/** Mesma paleta do painel web, para as duas pontas falarem a mesma língua. */
const t = {
  navy: "#061d36",
  navyDeep: "#0a426e",
  blue: "#0878bd",
  bright: "#1b9be8",
  sky: "#70c7ee",
  bg: "#eef4f7",
  card: "#ffffff",
  line: "#dce7ee",
  ink: "#162b3e",
  body: "#3c5266",
  muted: "#637488",
  faint: "#8496a5",
};

/** Fotos reais locais dos modelos usados na garagem de demonstração. */
const VEHICLE_IMAGE_SOURCES = {
  territory: require("./assets/real/territory-studio-v2.png"),
  ranger: require("./assets/real/ranger-studio-v2.png"),
  maverick: require("./assets/real/maverick-studio-v2.png"),
  bronco: require("./assets/real/bronco-studio-v2.png"),
  machE: require("./assets/real/mach-e-studio-v1.png"),
  f150: require("./assets/real/f150-studio-v1.png"),
} as const;

function vehicleImageForModel(model?: string) {
  const normalized = model?.toLowerCase() ?? "";
  if (normalized.includes("territory")) return VEHICLE_IMAGE_SOURCES.territory;
  if (normalized.includes("ranger")) return VEHICLE_IMAGE_SOURCES.ranger;
  if (normalized.includes("maverick")) return VEHICLE_IMAGE_SOURCES.maverick;
  if (normalized.includes("bronco")) return VEHICLE_IMAGE_SOURCES.bronco;
  if (normalized.includes("mach-e") || normalized.includes("mustang")) return VEHICLE_IMAGE_SOURCES.machE;
  if (normalized.includes("f-150") || normalized.includes("f150")) return VEHICLE_IMAGE_SOURCES.f150;
  return null;
}

function vehicleColorSwatch(color: string) {
  const value = color.toLocaleLowerCase("pt-BR");
  if (value.includes("branc")) return "#f4f7fa";
  if (value.includes("pret")) return "#111827";
  if (value.includes("cinza") || value.includes("prata")) return "#8b99a8";
  if (value.includes("azul")) return "#1261b8";
  if (value.includes("vermelh")) return "#c92832";
  if (value.includes("verde")) return "#315943";
  if (value.includes("marrom")) return "#785647";
  if (value.includes("laranja")) return "#dc6719";
  return "#d6dde5";
}

const CATALOG_REFERENCE_IMAGES = {
  atlas: { source: VEHICLE_IMAGE_SOURCES.ranger, label: "Ranger" },
  pulse: { source: VEHICLE_IMAGE_SOURCES.maverick, label: "Maverick" },
  horizon: { source: VEHICLE_IMAGE_SOURCES.territory, label: "Territory" },
  trail: { source: VEHICLE_IMAGE_SOURCES.bronco, label: "Bronco" },
} as const;

function catalogReferenceFor(item: { slug: string; name: string }) {
  const directImage = vehicleImageForModel(item.name);
  if (directImage) return { source: directImage, label: item.name };
  return CATALOG_REFERENCE_IMAGES[
    item.slug.toLowerCase() as keyof typeof CATALOG_REFERENCE_IMAGES
  ] ?? null;
}

/** Exibida no rodapé do acesso; acompanha a versão do pacote do app. */
const APP_VERSION = "0.1.0";

function resetTokenFromUrl(url?: string | null) {
  const match = url?.match(/[?&]reset=([^&#]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

type User = { fullName: string; email: string };
type Vehicle = {
  vin: string;
  plate: string | null;
  model: string;
  modelYear: number;
  manufactureYear: number;
  currentMileage: number;
  exteriorColor: string | null;
  imageUrl?: string | null;
  warrantyUntil: string | null;
};
type Order = {
  id: string;
  description: string | null;
  mileage: number;
  status: string;
  amount: string | number | null;
  completedAt: string | null;
  createdAt: string;
  dealership: { tradeName: string; city: string; state: string };
};
/** Política de atendimento da concessionária, usada para montar os horários. */
type Ticket = {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  unreadCount: number;
  messageCount: number;
  dealership: { id: string; tradeName: string } | null;
  assignedTo: { id: string; fullName: string } | null;
};
type SupportMessage = {
  id: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
};
type Consent = {
  purpose: string;
  granted: boolean;
  updatedAt: string | null;
};
type DataRequest = {
  id: string;
  type: string;
  status: string;
  notes: string | null;
  createdAt: string;
};
type Dealership = {
  id: string;
  tradeName: string;
  city: string;
  state: string;
  /** A API já entrega normalizado como números do dia da semana. */
  businessDays: number[];
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
};
type RegistrationDealership = Pick<Dealership, "id" | "tradeName" | "city" | "state">;
type RegistrationVehicleOption = {
  key: string;
  name: string;
  modelYear: number;
  manufactureYears: number[];
  colors: string[];
  imageUrl: string | null;
};
type VehicleDetail = Vehicle & { serviceOrders: Order[] };
type Ownership = {
  id: string;
  status: "ACTIVE" | "PENDING_VERIFICATION" | "ENDED";
  vehicle: Vehicle;
  declaredMileage?: number | null;
  declaredColor?: string | null;
};
type Booking = {
  id: string;
  requestedFor: string;
  status: string;
  notes: string | null;
  dealership: { tradeName: string };
  vehicle: Vehicle;
};
type Loyalty = {
  balance: number;
  transactions: Array<{
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
  vouchers: Array<{
    id: string;
    title: string;
    code: string;
    status: string;
    pointsCost: number;
  }>;
};
type NotificationFeed = {
  unread: number;
  items: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    readAt: string | null;
  }>;
};
type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  modelCode: string | null;
  modelYear: number | null;
  version: string | null;
  category: string;
  summary: string;
  description: string;
  highlights: string | null;
  engine: string | null;
  fuelType: string | null;
  transmission: string | null;
  drive: string | null;
  power: string | null;
  torque: string | null;
  consumption: string | null;
  rangeLabel: string | null;
  dimensions: string | null;
  seats: number | null;
  warrantyLabel: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  stockLabel: string | null;
  ctaLabel: string;
  sortOrder: number;
  published: boolean;
};
type CustomerOffer = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  cta: { label: string; link: string };
  vehicle: { vin: string; model: string; modelYear: number };
};
type CustomerOffersFeed = {
  /** null significa que a vitrine não respondeu; false significa opt-out real. */
  marketingConsent: boolean | null;
  items: CustomerOffer[];
};
type Recall = {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: string;
  targets: Array<{ id: string; status: string; vehicle: Vehicle }>;
};
type Tab = "home" | "history" | "points" | "bookings" | "alerts";

/** Helpers puros: mantêm validação e regras de agenda iguais na UI e no QA. */
export function normalizeClaimVin(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

export function normalizeClaimPlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function isUpcomingBooking(
  booking: { requestedFor: string; status: string },
  now = new Date(),
) {
  return (
    (booking.status === "CONFIRMED" || booking.status === "REQUESTED") &&
    new Date(booking.requestedFor).getTime() > now.getTime()
  );
}

export function sortBookingsByDate<
  T extends { requestedFor: string },
>(bookings: T[], direction: "asc" | "desc" = "asc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...bookings].sort(
    (left, right) =>
      (new Date(left.requestedFor).getTime() -
        new Date(right.requestedFor).getTime()) *
      multiplier,
  );
}

/** Rótulos em português: nenhum enum da API chega à tela do cliente. */
const voucherLabels: Record<string, string> = {
  AVAILABLE: "ATIVO",
  REDEEMED: "UTILIZADO",
  EXPIRED: "EXPIRADO",
};
const bookingLabels: Record<string, string> = {
  REQUESTED: "A confirmar",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const bookingServiceOptions = [
  "Revisão periódica",
  "Diagnóstico do veículo",
  "Pneus e alinhamento",
  "Recall ou campanha",
  "Outro atendimento",
] as const;
const recallLabels: Record<string, string> = {
  PENDING: "AGUARDANDO AGENDAMENTO",
  CONTACTED: "PROPRIETÁRIO NOTIFICADO",
  SCHEDULED: "ATENDIMENTO AGENDADO",
  COMPLETED: "CONCLUÍDO",
};

const ticketStatusLabels: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em análise",
  RESOLVED: "Resolvido",
  CLOSED: "Encerrado",
};
const ticketCategories = [
  ["SCHEDULING", "Agendamento"],
  ["ACCESS", "Acesso à conta"],
  ["BILLING", "Cobrança"],
  ["OTHER", "Outro assunto"],
] as const;
const consentLabels: Record<string, { title: string; hint: string }> = {
  MARKETING: {
    title: "Comunicações de marketing",
    hint: "Ofertas, campanhas e novidades da rede Ford.",
  },
  ANALYTICS: {
    title: "Análise de uso",
    hint: "Ajuda a melhorar o app e os serviços da rede.",
  },
  PERSONALIZATION: {
    title: "Personalização",
    hint: "Recomendações com base no seu histórico de serviços.",
  },
};
const dataRequestTypes = [
  ["ACCESS", "Acessar meus dados", "Ver tudo o que a Ford guarda sobre você."],
  ["CORRECTION", "Corrigir meus dados", "Pedir correção de alguma informação."],
  ["DELETION", "Excluir meus dados", "Solicitar a exclusão do seu cadastro."],
] as const;
const dataRequestStatusLabels: Record<string, string> = {
  RECEIVED: "Recebida",
  IN_REVIEW: "Em análise",
  COMPLETED: "Concluída",
  REJECTED: "Indeferida",
};

const orderStatusLabels: Record<string, string> = {
  OPEN: "Em aberto",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

/** Prisma serializa Decimal como string: normalizamos antes de formatar. */
function brl(value: string | number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Cada tipo de aviso ganha o próprio ícone: a lista deixa de ser uniforme. */
const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  RECALL: ShieldAlert,
  SERVICE: Wrench,
  LOYALTY: Gift,
  BOOKING: CalendarDays,
  SYSTEM: Bell,
};

/**
 * Próximos dias em que a concessionária atende, segundo a própria política.
 * Só oferecemos o que ela aceita — o servidor recusaria um sábado e o cliente
 * levaria um erro sem entender o motivo.
 */
function availableDays(dealership: Dealership, count = 12) {
  const open = dealership.businessDays;
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (open.includes(cursor.getDay())) days.push(new Date(cursor));
  }
  return days;
}

/** Grade de horários derivada da abertura, fechamento e duração do slot. */
function availableSlots(dealership: Dealership) {
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const opening = toMinutes(dealership.openingTime);
  const closing = toMinutes(dealership.closingTime);
  const step = dealership.slotDurationMinutes;
  const slots: string[] = [];
  for (let at = opening; at + step <= closing; at += step)
    slots.push(
      `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`,
    );
  return slots;
}

/** Azul institucional do oval Ford. */
const FORD_BLUE = "#00095b";

/**
 * Emblema oval da marca.
 *
 * A assinatura cursiva da Ford é marca registrada com traço proprietário —
 * numa implantação real ela entra como arquivo oficial (SVG/PNG) fornecido
 * pela montadora. Até lá, a lataria do emblema é fiel e o lettering usa uma
 * itálica pesada ajustada, que a esta escala lê como a assinatura.
 */
function FordOval({
  width = 84,
  onDark = false,
}: {
  width?: number;
  onDark?: boolean;
}) {
  const height = width * 0.4;
  return (
    <Svg width={width} height={height} viewBox="0 0 200 80">
      <Defs>
        <SvgGradient id="fordOval" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={onDark ? "#1a4c9e" : "#123a86"} />
          <Stop offset="1" stopColor={onDark ? "#062a6b" : FORD_BLUE} />
        </SvgGradient>
      </Defs>
      {/* Sobre fundo escuro o azul institucional some: a área de respiro
          vira um contorno claro, como na aplicação em fundo negativo. */}
      <Ellipse
        cx={100}
        cy={40}
        rx={99}
        ry={39}
        fill="url(#fordOval)"
        stroke={onDark ? "rgba(255,255,255,0.3)" : "transparent"}
        strokeWidth={onDark ? 1.6 : 0}
      />
      {/* Filete interno branco, a assinatura visual do emblema. */}
      <Ellipse
        cx={100}
        cy={40}
        rx={91}
        ry={31}
        fill="none"
        stroke="#fff"
        strokeWidth={2.4}
      />
      <SvgText
        x={100}
        y={54}
        fill="#fff"
        fontSize={40}
        fontWeight="900"
        fontStyle="italic"
        textAnchor="middle"
      >
        Ford
      </SvgText>
    </Svg>
  );
}

/**
 * Perfil do utilitário em traço técnico. Um app de carro sem carro na tela
 * fica sem âncora visual — e um traço fino combina melhor com a marca do que
 * uma foto de banco de imagens.
 */
function VehicleSilhouette({ width = 244 }: { width?: number }) {
  const stroke = "#5cb2e4";
  return (
    <Svg width={width} height={width * 0.423} viewBox="0 0 260 110">
      <Path
        d="M26 81 L24 62 C24 55 28 52 38 51 L68 49 L94 19 L190 18 L208 48
           L228 50 C236 51 238 56 238 64 L237 81 L209 81
           A17 17 0 0 0 175 81 L93 81 A17 17 0 0 0 59 81 Z"
        fill="rgba(92,178,228,0.07)"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Linha de cintura: separa envidraçamento da lataria. */}
      <Path d="M70 50 L226 52" stroke={stroke} strokeWidth={1.4} opacity={0.55} />
      {/* Colunas B e C. */}
      <Path d="M128 49 L128 19" stroke={stroke} strokeWidth={1.2} opacity={0.4} />
      <Path d="M164 48 L164 18" stroke={stroke} strokeWidth={1.2} opacity={0.4} />
      <Circle cx={76} cy={81} r={17} stroke={stroke} strokeWidth={2} fill="none" />
      <Circle cx={76} cy={81} r={7} stroke={stroke} strokeWidth={1.4} fill="none" opacity={0.55} />
      <Circle cx={192} cy={81} r={17} stroke={stroke} strokeWidth={2} fill="none" />
      <Circle cx={192} cy={81} r={7} stroke={stroke} strokeWidth={1.4} fill="none" opacity={0.55} />
      {/* Sombra de apoio: sem ela o carro flutua no gradiente. */}
      <Path d="M32 100 L232 100" stroke={stroke} strokeWidth={1.4} opacity={0.22} />
    </Svg>
  );
}

/**
 * Lista vazia com uma frase solta no meio da tela parece bug. Aqui o vazio
 * explica o que fazer para preenchê-lo.
 */
function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Clock3;
  title: string;
  hint: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Icon size={22} color="#89a3b6" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

const CATALOG_FALLBACK: CatalogItem[] = [
  { id: "fallback-atlas", slug: "atlas", name: "Atlas", modelCode: "ATL-01", modelYear: 2026, version: "Work", category: "Picape de trabalho", summary: "Força, organização e autonomia para o dia a dia.", description: "Um utilitário autoral pensado para quem precisa transformar trabalho pesado em uma jornada mais simples.", highlights: "Carga inteligente · 4x4 · Cabine dupla", engine: "2.0 turbo", fuelType: "Flex", transmission: "Automática 8 marchas", drive: "4x4", power: "240 cv", torque: "380 Nm", consumption: "9,8 km/l", rangeLabel: "Autonomia estimada 720 km", dimensions: "5,30 m × 1,95 m × 1,85 m", seats: 5, warrantyLabel: "3 anos", imageUrl: null, priceLabel: "Sob consulta", stockLabel: "Sob encomenda", ctaLabel: "Tenho interesse", sortOrder: 1, published: true },
  { id: "fallback-pulse", slug: "pulse", name: "Pulse", modelCode: "PLS-01", modelYear: 2026, version: "Urban", category: "Picape urbana", summary: "Versatilidade compacta para a cidade e o fim de semana.", description: "Uma picape conceitual para acompanhar rotinas dinâmicas, com soluções flexíveis para carga e lazer.", highlights: "Eficiente · Flexível · Caçamba modular", engine: "1.5 turbo híbrido", fuelType: "Híbrido", transmission: "Automática CVT", drive: "4x2", power: "180 cv", torque: "270 Nm", consumption: "12,5 km/l", rangeLabel: "Autonomia estimada 850 km", dimensions: "5,05 m × 1,85 m × 1,75 m", seats: 5, warrantyLabel: "3 anos", imageUrl: null, priceLabel: "Sob consulta", stockLabel: "Disponível sob consulta", ctaLabel: "Tenho interesse", sortOrder: 2, published: true },
  { id: "fallback-horizon", slug: "horizon", name: "Horizon", modelCode: "HRZ-01", modelYear: 2026, version: "Family", category: "SUV conectado", summary: "Espaço, conforto e tecnologia para toda a família.", description: "Um SUV autoral que aproxima as pessoas da manutenção, da segurança e das experiências do veículo.", highlights: "Conectado · Assistências · 5 lugares", engine: "1.5 turbo", fuelType: "Flex", transmission: "Automática 7 marchas", drive: "4x2", power: "175 cv", torque: "280 Nm", consumption: "11,2 km/l", rangeLabel: "Autonomia estimada 780 km", dimensions: "4,70 m × 1,90 m × 1,70 m", seats: 5, warrantyLabel: "3 anos", imageUrl: null, priceLabel: "Sob consulta", stockLabel: "Disponível sob consulta", ctaLabel: "Tenho interesse", sortOrder: 3, published: true },
  { id: "fallback-trail", slug: "trail", name: "Trail", modelCode: "TRL-01", modelYear: 2026, version: "Adventure", category: "SUV aventureiro", summary: "Confiança e personalidade para sair do roteiro.", description: "Um conceito aventureiro criado para representar liberdade, proteção e novas descobertas.", highlights: "Tração integral · Proteção · Aventura", engine: "2.0 turbo", fuelType: "Flex", transmission: "Automática 8 marchas", drive: "4x4", power: "220 cv", torque: "360 Nm", consumption: "9,4 km/l", rangeLabel: "Autonomia estimada 700 km", dimensions: "4,55 m × 1,90 m × 1,75 m", seats: 5, warrantyLabel: "3 anos", imageUrl: null, priceLabel: "Sob consulta", stockLabel: "Pré-lançamento", ctaLabel: "Tenho interesse", sortOrder: 4, published: true },
];

function BookingItem({
  booking,
  canCancel,
  cancelling,
  onCancel,
}: {
  booking: Booking;
  canCancel: boolean;
  cancelling: boolean;
  onCancel: (booking: Booking) => void;
}) {
  const when = new Date(booking.requestedFor);
  const confirmed = booking.status === "CONFIRMED";
  return (
    <View
      style={[styles.bookingCard, !canCancel && styles.bookingCardArchived]}
      accessible={!canCancel}
      accessibilityLabel={`${booking.notes ?? "Serviço Ford"}, ${when.toLocaleString("pt-BR")}, ${bookingLabels[booking.status] ?? booking.status}`}
    >
      <View style={[styles.dateBox, !canCancel && styles.dateBoxArchived]}>
        <Text style={styles.dateWeekday}>
          {when
            .toLocaleDateString("pt-BR", { weekday: "short" })
            .replace(".", "")
            .toUpperCase()}
        </Text>
        <Text style={[styles.dateDay, !canCancel && styles.dateDayArchived]}>
          {when.getDate()}
        </Text>
        <Text style={styles.dateMonth}>
          {when
            .toLocaleDateString("pt-BR", { month: "short" })
            .replace(".", "")
            .toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{booking.notes ?? "Serviço Ford"}</Text>
        <View style={styles.bookingMeta}>
          <Clock3 size={11} color={t.faint} />
          <Text style={styles.bookingMetaText}>
            {when.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.bookingMeta}>
          <MapPin size={11} color={t.faint} />
          <Text style={styles.bookingMetaText}>
            {booking.dealership.tradeName}
          </Text>
        </View>
        <View style={styles.bookingFoot}>
          <View
            style={[
              styles.badge,
              confirmed
                ? styles.badgeGreen
                : booking.status === "REQUESTED"
                  ? styles.badgeAmber
                  : styles.badgeSlate,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                confirmed
                  ? styles.badgeTextGreen
                  : booking.status === "REQUESTED"
                    ? styles.badgeTextAmber
                    : styles.badgeTextSlate,
              ]}
            >
              {bookingLabels[booking.status] ?? booking.status}
            </Text>
          </View>
          {canCancel ? (
            <Pressable
              onPress={() => onCancel(booking)}
              disabled={cancelling}
              accessibilityRole="button"
              accessibilityLabel={`Cancelar ${booking.notes ?? "agendamento"}`}
              accessibilityState={{ disabled: cancelling }}
              hitSlop={8}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={t.muted} />
              ) : (
                <Text style={styles.bookingCancel}>Cancelar</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

async function loadSessionData(accessToken: string, selectedVin?: string) {
  const [vehicles, ownerships, account, appointments, notificationFeed, recallItems, offerFeed, catalog] =
    await Promise.all([
      request<Vehicle[]>("/vehicles", accessToken),
      request<Ownership[]>("/ownerships", accessToken),
      request<Loyalty>("/loyalty/me", accessToken),
      request<Booking[]>("/bookings", accessToken),
      request<NotificationFeed>("/notifications", accessToken),
      request<Recall[]>("/recalls", accessToken),
      request<CustomerOffersFeed>("/campaigns/offers", accessToken).catch(
        (): CustomerOffersFeed => ({ marketingConsent: null, items: [] }),
      ),
      request<CatalogItem[]>("/catalog", accessToken).catch(() => CATALOG_FALLBACK),
    ]);
  const selected = vehicles.find((item) => item.vin === selectedVin) ?? vehicles[0];
  const detail = selected
    ? await request<VehicleDetail>(`/vehicles/${selected.vin}`, accessToken)
    : null;
  return {
    vehicles,
    ownerships,
    detail,
    account,
    appointments,
    notificationFeed,
    recallItems,
    offerFeed,
    catalog,
  };
}

function OwnerApp() {
  const [showPassword, setShowPassword] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [ownerships, setOwnerships] = useState<Ownership[]>([]);
  const [vehicleBusy, setVehicleBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [activationToken, setActivationToken] = useState("");
  const [activationPassword, setActivationPassword] = useState("");
  const [activationPasswordConfirmation, setActivationPasswordConfirmation] = useState("");
  const [selfRegistrationOpen, setSelfRegistrationOpen] = useState(false);
  const [registrationName, setRegistrationName] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPhone, setRegistrationPhone] = useState("");
  const [registrationVin, setRegistrationVin] = useState("");
  const [registrationPlate, setRegistrationPlate] = useState("");
  const [registrationModel, setRegistrationModel] = useState("");
  const [registrationVehicleOptions, setRegistrationVehicleOptions] = useState<RegistrationVehicleOption[]>([]);
  const [registrationVehicleOptionKey, setRegistrationVehicleOptionKey] = useState("");
  const [registrationColor, setRegistrationColor] = useState("");
  const [registrationManufactureYear, setRegistrationManufactureYear] = useState("");
  const [registrationModelYear, setRegistrationModelYear] = useState("");
  const [registrationMileage, setRegistrationMileage] = useState("");
  const [registrationDealerships, setRegistrationDealerships] = useState<RegistrationDealership[]>([]);
  const [registrationDealershipId, setRegistrationDealershipId] = useState("");
  const [registrationTermsAccepted, setRegistrationTermsAccepted] = useState(false);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationFeed>({
    unread: 0,
    items: [],
  });
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [offers, setOffers] = useState<CustomerOffer[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>(CATALOG_FALLBACK);
  const [marketingConsent, setMarketingConsent] = useState<boolean | null>(null);
  const [claimVin, setClaimVin] = useState("");
  const [claimPlate, setClaimPlate] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimNotice, setClaimNotice] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<
    "email" | "password" | "activationPassword" | "activationPasswordConfirmation" | null
  >(
    null,
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [interestBusy, setInterestBusy] = useState("");
  const [interestConfirmation, setInterestConfirmation] = useState<{
    model: string;
    dealership: string;
  } | null>(null);
  const [vehicleDetailOpen, setVehicleDetailOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDealership, setBookingDealership] = useState<Dealership | null>(
    null,
  );
  const [bookingDay, setBookingDay] = useState<Date | null>(null);
  const [bookingSlot, setBookingSlot] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [redeeming, setRedeeming] = useState("");
  const [confirmVoucher, setConfirmVoucher] = useState<{
    code: string;
    title: string;
    pointsCost: number;
  } | null>(null);
  const [cancelling, setCancelling] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [recallDetail, setRecallDetail] = useState<Recall | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketCategory, setTicketCategory] = useState("SCHEDULING");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [activeChat, setActiveChat] = useState<Ticket | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [privacyBusy, setPrivacyBusy] = useState("");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const vehicleReveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const readActivationLink = (url?: string | null) => {
      const resetToken = resetTokenFromUrl(url);
      if (!resetToken) return;
      setActivationToken(resetToken);
      setRecovering(false);
      setError("");
      setRecoveryNotice("");
    };
    if (Platform.OS === "web") {
      readActivationLink(globalThis.location?.href);
      return;
    }
    void Linking.getInitialURL().then(readActivationLink);
    const subscription = Linking.addEventListener("url", ({ url }) => readActivationLink(url));
    return () => subscription.remove();
  }, []);

  function applySessionData(data: Awaited<ReturnType<typeof loadSessionData>>) {
    setVehicles(data.vehicles);
    setOwnerships(data.ownerships);
    setVehicle(data.detail);
    setLoyalty(data.account);
    setBookings(data.appointments);
    setNotifications(data.notificationFeed);
    setRecalls(data.recallItems);
    setOffers(data.offerFeed.items);
    setMarketingConsent(data.offerFeed.marketingConsent);
    setCatalog(data.catalog);
  }

  async function logout() {
    setAccountOpen(false);
    await signOut().catch(() => undefined);
    setToken("");
    setUser(null);
    setVehicles([]);
    setOwnerships([]);
    setVehicle(null);
    setTab('home');
    setClaimVin("");
    setClaimPlate("");
    setClaimError("");
    setClaimNotice("");
    setClaimOpen(false);
    setGarageOpen(false);
    setCatalogOpen(false);
    setProfileOpen(false);
    setInterestBusy("");
    setInterestConfirmation(null);
    setVehicleDetailOpen(false);
    setCatalog(CATALOG_FALLBACK);
  }

  async function chooseVehicle(vin: string) {
    if (vin === vehicle?.vin) return true;
    setVehicleBusy(true);
    setError('');
    try {
      applySessionData(await loadSessionData(token, vin));
      return true;
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível trocar o veículo.');
      return false;
    }
    finally { setVehicleBusy(false); }
  }

  async function claimVehicle() {
    const vin = normalizeClaimVin(claimVin);
    const plate = normalizeClaimPlate(claimPlate);
    setClaimError("");
    setClaimNotice("");
    if (vin.length !== 17) {
      setClaimError("O VIN precisa ter 17 caracteres.");
      return;
    }
    if (plate.length < 7 || plate.length > 8) {
      setClaimError("Informe uma placa válida com 7 ou 8 caracteres.");
      return;
    }
    setClaimBusy(true);
    try {
      await request("/ownerships/claim", token, {
        method: "POST",
        body: JSON.stringify({ vin, plate }),
      });
      applySessionData(await loadSessionData(token, vin));
      setClaimVin("");
      setClaimPlate("");
      setClaimOpen(false);
      setClaimNotice("Veículo vinculado. Sua garagem já está atualizada.");
    } catch (reason) {
      setClaimError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível vincular o veículo.",
      );
    } finally {
      setClaimBusy(false);
    }
  }

  async function recoverAccess() {
    if (!email.trim()) { setError('Informe seu e-mail para recuperar o acesso.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await request<{ message: string }>('/auth/password-reset/request', undefined, {
        method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setRecoveryNotice(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível recuperar o acesso.'); }
    finally { setLoading(false); }
  }

  async function completeActivation() {
    if (activationPassword.length < 8 || !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/.test(activationPassword)) {
      setError("Use ao menos 8 caracteres, com letra maiúscula, minúscula e número.");
      return;
    }
    if (activationPassword !== activationPasswordConfirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await request<{ message: string }>("/auth/password-reset/confirm", undefined, {
        method: "POST",
        body: JSON.stringify({ token: activationToken, password: activationPassword }),
      });
      setActivationToken("");
      setActivationPassword("");
      setActivationPasswordConfirmation("");
      setRecoveryNotice(`${result.message} Agora entre no app com seu e-mail e a nova senha.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar sua senha.");
    } finally { setLoading(false); }
  }

  async function openSelfRegistration() {
    setError("");
    setRecoveryNotice("");
    setRecovering(false);
    setSelfRegistrationOpen(true);
    try {
      const [units, options] = await Promise.all([
        registrationDealerships.length
          ? Promise.resolve(registrationDealerships)
          : request<RegistrationDealership[]>("/ownerships/dealerships"),
        registrationVehicleOptions.length
          ? Promise.resolve(registrationVehicleOptions)
          : request<RegistrationVehicleOption[]>("/ownerships/vehicle-options"),
      ]);
      setRegistrationDealerships(units);
      setRegistrationVehicleOptions(options);
      setRegistrationDealershipId((current) => current || units[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados da Rede Ford.");
    }
  }

  async function submitSelfRegistration() {
    const vin = normalizeClaimVin(registrationVin);
    const plate = normalizeClaimPlate(registrationPlate);
    const manufactureYear = Number(registrationManufactureYear);
    const modelYear = Number(registrationModelYear);
    const mileage = Number(registrationMileage);
    const selectedOption = registrationVehicleOptions.find(
      (option) => option.key === registrationVehicleOptionKey,
    );
    if (registrationName.trim().length < 3) { setError("Informe seu nome completo."); return; }
    if (!/^\S+@\S+\.\S+$/.test(registrationEmail.trim())) { setError("Informe um e-mail válido."); return; }
    if (vin.length !== 17) { setError("Informe o VIN completo, com 17 caracteres."); return; }
    if (
      !selectedOption ||
      selectedOption.name !== registrationModel.trim() ||
      selectedOption.modelYear !== modelYear ||
      !selectedOption.manufactureYears.includes(manufactureYear)
    ) {
      setError("Selecione o modelo e o ano na lista oficial da Ford."); return;
    }
    if (!registrationColor || !selectedOption.colors.includes(registrationColor)) {
      setError("Selecione a cor cadastrada para esse modelo."); return;
    }
    if (!Number.isInteger(manufactureYear) || !Number.isInteger(modelYear) || modelYear < manufactureYear) {
      setError("Confira o ano de fabricação e o ano-modelo."); return;
    }
    if (!Number.isInteger(mileage) || mileage < 0) { setError("Informe a quilometragem atual do veículo."); return; }
    if (!registrationTermsAccepted) { setError("Confirme que os dados e a posse do veículo são verdadeiros."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await request<{ message: string }>("/ownerships/self-registration", undefined, {
        method: "POST",
        body: JSON.stringify({
          fullName: registrationName.trim(),
          email: registrationEmail.trim().toLowerCase(),
          phone: registrationPhone.replace(/\D/g, "") || undefined,
          vin,
          plate: plate || undefined,
          model: selectedOption.name,
          exteriorColor: registrationColor,
          manufactureYear,
          modelYear,
          currentMileage: mileage,
          preferredDealershipId: registrationDealershipId || undefined,
          termsAccepted: true,
        }),
      });
      setEmail(registrationEmail.trim().toLowerCase());
      setSelfRegistrationOpen(false);
      setRecoveryNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível receber o cadastro do veículo.");
    } finally { setLoading(false); }
  }

  /** Abre o agendamento já com a rede carregada e o motivo pré-preenchido. */
  async function openBooking(note: string) {
    setBookingError("");
    setBookingNote(note);
    setBookingSlot("");
    setBookingDay(null);
    setBookingOpen(true);
    if (dealerships.length) return;
    try {
      const list = await request<Dealership[]>("/dealerships", token);
      setDealerships(list);
      setBookingDealership(list[0] ?? null);
    } catch (reason) {
      setBookingError(
        reason instanceof Error ? reason.message : "Falha ao carregar a rede.",
      );
    }
  }

  async function openOffer(offer: CustomerOffer) {
    const link = offer.cta.link.trim();
    if (link === "/agendamentos" || link.endsWith("/agendamentos")) {
      await openBooking(offer.title);
      return;
    }
    if (link === "/suporte" || link.endsWith("/suporte")) {
      setTicketCategory("SCHEDULING");
      setTicketSubject(`Dúvida sobre a revisão do meu ${offer.vehicle.model}`);
      setTicketMessage(
        `Olá, recebi o aviso "${offer.title}" sobre meu ${offer.vehicle.model} e gostaria de falar com a equipe sobre a próxima revisão.`,
      );
      await openSupport();
      return;
    }
    if (/^https?:\/\//i.test(link)) {
      try {
        await Linking.openURL(link);
      } catch {
        setError("Não foi possível abrir o link desta oferta.");
      }
      return;
    }
    setError("Esta oferta ainda não tem um destino disponível.");
  }

  async function expressCatalogInterest(item: CatalogItem) {
    if (!vehicle) {
      setError("Vincule um veículo antes de registrar o interesse de troca.");
      return;
    }
    setInterestBusy(item.id);
    setError("");
    try {
      const result = await request<{
        dealership: { tradeName: string };
      }>("/repurchase-leads/interest", token, {
        method: "POST",
        body: JSON.stringify({ vin: vehicle.vin, desiredModel: item.name }),
      });
      setCatalogOpen(false);
      setTab("home");
      setInterestConfirmation({
        model: item.name,
        dealership: result.dealership.tradeName,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível registrar seu interesse agora.",
      );
    } finally {
      setInterestBusy("");
    }
  }

  async function confirmBooking() {
    if (!vehicle || !bookingDealership || !bookingDay || !bookingSlot) return;
    setBookingBusy(true);
    setBookingError("");
    try {
      const [hour, minute] = bookingSlot.split(":").map(Number);
      const requestedFor = new Date(bookingDay);
      requestedFor.setHours(hour, minute, 0, 0);
      await request("/bookings", token, {
        method: "POST",
        body: JSON.stringify({
          vin: vehicle.vin,
          dealershipId: bookingDealership.id,
          requestedFor: requestedFor.toISOString(),
          notes: bookingNote || undefined,
        }),
      });
      applySessionData(await loadSessionData(token, vehicle?.vin));
      setBookingOpen(false);
      setTab("bookings");
    } catch (reason) {
      // O servidor recusa horário lotado ou fora do expediente: a mensagem
      // dele é mais útil que qualquer texto genérico nosso.
      setBookingError(
        reason instanceof Error ? reason.message : "Não foi possível agendar.",
      );
    } finally {
      setBookingBusy(false);
    }
  }

  /**
   * Marca o aviso como lido no servidor e já ajusta o contador local, para o
   * ponto azul sumir no toque em vez de esperar a próxima carga.
   */
  async function markRead(id: string) {
    setNotifications((current) => ({
      unread: Math.max(0, current.unread - 1),
      items: current.items.map((item) =>
        item.id === id && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    }));
    try {
      await request(`/notifications/${id}/read`, token, { method: "PATCH" });
    } catch {
      // Falha aqui não merece alarme: a próxima sincronização corrige.
    }
  }

  async function cancelBooking(id: string) {
    const booking = bookings.find((item) => item.id === id);
    if (!booking || !isUpcomingBooking(booking)) {
      setConfirmCancel(null);
      setError("Este agendamento já foi encerrado e não pode ser cancelado.");
      return;
    }
    setCancelling(id);
    try {
      await request(`/bookings/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      applySessionData(await loadSessionData(token, vehicle?.vin));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao cancelar.",
      );
    } finally {
      setCancelling("");
      setConfirmCancel(null);
    }
  }

  async function openSupport() {
    setAccountOpen(false);
    setSupportOpen(true);
    setActiveChat(null);
    setTicketError("");
    try {
      setTickets(await request<Ticket[]>("/support-tickets", token));
    } catch {
      setTicketError("Não foi possível carregar seus chamados.");
    }
  }

  async function submitTicket() {
    setTicketBusy(true);
    setTicketError("");
    try {
      const created = await request<Ticket>("/support-tickets", token, {
        method: "POST",
        body: JSON.stringify({
          subject: ticketSubject.trim(),
          message: ticketMessage.trim(),
          category: ticketCategory,
          priority: "NORMAL",
        }),
      });
      setTicketSubject("");
      setTicketMessage("");
      const nextTickets = await request<Ticket[]>("/support-tickets", token);
      setTickets(nextTickets);
      const conversation = nextTickets.find((ticket) => ticket.id === created.id);
      if (conversation) await openChat(conversation);
    } catch (reason) {
      setTicketError(
        reason instanceof Error ? reason.message : "Falha ao abrir o chamado.",
      );
    } finally {
      setTicketBusy(false);
    }
  }

  async function openPrivacy() {
    setAccountOpen(false);
    setPrivacyOpen(true);
    setPrivacyNotice("");
    try {
      const data = await request<{
        consents: Consent[];
        requests: DataRequest[];
      }>("/privacy/me", token);
      setConsents(data.consents);
      setDataRequests(data.requests);
    } catch {
      setPrivacyNotice("Não foi possível carregar seus dados de privacidade.");
    }
  }

  async function toggleConsent(purpose: string, granted: boolean) {
    setPrivacyBusy(purpose);
    // Otimista: alternar consentimento precisa responder no toque.
    setConsents((current) =>
      current.map((item) =>
        item.purpose === purpose ? { ...item, granted } : item,
      ),
    );
    try {
      await request(`/privacy/consents/${purpose}`, token, {
        method: "PUT",
        body: JSON.stringify({ granted, source: "APP" }),
      });
      if (purpose === "MARKETING") {
        void loadSessionData(token, vehicle?.vin)
          .then(applySessionData)
          .catch(() => undefined);
      }
    } catch {
      setConsents((current) =>
        current.map((item) =>
          item.purpose === purpose ? { ...item, granted: !granted } : item,
        ),
      );
      setPrivacyNotice("Não foi possível salvar. Tente novamente.");
    } finally {
      setPrivacyBusy("");
    }
  }

  async function createDataRequest(type: string) {
    setPrivacyBusy(type);
    setPrivacyNotice("");
    try {
      await request("/privacy/requests", token, {
        method: "POST",
        body: JSON.stringify({ type }),
      });
      const data = await request<{
        consents: Consent[];
        requests: DataRequest[];
      }>("/privacy/me", token);
      setConsents(data.consents);
      setDataRequests(data.requests);
      setPrivacyNotice(
        "Solicitação registrada. A equipe de privacidade responde por aqui.",
      );
    } catch (reason) {
      setPrivacyNotice(
        reason instanceof Error ? reason.message : "Falha ao solicitar.",
      );
    } finally {
      setPrivacyBusy("");
    }
  }

  async function redeemVoucher(code: string) {
    setRedeeming(code);
    try {
      await request(`/loyalty/vouchers/${code}/redeem`, token, {
        method: "POST",
      });
      applySessionData(await loadSessionData(token, vehicle?.vin));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao usar o benefício.",
      );
    } finally {
      setRedeeming("");
    }
  }

  /** Puxar para atualizar: comportamento esperado de qualquer app de conta. */
  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      applySessionData(await loadSessionData(token, vehicle?.vin));
      setError('');
    } catch (reason) {
      if (reason instanceof SessionExpiredError) {
        await logout();
        setError(reason.message);
      } else setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar os dados.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeSession((session) => {
      setToken(session?.accessToken ?? '');
      setUser(session?.user ?? null);
    });
    (async () => {
      try {
        const stored = await restoreSession();
        if (!stored) return;
        const data = await loadSessionData(stored.accessToken);
        setToken(stored.accessToken);
        setUser(stored.user);
        applySessionData(data);
      } catch (reason) {
        if (reason instanceof Error) setError(reason.message);
      } finally {
        setBootstrapping(false);
      }
    })();
    return unsubscribe;
  }, []);

  /**
   * Sincronização periódica enquanto há sessão. Sem ela, o que o consultor faz
   * no painel só aparece no app depois de um recarregamento manual — e o gesto
   * de puxar para atualizar não existe no navegador.
   */
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      loadSessionData(token, vehicle?.vin)
        .then(applySessionData)
        .catch((reason) => { if (reason instanceof SessionExpiredError) setError(reason.message); });
    }, 15_000);
    return () => clearInterval(timer);
  }, [token, vehicle?.vin]);

  useEffect(() => {
    if (!token || !supportOpen || !activeChat?.id) return;
    const ticketId = activeChat.id;
    const timer = setInterval(() => void loadChat(ticketId, true), 5_000);
    return () => clearInterval(timer);
  }, [token, supportOpen, activeChat?.id]);

  /** A troca deve parecer uma mudança de contexto, não um recarregamento brusco. */
  useEffect(() => {
    if (!vehicle?.vin) return;
    vehicleReveal.setValue(0);
    Animated.spring(vehicleReveal, {
      toValue: 1,
      damping: 17,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [vehicle?.vin, vehicleReveal]);

  async function login() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const session = await signIn(email, password);
      const data = await loadSessionData(session.accessToken);
      setToken(session.accessToken);
      setUser(session.user);
      applySessionData(data);
      setPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChat(ticketId: string, quiet = false) {
    if (!quiet) setChatLoading(true);
    try {
      const messages = await request<SupportMessage[]>(
        `/support-tickets/${ticketId}/messages`,
        token,
      );
      setChatMessages(messages);
      await request(`/support-tickets/${ticketId}/messages/read`, token, {
        method: "PATCH",
      });
      const nextTickets = await request<Ticket[]>("/support-tickets", token);
      setTickets(nextTickets);
      setActiveChat((current) =>
        current
          ? nextTickets.find((ticket) => ticket.id === current.id) ?? current
          : current,
      );
    } catch (reason) {
      if (!quiet)
        setChatError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar a conversa.",
        );
    } finally {
      if (!quiet) setChatLoading(false);
    }
  }

  async function openChat(ticket: Ticket) {
    setActiveChat(ticket);
    setChatDraft("");
    setChatError("");
    await loadChat(ticket.id);
  }

  async function sendChatMessage() {
    const body = chatDraft.trim();
    if (!activeChat || !body || chatBusy) return;
    setChatBusy(true);
    setChatError("");
    try {
      const sent = await request<SupportMessage>(
        `/support-tickets/${activeChat.id}/messages`,
        token,
        { method: "POST", body: JSON.stringify({ body }) },
      );
      setChatMessages((current) => [...current, sent]);
      setChatDraft("");
      const nextTickets = await request<Ticket[]>("/support-tickets", token);
      setTickets(nextTickets);
      setActiveChat(
        nextTickets.find((ticket) => ticket.id === activeChat.id) ?? activeChat,
      );
    } catch (reason) {
      setChatError(
        reason instanceof Error ? reason.message : "Não foi possível enviar.",
      );
    } finally {
      setChatBusy(false);
    }
  }

  const selectedRegistrationVehicleOption = registrationVehicleOptions.find(
    (option) => option.key === registrationVehicleOptionKey,
  ) ?? null;
  const normalizedRegistrationModel = registrationModel.trim().toLocaleLowerCase("pt-BR");
  const registrationModelSuggestions = registrationVehicleOptions
    .filter((option) =>
      !normalizedRegistrationModel ||
      `${option.name} ${option.modelYear}`.toLocaleLowerCase("pt-BR").includes(normalizedRegistrationModel),
    )
    .slice(0, 6);

  /**
   * Uma superfície escura só, sem ornamento: o acesso é o momento mais
   * institucional do app e qualquer decoração aqui só tira credibilidade.
   */
  const loginBackdrop = (
    <LinearGradient
      colors={["#010914", "#041527", "#020a14"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );

  if (bootstrapping)
    return (
      <View style={styles.login}>
        <StatusBar barStyle="light-content" />
        {loginBackdrop}
        <SafeAreaView style={styles.loginBooting}>
          <ActivityIndicator color={t.sky} size="large" />
        </SafeAreaView>
      </View>
    );

  if (!token || !user)
    return (
      <View style={styles.login}>
        <StatusBar barStyle="light-content" />
        {loginBackdrop}
        {/* Glow de iluminação ambiente superior */}
        <View style={styles.loginAura} pointerEvents="none">
          <Svg width="100%" height={260} viewBox="0 0 400 260">
            <Defs>
              <SvgGradient id="topAura" x1="50%" y1="0%" x2="50%" y2="100%">
                <Stop offset="0%" stopColor="#0066d6" stopOpacity="0.35" />
                <Stop offset="60%" stopColor="#004899" stopOpacity="0.12" />
                <Stop offset="100%" stopColor="#020a14" stopOpacity="0" />
              </SvgGradient>
            </Defs>
            <Ellipse cx="200" cy="40" rx="190" ry="120" fill="url(#topAura)" />
          </Svg>
        </View>

        <SafeAreaView style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.loginScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header com Emblema Ford e Tag do App */}
            <View style={styles.loginHeader}>
              <View style={styles.loginLogoContainer}>
                <FordOval width={96} onDark />
              </View>
              <View style={styles.loginBrandBadge}>
                <Text style={styles.loginBrandBadgeText}>FORD APP</Text>
                <View style={styles.loginBrandBadgeDot} />
                <Text style={styles.loginBrandBadgeSub}>VÍNCULO 360</Text>
              </View>
            </View>

            {/* Alternador de Modo (Segmented Switch) */}
            {!activationToken && !selfRegistrationOpen && (
              <View style={styles.segmentedContainer}>
                <Pressable
                  style={[styles.segmentBtn, !recovering && styles.segmentBtnActive]}
                  onPress={() => { setRecovering(false); setError(''); setRecoveryNotice(''); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.segmentBtnText, !recovering && styles.segmentBtnTextActive]}>
                    Acessar Conta
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentBtn, recovering && styles.segmentBtnActive]}
                  onPress={() => { setRecovering(true); setError(''); setRecoveryNotice(''); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.segmentBtnText, recovering && styles.segmentBtnTextActive]}>
                    Primeiro Acesso
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Títulos e Contexto */}
            <View style={styles.loginHero}>
              <Text style={styles.loginEyebrow}>
                {activationToken ? 'DEFINIÇÃO DE CREDENCIAIS' : selfRegistrationOpen ? 'SEU FORD, SUA HISTÓRIA' : recovering ? 'SUPORTE & RECUPERAÇÃO' : 'PORTAL DO PROPRIETÁRIO'}
              </Text>
              <Text style={styles.loginTitle}>
                {activationToken
                  ? 'Crie sua senha\ndo Ford App.'
                  : selfRegistrationOpen
                  ? 'Já tem um Ford?\nVamos conectar.'
                  : recovering
                  ? 'Recupere seu\nacesso seguro.'
                  : 'Seu próximo caminho\ncomeça aqui.'}
              </Text>
              <Text style={styles.loginDescription}>
                {activationToken
                  ? 'Esta senha é exclusiva para a sua conta e garantirá o acesso seguro ao veículo.'
                  : selfRegistrationOpen
                  ? 'Informe seu veículo. A Rede Ford valida o vínculo antes de liberar a sua garagem no app.'
                  : recovering
                  ? 'Digite o e-mail cadastrado na concessionária para receber as instruções com segurança.'
                  : 'Acompanhe revisões, telemetria, histórico de ordens de serviço e benefícios exclusivos.'}
              </Text>
            </View>

            {/* Formulário de Login / Recuperação */}
            {!activationToken && !selfRegistrationOpen && (
              <>
                <Text style={styles.fieldLabel}>E-MAIL CADASTRADO</Text>
                <View
                  style={[
                    styles.field,
                    focusedField === "email" && styles.fieldFocused,
                  ]}
                >
                  <Mail
                    size={17}
                    color={focusedField === "email" ? "#38bdf8" : "#62829d"}
                  />
                  <TextInput
                    style={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="seu.email@exemplo.com"
                    placeholderTextColor="#4a6984"
                  />
                </View>

                {!recovering && (
                  <>
                    <View style={styles.passwordLabelRow}>
                      <Text style={styles.fieldLabel}>SENHA DE ACESSO</Text>
                      <Pressable
                        onPress={() => { setRecovering(true); setError(''); setRecoveryNotice(''); }}
                        hitSlop={8}
                      >
                        <Text style={styles.forgotPasswordText}>Esqueci a senha</Text>
                      </Pressable>
                    </View>
                    <View
                      style={[
                        styles.field,
                        focusedField === "password" && styles.fieldFocused,
                      ]}
                    >
                      <LockKeyhole
                        size={17}
                        color={focusedField === "password" ? "#38bdf8" : "#62829d"}
                      />
                      <TextInput
                        style={styles.fieldInput}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        secureTextEntry={!showPassword}
                        accessibilityLabel="Senha"
                        placeholder="••••••••"
                        placeholderTextColor="#4a6984"
                        onSubmitEditing={() => void login()}
                        returnKeyType="go"
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        onPress={() => setShowPassword((value) => !value)}
                        style={styles.passwordToggle}
                      >
                        {showPassword ? <EyeOff size={18} color="#70c7ee" /> : <Eye size={18} color="#70c7ee" />}
                      </Pressable>
                    </View>

                    {/* Pílula de Acesso Rápido Demo (Carlos Henrique • Territory) */}
                    <Pressable
                      style={({ pressed }) => [styles.demoQuickPill, pressed && styles.demoQuickPillPressed]}
                      onPress={() => {
                        setEmail("carlos@ford360.local");
                        setPassword("Ford@360");
                        setError("");
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Preencher dados de demonstração"
                    >
                      <Zap size={13} color="#38bdf8" />
                      <Text style={styles.demoQuickPillText}>
                        Preencher demo: <Text style={styles.demoQuickPillBold}>carlos@ford360.local</Text>
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* Cadastro autônomo: pedido de validação, nunca vínculo automático. */}
            {selfRegistrationOpen && !activationToken && (
              <View style={styles.selfRegistrationForm}>
                <View style={styles.selfRegistrationNotice}>
                  <ShieldCheck size={17} color="#38bdf8" />
                  <Text style={styles.selfRegistrationNoticeText}>Seu veículo fica em análise até a conferência da Rede Ford. Isso protege a sua conta e o histórico do VIN.</Text>
                </View>

                <Text style={styles.fieldLabel}>SEU NOME COMPLETO</Text>
                <View style={styles.field}><UserRound size={17} color="#62829d" /><TextInput style={styles.fieldInput} value={registrationName} onChangeText={setRegistrationName} placeholder="Como está no documento" placeholderTextColor="#4a6984" /></View>
                <Text style={styles.fieldLabel}>E-MAIL PARA CRIAR SUA CONTA</Text>
                <View style={styles.field}><Mail size={17} color="#62829d" /><TextInput style={styles.fieldInput} value={registrationEmail} onChangeText={setRegistrationEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="seu.email@exemplo.com" placeholderTextColor="#4a6984" /></View>
                <Text style={styles.fieldLabel}>TELEFONE COM DDD <Text style={styles.optionalLabel}>OPCIONAL</Text></Text>
                <View style={styles.field}><TextInput style={styles.fieldInput} value={registrationPhone} onChangeText={setRegistrationPhone} keyboardType="phone-pad" placeholder="(11) 99999-9999" placeholderTextColor="#4a6984" /></View>

                <View style={styles.registrationSectionHeader}><CarFront size={17} color="#38bdf8" /><Text style={styles.registrationSectionTitle}>DADOS DO SEU FORD</Text></View>
                <Text style={styles.fieldLabel}>VIN</Text>
                <View style={styles.field}><TextInput style={styles.fieldInput} value={registrationVin} onChangeText={(value) => setRegistrationVin(normalizeClaimVin(value))} autoCapitalize="characters" placeholder="17 caracteres do chassi" placeholderTextColor="#4a6984" /></View>
                <Text style={styles.fieldLabel}>PLACA <Text style={styles.optionalLabel}>SE TIVER</Text></Text>
                <View style={styles.field}><TextInput style={styles.fieldInput} value={registrationPlate} onChangeText={(value) => setRegistrationPlate(normalizeClaimPlate(value))} autoCapitalize="characters" placeholder="ABC1D23" placeholderTextColor="#4a6984" /></View>
                <Text style={styles.fieldLabel}>MODELO</Text>
                <View style={styles.field}>
                  <Search size={17} color="#62829d" />
                  <TextInput
                    style={styles.fieldInput}
                    value={registrationModel}
                    onChangeText={(value) => {
                      setRegistrationModel(value);
                      setRegistrationVehicleOptionKey("");
                      setRegistrationColor("");
                    }}
                    placeholder="Digite para buscar no catálogo Ford"
                    placeholderTextColor="#4a6984"
                  />
                </View>
                {!selectedRegistrationVehicleOption && registrationModelSuggestions.length > 0 && (
                  <View style={styles.registrationModelSuggestions}>
                    {registrationModelSuggestions.map((option) => (
                      <Pressable
                        key={option.key}
                        style={styles.registrationModelSuggestion}
                        onPress={() => {
                          setRegistrationVehicleOptionKey(option.key);
                          setRegistrationModel(option.name);
                          setRegistrationModelYear(String(option.modelYear));
                          setRegistrationManufactureYear(String(option.manufactureYears[0] ?? option.modelYear));
                          setRegistrationColor(option.colors[0] ?? "");
                        }}
                        accessibilityRole="button"
                      >
                        <View style={styles.registrationModelIcon}><CarFront size={16} color="#38bdf8" /></View>
                        <View style={styles.flex}>
                          <Text style={styles.registrationModelSuggestionTitle}>{option.name}</Text>
                          <Text style={styles.registrationModelSuggestionMeta}>Ano-modelo {option.modelYear} · {option.colors.length} {option.colors.length === 1 ? "cor cadastrada" : "cores cadastradas"}</Text>
                        </View>
                        <ChevronRight size={15} color="#62829d" />
                      </Pressable>
                    ))}
                  </View>
                )}
                {selectedRegistrationVehicleOption && (
                  <>
                    <View style={styles.registrationCatalogHint}>
                      <BadgeCheck size={15} color="#34d399" />
                      <Text style={styles.registrationCatalogHintText}>Modelo reconhecido na base Ford. Agora escolha a cor do veículo.</Text>
                    </View>
                    <Text style={styles.fieldLabel}>COR DO VEÍCULO</Text>
                    <View style={styles.registrationColorChoices}>
                      {selectedRegistrationVehicleOption.colors.map((color) => (
                        <Pressable
                          key={color}
                          onPress={() => setRegistrationColor(color)}
                          style={[styles.registrationColorChoice, registrationColor === color && styles.registrationColorChoiceSelected]}
                          accessibilityRole="button"
                        >
                          <View style={[styles.registrationColorDot, { backgroundColor: vehicleColorSwatch(color) }]} />
                          <Text style={[styles.registrationColorText, registrationColor === color && styles.registrationColorTextSelected]}>{color}</Text>
                          {registrationColor === color ? <CheckCircle2 size={14} color="#34d399" /> : null}
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                <View style={styles.registrationSplit}>
                  <View style={styles.registrationSplitItem}><Text style={styles.fieldLabel}>ANO FAB.</Text><View style={styles.field}><TextInput style={styles.fieldInput} value={registrationManufactureYear} editable={false} placeholder="Selecione o modelo" placeholderTextColor="#4a6984" /></View></View>
                  <View style={styles.registrationSplitItem}><Text style={styles.fieldLabel}>ANO MODELO</Text><View style={styles.field}><TextInput style={styles.fieldInput} value={registrationModelYear} editable={false} placeholder="Selecione o modelo" placeholderTextColor="#4a6984" /></View></View>
                </View>
                <Text style={styles.fieldLabel}>QUILOMETRAGEM ATUAL</Text>
                <View style={styles.field}><TextInput style={styles.fieldInput} value={registrationMileage} onChangeText={setRegistrationMileage} keyboardType="number-pad" placeholder="Ex.: 48500" placeholderTextColor="#4a6984" /></View>

                <Text style={styles.fieldLabel}>UNIDADE PREFERIDA</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealershipChoices}>
                  {registrationDealerships.map((unit) => (
                    <Pressable key={unit.id} onPress={() => setRegistrationDealershipId(unit.id)} style={[styles.dealershipChoice, registrationDealershipId === unit.id && styles.dealershipChoiceSelected]}>
                      <Text style={[styles.dealershipChoiceName, registrationDealershipId === unit.id && styles.dealershipChoiceNameSelected]}>{unit.tradeName}</Text>
                      <Text style={[styles.dealershipChoiceLocation, registrationDealershipId === unit.id && styles.dealershipChoiceLocationSelected]}>{unit.city}/{unit.state}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable onPress={() => setRegistrationTermsAccepted((value) => !value)} style={[styles.registrationConsent, registrationTermsAccepted && styles.registrationConsentSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: registrationTermsAccepted }}>
                  <View style={[styles.registrationCheck, registrationTermsAccepted && styles.registrationCheckSelected]}>{registrationTermsAccepted ? <CheckCircle2 size={16} color="#061d36" /> : null}</View>
                  <Text style={styles.registrationConsentText}>Declaro que os dados são verdadeiros e que tenho legitimidade para solicitar a validação deste veículo.</Text>
                </Pressable>
              </View>
            )}

            {/* Modo de Ativação de Nova Senha */}
            {Boolean(activationToken) && (
              <>
                <Text style={styles.fieldLabel}>NOVA SENHA</Text>
                <View style={[styles.field, focusedField === "activationPassword" && styles.fieldFocused]}>
                  <LockKeyhole size={17} color={focusedField === "activationPassword" ? "#38bdf8" : "#62829d"} />
                  <TextInput
                    style={styles.fieldInput}
                    value={activationPassword}
                    onChangeText={setActivationPassword}
                    onFocus={() => setFocusedField("activationPassword")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    accessibilityLabel="Nova senha"
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor="#4a6984"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.passwordToggle}
                  >
                    {showPassword ? <EyeOff size={18} color="#70c7ee" /> : <Eye size={18} color="#70c7ee" />}
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>CONFIRME A SENHA</Text>
                <View style={[styles.field, focusedField === "activationPasswordConfirmation" && styles.fieldFocused]}>
                  <LockKeyhole size={17} color={focusedField === "activationPasswordConfirmation" ? "#38bdf8" : "#62829d"} />
                  <TextInput
                    style={styles.fieldInput}
                    value={activationPasswordConfirmation}
                    onChangeText={setActivationPasswordConfirmation}
                    onFocus={() => setFocusedField("activationPasswordConfirmation")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    accessibilityLabel="Confirme a senha"
                    placeholder="Repita a nova senha"
                    placeholderTextColor="#4a6984"
                    onSubmitEditing={() => void completeActivation()}
                    returnKeyType="go"
                  />
                </View>
                <View style={styles.requirementBox}>
                  <ShieldCheck size={14} color="#70c7ee" />
                  <Text style={styles.requirementText}>
                    Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.
                  </Text>
                </View>
              </>
            )}

            {/* Mensagem de Erro Glass */}
            {error ? (
              <View accessibilityRole="alert" style={styles.errorBanner}>
                <ShieldAlert size={16} color="#f87171" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Notificação de Recuperação Glass */}
            {recoveryNotice ? (
              <View style={styles.recoveryBanner}>
                <CheckCircle2 size={16} color="#34d399" />
                <Text style={styles.recoveryBannerText}>{recoveryNotice}</Text>
              </View>
            ) : null}

            {/* Botão de Ação Primário com Gradiente Elétrico */}
            <Pressable
              style={({ pressed }) => [
                styles.loginPrimaryButton,
                pressed && styles.loginPrimaryButtonPressed,
                loading && styles.loginPrimaryButtonDisabled,
              ]}
              onPress={() => void (activationToken ? completeActivation() : selfRegistrationOpen ? submitSelfRegistration() : recovering ? recoverAccess() : login())}
              accessibilityRole="button"
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ["#074478", "#053157"] : ["#0077f7", "#004eb3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginPrimaryGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginPrimaryText}>
                      {activationToken
                        ? 'Criar senha e acessar o app'
                        : selfRegistrationOpen
                        ? 'Enviar para validação'
                        : recovering
                        ? 'Enviar instruções por e-mail'
                        : 'Entrar na minha conta'}
                    </Text>
                    <ArrowRight size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Alternador de rodapé quando em modo recovering */}
            {recovering && !activationToken && (
              <Pressable
                accessibilityRole="button"
                onPress={() => { setRecovering(false); setError(''); setRecoveryNotice(''); }}
                style={styles.backToLoginBtn}
              >
                <Text style={styles.backToLoginText}>Lembrou da senha? <Text style={styles.backToLoginBold}>Voltar para o login</Text></Text>
              </Pressable>
            )}

            {!activationToken && !selfRegistrationOpen && !recovering && (
              <Pressable onPress={() => void openSelfRegistration()} style={styles.selfRegistrationLink} accessibilityRole="button">
                <CarFront size={16} color="#70c7ee" />
                <Text style={styles.selfRegistrationLinkText}>Já tenho um Ford e ainda não tenho conta</Text>
                <ChevronRight size={16} color="#70c7ee" />
              </Pressable>
            )}
            {selfRegistrationOpen && !activationToken && (
              <Pressable onPress={() => { setSelfRegistrationOpen(false); setError(""); }} style={styles.backToLoginBtn} accessibilityRole="button">
                <Text style={styles.backToLoginText}>Já possui acesso? <Text style={styles.backToLoginBold}>Voltar para o login</Text></Text>
              </Pressable>
            )}

            <View style={styles.loginSpacer} />

            {/* Rodapé de Segurança e LGPD Premium */}
            <View style={styles.loginFooter}>
              <View style={styles.loginFooterRow}>
                <ShieldCheck size={14} color="#38bdf8" />
                <Text style={styles.loginFooterSecurity}>
                  Ambiente Protegido Ford SYNC® · Conexão Criptografada · LGPD
                </Text>
              </View>
              <Text style={styles.loginFooterBrand}>
                Ford Motor Company Brasil · Ford App v{APP_VERSION}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );

  const pendingOwnership = ownerships.find(
    (ownership) => ownership.status === "PENDING_VERIFICATION",
  ) ?? null;
  const pendingVehicle = pendingOwnership
    ? {
        ...pendingOwnership.vehicle,
        currentMileage: pendingOwnership.declaredMileage ?? pendingOwnership.vehicle.currentMileage,
        exteriorColor: pendingOwnership.declaredColor ?? pendingOwnership.vehicle.exteriorColor,
      }
    : null;
  const displayedVehicle = vehicle ?? pendingVehicle;
  const nextMileage = vehicle
    ? Math.ceil((vehicle.currentMileage + 1) / 10000) * 10000
    : 0;
  const previousMileage = Math.max(0, nextMileage - 10000);
  /**
   * Avanço dentro do intervalo atual de revisão. Medir sobre a quilometragem
   * total daria 96% a um carro que acabou de sair da oficina.
   */
  const servicePercent = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        (((vehicle?.currentMileage ?? 0) - previousMileage) /
          Math.max(1, nextMileage - previousMileage)) *
          100,
      ),
    ),
  );
  const availableVouchers =
    loyalty?.vouchers.filter((item) => item.status === "AVAILABLE").length ?? 0;
  const history = vehicle?.serviceOrders ?? [];
  /** Regra demonstrativa do piloto: revisão concluída vira crédito de recompra. */
  const eligibleTradeReviews = history.filter(
    (order) => order.status === "COMPLETED" && order.description?.toLowerCase().includes("revis"),
  ).length;
  const tradeBonusPerReview = 500;
  const tradeBonusCap = 3000;
  const tradeBonus = Math.min(tradeBonusCap, eligibleTradeReviews * tradeBonusPerReview);
  const tradeBonusProgress = Math.round((tradeBonus / tradeBonusCap) * 100);
  const tradeBonusLabel = tradeBonus.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const pointsEarned =
    loyalty?.transactions
      .filter((item) => item.amount > 0)
      .reduce((total, item) => total + item.amount, 0) ?? 0;
  const pointsRedeemed =
    loyalty?.transactions
      .filter((item) => item.amount < 0)
      .reduce((total, item) => total - item.amount, 0) ?? 0;
  const upcomingBookings = sortBookingsByDate(
    bookings.filter((booking) => isUpcomingBooking(booking)),
  );
  const previousBookings = sortBookingsByDate(
    bookings.filter((booking) => !isUpcomingBooking(booking)),
    "desc",
  );
  const latestOrder = history[0] ?? null;
  const maintenanceStatus = !vehicle
    ? "Vincule um veículo"
    : recalls.length
      ? "Atenção imediata"
      : servicePercent >= 85
        ? "Revisão próxima"
        : "Em dia";
  const maintenanceStatusTone = !vehicle || recalls.length || servicePercent >= 85 ? "warning" : "good";
  const warrantyText = vehicle?.warrantyUntil
    ? `Até ${new Date(vehicle.warrantyUntil).toLocaleDateString("pt-BR")}`
    : "Não informado";
  const attention = pendingVehicle && !vehicle
    ? {
        tone: "blue" as const,
        title: "Seu Ford já está em validação",
        description: `${pendingVehicle.model} ${pendingVehicle.modelYear} · ${pendingVehicle.currentMileage.toLocaleString("pt-BR")} km. A Rede Ford está conferindo o VIN e a posse.`,
        action: "Acompanhar",
      }
    : !vehicle
    ? {
        tone: "blue" as const,
        title: "Comece pela sua garagem",
        description: "Vincule seu Ford para liberar histórico, manutenção, pontos e agendamentos.",
        action: "Vincular veículo",
      }
    : recalls.length
      ? {
          tone: "red" as const,
          title: "Seu Ford precisa de atenção",
          description: `${recalls[0].title}. Consulte os detalhes e agende o atendimento gratuito.`,
          action: "Ver alerta",
        }
      : upcomingBookings.length
        ? {
            tone: "green" as const,
            title: "Você tem uma visita marcada",
            description: `${upcomingBookings[0].dealership.tradeName} espera você em ${new Date(upcomingBookings[0].requestedFor).toLocaleDateString("pt-BR")}.`,
            action: "Ver agenda",
          }
        : availableVouchers > 0
          ? {
              tone: "violet" as const,
              title: "Você tem um benefício disponível",
              description: "Use seus pontos na próxima passagem pela rede autorizada.",
              action: "Ver benefício",
            }
          : {
              tone: "green" as const,
              title: "Seu Ford está em dia",
              description: "Continue acompanhando a quilometragem para programar a próxima revisão.",
              action: "Agendar revisão",
            };
  function openAttention() {
    if (pendingVehicle && !vehicle) { setSupportOpen(true); return; }
    if (!vehicle) { setClaimOpen(true); return; }
    if (recalls.length) { setRecallDetail(recalls[0]); return; }
    if (upcomingBookings.length) { setTab("bookings"); return; }
    if (availableVouchers > 0) { setTab("points"); return; }
    void openBooking(`Revisão de ${nextMileage.toLocaleString("pt-BR")} km`);
  }
  const attentionCardStyle = attention.tone === "red"
    ? styles.attentionRed
    : attention.tone === "green"
      ? styles.attentionGreen
      : attention.tone === "violet"
      ? styles.attentionViolet
      : styles.attentionBlue;
  const vehicleImage = displayedVehicle?.imageUrl
    ? { uri: displayedVehicle.imageUrl }
    : vehicleImageForModel(displayedVehicle?.model);
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar
        barStyle={tab === "home" ? "light-content" : "dark-content"}
      />
      {/* Fora da home a tarja escura não carregava nada e ainda repetia
          título com o cabeçalho da página: vira barra clara e fixa. */}
      {tab !== "home" && (
        <View style={styles.topbar}>
          <View style={styles.topbarBrand}>
            <FordOval width={62} />
            <View style={styles.topbarDivider} />
            <Text style={styles.topbarProduct}>FORD APP</Text>
          </View>
          <Pressable
            style={styles.avatarLight}
            onPress={() => setAccountOpen(true)}
            accessibilityLabel="Abrir minha conta"
            accessibilityRole="button"
          >
            <UserRound size={17} color="#0a5f9c" />
          </Pressable>
        </View>
      )}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={t.blue}
            colors={[t.blue]}
          />
        }
      >
        {error ? <View style={styles.connectionNotice} accessibilityRole="alert"><Text style={styles.connectionNoticeText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View> : null}
        {tab === "home" && (
          <LinearGradient
            colors={[t.navy, "#0b3f68"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[styles.header, styles.headerHome]}
          >
            <View style={styles.headerRow}>
              <View>
                <FordOval width={58} onDark />
                <Text style={styles.headerGreeting}>
                  OLÁ, {user.fullName.split(" ")[0].toUpperCase()}
                </Text>
                <Text style={styles.headerTitle}>Meu Ford</Text>
              </View>
              <View style={styles.headerActions}>
              <Pressable style={styles.profile} onPress={() => void refresh()} disabled={refreshing} accessibilityLabel="Atualizar meus dados" accessibilityRole="button">
                {refreshing ? <ActivityIndicator color="#cfe6f8" /> : <RefreshCw size={18} color="#cfe6f8" />}
              </Pressable>
              <Pressable
                style={styles.profile}
                onPress={() => setAccountOpen(true)}
                accessibilityLabel="Abrir minha conta"
                accessibilityRole="button"
              >
                <UserRound size={18} color="#cfe6f8" />
              </Pressable>
              </View>
            </View>
              <View style={styles.verified}>
                {vehicle ? <BadgeCheck size={12} color="#8fe0b6" /> : pendingVehicle ? <Clock3 size={12} color="#f7c76b" /> : <CarFront size={12} color="#9acbe6" />}
                <Text style={styles.verifiedText}>{vehicle ? 'VEÍCULO VINCULADO' : pendingVehicle ? 'VEÍCULO EM VALIDAÇÃO' : 'MINHA GARAGEM'}</Text>
              </View>
              <Text style={styles.vehicleName}>
                {displayedVehicle
                  ? `${displayedVehicle.model} ${displayedVehicle.modelYear}`
                  : "Vincule seu Ford"}
              </Text>
              <Text style={styles.vehicleVin}>
                {displayedVehicle?.vin ?? "Seu veículo aparecerá aqui"}
              </Text>
              <View style={styles.heroArt}>
                {vehicleImage ? (
                  <Animated.View
                    style={[
                      styles.vehicleHeroVisual,
                      {
                        opacity: vehicleReveal,
                        transform: [{
                          scale: vehicleReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        }],
                      },
                    ]}
                  >
                    <Image
                      source={vehicleImage}
                      style={styles.vehicleHeroImage}
                      resizeMode="contain"
                      accessible
                      accessibilityLabel={`Foto do ${displayedVehicle?.model ?? "veículo"}`}
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={["rgba(3, 20, 36, 0)", "rgba(3, 20, 36, 0.86)"]}
                      locations={[0.42, 1]}
                      style={styles.vehicleHeroShade}
                    />
                    <View style={styles.vehiclePhotoTag}>
                      <CarFront size={11} color="#dff4ff" />
                      <Text style={styles.vehiclePhotoTagText}>FOTO REAL DO MODELO</Text>
                    </View>
                    <View pointerEvents="none" style={styles.vehiclePhotoCaption}>
                      <Text style={styles.vehiclePhotoCaptionModel}>{displayedVehicle?.model}</Text>
                      <Text style={styles.vehiclePhotoCaptionMeta}>Linha {displayedVehicle?.modelYear}</Text>
                    </View>
                  </Animated.View>
                ) : (
                  <VehicleSilhouette />
                )}
              </View>
              {vehicles.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir minha garagem para trocar de veículo"
                  onPress={() => setGarageOpen(true)}
                  style={({ pressed }) => [styles.garageSwitcher, pressed && styles.garageSwitcherPressed]}
                >
                  <View style={styles.garageSwitcherIcon}><CarFront size={16} color="#dff4ff" /></View>
                  <View style={styles.flex}>
                    <Text style={styles.garageLabel}>MINHA GARAGEM · {vehicles.length} {vehicles.length === 1 ? "VEÍCULO" : "VEÍCULOS"}</Text>
                    <Text style={styles.garageSwitcherText}>{vehicles.length > 1 ? "Trocar o Ford em uso" : "Gerenciar ou adicionar outro Ford"}</Text>
                  </View>
                  <View style={styles.garageSwitcherAction}>
                    <Gift size={12} color="#8fe0b6" />
                    <View>
                      <Text style={styles.garageSwitcherBonusLabel}>BÔNUS TROCA</Text>
                      <Text style={styles.garageSwitcherActionText}>{tradeBonusLabel}</Text>
                    </View>
                    <ChevronRight size={14} color="#dff4ff" />
                  </View>
                </Pressable>
              )}
              {/* Números do carro em faixa contínua: densidade em vez de
                  mais um retângulo empilhado. */}
              <View style={styles.heroMetrics}>
                {(
                  [
                    [
                      `${displayedVehicle?.currentMileage.toLocaleString("pt-BR") ?? 0} km`,
                      "QUILOMETRAGEM",
                    ],
                    [displayedVehicle?.exteriorColor ?? displayedVehicle?.plate ?? "—", displayedVehicle?.exteriorColor ? "COR" : "PLACA"],
                    [vehicle ? `${loyalty?.balance.toLocaleString("pt-BR") ?? 0} pts` : pendingVehicle ? "EM ANÁLISE" : "—", vehicle ? "FORD POINTS" : "STATUS"],
                  ] as const
                ).map(([value, label], index) => (
                  <View key={label} style={styles.heroMetric}>
                    {index > 0 && <View style={styles.heroDivider} />}
                    <Text style={styles.heroMetricValue}>{value}</Text>
                    <Text style={styles.heroMetricLabel}>{label}</Text>
                  </View>
                ))}
              </View>
          </LinearGradient>
        )}
        <View style={styles.body}>
        {tab === "home" && (
          <>
            {claimNotice ? (
              <View
                style={styles.successNotice}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <BadgeCheck size={17} color="#247a50" />
                <Text style={styles.successNoticeText}>{claimNotice}</Text>
              </View>
            ) : null}
            {!vehicle && pendingVehicle ? (
              <View style={styles.pendingVehicleCard}>
                <View style={styles.pendingVehicleIcon}><ShieldCheck size={20} color="#0a6cad" /></View>
                <View style={styles.flex}>
                  <Text style={styles.pendingVehicleEyebrow}>VALIDAÇÃO PROTEGIDA</Text>
                  <Text style={styles.pendingVehicleTitle}>Seu veículo já foi recebido</Text>
                  <Text style={styles.pendingVehicleDescription}>
                    {pendingVehicle.model} {pendingVehicle.modelYear} · {pendingVehicle.exteriorColor ?? "cor não informada"} · {pendingVehicle.currentMileage.toLocaleString("pt-BR")} km. O acesso aos serviços será liberado após a conferência do VIN e da posse.
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={[styles.attentionCard, attentionCardStyle]}>
              <View style={styles.attentionIcon}><Sparkles size={17} color="#fff" /></View>
              <View style={styles.flex}>
                <Text style={styles.attentionLabel}>AGORA</Text>
                <Text style={styles.attentionTitle}>{attention.title}</Text>
                <Text style={styles.attentionDescription}>{attention.description}</Text>
              </View>
              <Pressable style={styles.attentionAction} onPress={openAttention} accessibilityRole="button"><Text style={styles.attentionActionText}>{attention.action}</Text><ArrowRight size={14} color={t.blue} /></Pressable>
            </View>
            {((!vehicle && !pendingVehicle) || claimOpen) && (
              <View style={styles.claimCard}>
                <View style={styles.claimHead}>
                  <View style={styles.claimIcon}>
                    <CarFront size={20} color={t.blue} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.claimEyebrow}>MINHA GARAGEM</Text>
                    <Text style={styles.claimTitle}>Vincule seu Ford</Text>
                  </View>
                  {vehicle && <Pressable onPress={() => { setClaimOpen(false); setClaimError(""); }} accessibilityRole="button" accessibilityLabel="Fechar adição de veículo" hitSlop={8}><X size={18} color={t.muted} /></Pressable>}
                </View>
                <Text style={styles.claimDescription}>
                  Confirme o VIN e a placa para trazer o histórico, os serviços
                  e os benefícios do seu veículo para esta conta.
                </Text>
                <Text style={styles.fieldLabelLight}>VIN · 17 CARACTERES</Text>
                <TextInput
                  value={claimVin}
                  onChangeText={(value) => {
                    setClaimVin(normalizeClaimVin(value));
                    setClaimError("");
                  }}
                  style={styles.claimInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={17}
                  placeholder="Ex.: 9BF..."
                  placeholderTextColor={t.faint}
                  accessibilityLabel="VIN do veículo"
                />
                <Text style={styles.fieldLabelLight}>PLACA</Text>
                <TextInput
                  value={claimPlate}
                  onChangeText={(value) => {
                    setClaimPlate(normalizeClaimPlate(value));
                    setClaimError("");
                  }}
                  style={styles.claimInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  placeholder="ABC1D23"
                  placeholderTextColor={t.faint}
                  accessibilityLabel="Placa do veículo"
                  onSubmitEditing={() => void claimVehicle()}
                  returnKeyType="done"
                />
                {claimError ? (
                  <Text accessibilityRole="alert" style={styles.claimError}>
                    {claimError}
                  </Text>
                ) : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.claimButton,
                    pressed && styles.primaryButtonPressed,
                    claimBusy && styles.buttonDisabled,
                  ]}
                  onPress={() => void claimVehicle()}
                  disabled={claimBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Vincular veículo à minha conta"
                  accessibilityState={{ disabled: claimBusy, busy: claimBusy }}
                >
                  {claimBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Vincular veículo</Text>
                      <ArrowRight size={17} color="#fff" />
                    </>
                  )}
                </Pressable>
                <View style={styles.claimPrivacy}>
                  <ShieldCheck size={13} color="#4d738e" />
                  <Text style={styles.claimPrivacyText}>
                    Os dois dados precisam coincidir com o cadastro Ford.
                  </Text>
                </View>
              </View>
            )}
            {vehicle && (
              <View style={styles.vehicleProfileCard}>
                <View style={styles.vehicleProfileHead}>
                  <View style={styles.vehicleProfileArt}>
                    {vehicleImage ? (
                      <Image
                        source={vehicleImage}
                        style={styles.vehicleProfileImage}
                        resizeMode="contain"
                        accessible
                        accessibilityLabel={`Foto do ${vehicle.model}`}
                      />
                    ) : (
                      <VehicleSilhouette width={126} />
                    )}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.vehicleProfileEyebrow}>VEÍCULO ATIVO</Text>
                    <Text style={styles.vehicleProfileName}>{vehicle.model} {vehicle.modelYear}</Text>
                    <Text style={styles.vehicleProfileIdentity}>{vehicle.plate ?? "Placa não informada"} · {vehicle.vin}</Text>
                    <View style={styles.vehicleProfileStatus}>{recalls.length ? <ShieldAlert size={12} color="#c8443d" /> : <BadgeCheck size={12} color="#247a50" />}<Text style={[styles.vehicleProfileStatusText, recalls.length > 0 ? styles.vehicleProfileStatusWarning : null]}>{recalls.length ? "Atenção necessária" : "Acompanhamento ativo"}</Text></View>
                  </View>
                </View>
                <View style={styles.vehicleProfileGrid}>
                  <View style={styles.vehicleProfileMetric}><Text style={styles.vehicleProfileMetricValue}>{vehicle.currentMileage.toLocaleString("pt-BR")} km</Text><Text style={styles.vehicleProfileMetricLabel}>ODÔMETRO</Text></View>
                  <View style={styles.vehicleProfileMetric}><Text style={styles.vehicleProfileMetricValue}>{latestOrder ? new Date(latestOrder.completedAt ?? latestOrder.createdAt).toLocaleDateString("pt-BR") : "—"}</Text><Text style={styles.vehicleProfileMetricLabel}>ÚLTIMO SERVIÇO</Text></View>
                  <View style={styles.vehicleProfileMetric}><Text style={styles.vehicleProfileMetricValue}>{nextMileage.toLocaleString("pt-BR")} km</Text><Text style={styles.vehicleProfileMetricLabel}>PRÓXIMA REVISÃO</Text></View>
                </View>
                <Pressable style={styles.vehicleProfileAction} onPress={() => setVehicleDetailOpen(true)} accessibilityRole="button"><Text style={styles.vehicleProfileActionText}>Ver ficha mecânica completa</Text><ChevronRight size={15} color={t.blue} /></Pressable>
              </View>
            )}
            {recalls[0] && (
              <Pressable
                style={styles.recallAlert}
                onPress={() => setRecallDetail(recalls[0])}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalhes da campanha de segurança ${recalls[0].title}`}
              >
                <View style={styles.recallAlertIcon}>
                  <ShieldAlert size={17} color="#c8443d" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.recallAlertLabel}>
                    CAMPANHA DE SEGURANÇA
                  </Text>
                  <Text style={styles.recallAlertTitle}>
                    {recalls[0].title}
                  </Text>
                  <Text style={styles.recallAlertHint}>
                    Toque para consultar os detalhes
                  </Text>
                </View>
                <ChevronRight size={17} color="#b98380" />
              </Pressable>
            )}
            <Text style={styles.sectionTitle}>Próxima manutenção</Text>
            <View style={styles.serviceCard}>
              <View style={styles.serviceHead}>
                <View style={styles.roundIcon}>
                  <Wrench size={18} color="#0c72b8" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>
                    {vehicle ? `Revisão de ${nextMileage.toLocaleString('pt-BR')} km` : 'Seu Ford ainda não está vinculado'}
                  </Text>
                  {vehicle ? <Text style={styles.muted}>
                    Faltam{" "}
                    {Math.max(
                      0,
                      nextMileage - (vehicle?.currentMileage ?? 0),
                    ).toLocaleString("pt-BR")}{" "}
                    km
                  </Text> : <Text style={styles.muted}>Use o vínculo seguro acima para adicionar seu veículo.</Text>}
                </View>
                {vehicle && <Text style={styles.servicePercent}>{servicePercent}%</Text>}
              </View>
              <View style={styles.progress}>
                <View
                  style={[styles.progressFill, { width: `${servicePercent}%` }]}
                />
              </View>
              {/* Extremos rotulados: uma barra nua não diz de onde nem até onde. */}
              <View style={styles.progressScale}>
                <Text style={styles.progressScaleText}>
                  {previousMileage.toLocaleString("pt-BR")} km
                </Text>
                <Text style={styles.progressScaleText}>
                  {nextMileage.toLocaleString("pt-BR")} km
                </Text>
              </View>
            </View>
            {availableVouchers > 0 && (
              <Pressable
                style={styles.benefitCard}
                onPress={() => setTab("points")}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${availableVouchers} ${availableVouchers === 1 ? "benefício disponível" : "benefícios disponíveis"}`}
              >
                <View style={styles.benefitIcon}>
                  <Gift size={19} color="#a9daf6" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.benefitTitle}>
                    {availableVouchers}{" "}
                    {availableVouchers === 1
                      ? "benefício disponível"
                      : "benefícios disponíveis"}
                  </Text>
                  <Text style={styles.benefitHint}>
                    Use na próxima passagem pela concessionária
                  </Text>
                </View>
                <ChevronRight size={17} color="#7fb9e0" />
              </Pressable>
            )}
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={[styles.sectionTitle, styles.sectionTitleFlush]}>
                  Ofertas para você
                </Text>
                <Text style={styles.sectionHint}>Campanhas enviadas pela rede Ford</Text>
              </View>
              <Sparkles size={17} color="#8c63c8" />
            </View>
            {offers.length ? (
              offers.slice(0, 2).map((offer) => (
                <View key={`${offer.id}-${offer.vehicle.vin}`} style={styles.offerCard}>
                  <LinearGradient
                    colors={["#f3edfc", "#fbf9fe"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.offerIcon}
                  >
                    <Sparkles size={18} color="#7549bb" />
                  </LinearGradient>
                  <View style={styles.flex}>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                    <Text style={styles.offerVehicle}>
                      PARA {offer.vehicle.model.toUpperCase()} {offer.vehicle.modelYear}
                    </Text>
                    <Text style={styles.offerMessage}>{offer.description}</Text>
                    <Text style={styles.offerDate}>
                      Disponível até {new Date(offer.endsAt).toLocaleDateString("pt-BR")}
                    </Text>
                    {offer.cta.link && vehicle ? (
                      <Pressable
                        style={styles.offerAction}
                        onPress={() => void openOffer(offer)}
                        accessibilityRole="button"
                        accessibilityLabel={`${offer.cta.label}: ${offer.title}`}
                      >
                        <Text style={styles.offerActionText}>{offer.cta.label}</Text>
                        <ArrowRight size={13} color="#7549bb" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            ) : marketingConsent === false ? (
              <Pressable
                style={styles.offerEmptyCard}
                onPress={() => void openPrivacy()}
                accessibilityRole="button"
                accessibilityLabel="Revisar preferência de comunicações de marketing"
              >
                <View style={styles.offerEmptyIcon}>
                  <ShieldCheck size={18} color="#8c63c8" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Ofertas estão desativadas</Text>
                  <Text style={styles.muted}>
                    Revise sua preferência de marketing em Privacidade para receber campanhas.
                  </Text>
                </View>
                <ChevronRight size={16} color="#8c63c8" />
              </Pressable>
            ) : (
              <View style={styles.offerEmptyCard}>
                <View style={styles.offerEmptyIcon}>
                  <Sparkles size={18} color="#8c63c8" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Nenhuma oferta ativa no momento</Text>
                  <Text style={styles.muted}>
                    Quando uma campanha vigente for destinada ao seu Ford, ela aparecerá aqui.
                  </Text>
                </View>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.chatEntryCard,
                pressed && styles.chatEntryCardPressed,
              ]}
              onPress={() => void openSupport()}
              accessibilityRole="button"
              accessibilityLabel="Conversar com a equipe Ford"
            >
              <View style={styles.chatEntryIcon}>
                <LifeBuoy size={19} color="#fff" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.chatEntryLabel}>ATENDIMENTO HUMANO</Text>
                <Text style={styles.chatEntryTitle}>Falar com a Ford</Text>
                <Text style={styles.chatEntryHint}>
                  Tire dúvidas e acompanhe suas solicitações sem sair do app.
                </Text>
              </View>
              <ChevronRight size={18} color="#5d86a0" />
            </Pressable>
            <Text style={styles.sectionTitle}>Atalhos</Text>
            <View style={styles.shortcuts}>
            <Pressable
              style={[styles.shortcut, !vehicle && styles.shortcutDisabled]}
              disabled={!vehicle}
                accessibilityRole="button"
                accessibilityLabel="Agendar serviço"
                accessibilityState={{ disabled: !vehicle }}
                onPress={() =>
                  void openBooking(
                    `Revisão de ${nextMileage.toLocaleString("pt-BR")} km`,
                  )
                }
              >
                <View style={styles.shortcutIcon}>
                  <CalendarDays size={18} color="#0c72b8" />
                </View>
                <Text style={styles.shortcutText}>Agendar serviço</Text>
              </Pressable>
              <Pressable
                style={styles.shortcut}
                onPress={() => setTab("history")}
                accessibilityRole="button"
                accessibilityLabel="Ver histórico do veículo"
              >
                <View style={[styles.shortcutIcon, styles.shortcutIconGreen]}>
                  <Clock3 size={18} color="#228657" />
                </View>
                <Text style={styles.shortcutText}>Ver histórico</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.catalogTeaser}
              onPress={() => setCatalogOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Conhecer a vitrine de conceitos"
            >
              <View style={styles.catalogTeaserArt}>
                <CarFront size={22} color="#9bd4f2" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.catalogTeaserEyebrow}>VITRINE FORD APP</Text>
                <Text style={styles.catalogTeaserTitle}>Conheça nossos conceitos</Text>
                <Text style={styles.catalogTeaserHint}>Explore ideias de veículos para a próxima garagem conectada.</Text>
              </View>
              <ChevronRight size={18} color="#9bd4f2" />
            </Pressable>
          </>
        )}
        {tab === "history" && (
          <>
            <Text style={styles.pageTitle}>Histórico do veículo</Text>
            <Text style={styles.pageSubtitle}>
              A identidade do seu Ford preservada pelo VIN.
            </Text>
            {history.length > 0 && (
              <View style={styles.statStrip}>
                {(
                  [
                    [String(history.length), "SERVIÇOS"],
                    [
                      `${(history[0].mileage - history[history.length - 1].mileage).toLocaleString("pt-BR")} km`,
                      "NO PERÍODO",
                    ],
                    [
                      new Date(
                        history[history.length - 1].completedAt ??
                          history[history.length - 1].createdAt,
                      ).getFullYear().toString(),
                      "DESDE",
                    ],
                  ] as const
                ).map(([value, label], index) => (
                  <View key={label} style={styles.statCell}>
                    {index > 0 && <View style={styles.statDivider} />}
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* Uma superfície só com a linha do tempo dentro: quatro cartões
                soltos não comunicavam que é a história de um mesmo carro. */}
            {history.length > 0 && (
              <View style={styles.timelineCard}>
                {history.map((order, index) => (
                  <View style={styles.timelineRow} key={order.id}>
                    <View style={styles.timelineRail}>
                      <View
                        style={[
                          styles.timelineMarker,
                          index === 0 && styles.timelineMarkerLatest,
                        ]}
                      />
                      {index < history.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>
                    <Pressable
                      style={[
                        styles.timelineBody,
                        index === history.length - 1 && styles.timelineBodyLast,
                      ]}
                      onPress={() => setOrderDetail(order)}
                    >
                      <Text style={styles.timelineDate}>
                        {new Date(
                          order.completedAt ?? order.createdAt,
                        ).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                      <Text style={styles.timelineTitle}>
                        {order.description ?? "Serviço Ford"}
                      </Text>
                      <View style={styles.timelineMeta}>
                        <Wrench size={11} color={t.faint} />
                        <Text style={styles.timelineMileage}>
                          {order.mileage.toLocaleString("pt-BR")} km no odômetro
                        </Text>
                        <Text style={styles.timelineOpen}>Ver detalhes</Text>
                        <ChevronRight size={12} color={t.blue} />
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {!history.length && (
              <EmptyState
                icon={Clock3}
                title="Nenhum serviço registrado"
                hint="Assim que seu Ford passar pela rede autorizada, o atendimento aparece aqui."
              />
            )}
          </>
        )}
        {tab === "points" && (
          <>
            <Text style={styles.pageTitle}>Pontos e benefícios</Text>
            <Text style={styles.pageSubtitle}>
              Cada serviço Ford aproxima você de uma nova vantagem.
            </Text>
            <LinearGradient
              colors={[t.navy, "#0b3f68"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <Text style={styles.balanceLabel}>SALDO DISPONÍVEL</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceValue}>
                  {loyalty?.balance.toLocaleString("pt-BR") ?? 0}
                </Text>
                <Text style={styles.balanceUnit}>pts</Text>
              </View>
              {/* Gerado e resgatado saem das próprias transações: o saldo
                  deixa de ser um número sem procedência. */}
              <View style={styles.balanceSplit}>
                <View style={styles.balanceSplitCell}>
                  <Text style={styles.balanceSplitValue}>
                    {pointsEarned.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.balanceSplitLabel}>GERADOS</Text>
                </View>
                <View style={styles.balanceSplitCell}>
                  <View style={styles.balanceSplitDivider} />
                  <Text style={styles.balanceSplitValue}>
                    {pointsRedeemed.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.balanceSplitLabel}>RESGATADOS</Text>
                </View>
              </View>
            </LinearGradient>
            <Text style={styles.sectionTitle}>Meus vouchers</Text>
            {loyalty?.vouchers.map((voucher) => {
              const active = voucher.status === "AVAILABLE";
              return (
                <View
                  style={[styles.voucher, !active && styles.voucherUsed]}
                  key={voucher.id}
                >
                  {/* Filete lateral: distingue disponível de usado antes
                      mesmo de ler o selo. */}
                  <View
                    style={[
                      styles.voucherEdge,
                      active ? styles.voucherEdgeOn : styles.voucherEdgeOff,
                    ]}
                  />
                  <View style={styles.voucherRow}>
                    <View
                      style={[
                        styles.roundIcon,
                        active ? styles.roundIconViolet : styles.roundIconGrey,
                      ]}
                    >
                      <Sparkles
                        size={17}
                        color={active ? "#7549bb" : "#8e9eaa"}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={[
                          styles.cardTitle,
                          !active && styles.voucherTitleUsed,
                        ]}
                      >
                        {voucher.title}
                      </Text>
                      <Text style={styles.voucherCode}>{voucher.code}</Text>
                      <Text style={styles.muted}>
                        {voucher.pointsCost.toLocaleString("pt-BR")} pontos
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        active ? styles.badgeGreen : styles.badgeSlate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          active
                            ? styles.badgeTextGreen
                            : styles.badgeTextSlate,
                        ]}
                      >
                        {voucherLabels[voucher.status] ?? voucher.status}
                      </Text>
                    </View>
                  </View>
                  {active && (
                    <Pressable
                      style={styles.voucherAction}
                      onPress={() => setConfirmVoucher(voucher)}
                      disabled={redeeming === voucher.code}
                    >
                      {redeeming === voucher.code ? (
                        <ActivityIndicator size="small" color={t.blue} />
                      ) : (
                        <>
                          <Text style={styles.voucherActionText}>
                            Usar este benefício
                          </Text>
                          <ArrowRight size={14} color={t.blue} />
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
            {!loyalty?.vouchers.length && (
              <EmptyState
                icon={Gift}
                title="Nenhum voucher ainda"
                hint="Cada revisão na rede autorizada credita pontos que viram benefícios aqui."
              />
            )}
          </>
        )}
        {tab === "bookings" && (
          <>
            <View style={styles.bookingPageHead}>
              <View style={styles.flex}>
                <Text style={styles.pageTitle}>Agendamentos</Text>
                <Text style={[styles.pageSubtitle, styles.bookingPageSubtitle]}>
                  Seus próximos encontros e o histórico de atendimentos.
                </Text>
              </View>
              <Pressable
                style={styles.bookingCreateButton}
                onPress={() => {
                  if (!vehicle) {
                    setClaimOpen(true);
                    return;
                  }
                  void openBooking("Revisão periódica");
                }}
                accessibilityRole="button"
                accessibilityLabel={vehicle ? "Agendar novo serviço" : "Vincular veículo para agendar"}
              >
                <Plus size={15} color="#fff" />
                <Text style={styles.bookingCreateButtonText}>Agendar</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.chatEntryCard,
                pressed && styles.chatEntryCardPressed,
              ]}
              onPress={() => void openSupport()}
              accessibilityRole="button"
              accessibilityLabel="Conversar com a equipe Ford"
            >
              <View style={styles.chatEntryIcon}>
                <LifeBuoy size={19} color="#fff" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.chatEntryLabel}>ATENDIMENTO HUMANO</Text>
                <Text style={styles.chatEntryTitle}>Falar com a Ford</Text>
                <Text style={styles.chatEntryHint}>
                  Converse com a equipe responsável pela sua concessionária.
                </Text>
              </View>
              <ChevronRight size={18} color="#5d86a0" />
            </Pressable>
            <View style={styles.bookingSectionHead}>
              <Text style={[styles.sectionTitle, styles.sectionTitleFlush]}>
                Próximos
              </Text>
              <View style={styles.bookingCountBadge}>
                <Text style={styles.bookingCountText}>{upcomingBookings.length}</Text>
              </View>
            </View>
            {upcomingBookings.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                canCancel
                cancelling={cancelling === booking.id}
                onCancel={setConfirmCancel}
              />
            ))}
            {!upcomingBookings.length ? (
              <View style={styles.bookingEmptyCard}>
                <View style={styles.emptyIconCompact}>
                  <CalendarDays size={20} color="#7190a6" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.emptyTitle}>Nenhum compromisso futuro</Text>
                  <Text style={[styles.emptyHint, styles.emptyHintLeft]}>
                    Escolha uma data para sua próxima visita à rede autorizada.
                  </Text>
                </View>
                {vehicle ? (
                  <Pressable
                    style={styles.compactAction}
                    onPress={() => void openBooking("Serviço Ford")}
                    accessibilityRole="button"
                    accessibilityLabel="Agendar novo serviço"
                  >
                    <Text style={styles.compactActionText}>Agendar</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {previousBookings.length ? (
              <>
                <Text style={[styles.sectionTitle, styles.bookingArchiveTitle]}>
                  Anteriores e cancelados
                </Text>
                <Text style={styles.bookingArchiveHint}>
                  Itens encerrados ficam disponíveis apenas para consulta.
                </Text>
                {previousBookings.map((booking) => (
                  <BookingItem
                    key={booking.id}
                    booking={booking}
                    canCancel={false}
                    cancelling={false}
                    onCancel={setConfirmCancel}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
        {tab === "alerts" && (
          <>
            <Text style={styles.pageTitle}>Segurança e avisos</Text>
            <Text style={styles.pageSubtitle}>
              {notifications.unread} aviso
              {notifications.unread === 1 ? "" : "s"} não lido
              {notifications.unread === 1 ? "" : "s"}.
            </Text>
            {recalls.map((recall) => (
              <View style={styles.mobileRecallCard} key={recall.id}>
                <View style={styles.mobileRecallTop}>
                  <Text style={styles.mobileRecallCode}>{recall.code}</Text>
                  <Text style={styles.mobileRecallSeverity}>
                    {recall.severity === "CRITICAL"
                      ? "CRÍTICA"
                      : recall.severity === "HIGH"
                        ? "ALTA"
                        : recall.severity}
                  </Text>
                </View>
                <Text style={styles.mobileRecallTitle}>{recall.title}</Text>
                <Text style={styles.mobileRecallDescription}>
                  {recall.description}
                </Text>
                <Text style={styles.mobileRecallStatus}>
                  STATUS ·{" "}
                  {recallLabels[recall.targets[0]?.status ?? ""] ??
                    "AGUARDANDO AGENDAMENTO"}
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() =>
                    void openBooking(`Recall ${recall.code} — ${recall.title}`)
                  }
                >
                  <Text style={styles.primaryButtonText}>
                    Agendar atendimento gratuito
                  </Text>
                  <ArrowRight size={15} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Text style={styles.sectionTitle}>Notificações</Text>
            {notifications.items.map((item) => {
              const unread = !item.readAt;
              const Icon = NOTIFICATION_ICONS[item.type] ?? Bell;
              return (
                <Pressable
                  style={[
                    styles.notificationCard,
                    unread && styles.notificationUnread,
                  ]}
                  key={item.id}
                  onPress={() => unread && void markRead(item.id)}
                >
                  <View
                    style={[
                      styles.notificationIcon,
                      unread && styles.notificationIconUnread,
                    ]}
                  >
                    <Icon size={15} color={unread ? "#0c72b8" : "#8ea1b0"} />
                  </View>
                  <View style={styles.flex}>
                    <Text
                      style={[
                        styles.cardTitle,
                        unread && styles.notificationTitleUnread,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.muted}>{item.message}</Text>
                    <Text style={styles.notificationDate}>
                      {new Date(item.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  {unread && <View style={styles.notificationDot} />}
                </Pressable>
              );
            })}
            {!notifications.items.length && (
              <EmptyState
                icon={Bell}
                title="Nenhum aviso"
                hint="Campanhas de segurança e novidades do seu Ford aparecem aqui."
              />
            )}
          </>
        )}
        </View>
      </ScrollView>
      <View style={styles.tabbar}>
        {(
          [
            ["home", CarFront, "Início"],
            ["history", Clock3, "Histórico"],
            ["points", Gift, "Pontos"],
            ["bookings", CalendarDays, "Agenda"],
            ["alerts", Bell, "Avisos"],
          ] as const
        ).map(([key, Icon, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabSelected]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === key }}
          >
            <View style={styles.tabIconWrap}>
              <Icon size={19} color={tab === key ? t.bright : "#93a6b4"} />
              {key === "alerts" && notifications.unread > 0 ? <View style={styles.tabUnreadBadge}><Text style={styles.tabUnreadText}>{notifications.unread > 9 ? "9+" : notifications.unread}</Text></View> : null}
            </View>
            <Text style={[styles.tabLabel, tab === key && styles.tabActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Garagem 360: troca visual de contexto entre os veículos da conta. */}
      <Modal
        visible={garageOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGarageOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setGarageOpen(false)} />
        <View style={[styles.sheet, styles.garageSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <LinearGradient colors={["#0b75b7", "#06477c"]} style={styles.garageSheetIcon}>
              <CarFront size={20} color="#fff" />
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>Garagem 360</Text>
              <Text style={styles.sheetEmail}>Escolha qual Ford você quer acompanhar agora.</Text>
            </View>
            <Pressable
              onPress={() => setGarageOpen(false)}
              accessibilityLabel="Fechar minha garagem"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>

          <LinearGradient colors={["#07375f", "#096b9e"]} style={styles.tradeBonusCard}>
            <View style={styles.tradeBonusTop}>
              <View style={styles.tradeBonusIcon}><Gift size={18} color="#dff8ea" /></View>
              <View style={styles.flex}>
                <View style={styles.tradeBonusEyebrowRow}>
                  <Text style={styles.tradeBonusEyebrow}>BÔNUS TROCA FORD</Text>
                  <Text style={styles.tradeBonusPilot}>SIMULAÇÃO DO PILOTO</Text>
                </View>
                <Text style={styles.tradeBonusValue}>{tradeBonusLabel}</Text>
                <Text style={styles.tradeBonusDescription}>
                  {eligibleTradeReviews} {eligibleTradeReviews === 1 ? "revisão elegível" : "revisões elegíveis"} · R$ 500 por revisão concluída
                </Text>
              </View>
            </View>
            <View style={styles.tradeBonusProgress}>
              <View style={[styles.tradeBonusProgressFill, { width: `${tradeBonusProgress}%` }]} />
            </View>
            <View style={styles.tradeBonusFooter}>
              <Text style={styles.tradeBonusHint}>{tradeBonus >= tradeBonusCap ? "Bônus máximo alcançado" : `Próxima revisão libera + R$ ${tradeBonusPerReview}`}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conhecer modelos para a próxima troca"
                style={styles.tradeBonusAction}
                onPress={() => { setGarageOpen(false); setCatalogOpen(true); }}
              >
                <Text style={styles.tradeBonusActionText}>Ver próximos Ford</Text>
                <ArrowRight size={12} color="#fff" />
              </Pressable>
            </View>
          </LinearGradient>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentContainerStyle={styles.garageCards}
          >
            {vehicles.map((item) => {
              const active = item.vin === vehicle?.vin;
              const itemImage = vehicleImageForModel(item.model);
              return (
                <Pressable
                  key={item.vin}
                  disabled={vehicleBusy}
                  accessibilityRole="button"
                  accessibilityLabel={`${active ? "Veículo em uso" : "Usar"}: ${item.model} ${item.modelYear}`}
                  accessibilityState={{ selected: active, disabled: vehicleBusy }}
                  onPress={() => {
                    if (active) {
                      setGarageOpen(false);
                      return;
                    }
                    void chooseVehicle(item.vin).then((changed) => {
                      if (changed) setGarageOpen(false);
                    });
                  }}
                  style={({ pressed }) => [
                    styles.garageVehicleCard,
                    active && styles.garageVehicleCardActive,
                    pressed && styles.garageVehicleCardPressed,
                  ]}
                >
                  <LinearGradient colors={["#052541", "#0a5487"]} style={styles.garageVehicleVisual}>
                    {itemImage ? (
                      <Image
                        source={itemImage}
                        style={styles.garageVehicleImage}
                        resizeMode="contain"
                        accessible
                        accessibilityLabel={`Foto do ${item.model}`}
                      />
                    ) : <VehicleSilhouette width={220} />}
                    <LinearGradient
                      pointerEvents="none"
                      colors={["rgba(2, 16, 29, 0)", "rgba(2, 16, 29, 0.84)"]}
                      style={styles.garageVehicleShade}
                    />
                    <View style={[styles.garageStatusPill, active && styles.garageStatusPillActive]}>
                      {active ? <BadgeCheck size={11} color="#dff8ea" /> : <CarFront size={11} color="#d9ecf8" />}
                      <Text style={[styles.garageStatusText, active && styles.garageStatusTextActive]}>{active ? "EM USO" : "DISPONÍVEL"}</Text>
                    </View>
                    <View style={styles.garageVehicleIdentity}>
                      <Text style={styles.garageVehicleModel}>{item.model}</Text>
                      <Text style={styles.garageVehicleYear}>Linha {item.modelYear}</Text>
                    </View>
                  </LinearGradient>
                  <View style={styles.garageVehicleBody}>
                    <View>
                      <Text style={styles.garageVehiclePlate}>{item.plate ?? "Sem placa"}</Text>
                      <Text style={styles.garageVehicleVin} numberOfLines={1}>{item.vin}</Text>
                    </View>
                    {vehicleBusy && !active ? (
                      <ActivityIndicator size="small" color={t.blue} />
                    ) : (
                      <View style={[styles.garageSelectAction, active && styles.garageSelectActionActive]}>
                        <Text style={[styles.garageSelectActionText, active && styles.garageSelectActionTextActive]}>{active ? "Selecionado" : "Usar este"}</Text>
                        {!active && <ArrowRight size={13} color={t.blue} />}
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar outro Ford à garagem"
            style={({ pressed }) => [styles.garageAddVehicle, pressed && styles.garageVehicleCardPressed]}
            onPress={() => {
              setGarageOpen(false);
              setClaimOpen(true);
              setTab("home");
            }}
          >
            <View style={styles.garageAddVehicleIcon}><Plus size={18} color={t.blue} /></View>
            <View style={styles.flex}>
              <Text style={styles.garageAddVehicleTitle}>Adicionar outro Ford</Text>
              <Text style={styles.garageAddVehicleHint}>Vincule com VIN e placa em poucos passos.</Text>
            </View>
            <ChevronRight size={17} color={t.blue} />
          </Pressable>
        </View>
      </Modal>

      {/* Catálogo: descoberta de modelos sem misturar estoque da concessionária com a garagem do cliente. */}
      <Modal
        visible={catalogOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCatalogOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setCatalogOpen(false)}
        />
        <View style={[styles.sheet, styles.catalogSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={[styles.roundIcon, styles.roundIconBlue]}>
              <CarFront size={18} color="#0c72b8" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>Linha Ford App</Text>
              <Text style={styles.sheetEmail}>Explore modelos e vincule seu próximo veículo.</Text>
            </View>
            <Pressable
              onPress={() => setCatalogOpen(false)}
              accessibilityLabel="Fechar catálogo"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>
          <Text style={styles.catalogDisclaimer}>
            Catálogo conceitual do Ford App com fotos reais de referência. Os nomes e especificações são demonstrativos.
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {catalog.map((model) => {
              const reference = catalogReferenceFor(model);
              const specs = [
                model.modelCode ? `Código ${model.modelCode}` : null,
                model.modelYear ? `Ano ${model.modelYear}` : null,
                model.version ? `Versão ${model.version}` : null,
                model.engine ? `Motor ${model.engine}` : null,
                model.fuelType ? `Combustível ${model.fuelType}` : null,
                model.transmission ? `Câmbio ${model.transmission}` : null,
                model.drive ? `Tração ${model.drive}` : null,
                model.power ? `Potência ${model.power}` : null,
                model.torque ? `Torque ${model.torque}` : null,
                model.consumption ? `Consumo ${model.consumption}` : null,
                model.rangeLabel,
                model.dimensions ? `Dimensões ${model.dimensions}` : null,
                model.seats ? `${model.seats} lugares` : null,
                model.warrantyLabel ? `Garantia ${model.warrantyLabel}` : null,
                model.stockLabel,
              ].filter((value): value is string => Boolean(value));
              return (
                <View style={styles.catalogCard} key={model.name}>
                  <LinearGradient colors={["#061d36", "#0a426e"]} style={styles.catalogImageStage}>
                    {model.imageUrl ? (
                      <Image source={{ uri: model.imageUrl }} style={styles.catalogImage} resizeMode="cover" accessible accessibilityLabel={`Foto do ${model.name}`} />
                    ) : reference ? (
                      <Image source={reference.source} style={styles.catalogImage} resizeMode="contain" accessible accessibilityLabel={`Foto de referência ${reference.label} para ${model.name}`} />
                    ) : (
                      <View style={styles.catalogImageFallback} accessible accessibilityLabel={`Ilustração do conceito ${model.name}`}><VehicleSilhouette width={220} /></View>
                    )}
                    {reference && !model.imageUrl ? (
                      <View style={styles.catalogReferenceBadge}>
                        <BadgeCheck size={10} color="#dff8ea" />
                        <Text style={styles.catalogReferenceBadgeText}>FOTO REAL · REFERÊNCIA {reference.label.toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </LinearGradient>
                  <View style={styles.catalogCardBody}>
                    <View style={styles.catalogCardHeading}>
                      <View style={styles.flex}>
                        <Text style={styles.catalogCategory}>{model.category.toUpperCase()}</Text>
                        <Text style={styles.catalogName}>{model.name}</Text>
                      </View>
                      <BadgeCheck size={16} color="#228657" />
                    </View>
                    <Text style={styles.catalogDescription}>{model.summary}</Text>
                    <Text style={styles.catalogHighlights}>{model.highlights ?? model.description}</Text>
                    {specs.length ? <View accessibilityLabel={`Especificações de ${model.name}`}>
                      <Text style={styles.catalogSpecsTitle}>FICHA TÉCNICA</Text>
                      <View style={styles.catalogSpecs}>
                        {specs.map((spec) => <View key={spec} style={styles.catalogSpecChip}><Text style={styles.catalogSpecText}>{spec}</Text></View>)}
                      </View>
                    </View> : null}
                    {model.priceLabel ? <Text style={styles.catalogPrice}>{model.priceLabel}</Text> : null}
                    <Pressable
                      style={[styles.catalogAction, interestBusy === model.id && styles.buttonDisabled]}
                      onPress={() => void expressCatalogInterest(model)}
                      disabled={Boolean(interestBusy)}
                      accessibilityRole="button"
                      accessibilityLabel={`${model.ctaLabel} em ${model.name}`}
                      accessibilityState={{ disabled: Boolean(interestBusy), busy: interestBusy === model.id }}
                    >
                      {interestBusy === model.id ? (
                        <><ActivityIndicator size="small" color="#0c72b8" /><Text style={styles.catalogActionText}>Enviando interesse...</Text></>
                      ) : (
                        <><Text style={styles.catalogActionText}>{model.ctaLabel}</Text><ArrowRight size={14} color="#0c72b8" /></>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <View style={styles.sheetBottomGap} />
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={Boolean(interestConfirmation)}
        transparent
        animationType="fade"
        onRequestClose={() => setInterestConfirmation(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.tradeInterestDialog}>
            <LinearGradient colors={["#0878bd", "#075080"]} style={styles.tradeInterestSuccessIcon}>
              <BadgeCheck size={25} color="#fff" />
            </LinearGradient>
            <Text style={styles.tradeInterestEyebrow}>INTERESSE REGISTRADO</Text>
            <Text style={styles.tradeInterestTitle}>A equipe Ford já recebeu seu sinal.</Text>
            <Text style={styles.tradeInterestBody}>
              Seu interesse no {interestConfirmation?.model} foi enviado para {interestConfirmation?.dealership}. O seu {vehicle?.model} poderá entrar na avaliação da troca.
            </Text>
            <View style={styles.tradeInterestNotice}>
              <Gift size={16} color="#228657" />
              <Text style={styles.tradeInterestNoticeText}>Seu bônus atual de {tradeBonusLabel} também acompanha esta oportunidade.</Text>
            </View>
            <Pressable style={styles.tradeInterestDone} onPress={() => setInterestConfirmation(null)} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Ficha mecânica: concentra o que o proprietário precisa entender
          sobre identidade, uso, garantia e manutenção do carro ativo. */}
      <Modal
        visible={vehicleDetailOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVehicleDetailOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setVehicleDetailOpen(false)} />
        <View style={[styles.sheet, styles.vehicleDetailSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={styles.roundIcon}><Wrench size={18} color="#0c72b8" /></View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>Ficha mecânica</Text>
              <Text style={styles.sheetEmail}>{vehicle?.model} {vehicle?.modelYear} · dados do seu VIN</Text>
            </View>
            <Pressable onPress={() => setVehicleDetailOpen(false)} accessibilityLabel="Fechar ficha mecânica" style={styles.sheetClose}><X size={17} color={t.muted} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.vehicleDetailScroll}>
          {vehicle ? <>
            <View style={[styles.maintenanceHero, maintenanceStatusTone === "warning" ? styles.maintenanceHeroWarning : styles.maintenanceHeroGood]}>
              <View style={styles.maintenanceHeroIcon}>{maintenanceStatusTone === "warning" ? <ShieldAlert size={20} color="#b4433c" /> : <BadgeCheck size={20} color="#247a50" />}</View>
              <View style={styles.flex}><Text style={styles.maintenanceEyebrow}>SAÚDE DO VEÍCULO</Text><Text style={styles.maintenanceStatus}>{maintenanceStatus}</Text><Text style={styles.maintenanceHint}>{recalls.length ? "Existe uma campanha de segurança para consultar." : `Próxima revisão estimada em ${nextMileage.toLocaleString("pt-BR")} km.`}</Text></View>
            </View>
            <Text style={styles.detailSectionTitle}>Identificação</Text>
            <View style={styles.detailGrid}>
              {([
                ["MODELO", `${vehicle.model} ${vehicle.modelYear}`],
                ["FABRICAÇÃO", String(vehicle.manufactureYear)],
                ["VIN", vehicle.vin],
                ["PLACA", vehicle.plate ?? "Não informada"],
                ["ODÔMETRO", `${vehicle.currentMileage.toLocaleString("pt-BR")} km`],
                ["GARANTIA", warrantyText],
              ] as const).map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
            </View>
            <Text style={styles.detailSectionTitle}>Checklist de manutenção</Text>
            <View style={styles.maintenanceChecklist}>
              <View style={styles.maintenanceRow}><Wrench size={15} color={servicePercent >= 85 ? "#b4433c" : "#247a50"} /><View style={styles.flex}><Text style={styles.maintenanceRowTitle}>Revisão por quilometragem</Text><Text style={styles.maintenanceRowHint}>{Math.max(0, nextMileage - vehicle.currentMileage).toLocaleString("pt-BR")} km restantes</Text></View><Text style={[styles.maintenanceRowStatus, servicePercent >= 85 ? styles.maintenanceWarning : styles.maintenanceGood]}>{servicePercent >= 85 ? "PRÓXIMA" : "EM DIA"}</Text></View>
              <View style={styles.maintenanceRow}><ShieldAlert size={15} color={recalls.length ? "#b4433c" : "#247a50"} /><View style={styles.flex}><Text style={styles.maintenanceRowTitle}>Campanhas de segurança</Text><Text style={styles.maintenanceRowHint}>{recalls.length ? recalls[0].title : "Nenhuma campanha pendente"}</Text></View><Text style={[styles.maintenanceRowStatus, recalls.length ? styles.maintenanceWarning : styles.maintenanceGood]}>{recalls.length ? "ATENÇÃO" : "OK"}</Text></View>
              <View style={styles.maintenanceRow}><Clock3 size={15} color={history.length ? "#247a50" : "#8496a5"} /><View style={styles.flex}><Text style={styles.maintenanceRowTitle}>Histórico registrado</Text><Text style={styles.maintenanceRowHint}>{history.length ? `${history.length} atendimento(s) no VIN` : "Ainda sem serviços registrados"}</Text></View><Text style={styles.maintenanceRowStatus}>{history.length ? "ATIVO" : "—"}</Text></View>
              <View style={styles.maintenanceRow}><CalendarDays size={15} color={upcomingBookings.length ? "#247a50" : "#8496a5"} /><View style={styles.flex}><Text style={styles.maintenanceRowTitle}>Próxima visita</Text><Text style={styles.maintenanceRowHint}>{upcomingBookings.length ? new Date(upcomingBookings[0].requestedFor).toLocaleDateString("pt-BR") : "Nenhum agendamento"}</Text></View><Text style={styles.maintenanceRowStatus}>{upcomingBookings.length ? "MARCADA" : "ABERTA"}</Text></View>
            </View>
            <View style={styles.vehicleDetailActions}><Pressable style={styles.secondarySheetAction} onPress={() => { setVehicleDetailOpen(false); setTab("history"); }}><Clock3 size={14} color={t.blue} /><Text style={styles.secondarySheetActionText}>Ver histórico</Text></Pressable><Pressable style={styles.primarySheetAction} onPress={() => { setVehicleDetailOpen(false); void openBooking(`Revisão de ${nextMileage.toLocaleString("pt-BR")} km`); }}><CalendarDays size={14} color="#fff" /><Text style={styles.primarySheetActionText}>Agendar revisão</Text></Pressable></View>
          </> : null}
          </ScrollView>
        </View>
      </Modal>

      {/* Painel da conta: antes o toque no avatar deslogava direto, sem
          aviso nem lugar nenhum para ver os próprios dados. */}
      <Modal
        visible={accountOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setAccountOpen(false)}
        />
        <View style={[styles.sheet, styles.accountSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={styles.sheetAvatar}>
              <Text style={styles.sheetAvatarText}>{initials}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>{user.fullName}</Text>
              <Text style={styles.sheetEmail}>{user.email}</Text>
            </View>
            <Pressable
              onPress={() => setAccountOpen(false)}
              accessibilityLabel="Fechar"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountMenuScroll}>
            <Text style={styles.accountMenuSection}>CONTA E GARAGEM</Text>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, styles.accountMenuRow, pressed && styles.accountMenuRowPressed]}
              onPress={() => { setAccountOpen(false); setProfileOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel="Abrir meu perfil"
            >
              <View style={[styles.roundIcon, styles.roundIconBlue]}>
                <UserRound size={18} color="#0c72b8" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetRowValue}>Meu perfil</Text>
                <Text style={styles.sheetRowHint}>Dados pessoais, conta e resumo da garagem.</Text>
              </View>
              <ChevronRight size={17} color="#8da3b2" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, styles.accountMenuRow, pressed && styles.accountMenuRowPressed]}
              onPress={() => {
                setAccountOpen(false);
                setTab("home");
                setClaimOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Informar que troquei de carro"
            >
              <View style={[styles.roundIcon, styles.roundIconGreen]}>
                <RefreshCw size={18} color="#228657" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetRowValue}>Troquei de carro</Text>
                <Text style={styles.sheetRowHint}>Vincule o novo Ford usando VIN e placa.</Text>
              </View>
              <ChevronRight size={17} color="#8da3b2" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, styles.accountMenuRow, styles.accountMenuRowFeatured, pressed && styles.accountMenuRowPressed]}
              onPress={() => { setAccountOpen(false); setCatalogOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel="Quero trocar de carro"
            >
              <View style={styles.accountTradeIcon}>
                <Gift size={18} color="#fff" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.accountTradeLabel}>QUERO TROCAR</Text>
                <Text style={styles.accountTradeTitle}>Quero trocar de carro</Text>
                <Text style={styles.accountTradeHint}>Explore novos modelos com {tradeBonusLabel} de bônus simulado.</Text>
              </View>
              <ChevronRight size={17} color="#fff" />
            </Pressable>

            {vehicle && (
              <View style={styles.accountVehicleSummary}>
                <View style={styles.roundIcon}>
                  <CarFront size={17} color="#0c72b8" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.sheetRowLabel}>VEÍCULO EM USO</Text>
                  <Text style={styles.sheetRowValue}>{vehicle.model} {vehicle.modelYear}</Text>
                  <Text style={styles.sheetRowHint}>{vehicle.plate ?? "Sem placa"} · {vehicles.length} veículos na garagem</Text>
                </View>
              </View>
            )}

            <Text style={styles.accountMenuSection}>SUPORTE E SEGURANÇA</Text>
            <Pressable style={({ pressed }) => [styles.sheetRow, styles.accountMenuRow, pressed && styles.accountMenuRowPressed]} onPress={() => void openSupport()}>
              <View style={[styles.roundIcon, styles.roundIconViolet]}>
                <LifeBuoy size={17} color="#7549bb" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetRowValue}>Chat com a Ford</Text>
                <Text style={styles.sheetRowHint}>Converse com a equipe da sua concessionária.</Text>
              </View>
              <ChevronRight size={17} color="#a4b4c0" />
            </Pressable>

            <Pressable style={({ pressed }) => [styles.sheetRow, styles.accountMenuRow, pressed && styles.accountMenuRowPressed]} onPress={() => void openPrivacy()}>
              <View style={[styles.roundIcon, styles.roundIconGreen]}>
                <ShieldCheck size={17} color="#228657" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.sheetRowValue}>Privacidade e dados</Text>
                <Text style={styles.sheetRowHint}>Consentimentos, acesso, correção e exclusão.</Text>
              </View>
              <ChevronRight size={17} color="#a4b4c0" />
            </Pressable>

            <Pressable style={styles.logoutButton} onPress={() => void logout()}>
              <LogOut size={16} color="#c6403b" />
              <Text style={styles.logoutText}>Sair da conta</Text>
            </Pressable>
            <Text style={styles.sheetVersion}>Ford App · v{APP_VERSION}</Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Perfil simples e objetivo: mantém os dados pessoais separados das ações do carro. */}
      <Modal
        visible={profileOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setProfileOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={[styles.roundIcon, styles.roundIconBlue]}><UserRound size={19} color="#0c72b8" /></View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>Meu perfil</Text>
              <Text style={styles.sheetEmail}>Sua identidade no Ford App.</Text>
            </View>
            <Pressable onPress={() => setProfileOpen(false)} accessibilityLabel="Fechar meu perfil" style={styles.sheetClose}>
              <X size={17} color={t.muted} />
            </Pressable>
          </View>

          <LinearGradient colors={["#07375f", "#0878bd"]} style={styles.profileHero}>
            <View style={styles.profileHeroAvatar}><Text style={styles.profileHeroAvatarText}>{initials}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.profileHeroName}>{user.fullName}</Text>
              <Text style={styles.profileHeroEmail}>{user.email}</Text>
            </View>
            <BadgeCheck size={20} color="#9fe3bf" />
          </LinearGradient>

          <View style={styles.profileStats}>
            <View style={styles.profileStat}><Text style={styles.profileStatValue}>{vehicles.length}</Text><Text style={styles.profileStatLabel}>VEÍCULOS</Text></View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}><Text style={styles.profileStatValue}>{loyalty?.balance.toLocaleString("pt-BR") ?? 0}</Text><Text style={styles.profileStatLabel}>FORD POINTS</Text></View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}><Text style={styles.profileStatValue}>{vehicle?.plate ?? "—"}</Text><Text style={styles.profileStatLabel}>PLACA ATUAL</Text></View>
          </View>

          <Pressable style={styles.profilePrivacyAction} onPress={() => { setProfileOpen(false); void openPrivacy(); }}>
            <ShieldCheck size={17} color="#228657" />
            <View style={styles.flex}><Text style={styles.sheetRowValue}>Privacidade e dados</Text><Text style={styles.sheetRowHint}>Gerencie seus consentimentos e solicitações.</Text></View>
            <ChevronRight size={17} color="#8da3b2" />
          </Pressable>
        </View>
      </Modal>

      {/* Detalhe do atendimento */}
      <Modal
        visible={!!orderDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setOrderDetail(null)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setOrderDetail(null)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={styles.roundIcon}>
              <Wrench size={18} color="#0c72b8" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>
                {orderDetail?.description ?? "Serviço Ford"}
              </Text>
              <Text style={styles.sheetEmail}>
                {orderStatusLabels[orderDetail?.status ?? ""] ??
                  orderDetail?.status}
              </Text>
            </View>
            <Pressable
              onPress={() => setOrderDetail(null)}
              accessibilityLabel="Fechar detalhe"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>
          {orderDetail && (
            <View style={styles.detailGrid}>
              {(
                [
                  [
                    "DATA",
                    new Date(
                      orderDetail.completedAt ?? orderDetail.createdAt,
                    ).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    }),
                  ],
                  [
                    "ODÔMETRO",
                    `${orderDetail.mileage.toLocaleString("pt-BR")} km`,
                  ],
                  ["CONCESSIONÁRIA", orderDetail.dealership.tradeName],
                  [
                    "LOCAL",
                    `${orderDetail.dealership.city} · ${orderDetail.dealership.state}`,
                  ],
                  ...(orderDetail.amount
                    ? ([["VALOR", brl(orderDetail.amount)]] as const)
                    : []),
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.detailNote}>
            <BadgeCheck size={13} color="#247a50" />
            <Text style={styles.detailNoteText}>
              Registrado no VIN do veículo — este histórico acompanha o carro em
              toda a rede Ford.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Confirmação de uso do benefício: o resgate não tem volta. */}
      <Modal
        visible={!!confirmVoucher}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVoucher(null)}
      >
        <Pressable
          style={styles.dialogBackdrop}
          onPress={() => setConfirmVoucher(null)}
        >
          <Pressable style={styles.dialog}>
            <View style={[styles.roundIcon, styles.roundIconViolet]}>
              <Sparkles size={18} color="#7549bb" />
            </View>
            <Text style={styles.dialogTitle}>Usar este benefício?</Text>
            <Text style={styles.dialogBody}>
              {confirmVoucher?.title} será marcado como utilizado. Apresente o
              código {confirmVoucher?.code} na concessionária no momento do
              atendimento. A ação não pode ser desfeita pelo app.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                const code = confirmVoucher?.code;
                setConfirmVoucher(null);
                if (code) void redeemVoucher(code);
              }}
            >
              <Text style={styles.primaryButtonText}>Confirmar uso</Text>
            </Pressable>
            <Pressable
              style={styles.dialogCancel}
              onPress={() => setConfirmVoucher(null)}
            >
              <Text style={styles.dialogCancelText}>Agora não</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Recall específico, aberto pelo cartão da home */}
      <Modal
        visible={!!recallDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setRecallDetail(null)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setRecallDetail(null)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={styles.recallAlertIcon}>
              <ShieldAlert size={18} color="#c8443d" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetRowLabel}>
                CAMPANHA {recallDetail?.code}
              </Text>
              <Text style={styles.sheetName}>{recallDetail?.title}</Text>
            </View>
            <Pressable
              onPress={() => setRecallDetail(null)}
              accessibilityLabel="Fechar campanha"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>
          <Text style={styles.recallSheetText}>
            {recallDetail?.description}
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SITUAÇÃO</Text>
            <Text style={styles.detailValue}>
              {recallLabels[recallDetail?.targets[0]?.status ?? ""] ??
                "AGUARDANDO AGENDAMENTO"}
            </Text>
          </View>
          <View style={styles.detailNote}>
            <BadgeCheck size={13} color="#247a50" />
            <Text style={styles.detailNoteText}>
              O atendimento de campanha de segurança é gratuito em toda a rede
              autorizada Ford.
            </Text>
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              const target = recallDetail;
              setRecallDetail(null);
              if (target)
                void openBooking(`Recall ${target.code} — ${target.title}`);
            }}
          >
            <Text style={styles.primaryButtonText}>
              Agendar atendimento gratuito
            </Text>
            <ArrowRight size={15} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* Suporte */}
      <Modal
        visible={supportOpen}
        transparent
        animationType="slide"
        onRequestClose={() =>
          activeChat ? setActiveChat(null) : setSupportOpen(false)
        }
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSupportOpen(false)}
        />
        <View style={[styles.sheet, styles.bookingSheet, styles.chatSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            {activeChat ? (
              <Pressable
                onPress={() => setActiveChat(null)}
                accessibilityLabel="Voltar para conversas"
                style={styles.chatBack}
              >
                <ArrowLeft size={17} color={t.blue} />
              </Pressable>
            ) : null}
            <View style={[styles.roundIcon, styles.roundIconViolet]}>
              <LifeBuoy size={18} color="#7549bb" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetName} numberOfLines={1}>
                {activeChat ? activeChat.subject : "Chat com a Ford"}
              </Text>
              <Text style={styles.sheetEmail}>
                {activeChat
                  ? activeChat.assignedTo?.fullName
                    ? `Atendimento com ${activeChat.assignedTo.fullName}`
                    : "Aguardando um atendente da rede Ford"
                  : "Conversa segura com a equipe da sua concessionária."}
              </Text>
            </View>
            <Pressable
              onPress={() => setSupportOpen(false)}
              accessibilityLabel="Fechar suporte"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>

          {activeChat ? (
            <>
              <View style={styles.chatContext}>
                <View style={styles.chatLiveDot} />
                <Text style={styles.chatContextText}>
                  {activeChat.dealership?.tradeName ?? "Central Ford"} · mensagens atualizadas automaticamente
                </Text>
              </View>
              <ScrollView
                style={styles.chatThread}
                contentContainerStyle={styles.chatThreadContent}
                showsVerticalScrollIndicator={false}
              >
                {chatLoading ? <ActivityIndicator color={t.blue} /> : null}
                {chatMessages.map((message) => {
                  const mine = message.sender.role === "CUSTOMER";
                  return (
                    <View
                      style={[
                        styles.chatBubble,
                        mine ? styles.chatBubbleMine : styles.chatBubbleFord,
                      ]}
                      key={message.id}
                    >
                      <Text
                        style={[
                          styles.chatSender,
                          mine && styles.chatSenderMine,
                        ]}
                      >
                        {mine ? "VOCÊ" : message.sender.fullName.toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          styles.chatBody,
                          mine && styles.chatBodyMine,
                        ]}
                      >
                        {message.body}
                      </Text>
                      <Text
                        style={[
                          styles.chatTime,
                          mine && styles.chatTimeMine,
                        ]}
                      >
                        {new Date(message.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  );
                })}
                {!chatLoading && !chatMessages.length ? (
                  <Text style={styles.helperText}>Ainda não há mensagens.</Text>
                ) : null}
              </ScrollView>
              {chatError ? <Text style={styles.error}>{chatError}</Text> : null}
              <View style={styles.chatComposer}>
                <TextInput
                  style={styles.chatInput}
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder="Escreva sua mensagem..."
                  placeholderTextColor={t.faint}
                  multiline
                  maxLength={2000}
                />
                <Pressable
                  style={[
                    styles.chatSend,
                    (!chatDraft.trim() || chatBusy) && styles.buttonDisabled,
                  ]}
                  onPress={() => void sendChatMessage()}
                  disabled={!chatDraft.trim() || chatBusy}
                  accessibilityLabel="Enviar mensagem"
                >
                  {chatBusy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Send size={18} color="#fff" />
                  )}
                </Pressable>
              </View>
              <Text style={styles.chatPrivacy}>
                Nunca envie senhas ou códigos. A conversa fica registrada com segurança.
              </Text>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.chatIntro}>
                <Text style={styles.chatIntroTitle}>Como podemos ajudar?</Text>
                <Text style={styles.chatIntroText}>
                  Inicie uma conversa. A mensagem será encaminhada à sua concessionária e acompanhada pela rede Ford.
                </Text>
              </View>
              <Text style={styles.fieldLabelDark}>ASSUNTO</Text>
              <View style={styles.chipWrap}>
                {ticketCategories.map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.slotChip,
                      ticketCategory === value && styles.chipOn,
                    ]}
                    onPress={() => setTicketCategory(value)}
                  >
                    <Text
                      style={[
                        styles.slotChipText,
                        ticketCategory === value && styles.chipTextOn,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabelDark}>TÍTULO</Text>
              <View style={styles.lightField}>
                <TextInput
                  style={styles.lightFieldInput}
                  value={ticketSubject}
                  onChangeText={setTicketSubject}
                  placeholder="Ex.: dúvida sobre minha revisão"
                  placeholderTextColor={t.faint}
                  maxLength={160}
                />
              </View>

              <Text style={styles.fieldLabelDark}>PRIMEIRA MENSAGEM</Text>
              <View style={[styles.lightField, styles.lightFieldTall]}>
                <TextInput
                  style={[styles.lightFieldInput, styles.lightFieldInputTall]}
                  value={ticketMessage}
                  onChangeText={setTicketMessage}
                  placeholder="Conte para a equipe como podemos ajudar."
                  placeholderTextColor={t.faint}
                  multiline
                  maxLength={5000}
                />
              </View>
              <Text style={styles.helperText}>
                {ticketSubject.trim().length < 5
                  ? "Título com pelo menos 5 caracteres."
                  : ticketMessage.trim().length < 15
                    ? "Mensagem com pelo menos 15 caracteres."
                    : "Pronto para iniciar a conversa."}
              </Text>

              {ticketError ? <Text style={styles.error}>{ticketError}</Text> : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  (ticketSubject.trim().length < 5 ||
                    ticketMessage.trim().length < 15 ||
                    ticketBusy) &&
                    styles.buttonDisabled,
                ]}
                onPress={() => void submitTicket()}
                disabled={
                  ticketSubject.trim().length < 5 ||
                  ticketMessage.trim().length < 15 ||
                  ticketBusy
                }
              >
                {ticketBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Iniciar conversa</Text>
                )}
              </Pressable>

              <Text style={styles.fieldLabelDark}>MINHAS CONVERSAS</Text>
              {tickets.map((ticket) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.ticketCard,
                    ticket.unreadCount > 0 && styles.ticketCardUnread,
                    pressed && styles.ticketCardPressed,
                  ]}
                  key={ticket.id}
                  onPress={() => void openChat(ticket)}
                >
                  <View style={styles.ticketHead}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    {ticket.unreadCount > 0 ? (
                      <View style={styles.chatUnreadBadge}>
                        <Text style={styles.chatUnreadBadgeText}>{ticket.unreadCount}</Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.badge,
                        ticket.status === "RESOLVED" || ticket.status === "CLOSED"
                          ? styles.badgeGreen
                          : styles.badgeAmber,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          ticket.status === "RESOLVED" || ticket.status === "CLOSED"
                            ? styles.badgeTextGreen
                            : styles.badgeTextAmber,
                        ]}
                      >
                        {ticketStatusLabels[ticket.status] ?? ticket.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.muted} numberOfLines={2}>{ticket.message}</Text>
                  <View style={styles.ticketFooter}>
                    <Text style={styles.notificationDate}>
                      {ticket.messageCount} {ticket.messageCount === 1 ? "mensagem" : "mensagens"}
                    </Text>
                    <Text style={styles.ticketOpenText}>Abrir conversa →</Text>
                  </View>
                </Pressable>
              ))}
              {!tickets.length && (
                <Text style={styles.helperText}>Você ainda não iniciou nenhuma conversa.</Text>
              )}
              <View style={styles.sheetBottomGap} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Privacidade e LGPD */}
      <Modal
        visible={privacyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setPrivacyOpen(false)}
        />
        <View style={[styles.sheet, styles.bookingSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={[styles.roundIcon, styles.roundIconGreen]}>
              <ShieldCheck size={18} color="#228657" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>Privacidade e dados</Text>
              <Text style={styles.sheetEmail}>
                Seus direitos como titular, pela LGPD.
              </Text>
            </View>
            <Pressable
              onPress={() => setPrivacyOpen(false)}
              accessibilityLabel="Fechar privacidade"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabelDark}>CONSENTIMENTOS</Text>
            {consents.map((consent) => {
              const meta = consentLabels[consent.purpose];
              return (
                <Pressable
                  key={consent.purpose}
                  style={styles.consentRow}
                  onPress={() =>
                    void toggleConsent(consent.purpose, !consent.granted)
                  }
                  disabled={privacyBusy === consent.purpose}
                >
                  <View style={styles.flex}>
                    <Text style={styles.pickTitle}>
                      {meta?.title ?? consent.purpose}
                    </Text>
                    <Text style={styles.pickHint}>{meta?.hint}</Text>
                  </View>
                  {/* Interruptor próprio: o Switch nativo não aceita a paleta. */}
                  <View
                    style={[
                      styles.switchTrack,
                      consent.granted && styles.switchTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.switchKnob,
                        consent.granted && styles.switchKnobOn,
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}

            <Text style={styles.fieldLabelDark}>SEUS DIREITOS</Text>
            {dataRequestTypes.map(([type, title, hint]) => (
              <Pressable
                key={type}
                style={styles.pickRow}
                onPress={() => void createDataRequest(type)}
                disabled={!!privacyBusy}
              >
                <View style={styles.flex}>
                  <Text style={styles.pickTitle}>{title}</Text>
                  <Text style={styles.pickHint}>{hint}</Text>
                </View>
                {privacyBusy === type ? (
                  <ActivityIndicator size="small" color={t.blue} />
                ) : (
                  <ChevronRight size={17} color="#a4b4c0" />
                )}
              </Pressable>
            ))}

            {privacyNotice ? (
              <View style={styles.detailNote}>
                <ShieldCheck size={13} color="#247a50" />
                <Text style={styles.detailNoteText}>{privacyNotice}</Text>
              </View>
            ) : null}

            {dataRequests.length > 0 && (
              <>
                <Text style={styles.fieldLabelDark}>MINHAS SOLICITAÇÕES</Text>
                {dataRequests.map((item) => (
                  <View style={styles.ticketCard} key={item.id}>
                    <View style={styles.ticketHead}>
                      <Text style={styles.ticketSubject}>
                        {dataRequestTypes.find(([v]) => v === item.type)?.[1] ??
                          item.type}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          item.status === "COMPLETED"
                            ? styles.badgeGreen
                            : item.status === "REJECTED"
                              ? styles.badgeSlate
                              : styles.badgeAmber,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            item.status === "COMPLETED"
                              ? styles.badgeTextGreen
                              : item.status === "REJECTED"
                                ? styles.badgeTextSlate
                                : styles.badgeTextAmber,
                          ]}
                        >
                          {dataRequestStatusLabels[item.status] ?? item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.notificationDate}>
                      {new Date(item.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </>
            )}
            <View style={styles.sheetBottomGap} />
          </ScrollView>
        </View>
      </Modal>

      {/* Confirmação de cancelamento */}
      <Modal
        visible={!!confirmCancel}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmCancel(null)}
      >
        <Pressable
          style={styles.dialogBackdrop}
          onPress={() => setConfirmCancel(null)}
          accessibilityRole="button"
          accessibilityLabel="Fechar confirmação de cancelamento"
        >
          <Pressable style={styles.dialog} accessibilityRole="none">
            <View style={styles.recallAlertIcon}>
              <ShieldAlert size={18} color="#c8443d" />
            </View>
            <Text style={styles.dialogTitle}>Cancelar este agendamento?</Text>
            <Text style={styles.dialogBody}>
              {confirmCancel?.notes ?? "Atendimento Ford"} de{" "}
              {confirmCancel
                ? new Date(confirmCancel.requestedFor).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}{" "}
              será cancelado. O horário volta para a agenda da concessionária.
            </Text>
            <Pressable
              style={styles.dangerButton}
              onPress={() => {
                const id = confirmCancel?.id;
                if (id) void cancelBooking(id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Confirmar cancelamento do agendamento"
            >
              <Text style={styles.dangerButtonText}>Cancelar agendamento</Text>
            </Pressable>
            <Pressable
              style={styles.dialogCancel}
              onPress={() => setConfirmCancel(null)}
              accessibilityRole="button"
            >
              <Text style={styles.dialogCancelText}>Manter agendamento</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Agendamento */}
      <Modal
        visible={bookingOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setBookingOpen(false)}
        />
        <View style={[styles.sheet, styles.bookingSheet]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHead}>
            <View style={styles.roundIcon}>
              <CalendarDays size={18} color="#0c72b8" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>Agendar serviço</Text>
              <Text style={styles.sheetEmail} numberOfLines={1}>
                {bookingNote || "Escolha o local e o horário"}
              </Text>
            </View>
            <Pressable
              onPress={() => setBookingOpen(false)}
              accessibilityLabel="Fechar agendamento"
              style={styles.sheetClose}
            >
              <X size={17} color={t.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabelDark}>TIPO DE ATENDIMENTO</Text>
            <View style={styles.bookingServiceOptions}>
              {bookingServiceOptions.map((service) => {
                const picked = bookingNote === service;
                return (
                  <Pressable
                    key={service}
                    style={[styles.bookingServiceOption, picked && styles.bookingServiceOptionOn]}
                    onPress={() => setBookingNote(service)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: picked }}
                  >
                    <Wrench size={13} color={picked ? "#fff" : t.blue} />
                    <Text style={[styles.bookingServiceOptionText, picked && styles.bookingServiceOptionTextOn]}>
                      {service}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabelDark}>CONCESSIONÁRIA</Text>
            {dealerships.map((item) => {
              const picked = bookingDealership?.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.pickRow, picked && styles.pickRowOn]}
                  onPress={() => {
                    setBookingDealership(item);
                    setBookingDay(null);
                    setBookingSlot("");
                  }}
                >
                  <View style={styles.flex}>
                    <Text style={styles.pickTitle}>{item.tradeName}</Text>
                    <Text style={styles.pickHint}>
                      {item.city} · {item.state} · {item.openingTime} às{" "}
                      {item.closingTime}
                    </Text>
                  </View>
                  <View style={[styles.radio, picked && styles.radioOn]} />
                </Pressable>
              );
            })}

            {bookingDealership && (
              <>
                <Text style={styles.fieldLabelDark}>DIA</Text>
                <View style={styles.chipWrap}>
                  {availableDays(bookingDealership).map((day) => {
                    const picked =
                      bookingDay?.toDateString() === day.toDateString();
                    return (
                      <Pressable
                        key={day.toISOString()}
                        style={[styles.dayChip, picked && styles.chipOn]}
                        onPress={() => setBookingDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayChipWeek,
                            picked && styles.chipTextOn,
                          ]}
                        >
                          {day
                            .toLocaleDateString("pt-BR", { weekday: "short" })
                            .replace(".", "")
                            .toUpperCase()}
                        </Text>
                        <Text
                          style={[
                            styles.dayChipDay,
                            picked && styles.chipTextOn,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                        <Text
                          style={[
                            styles.dayChipMonth,
                            picked && styles.chipTextOn,
                          ]}
                        >
                          {day
                            .toLocaleDateString("pt-BR", { month: "short" })
                            .replace(".", "")
                            .toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabelDark}>HORÁRIO</Text>
                <View style={styles.chipWrap}>
                  {availableSlots(bookingDealership).map((slot) => {
                    const picked = bookingSlot === slot;
                    return (
                      <Pressable
                        key={slot}
                        style={[styles.slotChip, picked && styles.chipOn]}
                        onPress={() => setBookingSlot(slot)}
                      >
                        <Text
                          style={[
                            styles.slotChipText,
                            picked && styles.chipTextOn,
                          ]}
                        >
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {bookingError ? (
              <Text style={styles.error}>{bookingError}</Text>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                (!bookingDay || !bookingSlot || bookingBusy) &&
                  styles.buttonDisabled,
              ]}
              onPress={() => void confirmBooking()}
              disabled={!bookingDay || !bookingSlot || bookingBusy}
            >
              {bookingBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Confirmar agendamento
                </Text>
              )}
            </Pressable>
            <Text style={styles.bookingFootnote}>
              A concessionária confirma o horário e você recebe um aviso aqui.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return <OwnerApp />;
  return (
    <View style={styles.webCanvas}>
      {/* Background Gradient Noturno */}
      <LinearGradient
        colors={["#020b15", "#041426", "#020912"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Luz ambiente central */}
      <View style={styles.webCanvasAura} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 1000 800" preserveAspectRatio="none">
          <Defs>
            <SvgGradient id="canvasGlow" x1="60%" y1="40%" x2="100%" y2="80%">
              <Stop offset="0%" stopColor="#0066d6" stopOpacity="0.22" />
              <Stop offset="50%" stopColor="#003577" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#020912" stopOpacity="0" />
            </SvgGradient>
          </Defs>
          <Ellipse cx="650" cy="400" rx="480" ry="380" fill="url(#canvasGlow)" />
        </Svg>
      </View>

      {width >= 960 && (
        <View style={styles.webStory}>
          <View style={styles.webStoryHeader}>
            <FordOval width={112} onDark />
            <View style={styles.webTagBadge}>
              <Sparkles size={13} color="#38bdf8" />
              <Text style={styles.webTagBadgeText}>EXPERIÊNCIA CONECTADA</Text>
            </View>
          </View>

          <Text style={styles.webTitle}>
            Cada caminho,{"\n"}
            <Text style={styles.webTitleHighlight}>uma nova história.</Text>
          </Text>
          <Text style={styles.webDescription}>
            Seu Ford tem uma história única. Cuide de cada capítulo com agendamento direto na concessionária, telemetria inteligente e a confiança absoluta da rede autorizada.
          </Text>

          <View style={styles.webFeatures}>
            <View style={styles.webFeatureCard}>
              <View style={styles.webFeatureIconBox}>
                <ShieldCheck color="#38bdf8" size={22} />
              </View>
              <View style={styles.webFeatureTextBox}>
                <Text style={styles.webFeatureTitle}>Histórico Digital do Veículo</Text>
                <Text style={styles.webFeatureDesc}>Manutenções, peças genuínas e garantia sempre à mão.</Text>
              </View>
            </View>

            <View style={styles.webFeatureCard}>
              <View style={styles.webFeatureIconBox}>
                <CalendarDays color="#38bdf8" size={22} />
              </View>
              <View style={styles.webFeatureTextBox}>
                <Text style={styles.webFeatureTitle}>Agendamento Inteligente</Text>
                <Text style={styles.webFeatureDesc}>Escolha data, horário e consultor em poucos segundos.</Text>
              </View>
            </View>

            <View style={styles.webFeatureCard}>
              <View style={styles.webFeatureIconBox}>
                <Gift color="#38bdf8" size={22} />
              </View>
              <View style={styles.webFeatureTextBox}>
                <Text style={styles.webFeatureTitle}>Benefícios & Fidelidade Ford</Text>
                <Text style={styles.webFeatureDesc}>Pontos em revisões acumulados e convertidos em recompra.</Text>
              </View>
            </View>
          </View>

          {/* Card de Demonstração Interativo */}
          <View style={styles.webDemoHelperCard}>
            <View style={styles.webDemoHelperHeader}>
              <Zap size={14} color="#38bdf8" />
              <Text style={styles.webDemoHelperTitle}>AMBIENTE DE DEMONSTRAÇÃO</Text>
            </View>
            <Text style={styles.webDemoHelperInfo}>
              Utilize o botão <Text style={styles.webDemoHelperBold}>Preencher demo</Text> no celular ao lado ou entre com <Text style={styles.webDemoHelperCode}>carlos@ford360.local</Text> e senha <Text style={styles.webDemoHelperCode}>Ford@360</Text> para acessar a garagem completa.
            </Text>
          </View>

          <Text style={styles.webFooter}>FORD MOTOR COMPANY BRASIL · TECNOLOGIA CONECTADA 360</Text>
        </View>
      )}

      {/* Mockup do Smartphone com Acabamento Titanium */}
      <View style={[styles.webApp, width >= 960 && styles.webAppDesktop]}>
        {width >= 960 && (
          <View style={styles.phoneDeviceNotch}>
            <View style={styles.phoneDeviceSpeaker} />
            <View style={styles.phoneDeviceCamera} />
          </View>
        )}
        <OwnerApp />
      </View>
    </View>
  );
}

/**
 * Mesma linguagem visual do painel web: fundo #f3f6f9, cartões brancos com
 * borda fina e sombra sutil, eyebrow em azul, tipografia Inter/sistema.
 */
const card = {
  backgroundColor: t.card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: t.line,
  boxShadow: "0 9px 22px rgba(26, 67, 94, 0.07)",
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  /* ===== Apresentação Web Desktop ===== */
  webCanvas: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020b15',
    overflow: 'hidden',
    position: 'relative',
  },
  webCanvasAura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  webStory: {
    flex: 1,
    maxWidth: 580,
    paddingHorizontal: 48,
    paddingVertical: 36,
    zIndex: 1,
  },
  webStoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  webTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 118, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  webTagBadgeText: {
    color: '#7dd3fc',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  webTitle: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  webTitleHighlight: {
    color: '#38bdf8',
  },
  webDescription: {
    color: '#94a9bf',
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 480,
    marginBottom: 28,
  },
  webFeatures: {
    gap: 14,
    marginBottom: 28,
  },
  webFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 30, 48, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  webFeatureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 118, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFeatureTextBox: {
    flex: 1,
  },
  webFeatureTitle: {
    color: '#f0f6fc',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  webFeatureDesc: {
    color: '#839cb5',
    fontSize: 12,
    lineHeight: 17,
  },
  webDemoHelperCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(3, 105, 161, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    marginBottom: 24,
  },
  webDemoHelperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  webDemoHelperTitle: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  webDemoHelperInfo: {
    color: '#bad1e4',
    fontSize: 12,
    lineHeight: 18,
  },
  webDemoHelperBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
  webDemoHelperCode: {
    color: '#7dd3fc',
    fontWeight: '700',
  },
  webFooter: {
    color: '#53708a',
    fontSize: 9.5,
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  webApp: {
    width: '100%',
    maxWidth: 540,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: t.bg,
  },
  webAppDesktop: {
    maxWidth: 420,
    height: '94%',
    maxHeight: 880,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: 'rgba(100, 160, 220, 0.25)',
    marginRight: 48,
    boxShadow: '0 30px 80px -10px rgba(0, 0, 0, 0.8), 0 0 45px rgba(0, 118, 255, 0.18)',
    position: 'relative',
    zIndex: 2,
  },
  phoneDeviceNotch: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    height: 22,
    backgroundColor: '#01050a',
    borderRadius: 12,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  phoneDeviceSpeaker: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1b2d42',
  },
  phoneDeviceCamera: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a1d30',
    borderWidth: 1,
    borderColor: '#193959',
  },

  /* ===== Outras notificações gerais ===== */
  connectionNotice: { backgroundColor: '#fff2e3', padding: 16, gap: 8 },
  connectionNoticeText: { color: '#875417', fontSize: 13, lineHeight: 20 },
  retryText: { color: '#075c9b', fontSize: 13, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 10 },
  garageLabel: { color: '#8fb8d0', fontSize: 7.5, fontWeight: '800', letterSpacing: 1.1 },
  garageSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(131, 204, 239, .35)',
    backgroundColor: 'rgba(4, 28, 51, .48)',
  },
  garageSwitcherPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  garageSwitcherIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14618f' },
  garageSwitcherText: { color: '#eef8ff', fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  garageSwitcherAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  garageSwitcherBonusLabel: { color: '#8fb8d0', fontSize: 5.8, fontWeight: '800', letterSpacing: 0.7 },
  garageSwitcherActionText: { color: '#dff4ff', fontSize: 9, fontWeight: '800', marginTop: 1 },
  screen: { flex: 1, backgroundColor: t.bg },

  /* ===== Tela de Acesso (Login Mobile) ===== */
  login: {
    flex: 1,
    backgroundColor: "#020a13",
    position: 'relative',
  },
  loginAura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  loginBooting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loginScroll: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 24,
  },
  loginHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  loginLogoContainer: {
    padding: 4,
  },
  loginBrandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  loginBrandBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  loginBrandBadgeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#38bdf8",
  },
  loginBrandBadgeSub: {
    color: "#7dd3fc",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 22,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: "#0066d6",
    boxShadow: "0 2px 10px rgba(0, 102, 214, 0.35)",
  },
  segmentBtnText: {
    color: "#8aa2b9",
    fontSize: 12.5,
    fontWeight: "700",
  },
  segmentBtnTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  loginHero: {
    marginBottom: 18,
  },
  loginEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#38bdf8",
    fontWeight: "800",
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#ffffff",
    marginBottom: 8,
  },
  loginDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#9db7cc",
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#8cb2ce",
    marginTop: 14,
    marginBottom: 7,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 7,
  },
  forgotPasswordText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38bdf8",
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 13,
    paddingHorizontal: 15,
  },
  fieldFocused: {
    borderColor: '#0084ff',
    backgroundColor: 'rgba(0, 132, 255, 0.09)',
    boxShadow: '0 0 0 3px rgba(0, 132, 255, 0.18)',
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    color: '#ffffff',
    fontSize: 15,
  },
  passwordToggle: {
    padding: 8,
    marginRight: -4,
  },
  demoQuickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    alignSelf: 'flex-start',
  },
  demoQuickPillPressed: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  demoQuickPillText: {
    color: '#badff5',
    fontSize: 11.5,
  },
  demoQuickPillBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
  requirementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 118, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 118, 255, 0.2)',
  },
  requirementText: {
    color: '#99cbed',
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  selfRegistrationForm: {
    marginTop: 2,
  },
  selfRegistrationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 118, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.26)',
  },
  selfRegistrationNoticeText: {
    flex: 1,
    color: '#b9d8eb',
    fontSize: 11.5,
    lineHeight: 17,
  },
  optionalLabel: {
    color: '#5d7891',
    fontSize: 8,
  },
  registrationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 23,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  registrationSectionTitle: {
    color: '#d9efff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.35,
  },
  registrationSplit: {
    flexDirection: 'row',
    gap: 10,
  },
  registrationSplitItem: {
    flex: 1,
  },
  registrationModelSuggestions: {
    marginTop: 8,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.24)',
    backgroundColor: 'rgba(2, 15, 28, 0.94)',
  },
  registrationModelSuggestion: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  registrationModelIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.11)',
  },
  registrationModelSuggestionTitle: {
    color: '#f4f9fc',
    fontSize: 12,
    fontWeight: '800',
  },
  registrationModelSuggestionMeta: {
    color: '#7897ad',
    fontSize: 9.5,
    marginTop: 3,
  },
  registrationCatalogHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.22)',
  },
  registrationCatalogHintText: {
    flex: 1,
    color: '#b9ddcb',
    fontSize: 10.5,
    lineHeight: 15,
  },
  registrationColorChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  registrationColorChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  registrationColorChoiceSelected: {
    borderColor: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.11)',
  },
  registrationColorDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  registrationColorText: { color: '#b7c8d6', fontSize: 10.5, fontWeight: '700' },
  registrationColorTextSelected: { color: '#ffffff' },
  dealershipChoices: {
    gap: 9,
    paddingVertical: 1,
    paddingRight: 12,
  },
  dealershipChoice: {
    width: 154,
    minHeight: 64,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  dealershipChoiceSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(0, 118, 255, 0.20)',
  },
  dealershipChoiceName: {
    color: '#c0d4e4',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  dealershipChoiceNameSelected: { color: '#ffffff' },
  dealershipChoiceLocation: {
    color: '#6f8ca4',
    fontSize: 10,
    marginTop: 5,
  },
  dealershipChoiceLocationSelected: { color: '#96d8fa' },
  registrationConsent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    padding: 13,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  registrationConsentSelected: {
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderColor: 'rgba(52,211,153,0.40)',
  },
  registrationCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#6f8ca4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  registrationCheckSelected: {
    backgroundColor: '#34d399',
    borderColor: '#34d399',
  },
  registrationConsentText: {
    flex: 1,
    color: '#b7c8d6',
    fontSize: 11.5,
    lineHeight: 17,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 11,
    marginTop: 14,
  },
  errorBannerText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 11,
    marginTop: 14,
  },
  recoveryBannerText: {
    color: '#6ee7b7',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  loginPrimaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
    boxShadow: '0 8px 24px rgba(0, 102, 214, 0.38)',
  },
  loginPrimaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  loginPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  loginPrimaryGradient: {
    flexDirection: 'row',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  loginPrimaryText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  backToLoginBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 12.5,
    color: '#8da9c0',
  },
  backToLoginBold: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  selfRegistrationLink: {
    marginTop: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
  },
  selfRegistrationLinkText: {
    color: '#a9d9f3',
    fontSize: 12,
    fontWeight: '700',
  },
  loginSpacer: {
    flex: 1,
    minHeight: 24,
  },
  loginFooter: {
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  loginFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  loginFooterSecurity: {
    fontSize: 10,
    color: '#7fa3bf',
  },
  loginFooterBrand: {
    fontSize: 9,
    color: '#4d6b84',
    letterSpacing: 0.4,
  },
  error: { fontSize: 11.5, color: "#f08b86", marginTop: 14 },
  primaryButton: {
    flexDirection: "row",
    height: 50,
    borderRadius: 13,
    backgroundColor: t.blue,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    boxShadow: "0 8px 18px rgba(8, 120, 189, .24)",
  },
  primaryButtonPressed: { backgroundColor: "#04629f" },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  loginHelp: {
    fontSize: 13,
    lineHeight: 17,
    color: "#9bbdd6",
    marginTop: 16,
    textAlign: "center",
  },

  loginLegal: {
    gap: 7,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  loginLegalRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  loginLegalText: { fontSize: 10, color: "#7d9ab1" },
  loginLegalBrand: { fontSize: 9, color: "#4f6d84", letterSpacing: 0.3 },

  /* ----- Cabeçalho ----- */
  header: {
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 24,
  },
  /** Na home o cabeçalho absorve o veículo e vira um bloco só. */
  headerHome: {
    paddingBottom: 0,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
    boxShadow: "0 16px 28px rgba(5, 41, 70, .18)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    /** Topo, para o avatar acompanhar o emblema e não o bloco inteiro. */
    alignItems: "flex-start",
  },

  /* ----- Barra das telas internas ----- */
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: t.card,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
    boxShadow: "0 3px 14px rgba(26, 67, 94, .06)",
  },
  topbarBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  topbarFord: {
    fontSize: 19,
    fontStyle: "italic",
    fontWeight: "900",
    color: t.navy,
  },
  topbarDivider: { width: 1, height: 16, backgroundColor: "#cfd9e2" },
  topbarProduct: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: t.muted,
  },
  avatarLight: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e3f1fb",
    borderWidth: 1,
    borderColor: "#c5e0f5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLightText: { fontSize: 11, fontWeight: "800", color: "#0a5f9c" },

  /* ----- Painel da conta ----- */
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(6,20,34,0.55)" },
  sheet: {
    backgroundColor: t.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
  },
  accountSheet: { maxHeight: "92%", paddingBottom: 14 },
  accountMenuScroll: { paddingBottom: 16 },
  accountMenuSection: { color: t.faint, fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
  accountMenuRow: { alignItems: "center", borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 13, marginBottom: 9, backgroundColor: "#fff" },
  accountMenuRowPressed: { opacity: 0.78, transform: [{ scale: 0.988 }] },
  accountMenuRowFeatured: { backgroundColor: "#073f6c", borderColor: "#0a679e", boxShadow: "0 9px 20px rgba(7, 63, 108, .18)" },
  accountTradeIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.15)", borderWidth: 1, borderColor: "rgba(255,255,255,.18)" },
  accountTradeLabel: { color: "#8fd4f1", fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  accountTradeTitle: { color: "#fff", fontSize: 13.5, fontWeight: "800", marginTop: 3 },
  accountTradeHint: { color: "#c8dfeb", fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  accountVehicleSummary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, backgroundColor: "#f2f8fb", borderWidth: 1, borderColor: "#d9e9f1", marginTop: 3 },
  profileHero: { flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderRadius: 16, marginTop: 16, overflow: "hidden" },
  profileHeroAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)", borderWidth: 1, borderColor: "rgba(255,255,255,.24)" },
  profileHeroAvatarText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  profileHeroName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  profileHeroEmail: { color: "#c7e3f1", fontSize: 10, marginTop: 4 },
  profileStats: { flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderColor: t.line, borderRadius: 14, marginTop: 12, paddingVertical: 14, backgroundColor: "#fff" },
  profileStat: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  profileStatDivider: { width: 1, backgroundColor: t.line },
  profileStatValue: { color: t.ink, fontSize: 13, fontWeight: "900" },
  profileStatLabel: { color: t.faint, fontSize: 6.5, fontWeight: "800", letterSpacing: 0.7, marginTop: 5, textAlign: "center" },
  profilePrivacyAction: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: t.line, marginTop: 4 },
  catalogSheet: { maxHeight: "88%" },
  garageSheet: { maxHeight: "96%", paddingHorizontal: 20 },
  garageSheetIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px rgba(8, 93, 149, .24)" },
  tradeBonusCard: { marginTop: 14, padding: 12, borderRadius: 15, overflow: "hidden", boxShadow: "0 9px 22px rgba(7, 64, 101, .20)" },
  tradeBonusTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  tradeBonusIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(143, 224, 182, .16)", borderWidth: 1, borderColor: "rgba(185, 244, 213, .22)" },
  tradeBonusEyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tradeBonusEyebrow: { color: "#9fdbf5", fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  tradeBonusPilot: { color: "#b8d6e8", fontSize: 5.5, fontWeight: "800", letterSpacing: 0.5 },
  tradeBonusValue: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  tradeBonusDescription: { color: "#c5dfed", fontSize: 7.8, marginTop: 1 },
  tradeBonusProgress: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,.15)", overflow: "hidden", marginTop: 10 },
  tradeBonusProgressFill: { height: "100%", borderRadius: 3, backgroundColor: "#8fe0b6" },
  tradeBonusFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 },
  tradeBonusHint: { flex: 1, color: "#c5dfed", fontSize: 7.5, fontWeight: "700" },
  tradeBonusAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 9, backgroundColor: "rgba(255,255,255,.13)" },
  tradeBonusActionText: { color: "#fff", fontSize: 7.5, fontWeight: "800" },
  garageCards: { gap: 12, paddingTop: 12, paddingBottom: 12, paddingRight: 8 },
  garageVehicleCard: { width: 278, borderRadius: 18, borderWidth: 1, borderColor: "#d7e5ed", backgroundColor: "#fff", overflow: "hidden", boxShadow: "0 10px 24px rgba(9, 45, 73, .10)" },
  garageVehicleCardActive: { borderColor: "#64b7e3", boxShadow: "0 12px 28px rgba(8, 120, 189, .18)" },
  garageVehicleCardPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  garageVehicleVisual: { height: 156, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  garageVehicleImage: { width: "100%", height: "100%" },
  garageVehicleShade: { ...StyleSheet.absoluteFillObject },
  garageStatusPill: { position: "absolute", top: 11, left: 11, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12, backgroundColor: "rgba(2, 25, 45, .76)", borderWidth: 1, borderColor: "rgba(218, 239, 250, .24)" },
  garageStatusPillActive: { backgroundColor: "rgba(28, 109, 72, .88)", borderColor: "rgba(191, 244, 214, .35)" },
  garageStatusText: { color: "#d9ecf8", fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  garageStatusTextActive: { color: "#dff8ea" },
  garageVehicleIdentity: { position: "absolute", left: 13, right: 13, bottom: 12 },
  garageVehicleModel: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  garageVehicleYear: { color: "#b8d8e9", fontSize: 9, fontWeight: "700", marginTop: 2 },
  garageVehicleBody: { minHeight: 67, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 13 },
  garageVehiclePlate: { color: t.ink, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  garageVehicleVin: { width: 130, color: t.faint, fontSize: 7.5, letterSpacing: 0.3, marginTop: 3 },
  garageSelectAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10, backgroundColor: "#eaf5fc" },
  garageSelectActionActive: { backgroundColor: "#eaf8f0" },
  garageSelectActionText: { color: t.blue, fontSize: 8.5, fontWeight: "800" },
  garageSelectActionTextActive: { color: "#247a50" },
  garageAddVehicle: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#9bcce6", backgroundColor: "#f4fafe" },
  garageAddVehicleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#e3f3fb" },
  garageAddVehicleTitle: { color: t.ink, fontSize: 11, fontWeight: "800" },
  garageAddVehicleHint: { color: t.muted, fontSize: 8.5, marginTop: 3 },
  vehicleDetailSheet: { maxHeight: "92%" },
  vehicleDetailScroll: { paddingBottom: 8 },
  catalogDisclaimer: { color: t.faint, fontSize: 9.5, lineHeight: 14, marginTop: 12, marginBottom: 2 },
  catalogCard: { ...card, overflow: "hidden", marginTop: 14 },
  catalogImageStage: { width: "100%", height: 158, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  catalogImage: { width: "100%", height: "100%" },
  catalogImageFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  catalogReferenceBadge: { position: "absolute", left: 11, bottom: 10, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(207, 242, 223, .28)", backgroundColor: "rgba(24, 91, 62, .88)" },
  catalogReferenceBadgeText: { color: "#dff8ea", fontSize: 6.5, fontWeight: "900", letterSpacing: 0.55 },
  catalogCardBody: { padding: 15 },
  catalogCardHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  catalogCategory: { color: t.blue, fontSize: 7.5, fontWeight: "800", letterSpacing: 1.1 },
  catalogName: { color: t.ink, fontSize: 19, fontWeight: "800", marginTop: 4 },
  catalogDescription: { color: t.body, fontSize: 10.5, lineHeight: 16, marginTop: 8 },
  catalogHighlights: { color: t.faint, fontSize: 9, fontWeight: "700", marginTop: 9 },
  catalogSpecsTitle: { color: t.faint, fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 13, marginBottom: 6 },
  catalogSpecs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catalogSpecChip: { borderRadius: 6, borderWidth: 1, borderColor: "#dbe7ef", backgroundColor: "#f7fbfd", paddingHorizontal: 7, paddingVertical: 5 },
  catalogSpecText: { color: t.body, fontSize: 8.5, lineHeight: 12 },
  catalogPrice: { color: t.ink, fontSize: 11, fontWeight: "800", marginTop: 9 },
  catalogAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 40, borderRadius: 9, backgroundColor: "#eaf5fc", marginTop: 13 },
  catalogActionText: { color: t.blue, fontSize: 10.5, fontWeight: "800" },
  sheetGrip: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#dde5ec",
    marginBottom: 20,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  sheetAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#0a63a6",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAvatarText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  sheetName: { fontSize: 15, fontWeight: "800", color: t.ink },
  sheetEmail: { fontSize: 11, color: t.muted, marginTop: 3 },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f1f5f8",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRow: {
    flexDirection: "row",
    gap: 13,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  sheetRowLabel: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: t.faint,
  },
  sheetRowValue: {
    fontSize: 13,
    fontWeight: "700",
    color: t.ink,
    marginTop: 4,
  },
  sheetRowHint: { fontSize: 10, color: t.muted, marginTop: 3, lineHeight: 15 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#f2d3d1",
    backgroundColor: "#fdf5f4",
    marginTop: 22,
  },
  logoutText: { fontSize: 12.5, fontWeight: "800", color: "#c6403b" },
  sheetVersion: {
    fontSize: 9,
    color: t.faint,
    textAlign: "center",
    marginTop: 16,
  },

  /* ----- Detalhe do atendimento ----- */
  maintenanceHero: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 12, padding: 13, marginTop: 16 },
  maintenanceHeroGood: { backgroundColor: "#eff9f3", borderWidth: 1, borderColor: "#ccebd8" },
  maintenanceHeroWarning: { backgroundColor: "#fdf2f1", borderWidth: 1, borderColor: "#f1d2cf" },
  maintenanceHeroIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  maintenanceEyebrow: { color: t.faint, fontSize: 7.5, fontWeight: "800", letterSpacing: 1 },
  maintenanceStatus: { color: t.ink, fontSize: 15, fontWeight: "800", marginTop: 3 },
  maintenanceHint: { color: t.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  detailSectionTitle: { color: t.ink, fontSize: 13, fontWeight: "800", marginTop: 18, marginBottom: 2 },
  maintenanceChecklist: { borderWidth: 1, borderColor: t.line, borderRadius: 11, overflow: "hidden" },
  maintenanceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line },
  maintenanceRowTitle: { color: t.ink, fontSize: 10.5, fontWeight: "700" },
  maintenanceRowHint: { color: t.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  maintenanceRowStatus: { color: t.faint, fontSize: 7.5, fontWeight: "800", letterSpacing: 0.7 },
  maintenanceGood: { color: "#247a50" },
  maintenanceWarning: { color: "#b4433c" },
  vehicleDetailActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  secondarySheetAction: { flex: 1, height: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, borderWidth: 1, borderColor: "#cfe3ee", backgroundColor: "#f5fbfe" },
  secondarySheetActionText: { color: t.blue, fontSize: 10, fontWeight: "800" },
  primarySheetAction: { flex: 1, height: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, backgroundColor: t.blue },
  primarySheetActionText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  detailGrid: { paddingTop: 4 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  detailLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: t.faint,
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: t.ink,
    flexShrink: 1,
    textAlign: "right",
  },
  detailNote: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f1f8f4",
    borderRadius: 10,
    padding: 13,
    marginTop: 18,
  },
  detailNoteText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: "#3d6b53",
  },

  /* ----- Diálogo de confirmação ----- */
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(6,20,34,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  dialog: {
    width: "100%",
    backgroundColor: t.card,
    borderRadius: 18,
    padding: 22,
  },
  tradeInterestDialog: { width: "100%", maxWidth: 420, alignItems: "center", backgroundColor: t.card, borderRadius: 22, padding: 24, boxShadow: "0 22px 60px rgba(4, 30, 51, .28)" },
  tradeInterestSuccessIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 15, boxShadow: "0 9px 22px rgba(8, 120, 189, .25)" },
  tradeInterestEyebrow: { color: t.blue, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  tradeInterestTitle: { color: t.ink, fontSize: 18, lineHeight: 23, fontWeight: "900", textAlign: "center", marginTop: 7 },
  tradeInterestBody: { color: t.body, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 10 },
  tradeInterestNotice: { width: "100%", flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#cde9da", backgroundColor: "#eff9f4", marginTop: 16 },
  tradeInterestNoticeText: { flex: 1, color: "#316a4d", fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
  tradeInterestDone: { width: "100%", height: 45, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: t.blue, marginTop: 16 },
  dialogTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: t.ink,
    marginTop: 14,
  },
  dialogBody: {
    fontSize: 11.5,
    lineHeight: 18,
    color: t.muted,
    marginTop: 8,
  },
  dialogCancel: { alignItems: "center", paddingVertical: 14 },
  dialogCancelText: { fontSize: 12, fontWeight: "700", color: t.muted },

  /* ----- Agendamento ----- */
  bookingSheet: { maxHeight: "88%" },
  fieldLabelDark: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: t.faint,
    marginTop: 20,
    marginBottom: 9,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 11,
    padding: 14,
    marginBottom: 8,
  },
  pickRowOn: { borderColor: t.bright, backgroundColor: "#f2f9fe" },
  pickTitle: { fontSize: 12.5, fontWeight: "700", color: t.ink },
  pickHint: { fontSize: 10, color: t.muted, marginTop: 3 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#c9d5de",
  },
  radioOn: { borderColor: t.bright, borderWidth: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    width: 58,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.line,
  },
  dayChipWeek: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: t.muted,
  },
  dayChipDay: {
    fontSize: 17,
    fontWeight: "800",
    color: t.ink,
    marginTop: 1,
  },
  dayChipMonth: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: t.muted,
    marginTop: 1,
  },
  slotChip: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: t.line,
  },
  slotChipText: { fontSize: 12, fontWeight: "700", color: t.ink },
  chipOn: { backgroundColor: t.blue, borderColor: t.blue },
  chipTextOn: { color: "#fff" },
  buttonDisabled: { opacity: 0.45 },
  bookingFootnote: {
    fontSize: 10,
    color: t.muted,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetBottomGap: { height: 20 },

  /* ----- Campos em painel claro ----- */
  lightField: {
    borderWidth: 1,
    borderColor: "#dbe4eb",
    backgroundColor: "#f7fafc",
    borderRadius: 11,
    paddingHorizontal: 14,
    justifyContent: "center",
    height: 48,
  },
  lightFieldTall: { height: 104, paddingVertical: 12 },
  lightFieldInput: { color: t.ink, fontSize: 13 },
  lightFieldInputTall: { height: 80, textAlignVertical: "top" },
  helperText: { fontSize: 10, color: t.muted, marginTop: 8 },

  /* ----- Suporte ----- */
  chatSheet: { minHeight: "72%" },
  chatBack: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef7fc",
  },
  chatIntro: {
    marginBottom: 18,
    padding: 15,
    borderRadius: 13,
    backgroundColor: "#eef7fc",
    borderWidth: 1,
    borderColor: "#d4e8f4",
  },
  chatIntroTitle: { fontSize: 14, fontWeight: "800", color: t.ink },
  chatIntroText: { marginTop: 5, fontSize: 10.5, lineHeight: 16, color: t.muted },
  chatContext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
    paddingHorizontal: 3,
  },
  chatLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#26a66e" },
  chatContextText: { flex: 1, fontSize: 9, color: t.muted },
  chatThread: {
    flex: 1,
    minHeight: 250,
    borderWidth: 1,
    borderColor: "#dfe9ef",
    borderRadius: 14,
    backgroundColor: "#edf4f7",
  },
  chatThreadContent: { padding: 12, gap: 9, justifyContent: "flex-end" },
  chatBubble: {
    maxWidth: "84%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    boxShadow: "0 3px 10px rgba(25,61,84,.06)",
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    borderRadius: 14,
    borderTopRightRadius: 4,
    backgroundColor: t.blue,
  },
  chatBubbleFord: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#dce7ed",
    backgroundColor: "#fff",
  },
  chatSender: { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.8, color: t.blue },
  chatSenderMine: { color: "#bfe8ff" },
  chatBody: { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: t.ink },
  chatBodyMine: { color: "#fff" },
  chatTime: { marginTop: 6, fontSize: 7.5, color: t.faint, textAlign: "right" },
  chatTimeMine: { color: "#cbeaff" },
  chatComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    marginTop: 11,
  },
  chatInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#d7e3ea",
    borderRadius: 13,
    backgroundColor: "#f8fafb",
    color: t.ink,
    fontSize: 11.5,
    textAlignVertical: "top",
  },
  chatSend: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.blue,
  },
  chatPrivacy: { marginTop: 8, fontSize: 8, lineHeight: 12, color: t.faint, textAlign: "center" },
  ticketCard: {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 11,
    padding: 14,
    marginBottom: 9,
    backgroundColor: "#fff",
  },
  ticketCardUnread: { borderColor: "#7ab9de", backgroundColor: "#f7fcff" },
  ticketCardPressed: { opacity: 0.75 },
  ticketHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: t.ink,
  },
  ticketReply: {
    backgroundColor: "#f1f8f4",
    borderRadius: 9,
    padding: 11,
    marginTop: 9,
  },
  ticketReplyLabel: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#3d6b53",
  },
  ticketReplyText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#31543f",
    marginTop: 4,
  },

  /* ----- Privacidade ----- */
  recallSheetText: {
    fontSize: 12,
    lineHeight: 18,
    color: t.body,
    paddingVertical: 16,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d5dee6",
    padding: 3,
    justifyContent: "center",
  },
  switchTrackOn: { backgroundColor: "#3aa76d" },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  switchKnobOn: { alignSelf: "flex-end" },
  headerGreeting: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: t.sky,
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.7,
    marginTop: 4,
  },
  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#12609b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
  },
  profileText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  content: { flex: 1 },
  contentInner: { paddingBottom: 30 },
  body: { paddingHorizontal: 16, paddingTop: 22 },

  /* ----- Veículo no hero ----- */
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 22,
  },
  verifiedText: {
    color: "#8fe0b6",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  vehicleName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 12,
  },
  vehicleVin: {
    color: "#8fb2cb",
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 5,
  },
  heroArt: {
    height: 178,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(180, 224, 247, 0.28)",
    backgroundColor: "#011d3f",
    boxShadow: "0 12px 26px rgba(0, 9, 22, .28)",
  },
  vehicleHeroImage: {
    width: "100%",
    height: "100%",
  },
  vehicleHeroVisual: { width: "100%", height: "100%" },
  vehicleHeroShade: { ...StyleSheet.absoluteFillObject },
  vehiclePhotoTag: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: "rgba(2, 25, 45, .78)",
    borderWidth: 1,
    borderColor: "rgba(201, 237, 255, .28)",
  },
  vehiclePhotoTagText: { color: "#dff4ff", fontSize: 7.5, fontWeight: "800", letterSpacing: 0.8 },
  vehiclePhotoCaption: { position: "absolute", left: 14, right: 14, bottom: 12 },
  vehiclePhotoCaptionModel: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  vehiclePhotoCaptionMeta: { color: "#b8d6e8", fontSize: 9, fontWeight: "700", marginTop: 2 },
  /** Faixa de números: divisórias em filete no lugar de mais um card. */
  heroMetrics: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.11)",
  },
  heroMetric: { flex: 1, paddingVertical: 15, paddingLeft: 14 },
  heroDivider: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  heroMetricValue: { fontSize: 15, fontWeight: "800", color: "#fff" },
  heroMetricLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: "#7fa2bb",
    marginTop: 4,
  },

  /* ----- Alerta de recall ----- */
  recallAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fdf2f1",
    borderWidth: 1,
    borderColor: "#f4d7d5",
    borderRadius: 12,
    padding: 15,
    marginBottom: 22,
  },
  recallAlertIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fbe2e0",
    alignItems: "center",
    justifyContent: "center",
  },
  recallAlertLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#bc463f",
  },
  recallAlertTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7d2f2a",
    marginTop: 5,
  },
  recallAlertHint: { fontSize: 9, color: "#a97570", marginTop: 4 },

  /* ----- Vínculo de veículo ----- */
  successNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eaf7ef",
    borderWidth: 1,
    borderColor: "#cdebd9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successNoticeText: {
    flex: 1,
    color: "#247a50",
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "700",
  },
  pendingVehicleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#f4f9fc",
    borderWidth: 1,
    borderColor: "#c9e2f1",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pendingVehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#deeff9",
  },
  pendingVehicleEyebrow: {
    color: "#0878bd",
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  pendingVehicleTitle: {
    color: t.ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  chatUnreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.blue,
  },
  chatUnreadBadgeText: { fontSize: 8, fontWeight: "800", color: "#fff" },
  ticketFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ticketOpenText: { marginTop: 8, fontSize: 9, fontWeight: "800", color: t.blue },
  pendingVehicleDescription: {
    color: t.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  attentionCard: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, borderWidth: 1, padding: 15, marginBottom: 16, boxShadow: "0 6px 16px rgba(26, 67, 94, .05)" },
  attentionBlue: { backgroundColor: "#eef8fd", borderColor: "#c9e6f5" },
  attentionRed: { backgroundColor: "#fdf2f1", borderColor: "#f2d3d0" },
  attentionGreen: { backgroundColor: "#eff9f3", borderColor: "#cdebd9" },
  attentionViolet: { backgroundColor: "#f7f2fd", borderColor: "#e4d6f5" },
  attentionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: t.blue },
  attentionLabel: { color: t.faint, fontSize: 7.5, fontWeight: "800", letterSpacing: 1.1 },
  attentionTitle: { color: t.ink, fontSize: 12.5, fontWeight: "800", marginTop: 3 },
  attentionDescription: { color: t.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  attentionAction: { flexDirection: "row", alignItems: "center", gap: 3, paddingLeft: 4 },
  attentionActionText: { color: t.blue, fontSize: 9, fontWeight: "800" },
  vehicleProfileCard: { ...card, padding: 16, marginBottom: 18, borderColor: "#c9e0ec" },
  vehicleProfileHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  vehicleProfileArt: { width: 120, height: 62, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#eaf4f9" },
  vehicleProfileImage: { width: "100%", height: "100%" },
  vehicleProfileEyebrow: { color: t.blue, fontSize: 7.5, fontWeight: "800", letterSpacing: 1.1 },
  vehicleProfileName: { color: t.ink, fontSize: 17, fontWeight: "800", marginTop: 3 },
  vehicleProfileIdentity: { color: t.faint, fontSize: 8.5, marginTop: 5 },
  vehicleProfileStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  vehicleProfileStatusText: { color: "#247a50", fontSize: 8.5, fontWeight: "800" },
  vehicleProfileStatusWarning: { color: "#b4433c" },
  vehicleProfileGrid: { flexDirection: "row", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.line },
  vehicleProfileMetric: { flex: 1, paddingLeft: 9 },
  vehicleProfileMetricValue: { color: t.ink, fontSize: 11, fontWeight: "800" },
  vehicleProfileMetricLabel: { color: t.faint, fontSize: 7, letterSpacing: 0.7, marginTop: 4 },
  vehicleProfileAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line },
  vehicleProfileActionText: { color: t.blue, fontSize: 10, fontWeight: "800" },
  claimCard: {
    ...card,
    padding: 18,
    marginBottom: 22,
    borderColor: "#cbe3f5",
  },
  claimHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  claimIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#e3f1fb",
    alignItems: "center",
    justifyContent: "center",
  },
  claimEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: t.blue,
  },
  claimTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: t.ink,
    marginTop: 3,
  },
  claimDescription: {
    color: t.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },
  fieldLabelLight: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: t.muted,
    marginTop: 15,
    marginBottom: 7,
  },
  claimInput: {
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#d6e1e9",
    backgroundColor: "#f7fafc",
    color: t.ink,
    fontSize: 14,
    letterSpacing: 0.7,
    paddingHorizontal: 13,
  },
  claimError: { color: "#b33d38", fontSize: 10.5, marginTop: 10 },
  claimButton: {
    height: 48,
    borderRadius: 13,
    backgroundColor: t.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  claimPrivacy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  claimPrivacyText: { color: t.muted, fontSize: 9.5 },

  /* ----- Blocos ----- */
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -0.3,
    marginBottom: 11,
  },
  sectionTitleFlush: { marginBottom: 0 },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 11,
  },
  sectionHint: { color: t.faint, fontSize: 9.5, marginTop: 3 },
  pageTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: t.ink,
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    fontSize: 11.5,
    color: t.muted,
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 17,
  },
  cardRow: {
    ...card,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    marginBottom: 22,
  },
  roundIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#e3f1fb",
    alignItems: "center",
    justifyContent: "center",
  },
  roundIconViolet: { backgroundColor: "#f0e9fc" },
  roundIconGrey: { backgroundColor: "#eef1f4" },
  roundIconGreen: { backgroundColor: "#e2f5eb" },
  roundIconBlue: { backgroundColor: "#e3f1fb" },
  flex: { flex: 1 },
  cardTitle: { fontSize: 12.5, fontWeight: "700", color: t.ink },
  muted: { fontSize: 10, color: t.muted, marginTop: 5, lineHeight: 15 },
  serviceCard: { ...card, padding: 18, marginBottom: 12 },
  chatEntryCard: {
    ...card,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 15,
    marginBottom: 18,
    borderColor: "#cfe1ec",
    backgroundColor: "#f9fcfe",
  },
  chatEntryCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  chatEntryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.blue,
    boxShadow: "0 6px 14px rgba(8,120,189,.22)",
  },
  chatEntryLabel: { fontSize: 7.5, fontWeight: "800", letterSpacing: 1, color: t.blue },
  chatEntryTitle: { marginTop: 2, fontSize: 13.5, fontWeight: "800", color: t.ink },
  chatEntryHint: { marginTop: 3, fontSize: 9.5, lineHeight: 14, color: t.muted },
  serviceHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  servicePercent: {
    fontSize: 19,
    fontWeight: "800",
    color: t.blue,
    letterSpacing: -0.6,
  },
  progress: {
    height: 7,
    backgroundColor: "#e7eef3",
    borderRadius: 6,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: t.bright, borderRadius: 6 },
  progressScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  progressScaleText: { fontSize: 8.5, color: t.faint, letterSpacing: 0.3 },

  /* ----- Benefício em destaque ----- */
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#0a63a6",
    borderRadius: 13,
    padding: 16,
    marginBottom: 22,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  benefitTitle: { fontSize: 13, fontWeight: "800", color: "#fff" },
  benefitHint: { fontSize: 10, color: "#b0d6f0", marginTop: 3 },

  /* ----- Ofertas personalizadas ----- */
  offerCard: {
    ...card,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 15,
    marginBottom: 10,
    borderColor: "#e3d8f3",
  },
  offerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  offerTitle: { fontSize: 13, fontWeight: "800", color: t.ink },
  offerVehicle: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: "#7549bb",
    marginTop: 5,
  },
  offerMessage: { fontSize: 10.5, lineHeight: 16, color: t.body, marginTop: 7 },
  offerDate: { fontSize: 8.5, color: t.faint, marginTop: 8 },
  offerAction: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f3edfc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 11,
  },
  offerActionText: { fontSize: 10.5, fontWeight: "800", color: "#7549bb" },
  offerEmptyCard: {
    ...card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    marginBottom: 22,
    borderStyle: "dashed",
    borderColor: "#ded3ee",
  },
  offerEmptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#f3edfc",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ----- Pontos ----- */
  pointsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0a63a6",
    borderRadius: 13,
    padding: 20,
    marginBottom: 22,
  },
  pointsLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#9fd0f0",
  },
  pointsValue: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
    marginTop: 6,
  },
  pointsHint: { fontSize: 9.5, color: "#b8dcf5", marginTop: 5 },
  balanceCard: { borderRadius: 16, padding: 20, marginBottom: 22 },
  balanceLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#7fa8c6",
  },
  /** Linha com alinhamento de base: espaço em Text aninhado é colapsado. */
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
    marginTop: 6,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1.4,
  },
  balanceUnit: { fontSize: 16, fontWeight: "700", color: "#8fc4e8" },
  balanceSplit: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  balanceSplitCell: { flex: 1, paddingLeft: 14 },
  /** O filete do card claro some sobre fundo escuro. */
  balanceSplitDivider: {
    position: "absolute",
    left: 0,
    top: 2,
    bottom: 2,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  balanceSplitValue: { fontSize: 15, fontWeight: "800", color: "#fff" },
  balanceSplitLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: "#7fa2bb",
    marginTop: 3,
  },

  /* ----- Atalhos ----- */
  shortcuts: { flexDirection: "row", gap: 12 },
  shortcut: { ...card, flex: 1, padding: 16 },
  shortcutDisabled: { opacity: 0.46 },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#e3f1fb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  shortcutIconGreen: { backgroundColor: "#e2f5eb" },
  shortcutText: { fontSize: 11.5, fontWeight: "700", color: t.ink },
  catalogTeaser: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0a3154", borderRadius: 13, padding: 15, marginTop: 22, marginBottom: 12 },
  catalogTeaserArt: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  catalogTeaserEyebrow: { color: "#8cc9e9", fontSize: 7.5, fontWeight: "800", letterSpacing: 1.1 },
  catalogTeaserTitle: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 4 },
  catalogTeaserHint: { color: "#b2cfe1", fontSize: 9.5, lineHeight: 14, marginTop: 4 },

  /* ----- Faixa de resumo ----- */
  statStrip: {
    ...card,
    flexDirection: "row",
    paddingVertical: 4,
    marginBottom: 14,
  },
  statCell: { flex: 1, paddingVertical: 13, paddingLeft: 14 },
  statDivider: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 1,
    backgroundColor: "rgba(120,150,175,0.22)",
  },
  statValue: { fontSize: 15, fontWeight: "800", color: t.ink },
  statLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: t.faint,
    marginTop: 4,
  },

  /* ----- Linha do tempo ----- */
  timelineCard: { ...card, padding: 18, marginBottom: 10 },
  timelineRow: { flexDirection: "row", gap: 14 },
  timelineRail: { width: 12, alignItems: "center" },
  timelineMarker: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: "#c3d4e0",
    backgroundColor: "#fff",
    marginTop: 3,
  },
  /** O serviço mais recente é o único preenchido. */
  timelineMarkerLatest: { borderColor: t.bright, backgroundColor: t.bright },
  timelineLine: { flex: 1, width: 2, backgroundColor: "#ccd9e4", marginTop: 3 },
  timelineBody: { flex: 1, paddingBottom: 22 },
  timelineBodyLast: { paddingBottom: 0 },
  timelineDate: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: t.faint,
    textTransform: "uppercase",
  },
  timelineTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: t.ink,
    marginTop: 5,
  },
  timelineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  timelineMileage: { fontSize: 10.5, color: t.muted },
  timelineOpen: {
    fontSize: 10,
    fontWeight: "800",
    color: t.blue,
    marginLeft: "auto",
  },

  /* ----- Vouchers ----- */
  voucher: {
    ...card,
    padding: 15,
    paddingLeft: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  voucherRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  voucherAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#cbe3f5",
    backgroundColor: "#f2f9fe",
    marginTop: 14,
  },
  voucherActionText: { fontSize: 11.5, fontWeight: "800", color: t.blue },
  voucherUsed: { backgroundColor: "#fafbfc" },
  voucherEdge: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  voucherEdgeOn: { backgroundColor: "#3aa76d" },
  voucherEdgeOff: { backgroundColor: "#d3dbe2" },
  voucherTitleUsed: { color: t.muted },
  voucherCode: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: t.faint,
    marginTop: 4,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeGreen: { backgroundColor: "#e7f6ed" },
  badgeSlate: { backgroundColor: "#edf1f4" },
  badgeAmber: { backgroundColor: "#fdf3e2" },
  badgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  badgeTextGreen: { color: "#247a50" },
  badgeTextSlate: { color: "#627383" },
  badgeTextAmber: { color: "#96631a" },

  /* ----- Estado vazio ----- */
  emptyState: { ...card, padding: 28, alignItems: "center" },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#eef3f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: t.ink },
  emptyHint: {
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    textAlign: "center",
    marginTop: 6,
  },

  /* ----- Agendamentos ----- */
  bookingPageHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 19,
  },
  bookingPageSubtitle: { marginBottom: 0 },
  bookingCreateButton: {
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: t.blue,
    boxShadow: "0 7px 16px rgba(8,120,189,.22)",
  },
  bookingCreateButtonText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  bookingCard: {
    ...card,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 15,
    marginBottom: 10,
  },
  bookingCardArchived: { backgroundColor: "#f9fafb", boxShadow: "none" },
  bookingSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 11,
  },
  bookingCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e3f1fb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  bookingCountText: { color: t.blue, fontSize: 10, fontWeight: "800" },
  bookingEmptyCard: {
    ...card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    marginBottom: 22,
  },
  emptyIconCompact: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eef3f7",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyHintLeft: { textAlign: "left", marginTop: 3 },
  compactAction: {
    borderRadius: 8,
    backgroundColor: "#e3f1fb",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  compactActionText: { color: t.blue, fontSize: 10.5, fontWeight: "800" },
  bookingServiceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  bookingServiceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  bookingServiceOptionOn: { borderColor: t.blue, backgroundColor: t.blue },
  bookingServiceOptionText: { color: t.body, fontSize: 10, fontWeight: "700" },
  bookingServiceOptionTextOn: { color: "#fff" },
  bookingArchiveTitle: { marginTop: 14, marginBottom: 3 },
  bookingArchiveHint: { color: t.faint, fontSize: 9.5, marginBottom: 11 },
  dateBox: {
    width: 54,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#eaf3fa",
    alignItems: "center",
  },
  dateBoxArchived: { backgroundColor: "#eef1f4" },
  dateWeekday: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#5d8dae",
  },
  dateDay: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0a5f9c",
    letterSpacing: -0.6,
    marginTop: 1,
  },
  dateDayArchived: { color: t.muted },
  dateMonth: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#5d8dae",
    marginTop: 1,
  },
  bookingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  bookingMetaText: { fontSize: 10.5, color: t.muted },
  bookingFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },
  bookingCancel: {
    fontSize: 11,
    fontWeight: "700",
    color: t.muted,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dangerButton: {
    height: 48,
    borderRadius: 11,
    backgroundColor: "#c6403b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  dangerButtonText: { fontSize: 12.5, fontWeight: "800", color: "#fff" },

  /* ----- Recalls e avisos ----- */
  mobileRecallCard: {
    ...card,
    padding: 18,
    marginBottom: 14,
    borderColor: "#f0d9d7",
  },
  mobileRecallTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileRecallCode: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#b0453e",
  },
  mobileRecallSeverity: {
    fontSize: 8,
    fontWeight: "800",
    color: "#bc423d",
    backgroundColor: "#fdebea",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  mobileRecallTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: t.ink,
    marginTop: 13,
    letterSpacing: -0.3,
  },
  mobileRecallDescription: {
    fontSize: 10.5,
    lineHeight: 16,
    color: t.muted,
    marginTop: 8,
  },
  mobileRecallStatus: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: "#237bb7",
    marginTop: 14,
  },
  notificationCard: {
    ...card,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 15,
    marginBottom: 10,
    backgroundColor: "#fafbfc",
  },
  /** Não lido recebe fundo branco e borda azul: a lista deixa de ser plana. */
  notificationUnread: { backgroundColor: t.card, borderColor: "#cbe3f5" },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff3f6",
  },
  notificationIconUnread: { backgroundColor: "#e3f1fb" },
  notificationTitleUnread: { fontWeight: "800" },
  notificationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: t.bright,
    marginTop: 6,
  },
  notificationDate: { fontSize: 8.5, color: t.faint, marginTop: 8 },

  /* ----- Navegação ----- */
  tabbar: {
    height: 72,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: t.line,
    boxShadow: "0 -4px 18px rgba(26, 67, 94, .07)",
    flexDirection: "row",
    paddingTop: 9,
  },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  tabIconWrap: { position: "relative", width: 22, height: 21, alignItems: "center", justifyContent: "center" },
  tabUnreadBadge: { position: "absolute", top: -5, right: -7, minWidth: 14, height: 14, paddingHorizontal: 3, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#d74e49", borderWidth: 2, borderColor: "#fff" },
  tabUnreadText: { color: "#fff", fontSize: 7, fontWeight: "800" },
  tabSelected: {
    backgroundColor: "#f5faff",
    borderTopWidth: 2,
    borderTopColor: t.bright,
    paddingTop: 7,
    marginTop: -9,
  },
  tabLabel: { fontSize: 8.5, color: "#8393a0", fontWeight: "600" },
  tabActive: { color: t.bright, fontWeight: "800" },
});
