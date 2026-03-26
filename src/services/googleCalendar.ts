import type { CalendarEvent } from '../types';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
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

  // Wait until the library is available on window
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

export function signIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Call initGoogleAuth() first.'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.access_token);
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function signOut(token: string): Promise<void> {
  return new Promise((resolve) => {
    google.accounts.oauth2.revoke(token, () => {
      resolve();
    });
  });
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

void DISCOVERY_DOC;
