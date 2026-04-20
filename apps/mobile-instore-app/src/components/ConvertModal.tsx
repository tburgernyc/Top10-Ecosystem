import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import WalkIn from '@/db/models/WalkIn';
import { apiFetch } from '@/lib/api';
import { syncDatabase } from '@/db/sync';

interface Stylist { id: string; name: string }

interface Props {
  walkIn: WalkIn;
  stylists: Stylist[];
  onSuccess: () => void;
  onClose: () => void;
}

export default function ConvertModal({ walkIn, stylists, onSuccess, onClose }: Props) {
  const [serviceType, setServiceType] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedStylistId, setSelectedStylistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!serviceType.trim()) { setError('Service type is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/mobile/convert-walkin', {
        method: 'POST',
        body: JSON.stringify({
          walk_in_id: walkIn.id,
          appointment_date: new Date().toISOString(),
          duration_minutes: durationMinutes,
          service_type: serviceType.trim(),
          stylist_id: selectedStylistId ?? undefined,
        }),
      });
      syncDatabase().catch(console.warn);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Convert to Appointment</Text>
          <Text style={styles.subtitle}>{walkIn.customerName}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Service Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dress fitting"
              placeholderTextColor="#555"
              value={serviceType}
              onChangeText={(t) => { setServiceType(t); setError(null); }}
            />

            <Text style={styles.label}>Duration</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDurationMinutes(Math.max(15, durationMinutes - 15))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{durationMinutes} min</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDurationMinutes(durationMinutes + 15)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {stylists.length > 0 && (
              <>
                <Text style={styles.label}>Assign Stylist</Text>
                {stylists.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.stylistBtn, selectedStylistId === s.id && styles.stylistBtnActive]}
                    onPress={() => setSelectedStylistId(s.id)}
                  >
                    <Text style={styles.stylistText}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
              onPress={handleConvert}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirm Appointment</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#111116', borderRadius: 16, padding: 24, maxHeight: '80%' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 20, marginTop: 4 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 16, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, backgroundColor: '#0B0A0E' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 20 },
  stepValue: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 70, textAlign: 'center' },
  stylistBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 6 },
  stylistBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1028' },
  stylistText: { color: '#ccc', fontSize: 15 },
  errorText: { color: '#FF4444', fontSize: 13, marginTop: 12, textAlign: 'center' },
  confirmBtn: { marginTop: 20, backgroundColor: '#8B5CF6', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { marginTop: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 15 },
});
