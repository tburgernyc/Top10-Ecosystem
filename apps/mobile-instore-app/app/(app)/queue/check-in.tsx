import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db/database';
import WalkIn from '@/db/models/WalkIn';
import { loadSession } from '@/store/auth';
import { syncDatabase } from '@/db/sync';

const OCCASIONS = ['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail'] as const;
type Occasion = typeof OCCASIONS[number];

export default function CheckInScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = 'Name is required.';
    if (!phone.trim()) e['phone'] = 'Phone number is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const session = await loadSession();
      if (!session) { router.replace('/(auth)'); return; }

      // Determine next queue position (server reconciles canonical value on next pull)
      const existing = await database.get<WalkIn>('walk_ins')
        .query(Q.where('status', Q.oneOf(['waiting', 'called', 'with_stylist'])))
        .fetch();
      const nextPosition = existing.length > 0
        ? Math.max(...existing.map((w) => w.queuePosition)) + 1
        : 1;

      await database.write(async () => {
        await database.get<WalkIn>('walk_ins').create((w) => {
          w._raw.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          w.tenantId = session.tenant_id;
          w.customerName = name.trim();
          w.phoneNumber = phone.trim();
          w.partySize = partySize;
          w.occasion = occasion;
          w.notes = notes.trim() || null;
          w.status = 'waiting';
          w.queuePosition = nextPosition;
          w.checkedInAt = new Date();
        });
      });

      syncDatabase().catch(console.warn);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check In</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput
          style={[styles.input, errors['name'] && styles.inputError]}
          placeholder="Full name"
          placeholderTextColor="#555"
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
        />
        {errors['name'] ? <Text style={styles.errorText}>{errors['name']}</Text> : null}

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={[styles.input, errors['phone'] && styles.inputError]}
          placeholder="(555) 000-0000"
          placeholderTextColor="#555"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(t) => { setPhone(t); setErrors((e) => ({ ...e, phone: '' })); }}
        />
        {errors['phone'] ? <Text style={styles.errorText}>{errors['phone']}</Text> : null}

        <Text style={styles.label}>Party Size</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setPartySize(Math.max(1, partySize - 1))}>
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{partySize}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setPartySize(partySize + 1)}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Occasion</Text>
        <View style={styles.occasionGrid}>
          {OCCASIONS.map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.occasionBtn, occasion === o && styles.occasionBtnActive]}
              onPress={() => setOccasion(occasion === o ? null : o)}
            >
              <Text style={[styles.occasionText, occasion === o && styles.occasionTextActive]}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any special notes..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Add to Queue</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1F' },
  backText: { color: '#8B5CF6', fontSize: 16, width: 60 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  form: { padding: 20, paddingBottom: 60 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 20, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, color: '#fff', fontSize: 16, backgroundColor: '#111116' },
  inputError: { borderColor: '#FF4444' },
  errorText: { color: '#FF4444', fontSize: 12, marginTop: 4 },
  notesInput: { height: 80, textAlignVertical: 'top' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 22 },
  stepValue: { color: '#fff', fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  occasionBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1028' },
  occasionText: { color: '#888', fontSize: 14 },
  occasionTextActive: { color: '#8B5CF6' },
  submitBtn: { marginTop: 32, backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
