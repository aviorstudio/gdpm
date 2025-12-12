import { getClientFromEnv, getProfileById, upsertProfile } from '../../../services/supabase';
import type { SupabaseBrowserClient } from '../../../services/supabase';

export type Tone = 'muted' | 'error' | 'success';

export const getClientOrStatus = (
  setStatus: (message: string, tone: Tone) => void
): SupabaseBrowserClient | null => {
  const { client, error } = getClientFromEnv();
  if (!client) {
    setStatus(error || 'Supabase is not configured. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.', 'error');
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

export const upsertUserProfile = async (
  client: SupabaseBrowserClient,
  payload: { id: string; username: string; email: string }
) => {
  const { error } = await upsertProfile(client, payload);
  if (error) throw error;
};
