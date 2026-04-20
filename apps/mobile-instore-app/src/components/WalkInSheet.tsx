import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { database } from '@/db/database';
import WalkIn, { type WalkInStatus } from '@/db/models/WalkIn';
import { loadSession } from '@/store/auth';
import { syncDatabase } from '@/db/sync';
import ConvertModal from './ConvertModal';

interface Props {
  walkIn: WalkIn;
  onClose: () => void;
}

const STATUS_ACTIONS: { label: string; next: WalkInStatus; color: string }[] = [
  { label: 'Call Customer', next: 'called', color: '#3B82F6' },
  { label: 'Seat with Stylist', next: 'with_stylist', color: '#10B981' },
  { label: 'Mark Completed', next: 'completed', color: '#6B7280' },
  { label: 'Mark Left', next: 'left', color: '#EF4444' },
];

export default function WalkInSheet({ walkIn, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [stylists, setStylists] = useState<{ id: string; name: string }[]>([]);

  // Load stylists from session on mount
  useEffect(() => {
    loadSession().then((s) => setStylists(s?.stylists ?? []));
  }, []);

  async function updateStatus(status: WalkInStatus) {
    setLoading(true);
    try {
      await database.write(async () => {
        await walkIn.update((w) => { w.status = status; });
      });
      syncDatabase().catch(console.warn);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function assignStylist(stylistId: string) {
    await database.write(async () => {
      await walkIn.update((w) => { w.assignedStylistId = stylistId; });
    });
    syncDatabase().catch(console.warn);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.name}>{walkIn.customerName}</Text>
        <Text style={styles.meta}>Party of {walkIn.partySize} · {walkIn.phoneNumber}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
          {STATUS_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.next}
              style={[styles.actionBtn, { borderColor: action.color }]}
              onPress={() => updateStatus(action.next)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={action.color} />
                : <Text style={[styles.actionText, { color: action.color }]}>{action.label}</Text>
              }
            </TouchableOpacity>
          ))}

          {stylists.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ASSIGN STYLIST</Text>
              {stylists.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.actionBtn,
                    walkIn.assignedStylistId === s.id && styles.actionBtnActive,
                  ]}
                  onPress={() => assignStylist(s.id)}
                >
                  <Text style={styles.actionText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#8B5CF6' }]}
            onPress={() => setShowConvert(true)}
          >
            <Text style={[styles.actionText, { color: '#8B5CF6' }]}>Convert to Appointment →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {showConvert && (
        <ConvertModal
          walkIn={walkIn}
          stylists={stylists}
          onSuccess={() => { setShowConvert(false); onClose(); }}
          onClose={() => setShowConvert(false)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#111116', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '70%',
  },
  handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  meta: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 20 },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  actionBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  actionBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1028' },
  actionText: { color: '#ccc', fontSize: 15, fontWeight: '600' },
});
