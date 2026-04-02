import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../cosmosClient';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const AUTH_DOC_ID = 'auth-session';
const AUTH_COLLECTION = 'auth';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
].join(' ');

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  return {
    clientId,
    clientSecret,
    appUrl,
    redirectUri: `${appUrl}/api/auth/callback`,
  };
}

// ---------------------------------------------------------------------------
// Cosmos DB helpers
// ---------------------------------------------------------------------------

interface AuthDoc {
  id: string;
  collection: string;
  email: string;
  name: string;
  picture: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
}

async function getAuthDoc(): Promise<AuthDoc | null> {
  try {
    const container = getContainer();
    const { resource } = await container.item(AUTH_DOC_ID, AUTH_COLLECTION).read<AuthDoc>();
    return resource ?? null;
  } catch (e: any) {
    if (e.code === 404) return null;
    throw e;
  }
}

async function saveAuthDoc(doc: AuthDoc): Promise<void> {
  const container = getContainer();
  await container.items.upsert(doc);
}

// ---------------------------------------------------------------------------
// Token refresh helper
// ---------------------------------------------------------------------------

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// GET /api/auth/start — redirect to Google OAuth2 consent screen
// ---------------------------------------------------------------------------

app.http('authStart', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/start',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { clientId, redirectUri } = getConfig();

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent', // always request refresh token
      });

      return {
        status: 302,
        headers: { Location: `${GOOGLE_AUTH_URL}?${params}` },
      };
    } catch (err: any) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ---------------------------------------------------------------------------
// GET /api/auth/callback?code=... — exchange code, store tokens, redirect
// ---------------------------------------------------------------------------

app.http('authCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { clientId, clientSecret, redirectUri, appUrl } = getConfig();

      const error = req.query.get('error');
      if (error) {
        ctx.warn('OAuth error from Google:', error);
        return { status: 302, headers: { Location: `${appUrl}/?auth=error&reason=${encodeURIComponent(error)}` } };
      }

      const code = req.query.get('code');
      if (!code) {
        return { status: 400, jsonBody: { error: 'Missing code parameter' } };
      }

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        ctx.error('Token exchange failed:', text);
        return { status: 302, headers: { Location: `${appUrl}/?auth=error&reason=token_exchange` } };
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Fetch user profile
      const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = (await profileResponse.json()) as {
        email: string;
        name: string;
        picture: string;
      };

      // Check allowed emails (reuse VITE_ var since it's set server-side too)
      const allowedEmails = (process.env.VITE_ALLOWED_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (allowedEmails.length > 0 && !allowedEmails.includes(profile.email.toLowerCase())) {
        ctx.warn('Blocked email:', profile.email);
        return { status: 302, headers: { Location: `${appUrl}/?auth=error&reason=not_allowed` } };
      }

      // Preserve existing refresh token if Google didn't issue a new one
      // (can happen if user already consented — but prompt=consent should always return one)
      const existing = await getAuthDoc();
      const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? '';

      if (!refreshToken) {
        ctx.warn('No refresh token available — user should re-consent');
      }

      const authDoc: AuthDoc = {
        id: AUTH_DOC_ID,
        collection: AUTH_COLLECTION,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        refreshToken,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      };

      await saveAuthDoc(authDoc);

      ctx.log(`Auth stored for ${profile.email}`);
      return { status: 302, headers: { Location: `${appUrl}/` } };
    } catch (err: any) {
      ctx.error('Auth callback error:', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ---------------------------------------------------------------------------
// GET /api/auth/token — return valid access token, refreshing if needed
// ---------------------------------------------------------------------------

app.http('authToken', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/token',
  handler: async (_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { clientId, clientSecret } = getConfig();
      const authDoc = await getAuthDoc();

      if (!authDoc?.refreshToken) {
        return { status: 401, jsonBody: { error: 'Not authenticated' } };
      }

      // Refresh if token expires within 5 minutes
      if (authDoc.accessTokenExpiresAt < Date.now() + 5 * 60 * 1000) {
        try {
          const { accessToken, expiresAt } = await refreshAccessToken(
            authDoc.refreshToken,
            clientId,
            clientSecret,
          );
          authDoc.accessToken = accessToken;
          authDoc.accessTokenExpiresAt = expiresAt;
          await saveAuthDoc(authDoc);
          ctx.log('Access token refreshed');
        } catch (refreshErr: any) {
          ctx.warn('Refresh failed:', refreshErr.message);
          // Invalid refresh token — clear and force re-login
          if (refreshErr.message.includes('invalid_grant') || refreshErr.message.includes('400')) {
            await getContainer()
              .item(AUTH_DOC_ID, AUTH_COLLECTION)
              .delete()
              .catch(() => {});
            return { status: 401, jsonBody: { error: 'Session expired — please sign in again' } };
          }
          throw refreshErr;
        }
      }

      return {
        jsonBody: {
          accessToken: authDoc.accessToken,
          expiresAt: authDoc.accessTokenExpiresAt,
          email: authDoc.email,
          name: authDoc.name,
          picture: authDoc.picture,
        },
      };
    } catch (err: any) {
      ctx.error('Auth token error:', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout — revoke tokens and clear session
// ---------------------------------------------------------------------------

app.http('authLogout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: async (_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const authDoc = await getAuthDoc();

      if (authDoc?.accessToken) {
        // Best-effort revoke
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(authDoc.accessToken)}`).catch(
          () => {},
        );
      }

      await getContainer()
        .item(AUTH_DOC_ID, AUTH_COLLECTION)
        .delete()
        .catch(() => {});

      ctx.log('User logged out');
      return { jsonBody: { ok: true } };
    } catch (err: any) {
      ctx.error('Logout error:', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
