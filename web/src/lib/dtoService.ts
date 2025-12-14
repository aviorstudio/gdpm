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

export type PackageInsert = {
  profile_id?: string | null;
  org_id?: string | null;
  name: string;
  repo: string;
};

export const packagesDto = {
  insert: (client: SupabaseClient, payload: PackageInsert) =>
    client.from('packages').insert(payload).select('*').maybeSingle(),
  listByProfileId: (client: SupabaseClient, profileId: string) =>
    client.from('packages').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }),
  listByOrgId: (client: SupabaseClient, orgId: string) =>
    client.from('packages').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
  getByProfileIdAndName: (client: SupabaseClient, profileId: string, name: string) =>
    client.from('packages').select('*').eq('profile_id', profileId).eq('name', name).maybeSingle(),
  getByOrgIdAndName: (client: SupabaseClient, orgId: string, name: string) =>
    client.from('packages').select('*').eq('org_id', orgId).eq('name', name).maybeSingle(),
};

export const packageVersionsDto = {
  insert: (client: SupabaseClient, payload: { package_id: string; version: string; sha: string }) =>
    client.from('package_versions').insert(payload).select('*').maybeSingle(),
  listByPackageIds: (client: SupabaseClient, packageIds: string[]) =>
    client
      .from('package_versions')
      .select('*')
      .in('package_id', packageIds)
      .order('created_at', { ascending: false }),
  listByPackageId: (client: SupabaseClient, packageId: string) =>
    client.from('package_versions').select('*').eq('package_id', packageId).order('created_at', { ascending: false }),
};
