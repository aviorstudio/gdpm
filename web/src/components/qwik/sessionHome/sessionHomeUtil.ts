import { getClientFromEnv, getProfileById } from '../../../services/supabase';
import type { SupabaseBrowserClient } from '../../../services/supabase';

export type Tone = 'muted' | 'error' | 'success';

export const getClientOrMessage = (
  setStatus: (email: string, message: string, tone: Tone) => void
): SupabaseBrowserClient | null => {
  const { client, error } = getClientFromEnv();
  if (!client) {
    setStatus('Supabase is not configured.', error || 'Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY to continue.', 'error');
    return null;
  }
  return client;
};

export const profileExists = async (client: SupabaseBrowserClient, userId: string) => {
  const { exists, error } = await getProfileById(client, userId);
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return exists;
};
