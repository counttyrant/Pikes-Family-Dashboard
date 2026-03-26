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
  getSettings,
  saveSettings,
} from '../services/storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
].join(' ');
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: GoogleUser | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${GIS_SCRIPT}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GIS script'));
    document.head.appendChild(script);
  });
}

function waitForGis(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

async function getAllowedEmails(): Promise<string[]> {
  // Env-var list takes priority
  const envList = (import.meta.env.VITE_ALLOWED_EMAILS as string) ?? '';
  if (envList.trim()) {
    return envList
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  // Fall back to stored settings
  const settings = await getSettings();
  return (settings.allowedEmails ?? []).map((e) => e.toLowerCase());
}

function isEmailAllowed(email: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenClientRef = useRef<any>(null);
  const gisReady = useRef(false);

  // ── Initialise GIS & attempt restore ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadGisScript();
        await waitForGis();

        const g = window.google as any;
        tokenClientRef.current = g.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => {
            /* overridden per-request */
          },
        });

        gisReady.current = true;

        // Try restoring a previous session from IndexedDB
        const stored = await getAuthUser();
        if (stored) {
          if (stored.expiresAt > Date.now()) {
            // Token still valid
            if (!cancelled) setUser(stored);
          } else {
            // Try silent refresh
            try {
              const refreshed = await silentRefresh();
              if (!cancelled && refreshed) setUser(refreshed);
            } catch {
              // Silent refresh failed – user will need to sign in again
              await clearAuthUser();
            }
          }
        }
      } catch (err) {
        console.error('Auth init failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Silent token refresh ──────────────────────────────────────────────

  const silentRefresh = useCallback((): Promise<GoogleUser | null> => {
    return new Promise((resolve, reject) => {
      const client = tokenClientRef.current;
      if (!client) {
        reject(new Error('Token client not initialised'));
        return;
      }

      client.callback = async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          const profile = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${response.access_token}` },
          }).then((r) => r.json());

          const allowed = await getAllowedEmails();
          if (!isEmailAllowed(profile.email, allowed)) {
            reject(new Error('Email not in the allowed list'));
            return;
          }

          const refreshedUser: GoogleUser = {
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            accessToken: response.access_token,
            expiresAt: Date.now() + 3600 * 1000,
          };

          await saveAuthUser(refreshedUser);
          resolve(refreshedUser);
        } catch (err) {
          reject(err);
        }
      };

      client.requestAccessToken({ prompt: '' });
    });
  }, []);

  // ── Sign in (interactive) ─────────────────────────────────────────────

  const signIn = useCallback(async (): Promise<void> => {
    if (!gisReady.current || !tokenClientRef.current) {
      throw new Error('Google auth not ready');
    }

    return new Promise<void>((resolve, reject) => {
      const client = tokenClientRef.current!;

      client.callback = async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          const profile = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${response.access_token}` },
          }).then((r) => r.json());

          const allowed = await getAllowedEmails();
          if (!isEmailAllowed(profile.email, allowed)) {
            const g = window.google as any;
            g?.accounts?.oauth2?.revoke(response.access_token, () => {});
            reject(new Error('Email not in the allowed list'));
            return;
          }

          const newUser: GoogleUser = {
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            accessToken: response.access_token,
            expiresAt: Date.now() + 3600 * 1000,
          };

          await saveAuthUser(newUser);
          setUser(newUser);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      client.requestAccessToken({ prompt: 'consent' });
    });
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────

  const handleSignOut = useCallback(() => {
    if (user?.accessToken) {
      const g = window.google as any;
      g?.accounts?.oauth2?.revoke(user.accessToken, () => {});
    }
    clearAuthUser();
    saveSettings({ googleToken: null });
    setUser(null);
  }, [user]);

  // ── Context value ─────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signIn,
      signOut: handleSignOut,
      accessToken: user?.accessToken ?? null,
    }),
    [user, isLoading, signIn, handleSignOut],
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
