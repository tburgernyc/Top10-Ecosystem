import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

const UNCONFIGURED_MESSAGE =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.';

function unconfiguredStub(): SupabaseClient {
  const handler: ProxyHandler<object> = {
    get() {
      throw new Error(UNCONFIGURED_MESSAGE);
    },
    apply() {
      throw new Error(UNCONFIGURED_MESSAGE);
    },
  };
  return new Proxy(function () {}, handler) as unknown as SupabaseClient;
}

export async function createClient(): Promise<SupabaseClient> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) {
    return unconfiguredStub();
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method is called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  }) as unknown as SupabaseClient;
}
