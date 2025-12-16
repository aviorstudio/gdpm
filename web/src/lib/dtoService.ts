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
  listByProfileIds: (client: SupabaseClient, profileIds: string[]) =>
    client.from('usernames').select('username_display,profile_id,org_id').in('profile_id', profileIds),
  listByOrgIds: (client: SupabaseClient, orgIds: string[]) =>
    client.from('usernames').select('username_display,profile_id,org_id').in('org_id', orgIds),
  getByUsernameNormal: (client: SupabaseClient, usernameNormal: string) =>
    client.from('usernames').select('*').eq('username_normal', usernameNormal).maybeSingle(),
};

export type PluginInsert = {
  profile_id?: string | null;
  org_id?: string | null;
  name: string;
  repo: string;
  path?: string | null;
};

export const pluginsDto = {
  insert: (client: SupabaseClient, payload: PluginInsert) =>
    client.from('plugins').insert(payload).select('*').maybeSingle(),
  listAll: async (client: SupabaseClient) => {
    const withPath = await client
      .from('plugins')
      .select('id,name,repo,path,created_at,profile_id,org_id')
      .order('created_at', { ascending: false });
    if (!withPath.error) return withPath;

    const msg = (withPath.error.message ?? '').toLowerCase();
    if (msg.includes('path') && (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache'))) {
      return client
        .from('plugins')
        .select('id,name,repo,created_at,profile_id,org_id')
        .order('created_at', { ascending: false });
    }
    return withPath;
  },
  listByProfileId: (client: SupabaseClient, profileId: string) =>
    client.from('plugins').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }),
  listByOrgId: (client: SupabaseClient, orgId: string) =>
    client.from('plugins').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
  getByProfileIdAndName: (client: SupabaseClient, profileId: string, name: string) =>
    client.from('plugins').select('*').eq('profile_id', profileId).eq('name', name).maybeSingle(),
  getByOrgIdAndName: (client: SupabaseClient, orgId: string, name: string) =>
    client.from('plugins').select('*').eq('org_id', orgId).eq('name', name).maybeSingle(),
};

export const pluginVersionsDto = {
  insert: (client: SupabaseClient, payload: { plugin_id: string; major: number; minor: number; patch: number; sha: string }) =>
    client.from('plugin_versions').insert(payload).select('*').maybeSingle(),
  listByPluginIds: (client: SupabaseClient, pluginIds: string[]) =>
    client
      .from('plugin_versions')
      .select('*')
      .in('plugin_id', pluginIds)
      .order('created_at', { ascending: false }),
  listByPluginId: (client: SupabaseClient, pluginId: string) =>
    client.from('plugin_versions').select('*').eq('plugin_id', pluginId).order('created_at', { ascending: false }),
};
