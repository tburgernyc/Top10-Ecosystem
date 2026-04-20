import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { saveSession, type AuthSession } from '@/store/auth';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export default function AuthScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!code.trim()) {
      setError('Please enter your store code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/mobile/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_code: code.trim().toUpperCase() }),
      });
      if (response.status === 401) {
        setError('Code not recognised — check with your manager.');
        return;
      }
      if (!response.ok) {
        setError("Couldn't reach server — check Wi-Fi and try again.");
        return;
      }
      const session = await response.json() as AuthSession;
      await saveSession(session);
      router.replace('/(app)/queue');
    } catch {
      setError("Couldn't reach server — check Wi-Fi and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>TOP 10 PROM</Text>
      <Text style={styles.subtitle}>In-Store Staff App</Text>

      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholder="Store Code"
        placeholderTextColor="#666"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={(t) => { setCode(t); setError(null); }}
        onSubmitEditing={handleSignIn}
        returnKeyType="go"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign In</Text>
        }
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0B0A0E', alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  logo: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 4, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 48 },
  input: {
    width: '100%', height: 52, borderWidth: 1, borderColor: '#333', borderRadius: 8,
    paddingHorizontal: 16, color: '#fff', fontSize: 18, letterSpacing: 4,
    backgroundColor: '#1A1A1F', textAlign: 'center',
  },
  inputError: { borderColor: '#FF4444' },
  errorText: { color: '#FF4444', fontSize: 13, marginTop: 8, textAlign: 'center' },
  button: {
    marginTop: 24, width: '100%', height: 52, backgroundColor: '#8B5CF6',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
