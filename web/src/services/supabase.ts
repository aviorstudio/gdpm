import { createClient, type Session, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';

export type SupabaseBrowserClient = SupabaseClient;

let cachedClient: SupabaseBrowserClient | null = null;
let cachedUrl = '';
let cachedKey = '';
let authCookieSyncAttached = false;

const cookieNamesFromEnv = () => {
  try {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    if (!url) return null;
    const host = new URL(url).host;
    const ref = host.split('.')[0];
    return {
      storageKey: `sb-${ref}-auth-token`,
      access: `sb-${ref}-access-token`,
      refresh: `sb-${ref}-refresh-token`,
      expires: `sb-${ref}-expires-at`,
    };
  } catch {
    return null;
  }
};

const decodeJWTPayload = (token: string) => {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const decoded =
      typeof atob === 'function'
        ? atob(base64)
        : (() => {
            const buff = (globalThis as any).Buffer;
            return buff ? buff.from(base64, 'base64').toString('utf-8') : '';
          })();
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const sessionFromTokens = (
  accessToken: string,
  refreshToken: string,
  expiresAtRaw?: string | null
): Session | null => {
  const now = Math.round(Date.now() / 1000);
  const claims = decodeJWTPayload(accessToken);
  const expiresAt = Number(expiresAtRaw ?? '') || claims?.exp || now + 60 * 60;
  if (expiresAt <= now) return null;
  const expiresIn = Math.max(0, expiresAt - now);

  const user =
    claims?.sub != null
      ? {
          id: claims.sub,
          aud: claims.aud ?? 'authenticated',
          role: claims.role ?? 'authenticated',
          email: claims.email ?? '',
          app_metadata: claims.app_metadata ?? {},
          user_metadata: claims.user_metadata ?? {},
          created_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : new Date().toISOString(),
          updated_at: null,
        }
      : null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: expiresIn,
    token_type: 'bearer',
    user: (user || null) as Session['user'],
  };
};

export const readSessionFromCookies = (cookies: CookieReader): Session | null => {
  const names = cookieNamesFromEnv();
  if (!names) return null;
  const accessToken = cookies.get(names.access)?.value;
  const refreshToken = cookies.get(names.refresh)?.value;
  const expiresAt = cookies.get(names.expires)?.value;
  if (!accessToken || !refreshToken) return null;
  return sessionFromTokens(accessToken, refreshToken, expiresAt);
};

const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

const clearCookie = (name: string) => setCookie(name, '', 0);

const writeAuthCookies = (session: Session | null) => {
  const names = cookieNamesFromEnv();
  if (!names || typeof document === 'undefined') return;

  // Remove the old aggregated cookie if it exists to stay under cookie size limits.
  clearCookie(names.storageKey);

  if (!session) {
    clearCookie(names.access);
    clearCookie(names.refresh);
    clearCookie(names.expires);
    return;
  }

  const now = Math.round(Date.now() / 1000);
  const accessTtl = session.expires_at ? session.expires_at - now : session.expires_in ?? 60 * 60;
  const refreshTtl = 60 * 60 * 24 * 60; // keep refresh token for ~60 days
  const expiresAt = session.expires_at ?? now + accessTtl;

  setCookie(names.access, session.access_token, accessTtl);
  if (session.refresh_token) {
    setCookie(names.refresh, session.refresh_token, refreshTtl);
  }
  setCookie(names.expires, String(expiresAt), refreshTtl);
};

const attachAuthCookieSync = (client: SupabaseBrowserClient) => {
  if (authCookieSyncAttached || typeof window === 'undefined') return;
  authCookieSyncAttached = true;

  client.auth.getSession().then(({ data }) => {
    writeAuthCookies(data.session ?? null);
  });

  client.auth.onAuthStateChange((_event, session) => {
    writeAuthCookies(session ?? null);
  });
};

export const getSupabaseBrowserClient = (url: string, anonKey: string): SupabaseBrowserClient => {
  if (!cachedClient || cachedUrl !== url || cachedKey !== anonKey) {
    cachedUrl = url;
    cachedKey = anonKey;
    cachedClient = createClient(url, anonKey);
    authCookieSyncAttached = false;
  }
  attachAuthCookieSync(cachedClient);
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

type CookieReader = {
  get: (name: string) => { value?: string } | undefined;
};

export const getServerClientFromCookies = (cookies: CookieReader): SupabaseClient | null => {
  const names = cookieNamesFromEnv();
  if (!names) return null;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const accessToken = cookies.get(names.access)?.value;
  const refreshToken = cookies.get(names.refresh)?.value;
  const expiresAt = cookies.get(names.expires)?.value;
  if (!accessToken || !refreshToken) return null;

  const session = sessionFromTokens(accessToken, refreshToken, expiresAt);
  if (!session) return null;

  const storage = {
    getItem: (keyName: string) => {
      if (keyName !== names.storageKey) return null;
      return JSON.stringify(session);
    },
    setItem: () => {},
    removeItem: () => {},
    isServer: true,
  };

  return createClient(url, key, {
    auth: {
      storageKey: names.storageKey,
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
  // If tokens are expired, getSession returns the cached value. Validate exp again.
  const session = data.session;
  if (session?.expires_at && session.expires_at <= Math.round(Date.now() / 1000)) {
    return { client, session: null };
  }
  return { client, session: session ?? null };
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
