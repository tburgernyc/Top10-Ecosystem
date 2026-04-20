import { useState, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/with-observables';
import NetInfo from '@react-native-community/netinfo';
import { database } from '@/db/database';
import WalkIn from '@/db/models/WalkIn';
import Appointment from '@/db/models/Appointment';
import { Q } from '@nozbe/watermelondb';
import WalkInSheet from '@/components/WalkInSheet';

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  waiting: '#F59E0B',
  called: '#3B82F6',
  with_stylist: '#10B981',
  completed: '#6B7280',
  left: '#6B7280',
  pending: '#F59E0B',
  confirmed: '#10B981',
  in_progress: '#3B82F6',
};

// ── Row components ────────────────────────────────────────────────────────────
function WalkInRow({ item, onPress }: { item: WalkIn; onPress: () => void }) {
  const waited = Math.floor((Date.now() - item.checkedInAt.getTime()) / 60000);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName}>{item.customerName}</Text>
        <Text style={styles.rowMeta}>Party of {item.partySize} · {waited}m wait</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#666' }]}>
        <Text style={styles.badgeText}>{item.status.replace('_', ' ')}</Text>
      </View>
    </TouchableOpacity>
  );
}

function AppointmentRow({ item }: { item: Appointment }) {
  const time = item.appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName}>{item.confirmationCode}</Text>
        <Text style={styles.rowMeta}>{time} · {item.serviceType}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#666' }]}>
        <Text style={styles.badgeText}>{item.status}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  walkIns: WalkIn[];
  appointments: Appointment[];
}

function QueueScreen({ walkIns, appointments }: Props) {
  const [isOnline, setIsOnline] = useState(true);
  const [selectedWalkIn, setSelectedWalkIn] = useState<WalkIn | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => unsub();
  }, []);

  const sections = [
    { title: 'Walk-Ins', data: walkIns },
    { title: "Today's Appointments", data: appointments },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — changes will sync when connected</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) =>
          section.title === 'Walk-Ins'
            ? <WalkInRow item={item as WalkIn} onPress={() => setSelectedWalkIn(item as WalkIn)} />
            : <AppointmentRow item={item as Appointment} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Queue is empty</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(app)/queue/check-in')}>
        <Text style={styles.fabText}>+ Check In</Text>
      </TouchableOpacity>

      {selectedWalkIn && (
        <WalkInSheet
          walkIn={selectedWalkIn}
          onClose={() => setSelectedWalkIn(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── WatermelonDB observer ─────────────────────────────────────────────────────
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayEnd = new Date();
todayEnd.setHours(23, 59, 59, 999);

const enhance = withObservables([], () => ({
  walkIns: database
    .get<WalkIn>('walk_ins')
    .query(Q.where('status', Q.oneOf(['waiting', 'called', 'with_stylist'])))
    .observe(),
  appointments: database
    .get<Appointment>('appointments')
    .query(
      Q.where('status', Q.oneOf(['pending', 'confirmed', 'in_progress'])),
      Q.where('appointment_date', Q.between(todayStart.getTime(), todayEnd.getTime()))
    )
    .observe(),
}));

export default enhance(QueueScreen);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  offlineBanner: { backgroundColor: '#7C3AED', paddingVertical: 6, alignItems: 'center' },
  offlineText: { color: '#fff', fontSize: 12 },
  sectionHeader: { color: '#888', fontSize: 12, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0B0A0E', letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1F' },
  rowLeft: { flex: 1 },
  rowName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowMeta: { color: '#888', fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  emptyText: { color: '#555', textAlign: 'center', paddingTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#8B5CF6', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 32, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
