/**
 * Google Drive OAuth via Google Identity Services (Token Client).
 * Usa apenas VITE_GOOGLE_CLIENT_ID — o client_secret nunca vai ao browser.
 */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    googleToken?: string;
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!id || id.includes('xxx')) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID ausente. Defina no .env e reinicie o servidor (npm run dev).'
    );
  }
  return id;
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GIS só funciona no browser.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Falha ao carregar Google Identity Services.'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services.'));
    document.head.appendChild(script);
  });
}

/**
 * Garante um access token do Drive. Abre o consentimento Google se necessário.
 */
export async function ensureGoogleDriveToken(forcePrompt = false): Promise<string> {
  if (!forcePrompt && window.googleToken) {
    return window.googleToken;
  }

  await loadGisScript();
  const clientId = getClientId();

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                'Autorização Google Drive cancelada ou falhou.'
            )
          );
          return;
        }
        window.googleToken = response.access_token;
        resolve(response.access_token);
      },
    });

    client.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
  });
}
