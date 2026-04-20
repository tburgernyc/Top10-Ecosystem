import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';
import { syncDatabase } from '@/db/sync';

function useForegroundSync() {
  useEffect(() => {
    syncDatabase().catch(console.warn);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') syncDatabase().catch(console.warn);
    });
    return () => sub.remove();
  }, []);
}

export default function AppLayout() {
  useForegroundSync();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0B0A0E', borderTopColor: '#1A1A1F' },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#666',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="queue"
        options={{ title: 'Queue', tabBarLabel: 'Queue' }}
      />
      <Tabs.Screen
        name="vto"
        options={{ title: 'VTO', tabBarLabel: 'VTO' }}
      />
    </Tabs>
  );
}
