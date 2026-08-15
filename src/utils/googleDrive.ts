/**
 * Utility to save reports directly to Google Drive using Google Workspace OAuth / Drive API.
 */

import { ensureGoogleDriveToken } from './googleAuth';

export interface SaveToDriveOptions {
  filename: string;
  mimeType: string;
  content: string | Blob;
}

export async function saveFileToGoogleDrive(
  options: SaveToDriveOptions,
  accessToken?: string
): Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }> {
  try {
    let token = accessToken;

    if (!token && typeof window !== 'undefined' && window.googleToken) {
      token = window.googleToken;
    }

    if (!token) {
      try {
        token = await ensureGoogleDriveToken();
      } catch (authErr: unknown) {
        const message =
          authErr instanceof Error
            ? authErr.message
            : 'Falha na autenticação Google Drive.';
        return { success: false, error: message };
      }
    }

    const metadata = {
      name: options.filename,
      mimeType: options.mimeType,
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );

    if (typeof options.content === 'string') {
      form.append('file', new Blob([options.content], { type: options.mimeType }));
    } else {
      form.append('file', options.content);
    }

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        try {
          token = await ensureGoogleDriveToken(true);
          const retry = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            }
          );
          if (!retry.ok) {
            throw new Error(`Google Drive API error (${retry.status}): ${await retry.text()}`);
          }
          const retryData = await retry.json();
          return {
            success: true,
            fileId: retryData.id,
            webViewLink: retryData.webViewLink,
          };
        } catch (reauthErr: unknown) {
          throw reauthErr instanceof Error
            ? reauthErr
            : new Error('Reautenticação Google Drive falhou.');
        }
      }
      throw new Error(`Google Drive API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      success: true,
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  } catch (err: unknown) {
    console.error('Save to Drive failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao salvar no Google Drive.',
    };
  }
}
