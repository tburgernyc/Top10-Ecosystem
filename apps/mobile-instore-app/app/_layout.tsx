import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { loadSession } from '@/store/auth';

export default function RootLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    loadSession().then((session) => {
      if (session) {
        router.replace('/(app)/queue');
      } else {
        router.replace('/(auth)');
      }
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
