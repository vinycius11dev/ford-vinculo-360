import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  setToken,
  type LoginResponse,
  type SessionUser,
} from "./lib/api";

type AuthValue = {
  user: SessionUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  acceptInvitation(token: string, password: string): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener('ford360:session-expired', expired);
    return () => window.removeEventListener('ford360:session-expired', expired);
  }, []);
  useEffect(() => {
    api<SessionUser & { dealership?: { tradeName: string } | null }>("/auth/me")
      .then((profile) =>
        setUser({
          ...profile,
          dealershipName: profile.dealership?.tradeName ?? null,
        }),
      )
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);
  async function login(email: string, password: string) {
    const result = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(result.accessToken);
    setUser(result.user);
  }
  async function acceptInvitation(token: string, password: string) {
    const result = await api<LoginResponse>("/auth/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    setToken(result.accessToken);
    setUser(result.user);
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setToken(null);
    setUser(null);
  }
  async function logoutAll() {
    await api("/auth/logout-all", { method: "POST" });
    await logout();
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, login, acceptInvitation, logout, logoutAll }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider ausente.");
  return value;
}
