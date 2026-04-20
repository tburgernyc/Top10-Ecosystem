import { synchronize, type SyncDatabaseChangeSet } from '@nozbe/watermelondb/sync';
import { MMKV } from 'react-native-mmkv';
import { database } from './database';
import { apiFetch } from '../lib/api';
import { loadSession } from '../store/auth';

const storage = new MMKV({ id: 'sync-storage' });
const LAST_PULLED_AT_KEY = 'last_pulled_at';

function getLastPulledAt(): number {
  return storage.getNumber(LAST_PULLED_AT_KEY) ?? 0;
}

function setLastPulledAt(timestamp: number): void {
  storage.set(LAST_PULLED_AT_KEY, timestamp);
}

interface PullResponse {
  changes: SyncDatabaseChangeSet;
  timestamp: number;
}

export async function syncDatabase(): Promise<void> {
  const session = await loadSession();
  if (!session) return;

  const lastPulledAt = getLastPulledAt();

  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt: wmlLastPulledAt }) => {
      const since = wmlLastPulledAt ?? lastPulledAt;
      const data = await apiFetch(
        `/api/sync?tenant_id=${session.tenant_id}&last_pulled_at=${since}`
      ) as PullResponse;
      return { changes: data.changes, timestamp: data.timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt: pushedAt }) => {
      await apiFetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          changes,
          tenantId: session.tenant_id,
          lastPulledAt: pushedAt,
        }),
      });
      setLastPulledAt(Date.now());
    },
  });
}

export function clearSyncState(): void {
  storage.delete(LAST_PULLED_AT_KEY);
}
