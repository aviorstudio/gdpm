import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';

export type SupabaseBrowserClient = SupabaseClient;

let cachedClient: SupabaseBrowserClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export const getSupabaseBrowserClient = (url: string, anonKey: string): SupabaseBrowserClient => {
  if (!cachedClient || cachedUrl !== url || cachedKey !== anonKey) {
    cachedUrl = url;
    cachedKey = anonKey;
    cachedClient = createClient(url, anonKey);
  }
  return cachedClient;
};

export const getClientFromEnv = (): { client: SupabaseBrowserClient | null; error?: string } => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      client: null,
      error: 'Supabase is not configured. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.',
    };
  }
  return { client: getSupabaseBrowserClient(url, key) };
};

const cookieNameFromEnv = () => {
  try {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    if (!url) return null;
    const host = new URL(url).host;
    const ref = host.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
};

type CookieReader = {
  get: (name: string) => { value?: string } | undefined;
};

export const getServerClientFromCookies = (cookies: CookieReader): SupabaseClient | null => {
  const cookieName = cookieNameFromEnv();
  if (!cookieName) return null;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const storage = {
    getItem: (keyName: string) => {
      if (keyName !== cookieName) return null;
      const raw = cookies.get(cookieName)?.value;
      return raw ? decodeURIComponent(raw) : null;
    },
    setItem: () => {},
    removeItem: () => {},
  };

  return createClient(url, key, {
    auth: {
      storage,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

export const getServerSession = async (cookies: CookieReader) => {
  const client = getServerClientFromCookies(cookies);
  if (!client) return { client: null, session: null };
  const { data, error } = await client.auth.getSession();
  if (error) {
    return { client, session: null, error };
  }
  return { client, session: data.session ?? null };
};

export const resolveEmailFromUsername = async (
  client: SupabaseBrowserClient,
  username: string
): Promise<{ email?: string; error: PostgrestError | null }> => {
  const { data, error } = await client
    .from('profiles')
    .select('email')
    .eq('username', username)
    .limit(1)
    .maybeSingle();
  return { email: (data?.email as string | undefined) ?? undefined, error };
};

export const getProfileById = async (
  client: SupabaseBrowserClient,
  id: string
): Promise<{ exists: boolean; error: PostgrestError | null }> => {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('id', id)
    .limit(1)
    .maybeSingle();
  return { exists: !!data?.id, error };
};

export const upsertProfile = async (
  client: SupabaseBrowserClient,
  payload: { id: string; username: string; email: string }
): Promise<{ error: PostgrestError | null }> => {
  const { error } = await client.from('profiles').upsert(payload);
  return { error };
};
