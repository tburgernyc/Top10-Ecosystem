import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Image, ScrollView, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '@/lib/api';
import { loadSession } from '@/store/auth';

type VtoStatus = 'idle' | 'submitting' | 'queued' | 'processing' | 'completed' | 'failed';

interface VtoResult {
  session_id: string;
  status: VtoStatus;
  output_image_url?: string;
  error_message?: string;
}

export default function VtoScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanMode, setIsScanMode] = useState(false);
  const [dressId, setDressId] = useState('');
  const [colorName, setColorName] = useState('');
  const [vtoStatus, setVtoStatus] = useState<VtoStatus>('idle');
  const [result, setResult] = useState<VtoResult | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
    return () => unsub();
  }, []);

  function handleBarcodeScan({ data }: BarcodeScanningResult) {
    setDressId(data);
    setIsScanMode(false);
  }

  async function handleCaptureAndSend() {
    if (!isOnline) {
      Alert.alert('Offline', 'VTO requires an internet connection.');
      return;
    }
    if (!dressId.trim() || !colorName.trim()) return;
    if (!cameraRef.current) return;

    setVtoStatus('submitting');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) throw new Error('Failed to capture image');

      const session = await loadSession();
      setVtoStatus('queued');

      const response = await apiFetch('/api/vto/initiate', {
        method: 'POST',
        body: JSON.stringify({
          dress_id: dressId.trim(),
          color_name: colorName.trim(),
          image_base64: photo.base64,
          tenant_id: session?.tenant_id ?? undefined,
        }),
      }) as { session_id: string; channel_id: string };

      setResult({ session_id: response.session_id, status: 'queued' });
      pollVtoStatus(response.session_id);
    } catch (err) {
      setVtoStatus('failed');
      setResult({ session_id: '', status: 'failed', error_message: err instanceof Error ? err.message : 'Capture failed' });
    }
  }

  async function pollVtoStatus(sessionId: string) {
    setVtoStatus('processing');
    // Poll every 3 seconds for up to 2 minutes
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const data = await apiFetch(`/api/vto/status/${sessionId}`) as VtoResult;
        setResult(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setVtoStatus(data.status);
          return;
        }
      } catch {
        // Continue polling on error
      }
    }
    setVtoStatus('failed');
    setResult((prev) => prev ? { ...prev, status: 'failed', error_message: 'Timed out waiting for result.' } : null);
  }

  function handleReset() {
    setVtoStatus('idle');
    setResult(null);
    setDressId('');
    setColorName('');
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionText}>Camera access is required for VTO capture.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canCapture = dressId.trim().length > 0 && colorName.trim().length > 0 && vtoStatus === 'idle';

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={isScanMode ? { barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] } : undefined}
          onBarcodeScanned={isScanMode ? handleBarcodeScan : undefined}
        />
        {isScanMode && (
          <View style={styles.scanOverlay}>
            <Text style={styles.scanHint}>Point at dress barcode or QR tag</Text>
            <TouchableOpacity style={styles.cancelScan} onPress={() => setIsScanMode(false)}>
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Controls */}
      <ScrollView style={styles.controls} keyboardShouldPersistTaps="handled">
        {vtoStatus === 'idle' || vtoStatus === 'submitting' ? (
          <>
            <Text style={styles.label}>Dress ID</Text>
            <View style={styles.dressIdRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Enter or scan ID"
                placeholderTextColor="#555"
                value={dressId}
                onChangeText={setDressId}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanMode(true)}>
                <Text style={styles.scanBtnText}>Scan</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Color Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Midnight Blue"
              placeholderTextColor="#555"
              value={colorName}
              onChangeText={setColorName}
            />

            <TouchableOpacity
              style={[styles.captureBtn, !canCapture && styles.captureBtnDisabled]}
              onPress={handleCaptureAndSend}
              disabled={!canCapture}
            >
              {vtoStatus === 'submitting'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.captureBtnText}>Capture & Send</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>
              {vtoStatus === 'queued' && '⏳ Queued for processing…'}
              {vtoStatus === 'processing' && '⚙️ Generating VTO image…'}
              {vtoStatus === 'completed' && '✅ VTO Complete'}
              {vtoStatus === 'failed' && '❌ VTO Failed'}
            </Text>

            {vtoStatus === 'completed' && result?.output_image_url && (
              <Image
                source={{ uri: result.output_image_url }}
                style={styles.outputImage}
                resizeMode="contain"
              />
            )}

            {vtoStatus === 'failed' && (
              <Text style={styles.errorText}>{result?.error_message ?? 'Unknown error'}</Text>
            )}

            {(vtoStatus === 'completed' || vtoStatus === 'failed') && (
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>
                  {vtoStatus === 'failed' ? 'Retry' : 'New Capture'}
                </Text>
              </TouchableOpacity>
            )}

            {(vtoStatus === 'queued' || vtoStatus === 'processing') && (
              <ActivityIndicator color="#8B5CF6" style={{ marginTop: 12 }} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  cameraContainer: { flex: 1, maxHeight: '50%', position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  scanHint: { color: '#fff', fontSize: 14, marginBottom: 12 },
  cancelScan: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  cancelScanText: { color: '#fff', fontSize: 14 },
  controls: { flex: 1, padding: 16 },
  label: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 16, textTransform: 'uppercase' },
  dressIdRow: { flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, backgroundColor: '#111116' },
  scanBtn: { backgroundColor: '#1A1A1F', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  scanBtnText: { color: '#8B5CF6', fontWeight: '700', fontSize: 14 },
  captureBtn: { marginTop: 20, backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  captureBtnDisabled: { opacity: 0.35 },
  captureBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusCard: { backgroundColor: '#111116', borderRadius: 12, padding: 20, marginTop: 8, alignItems: 'center' },
  statusLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  outputImage: { width: '100%', height: 300, borderRadius: 8 },
  errorText: { color: '#FF4444', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  resetBtn: { marginTop: 16, backgroundColor: '#8B5CF6', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  resetBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permissionText: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 24 },
  permissionBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
