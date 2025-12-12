import type { SupabaseBrowserClient } from '../../../services/supabase';
import {
  getClientFromEnv,
  getProfileById,
  resolveEmailFromUsername,
  upsertProfile,
} from '../../../services/supabase';

export type Tone = 'muted' | 'error' | 'success';

const getClientOrStatus = (setStatus: (text: string, tone: Tone) => void): SupabaseBrowserClient | null => {
  const { client, error } = getClientFromEnv();
  if (!client) {
    setStatus(error || 'Supabase is not configured.', 'error');
    return null;
  }
  return client;
};

const resolveLoginEmail = async (client: SupabaseBrowserClient, identifier: string): Promise<string> => {
  if (identifier.includes('@')) return identifier;
  const { email, error } = await resolveEmailFromUsername(client, identifier);
  if (error) {
    throw new Error(
      error.code === '42P01'
        ? 'Add a "profiles" table with username + email and a policy to select by username, or sign in with your email.'
        : error.message || 'Could not resolve username.'
    );
  }
  if (!email) throw new Error('No account found for that username.');
  return email;
};

export const profileExists = async (client: SupabaseBrowserClient, userId: string) => {
  const { exists, error } = await getProfileById(client, userId);
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return exists;
};

const upsertProfileForUser = async (
  client: SupabaseBrowserClient,
  payload: { id: string; username: string; email: string }
) => {
  const { error } = await upsertProfile(client, payload);
  if (error) throw error;
};

export const loadExistingSession = async (setStatus: (text: string, tone: Tone) => void) => {
  const client = getClientOrStatus(setStatus);
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
};

export const runSignIn = async (
  identifier: string,
  password: string,
  setStatus: (text: string, tone: Tone) => void
): Promise<{ redirect?: string }> => {
  const client = getClientOrStatus(setStatus);
  if (!client) return {};
  const resolvedEmail = await resolveLoginEmail(client, identifier);
  const { data, error } = await client.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });
  if (error) throw error;
  const sessionUser = data.session?.user;
  if (!sessionUser) throw new Error('Signed in, but no session returned. Check email confirmation settings.');
  const exists = await profileExists(client, sessionUser.id);
  return { redirect: exists ? '/' : '/onboard' };
};

export const runSignUp = async (
  email: string,
  username: string,
  password: string,
  setStatus: (text: string, tone: Tone) => void
): Promise<{ redirect?: string; needsConfirmation?: boolean }> => {
  const client = getClientOrStatus(setStatus);
  if (!client) return {};
  const { error, data } = await client.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  if (data.session?.user) {
    await upsertProfileForUser(client, { id: data.session.user.id, username, email });
    return { redirect: '/' };
  }
  return { needsConfirmation: true };
};
