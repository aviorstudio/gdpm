import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileUpsert = {
  id: string;
  name?: string | null;
  contact_email?: string | null;
};

export const profilesDto = {
  getById: (client: SupabaseClient, id: string) => client.from('profiles').select('*').eq('id', id).maybeSingle(),
  upsert: (client: SupabaseClient, payload: ProfileUpsert) => client.from('profiles').upsert(payload),
};

export type UsernameInsert = {
  username_display: string;
  username_normal: string;
  profile_id?: string | null;
  org_id?: string | null;
};

export const usernamesDto = {
  insert: (client: SupabaseClient, payload: UsernameInsert) => client.from('usernames').insert(payload),
  getByProfileId: (client: SupabaseClient, profileId: string) =>
    client.from('usernames').select('*').eq('profile_id', profileId),
  getByUsernameNormal: (client: SupabaseClient, usernameNormal: string) =>
    client.from('usernames').select('*').eq('username_normal', usernameNormal).maybeSingle(),
};
