import { loadSession } from '../store/auth';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const session = await loadSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };

  if (session?.sync_secret) {
    headers['x-sync-secret'] = session.sync_secret;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }

  return response.json();
}
