import { NextRequest, NextResponse } from 'next/server';
import { db } from '@toptenprom/database';
import { appointments, walk_ins } from '@toptenprom/database';
import { sql } from 'drizzle-orm';

// ── Type-safe WatermelonDB sync payload shapes ────────────────────────────────

/**
 * A single raw record from the WatermelonDB push payload.
 * WatermelonDB serialises all model fields as flat string/number/boolean primitives.
 */
type RawSyncRecord = Record<string, string | number | boolean | null>;

/**
 * WatermelonDB changes object shape for a single table.
 * All three keys MUST be present — missing keys cause sync assertion failures.
 */
interface TableChanges {
  created: RawSyncRecord[];
  updated: RawSyncRecord[];
  deleted: string[];
}

/**
 * Full push body from the mobile SyncEngine.
 */
interface SyncPushBody {
  changes: {
    appointments?: TableChanges;
    walk_ins?: TableChanges;
  };
  tenantId: string;
  lastPulledAt: number;
}

/**
 * Pull response shape — must satisfy WatermelonDB SynchronizedDatabase.synchronize() contract.
 * Each table key MUST have created, updated, deleted arrays.
 */
interface SyncPullResponse {
  changes: {
    appointments: TableChanges;
    walk_ins: TableChanges;
  };
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the mobile sync API secret from request headers.
 * Returns false if missing or invalid — caller should return 401.
 */
function validateSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  const expectedSecret = process.env.MOBILE_SYNC_API_SECRET;

  if (!expectedSecret) {
    console.error('[SyncAPI] MOBILE_SYNC_API_SECRET not configured');
    return false;
  }

  return secret === expectedSecret;
}

// ─────────────────────────────────────────────────────────────────────────────

/** GET: Pull server changes since lastPulledAt */
export async function GET(request: NextRequest) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get('tenant_id');
  const lastPulledAt = parseInt(searchParams.get('last_pulled_at') ?? '0', 10);

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  const sinceDate = new Date(lastPulledAt);
  const now = Date.now();

  try {
    const [updatedAppointments, updatedWalkIns] = await Promise.all([
      db.select().from(appointments)
        .where(sql`tenant_id = ${tenantId} AND updated_at >= ${sinceDate}`),
      db.select().from(walk_ins)
        .where(sql`tenant_id = ${tenantId} AND updated_at >= ${sinceDate}`),
    ]);

    const response: SyncPullResponse = {
      changes: {
        appointments: {
          // Partition into created vs updated by comparing created_at to sinceDate
          created: updatedAppointments
            .filter((a) => a.created_at >= sinceDate)
            .map((a) => ({ ...a } as unknown as RawSyncRecord)),
          updated: updatedAppointments
            .filter((a) => a.created_at < sinceDate)
            .map((a) => ({ ...a } as unknown as RawSyncRecord)),
          deleted: [],
        },
        walk_ins: {
          created: updatedWalkIns
            .filter((w) => w.created_at >= sinceDate)
            .map((w) => ({ ...w } as unknown as RawSyncRecord)),
          updated: updatedWalkIns
            .filter((w) => w.created_at < sinceDate)
            .map((w) => ({ ...w } as unknown as RawSyncRecord)),
          deleted: [],
        },
      },
      timestamp: now,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[SyncAPI GET] Failed:', error);
    return NextResponse.json({ error: 'Sync pull failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** POST: Push local device changes to server */
export async function POST(request: NextRequest) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SyncPushBody;
  try {
    body = await request.json() as SyncPushBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { changes, tenantId } = body;
  const conflictRecords: RawSyncRecord[] = [];

  try {
    // Upsert walk_ins from device — NOTE: table name is walk_ins (NOT availability_inquiries)
    const createdWalkIns = changes.walk_ins?.created ?? [];
    for (const walkIn of createdWalkIns) {
      try {
        const occasionRaw = walkIn['occasion'];
        // Coerce string to the dressOccasionEnum values or null
        const allowedOccasions = ['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail'] as const;
        type OccasionType = typeof allowedOccasions[number];
        const occasion: OccasionType | null =
          typeof occasionRaw === 'string' && (allowedOccasions as readonly string[]).includes(occasionRaw)
            ? (occasionRaw as OccasionType)
            : null;

        await db.insert(walk_ins).values({
          tenant_id: tenantId,
          customer_name: String(walkIn['customer_name'] ?? ''),
          phone_number: String(walkIn['phone_number'] ?? ''),
          party_size: Number(walkIn['party_size'] ?? 1),
          occasion,
          notes: walkIn['notes'] !== null && walkIn['notes'] !== undefined ? String(walkIn['notes']) : null,
          status: 'waiting',
          queue_position: Number(walkIn['queue_position'] ?? 0),
          checked_in_at: new Date(Number(walkIn['checked_in_at'] ?? Date.now())),
        }).onConflictDoNothing();
      } catch (insertError) {
        conflictRecords.push({ ...walkIn, _error: String(insertError) });
      }
    }

    if (conflictRecords.length > 0) {
      return NextResponse.json({ conflict_records: conflictRecords }, { status: 409 });
    }

    return NextResponse.json({ synced: true });
  } catch (error) {
    console.error('[SyncAPI POST] Failed:', error);
    return NextResponse.json({ error: 'Sync push failed' }, { status: 500 });
  }
}
