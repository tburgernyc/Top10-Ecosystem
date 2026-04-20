import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'auth_session';

export interface Stylist {
  id: string;
  name: string;
}

export interface AuthSession {
  tenant_id: string;
  store_name: string;
  sync_secret: string;
  stylists: Stylist[];
}

export async function saveSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
