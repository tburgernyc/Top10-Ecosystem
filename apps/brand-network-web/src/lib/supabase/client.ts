import { createBrowserClient } from '@supabase/ssr';
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

export function createClient(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) {
    return unconfiguredStub();
  }
  return createBrowserClient(url, key);
}
