import type { CalendarEvent } from '../types';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
].join(' ');

const DISCOVERY_DOC =
  'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;

declare global {
  interface Window {
    google?: typeof google;
  }
}

declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
    callback: (response: TokenResponse) => void;
  }

  interface TokenResponse {
    access_token: string;
    error?: string;
    expires_in?: number;
  }

  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }): TokenClient;

  function revoke(token: string, callback?: () => void): void;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function initGoogleAuth(clientId: string): Promise<void> {
  await loadScript('https://accounts.google.com/gsi/client');

  await new Promise<void>((resolve) => {
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {
      /* overridden at sign-in time */
    },
  });
}

export function signIn(prompt: 'consent' | '' = 'consent'): Promise<{ access_token: string; expires_in: number }> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Call initGoogleAuth() first.'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve({
          access_token: response.access_token,
          expires_in: response.expires_in ?? 3600,
        });
      }
    };

    tokenClient.requestAccessToken({ prompt });
  });
}

export function signOut(token: string): Promise<void> {
  return new Promise((resolve) => {
    google.accounts.oauth2.revoke(token, () => {
      resolve();
    });
  });
}

export async function fetchUserProfile(
  token: string,
): Promise<{ email: string; name: string; picture: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Profile fetch failed: ${response.status}`);
  const data = await response.json();
  return {
    email: data.email ?? '',
    name: data.name ?? '',
    picture: data.picture ?? '',
  };
}

export async function fetchCalendarEvents(
  token: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      colorId?: string;
    }>;
  };

  return (data.items ?? []).map((event) => {
    const allDay = !event.start.dateTime;
    return {
      id: event.id,
      title: event.summary ?? '(No title)',
      start: new Date(event.start.dateTime ?? event.start.date ?? ''),
      end: new Date(event.end.dateTime ?? event.end.date ?? ''),
      calendarId: 'primary',
      color: event.colorId ?? '#3b82f6',
      allDay,
    };
  });
}

export async function createCalendarEvent(
  token: string,
  event: {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    color?: string;
  },
): Promise<string> {
  const body: Record<string, unknown> = {
    summary: event.title,
  };

  if (event.allDay) {
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];
    body.start = { date: toDateStr(event.start) };
    body.end = { date: toDateStr(event.end) };
  } else {
    body.start = { dateTime: event.start.toISOString() };
    body.end = { dateTime: event.end.toISOString() };
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.status}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

void DISCOVERY_DOC;
