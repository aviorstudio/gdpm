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
