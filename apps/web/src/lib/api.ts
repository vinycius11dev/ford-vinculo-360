const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
const LEGACY_TOKEN_KEY = "ford360_token";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  dealershipId: string | null;
  dealershipName: string | null;
};
export type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
};

let refreshPromise: Promise<string | null> | null = null;
let accessToken: string | null = null;

export function getToken() {
  return accessToken;
}

export function setToken(value: string | null) {
  accessToken = value;
  try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* Storage may be disabled. */ }
}

async function refreshAccessToken() {
  if (!refreshPromise)
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Não foi possível renovar o acesso. Tente novamente.');
        const result = (await response.json()) as { accessToken: string };
        setToken(result.accessToken);
        return result.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}

function canRefresh(path: string) {
  return ![
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/password-reset/request",
    "/auth/password-reset/confirm",
    "/auth/invitations/accept",
  ].includes(path);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    signal: options.signal ?? AbortSignal.timeout(20000),
    headers,
  }).catch(() => { throw new Error('Não foi possível conectar à plataforma. Confira sua conexão e tente novamente.'); });

  if (response.status === 401 && retryAfterRefresh && canRefresh(path)) {
    const renewed = getToken() && getToken() !== token ? getToken() : await refreshAccessToken();
    if (renewed) return api<T>(path, options, false);
    setToken(null);
    window.dispatchEvent(new Event('ford360:session-expired'));
  }

  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : body?.message ?? "Não foi possível concluir a operação.");
  return body as T;
}
