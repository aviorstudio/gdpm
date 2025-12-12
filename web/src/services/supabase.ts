import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
export type ServerCookieJar = {
  get: (name: string) => { value?: string } | undefined;
  set: (
    name: string,
    value: string,
    options?: { path?: string; maxAge?: number; sameSite?: 'lax' | 'strict' | 'none'; httpOnly?: boolean; secure?: boolean }
  ) => void;
};

type CookieReader = Pick<ServerCookieJar, 'get'>;

type CookieNames = { storageKey: string; access: string; refresh: string; expires: string };
type SupabaseEnv = { url: string; anonKey: string; cookies: CookieNames };
type AuthResult<T> = { data?: T; error?: string };

const CONFIG_ERROR = 'Supabase is not configured. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.';

const supabaseEnv: SupabaseEnv | null = (() => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const hostRef = new URL(url).host.split('.')[0];
    const cookies = {
      storageKey: `sb-${hostRef}-auth-token`,
      access: `sb-${hostRef}-access-token`,
      refresh: `sb-${hostRef}-refresh-token`,
      expires: `sb-${hostRef}-expires-at`,
    };
    return { url, anonKey, cookies };
  } catch {
    return null;
  }
})();

const nowInSeconds = () => Math.round(Date.now() / 1000);

const asErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  return fallback;
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
  const now = nowInSeconds();
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

const createCookieStorage = (names: CookieNames, session: Session) => ({
  getItem: (key: string) => (key === names.storageKey ? JSON.stringify(session) : null),
  setItem: () => {},
  removeItem: () => {},
  isServer: true,
});

const createServerClient = (session?: Session): SupabaseClient | null => {
  if (!supabaseEnv) return null;
  const { url, anonKey, cookies } = supabaseEnv;
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: Boolean(session),
      detectSessionInUrl: false,
      storageKey: cookies.storageKey,
      storage: session ? createCookieStorage(cookies, session) : undefined,
    },
  });
};

const isSecureCookies = () => (typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : false);

const setServerCookie = (cookies: ServerCookieJar, name: string, value: string, maxAgeSeconds: number) => {
  cookies.set(name, value, {
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
    sameSite: 'lax',
    httpOnly: true,
    secure: isSecureCookies(),
  });
};

const clearServerCookie = (cookies: ServerCookieJar, name: string) => {
  cookies.set(name, '', { path: '/', maxAge: 0, sameSite: 'lax', httpOnly: true, secure: isSecureCookies() });
};

export const readSessionFromCookies = (cookies: CookieReader): Session | null => {
  if (!supabaseEnv) return null;
  const { access, refresh, expires } = supabaseEnv.cookies;
  const accessToken = cookies.get(access)?.value;
  const refreshToken = cookies.get(refresh)?.value;
  const expiresAt = cookies.get(expires)?.value;
  if (!accessToken || !refreshToken) return null;
  return sessionFromTokens(accessToken, refreshToken, expiresAt);
};

export const writeServerAuthCookies = (cookies: ServerCookieJar, session: Session | null) => {
  if (!supabaseEnv) return;
  const { access, refresh, expires, storageKey } = supabaseEnv.cookies;
  if (!session) {
    clearServerCookie(cookies, access);
    clearServerCookie(cookies, refresh);
    clearServerCookie(cookies, expires);
    clearServerCookie(cookies, storageKey);
    return;
  }
  const now = nowInSeconds();
  const accessTtl = session.expires_at ? session.expires_at - now : session.expires_in ?? 60 * 60;
  const refreshTtl = 60 * 60 * 24 * 60;
  const expiresAt = session.expires_at ?? now + accessTtl;

  setServerCookie(cookies, access, session.access_token, accessTtl);
  if (session.refresh_token) {
    setServerCookie(cookies, refresh, session.refresh_token, refreshTtl);
  }
  setServerCookie(cookies, expires, String(expiresAt), refreshTtl);
};

export const getServerSession = async (cookies: CookieReader) => {
  if (!supabaseEnv) return { client: null, session: null, error: CONFIG_ERROR };

  const session = readSessionFromCookies(cookies);
  if (!session) return { client: null, session: null };

  const client = createServerClient(session);
  if (!client) return { client: null, session: null, error: CONFIG_ERROR };

  const { data, error } = await client.auth.getSession();
  if (error) return { client, session: null, error };
  const liveSession = data.session;
  if (liveSession?.expires_at && liveSession.expires_at <= nowInSeconds()) {
    return { client, session: null };
  }
  return { client, session: liveSession ?? null };
};

const upsertProfile = async (
  client: SupabaseClient,
  payload: { id: string; username: string; email: string }
) => {
  const { error } = await client.from('profiles').upsert(payload);
  if (error) throw new Error(error.message || 'Could not save profile.');
};

const resolveLoginEmail = async (client: SupabaseClient, identifier: string) => {
  if (identifier.includes('@')) return identifier;
  const { data, error } = await client
    .from('profiles')
    .select('email')
    .eq('username', identifier)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      error.code === '42P01'
        ? 'Add a "profiles" table with username + email and a policy to select by username, or sign in with your email.'
        : error.message || 'Could not resolve username.'
    );
  }
  if (!data?.email) throw new Error('No account found for that username.');
  return data.email as string;
};

const getServerClientOrError = (): AuthResult<SupabaseClient> => {
  const client = createServerClient();
  if (!client) return { error: CONFIG_ERROR };
  return { data: client };
};

export const signInWithIdentifier = async (
  cookies: ServerCookieJar,
  identifier: string,
  password: string
): Promise<{ session?: Session; error?: string }> => {
  const { data: client, error } = getServerClientOrError();
  if (!client) return { error };
  try {
    const email = await resolveLoginEmail(client, identifier);
    const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) {
      return { error: signInError?.message || 'Sign in failed.' };
    }
    writeServerAuthCookies(cookies, data.session);
    return { session: data.session };
  } catch (err) {
    return { error: asErrorMessage(err, 'Sign in failed.') };
  }
};

export const signUpWithProfile = async (
  cookies: ServerCookieJar,
  username: string,
  email: string,
  password: string
): Promise<{ session?: Session; error?: string }> => {
  const { data: client, error } = getServerClientOrError();
  if (!client) return { error };
  try {
    const { data, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (signUpError) throw signUpError;

    let session = data.session;
    if (!session) {
      const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      session = signInData.session;
    }

    const userId = session?.user?.id ?? data.user?.id;
    if (!session || !userId) {
      throw new Error('Account created but no session returned.');
    }

    await upsertProfile(client, { id: userId, username, email });
    writeServerAuthCookies(cookies, session);
    return { session };
  } catch (err) {
    return { error: asErrorMessage(err, 'Account creation failed.') };
  }
};
