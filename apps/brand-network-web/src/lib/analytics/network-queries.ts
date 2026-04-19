import { db } from '@toptenprom/database';
import {
  tenants,
  appointments,
  walk_ins,
  dress_reservations,
  vto_sessions,
  boutique_staff,
  dress_inventory,
} from '@toptenprom/database';
import { eq, gte, and, count, sql, sum, avg } from 'drizzle-orm';

export interface NetworkKPISnapshot {
  totalActiveTenants: number;
  totalAppointmentsThisMonth: number;
  totalReservationsActive: number;
  totalVtoSessionsThisMonth: number;
  avgWalkInWaitMinutes: number;
  appointmentConfirmationRate: number;
  networkReservationUtilization: number;
}

export interface TenantKPIRow {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  appointmentsThisMonth: number;
  confirmedAppointments: number;
  activeReservations: number;
  vtoSessionsThisMonth: number;
  avgWalkInWaitMinutes: number;
  staffCount: number;
  totalDressInventory: number;
  isActive: boolean;
}

export interface AppointmentTrendRow {
  week: string;
  appointments: number;
  confirmed: number;
}

// ─── NETWORK-WIDE KPI SNAPSHOT ────────────────────────────────────────────────

export async function getNetworkKPISnapshot(): Promise<NetworkKPISnapshot> {

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    tenantResult,
    appointmentResult,
    reservationResult,
    vtoResult,
    walkInResult,
    confirmedResult,
    totalInventoryResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(tenants).where(eq(tenants.is_active, true)),

    db.select({ count: count() }).from(appointments)
      .where(gte(appointments.created_at, startOfMonth)),

    db.select({ count: count() }).from(dress_reservations)
      .where(eq(dress_reservations.reservation_status, 'active')),

    db.select({ count: count() }).from(vto_sessions)
      .where(gte(vto_sessions.created_at, startOfMonth)),

    db.select({ avg_wait: avg(walk_ins.estimated_wait_minutes) }).from(walk_ins)
      .where(gte(walk_ins.created_at, startOfMonth)),

    db.select({ count: count() }).from(appointments)
      .where(and(
        gte(appointments.created_at, startOfMonth),
        eq(appointments.status, 'confirmed')
      )),

    db.select({ total: sum(dress_inventory.quantity_on_hand) }).from(dress_inventory),
  ]);

  const totalAppointments = appointmentResult[0]?.count ?? 0;
  const confirmedCount = confirmedResult[0]?.count ?? 0;
  const totalInventory = Number(totalInventoryResult[0]?.total ?? 0);
  const activeReservations = reservationResult[0]?.count ?? 0;

  return {
    totalActiveTenants: tenantResult[0]?.count ?? 0,
    totalAppointmentsThisMonth: totalAppointments,
    totalReservationsActive: activeReservations,
    totalVtoSessionsThisMonth: vtoResult[0]?.count ?? 0,
    avgWalkInWaitMinutes: Math.round(Number(walkInResult[0]?.avg_wait ?? 0)),
    appointmentConfirmationRate: totalAppointments > 0
      ? Math.round((confirmedCount / totalAppointments) * 100)
      : 0,
    networkReservationUtilization: totalInventory > 0
      ? Math.round((activeReservations / totalInventory) * 100)
      : 0,
  };
}

// ─── PER-TENANT KPI TABLE ─────────────────────────────────────────────────────

export async function getTenantKPITable(tenantIdFilter?: string): Promise<TenantKPIRow[]> {

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const tenantList = await db
    .select({ id: tenants.id, name: tenants.name, subdomain: tenants.subdomain, is_active: tenants.is_active })
    .from(tenants)
    .where(tenantIdFilter ? eq(tenants.id, tenantIdFilter) : undefined);

  const rows: TenantKPIRow[] = await Promise.all(
    tenantList.map(async (tenant) => {
      const [apptResult, reservationResult, vtoResult, walkInResult, staffResult, inventoryResult, confirmedResult] = await Promise.all([
        db.select({ count: count() }).from(appointments)
          .where(and(eq(appointments.tenant_id, tenant.id), gte(appointments.created_at, startOfMonth))),

        db.select({ count: count() }).from(dress_reservations)
          .where(and(eq(dress_reservations.tenant_id, tenant.id), eq(dress_reservations.reservation_status, 'active'))),

        db.select({ count: count() }).from(vto_sessions)
          .where(and(eq(vto_sessions.tenant_id, tenant.id), gte(vto_sessions.created_at, startOfMonth))),

        db.select({ avg_wait: avg(walk_ins.estimated_wait_minutes) }).from(walk_ins)
          .where(and(eq(walk_ins.tenant_id, tenant.id), gte(walk_ins.created_at, startOfMonth))),

        db.select({ count: count() }).from(boutique_staff)
          .where(eq(boutique_staff.tenant_id, tenant.id)),

        db.select({ total: sum(dress_inventory.quantity_on_hand) }).from(dress_inventory)
          .where(eq(dress_inventory.tenant_id, tenant.id)),

        db.select({ count: count() }).from(appointments)
          .where(and(
            eq(appointments.tenant_id, tenant.id),
            gte(appointments.created_at, startOfMonth),
            eq(appointments.status, 'confirmed')
          )),
      ]);

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain,
        appointmentsThisMonth: apptResult[0]?.count ?? 0,
        confirmedAppointments: confirmedResult[0]?.count ?? 0,
        activeReservations: reservationResult[0]?.count ?? 0,
        vtoSessionsThisMonth: vtoResult[0]?.count ?? 0,
        avgWalkInWaitMinutes: Math.round(Number(walkInResult[0]?.avg_wait ?? 0)),
        staffCount: staffResult[0]?.count ?? 0,
        totalDressInventory: Number(inventoryResult[0]?.total ?? 0),
        isActive: tenant.is_active,
      };
    })
  );

  return rows;
}

// ─── 12-WEEK APPOINTMENT TREND (NETWORK) ─────────────────────────────────────

export async function getNetworkAppointmentTrend(tenantIdFilter?: string): Promise<AppointmentTrendRow[]> {

  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const baseWhere = tenantIdFilter
    ? and(gte(appointments.created_at, twelveWeeksAgo), eq(appointments.tenant_id, tenantIdFilter))
    : gte(appointments.created_at, twelveWeeksAgo);

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${appointments.created_at}), 'IYYY-"W"IW')`,
      appointments: count(),
      confirmed: sql<number>`cast(sum(case when ${appointments.status} = 'confirmed' then 1 else 0 end) as int)`,
    })
    .from(appointments)
    .where(baseWhere)
    .groupBy(sql`date_trunc('week', ${appointments.created_at})`)
    .orderBy(sql`date_trunc('week', ${appointments.created_at})`);

  return rows.map((r) => ({
    week: r.week,
    appointments: r.appointments,
    confirmed: r.confirmed,
  }));
}
