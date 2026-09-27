import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const web = Platform.OS === 'web';
const host = web ? globalThis.location.hostname : Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:3000/api/v1`;
const KEY = 'ford360_session';
export type SessionUser = { fullName: string; email: string; role?: string };
type Session = { accessToken: string; refreshToken?: string; user: SessionUser };
let current: Session | null = null;
let renewal: Promise<Session | null> | null = null;
let epoch = 0;
const listeners = new Set<(session: Session | null) => void>();

export class SessionExpiredError extends Error {
  constructor() { super('Sua sessão terminou. Entre novamente para continuar.'); }
}

export function subscribeSession(listener: (session: Session | null) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function remember(session: Session | null) {
  current = session;
  if (web) {
    // Remove legacy access tokens. Browser sessions use only HttpOnly cookies.
    try { globalThis.localStorage?.removeItem(KEY); } catch { /* Storage may be disabled. */ }
  } else if (session?.refreshToken) {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ refreshToken: session.refreshToken }));
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
  listeners.forEach((listener) => listener(session));
}

async function send(path: string, options: RequestInit = {}, token?: string) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 20000);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: web ? 'include' : 'omit',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
  } catch {
    throw new Error('Não foi possível conectar ao Ford App. Confira sua conexão e tente novamente.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message;
    throw new Error(Array.isArray(message) ? message.join(' ') : message ?? 'Não foi possível concluir a operação. Tente novamente.');
  }
  return body as T;
}

export async function restoreSession(): Promise<Session | null> {
  if (renewal) return renewal;
  const started = epoch;
  renewal = (async () => {
    let refreshToken = current?.refreshToken;
    if (!web && !refreshToken) {
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored) { try { refreshToken = JSON.parse(stored).refreshToken; } catch { await remember(null); } }
      if (!refreshToken) return null;
    }
    const response = await send(web ? '/auth/app/refresh' : '/auth/mobile/refresh', {
      method: 'POST', ...(!web ? { body: JSON.stringify({ refreshToken }) } : {}),
    });
    if (started !== epoch) return null;
    if (response.status === 401) { await remember(null); return null; }
    const session = await parse<Session>(response);
    if (started !== epoch) return null;
    await remember(session);
    return session;
  })().finally(() => { renewal = null; });
  return renewal;
}

export async function signIn(email: string, password: string) {
  epoch++;
  const session = await parse<Session>(await send(web ? '/auth/app/login' : '/auth/mobile/login', {
    method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  }));
  await remember(session);
  return session;
}

export async function signOut() {
  // Let an already-running rotation finish, so logout revokes the newest token.
  if (renewal) await renewal.catch(() => null);
  const refreshToken = current?.refreshToken;
  epoch++;
  try {
    await send(web ? '/auth/app/logout' : '/auth/mobile/logout', {
      method: 'POST', ...(!web ? { body: JSON.stringify({ refreshToken }) } : {}),
    });
  } finally { await remember(null); }
}

export async function request<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const usedToken = token ? current?.accessToken ?? token : undefined;
  let response = await send(path, options, usedToken);
  if (response.status === 401 && token) {
    const session = current?.accessToken !== usedToken ? current : await restoreSession();
    if (!session) throw new SessionExpiredError();
    response = await send(path, options, session.accessToken);
    if (response.status === 401) { await remember(null); throw new SessionExpiredError(); }
  }
  return parse<T>(response);
}
