/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — @react-pdf/renderer v4 class component types are incompatible with React 19 JSX inference
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { NetworkKPISnapshot, TenantKPIRow } from '@/lib/analytics/network-queries';

const styles = StyleSheet.create({
  page: { padding: 48, backgroundColor: '#ffffff', fontFamily: 'Helvetica' },
  header: { marginBottom: 32 },
  brand: { fontSize: 8, color: '#9E845A', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0B0A0E', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666666' },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0B0A0E', marginBottom: 12, marginTop: 24, borderBottomWidth: 1, borderBottomColor: '#E5E5E5', paddingBottom: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  kpiCard: { width: '30%', backgroundColor: '#F9F9F9', borderRadius: 8, padding: 12, marginBottom: 8 },
  kpiLabel: { fontSize: 7, color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: 'bold', color: '#0B0A0E' },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 4, padding: '6 8', marginBottom: 2 },
  tableHeaderCell: { fontSize: 7, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tableCell: { fontSize: 9, color: '#333333' },
  col1: { width: '30%' },
  colNum: { width: '10%', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#AAAAAA', borderTopWidth: 1, borderTopColor: '#E5E5E5', paddingTop: 8 },
});

interface NetworkReportDocumentProps {
  kpi: NetworkKPISnapshot;
  tenantRows: TenantKPIRow[];
  generatedAt: string;
  isSuperAdmin: boolean;
}

export function NetworkReportDocument({ kpi, tenantRows, generatedAt, isSuperAdmin }: NetworkReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Top 10 Prom · Analytics Report</Text>
          <Text style={styles.title}>{isSuperAdmin ? 'Franchise Network Intelligence' : 'Location Performance Report'}</Text>
          <Text style={styles.subtitle}>Generated: {generatedAt}</Text>
        </View>

        <Text style={styles.sectionTitle}>Performance Summary — Current Month</Text>
        <View style={styles.kpiGrid}>
          {isSuperAdmin && (
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Active Locations</Text>
              <Text style={styles.kpiValue}>{kpi.totalActiveTenants}</Text>
            </View>
          )}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Appointments</Text>
            <Text style={styles.kpiValue}>{kpi.totalAppointmentsThisMonth}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Confirmation Rate</Text>
            <Text style={styles.kpiValue}>{kpi.appointmentConfirmationRate}%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Reservations</Text>
            <Text style={styles.kpiValue}>{kpi.totalReservationsActive}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>VTO Sessions</Text>
            <Text style={styles.kpiValue}>{kpi.totalVtoSessionsThisMonth}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Walk-In Wait</Text>
            <Text style={styles.kpiValue}>{kpi.avgWalkInWaitMinutes} min</Text>
          </View>
        </View>

        {isSuperAdmin && tenantRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Location Breakdown</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col1]}>Location</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Appts</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Conf.</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Rsvns</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>VTO</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Wait</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Staff</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Inv.</Text>
              </View>
              {tenantRows.map((row) => (
                <View key={row.tenantId} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>{row.tenantName}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.appointmentsThisMonth}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.confirmedAppointments}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.activeReservations}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.vtoSessionsThisMonth}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.avgWalkInWaitMinutes}m</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.staffCount}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.totalDressInventory}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Top 10 Prom — Confidential · {generatedAt} · toptenprom.com
        </Text>
      </Page>
    </Document>
  );
}
