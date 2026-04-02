import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GoogleUser } from '../types';
import {
  getAuthUser,
  saveAuthUser,
  clearAuthUser,
  saveSettings,
} from '../services/storage';

// ---------------------------------------------------------------------------
// API endpoints (Azure Functions)
// ---------------------------------------------------------------------------

const TOKEN_API = '/api/auth/token';
const LOGOUT_API = '/api/auth/logout';
const START_API = '/api/auth/start';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: GoogleUser | null;
  isLoading: boolean;
  sessionExpired: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// API response type
// ---------------------------------------------------------------------------

interface TokenApiResponse {
  accessToken: string;
  expiresAt: number;
  email: string;
  name: string;
  picture: string;
}

async function fetchTokenFromApi(): Promise<TokenApiResponse | null> {
  const response = await fetch(TOKEN_API, { cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
  return response.json() as Promise<TokenApiResponse>;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule proactive token fetch ~5 min before expiry ──────────────

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const msUntilRefresh = expiresAt - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) return;

    refreshTimer.current = setTimeout(async () => {
      try {
        const data = await fetchTokenFromApi();
        if (data) {
          setAccessToken(data.accessToken);
          setSessionExpired(false);
          scheduleRefresh(data.expiresAt);
          // Keep IndexedDB profile fresh
          await saveAuthUser({
            email: data.email,
            name: data.name,
            picture: data.picture,
            accessToken: data.accessToken,
            expiresAt: data.expiresAt,
          });
        } else {
          setSessionExpired(true);
          setAccessToken(null);
        }
      } catch {
        // Network error — keep current token, retry on next schedule
      }
    }, msUntilRefresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialise: call backend token API ────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Handle redirect back from Google OAuth — clean the URL
      const params = new URLSearchParams(window.location.search);
      if (params.has('auth')) {
        window.history.replaceState({}, '', '/');
      }

      try {
        const data = await fetchTokenFromApi();

        if (!cancelled) {
          if (data) {
            const googleUser: GoogleUser = {
              email: data.email,
              name: data.name,
              picture: data.picture,
              accessToken: data.accessToken,
              expiresAt: data.expiresAt,
            };
            setUser(googleUser);
            setAccessToken(data.accessToken);
            setSessionExpired(false);
            scheduleRefresh(data.expiresAt);
            // Cache profile in IndexedDB for instant display on next load
            await saveAuthUser(googleUser);
          } else {
            // Not authenticated — show cached profile while on login screen
            const stored = await getAuthUser();
            if (stored) {
              setUser({ ...stored, tokenExpired: true });
              setSessionExpired(true);
            }
          }
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        // Network failure — show cached profile if available
        if (!cancelled) {
          const stored = await getAuthUser();
          if (stored) {
            setUser({ ...stored, tokenExpired: true });
            setSessionExpired(true);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sign in: redirect to backend OAuth start ──────────────────────────

  const signIn = useCallback(async (): Promise<void> => {
    // Navigating away — this promise intentionally never resolves in this context
    window.location.href = START_API;
    return new Promise(() => {});
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      await fetch(LOGOUT_API, { method: 'POST' });
    } catch {
      // best effort
    }
    await clearAuthUser();
    await saveSettings({ googleToken: null });
    setUser(null);
    setAccessToken(null);
    setSessionExpired(false);
  }, []);

  // ── Context value ─────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      sessionExpired,
      signIn,
      signOut: handleSignOut,
      accessToken,
    }),
    [user, isLoading, sessionExpired, signIn, handleSignOut, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
