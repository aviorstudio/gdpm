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
type AuthSessionResult = { session?: Session; error?: string; notice?: string };

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

const asTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeUsername = (value: string) => value.trim().toLowerCase();

const isEmailNotConfirmed = (err: unknown) =>
  typeof (err as { message?: string })?.message === 'string' &&
  /(email\s+not\s+confirmed)/i.test((err as { message?: string }).message || '');

const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

const asEmailOtpType = (value: string | null) => {
  if (!value) return null;
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null;
};

const resendConfirmationEmail = async (client: SupabaseClient, email: string) => {
  if (!email) return;
  try {
    await client.auth.resend({ type: 'signup', email });
  } catch {
    // Swallow resend errors; the original auth error is more important to surface.
  }
};

export const getProfileUsername = async (client: SupabaseClient, id: string): Promise<string> => {
  const { data, error } = await client
    .from('usernames')
    .select('username_display')
    .eq('profile_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return '';
  return asTrimmedString((data as { username_display?: unknown } | null)?.username_display);
};

const syncProfileFromSession = async (client: SupabaseClient, session: Session) => {
  const id = session.user?.id;
  if (!id) return;
  const email = session.user?.email ?? '';

  try {
    await upsertProfile(client, { id, contact_email: email });
  } catch {
    // Don't block sign-in if profile sync fails; it can be retried later.
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
  payload: { id: string; name?: string; contact_email: string }
) => {
  const { error } = await client.from('profiles').upsert(payload);
  if (error) throw new Error(error.message || 'Could not save profile.');
};

const insertUsername = async (
  client: SupabaseClient,
  payload: { username: string; profile_id?: string | null; org_id?: string | null }
) => {
  const profileId = asTrimmedString(payload.profile_id);
  const orgId = asTrimmedString(payload.org_id);
  if ((profileId && orgId) || (!profileId && !orgId)) {
    throw new Error('Username must be linked to exactly one owner (profile or org).');
  }

  const usernameDisplay = payload.username;
  const usernameNormalized = normalizeUsername(usernameDisplay);
  if (!usernameDisplay || !usernameNormalized) throw new Error('Username is required.');

  const { error } = await client
    .from('usernames')
    .insert({
      username_display: usernameDisplay,
      username_normal: usernameNormalized,
      profile_id: profileId || null,
      org_id: orgId || null,
    });
  if (!error) return;
  if (error.code === '23505') throw new Error('That username is already taken.');
  throw new Error(error.message || 'Could not save username.');
};

const resolveLoginEmail = async (client: SupabaseClient, identifier: string) => {
  if (identifier.includes('@')) return identifier;
  const normalizedUsername = normalizeUsername(identifier);
  const { data: usernameRow, error: usernameError } = await client
    .from('usernames')
    .select('profile_id')
    .eq('username_normal', normalizedUsername)
    .not('profile_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (usernameError) {
    throw new Error(
      usernameError.code === '42P01'
        ? 'Add a "usernames" table (username + profile_id) and allow selecting by username, or sign in with your email.'
        : usernameError.message || 'Could not resolve username.'
    );
  }

  const profileId = asTrimmedString((usernameRow as { profile_id?: unknown } | null)?.profile_id);
  if (!profileId) throw new Error('No account found for that username.');

  const { data: profileRow, error: profileError } = await client
    .from('profiles')
    .select('contact_email')
    .eq('id', profileId)
    .limit(1)
    .maybeSingle();
  if (profileError) {
    throw new Error(
      profileError.code === '42P01'
        ? 'Add a "profiles" table (id + contact_email), or sign in with your email.'
        : profileError.message || 'Could not resolve username.'
    );
  }

  const email = asTrimmedString((profileRow as { contact_email?: unknown } | null)?.contact_email);
  if (!email) throw new Error('No account found for that username.');
  return email;
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
): Promise<AuthSessionResult> => {
  const { data: client, error } = getServerClientOrError();
  if (!client) return { error };
  try {
    const email = await resolveLoginEmail(client, identifier);
    const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) {
      if (isEmailNotConfirmed(signInError)) {
        await resendConfirmationEmail(client, email);
        return { notice: 'Please confirm your email. We just sent a new confirmation link.' };
      }
      return { error: signInError?.message || 'Sign in failed.' };
    }
    await syncProfileFromSession(client, data.session);
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
): Promise<AuthSessionResult> => {
  const { data: client, error } = getServerClientOrError();
  if (!client) return { error };
  try {
    const { data, error: signUpError } = await client.auth.signUp({
      email,
      password,
    });
    if (signUpError) throw signUpError;

    const session = data.session;
    const userId = session?.user?.id ?? data.user?.id;
    if (!session) {
      return { notice: 'Check your email for the verification code to finish creating your account.' };
    }

    if (!userId) {
      throw new Error('Account created but no session returned.');
    }

    const authedClient = createServerClient(session) ?? client;
    await upsertProfile(authedClient, { id: userId, name: username, contact_email: email });
    await insertUsername(authedClient, { profile_id: userId, username });
    writeServerAuthCookies(cookies, session);
    return { session };
  } catch (err) {
    return { error: asErrorMessage(err, 'Account creation failed.') };
  }
};

export const confirmSignUpWithCode = async (
  cookies: ServerCookieJar,
  username: string,
  email: string,
  code: string
): Promise<AuthSessionResult> => {
  const { data: client, error } = getServerClientOrError();
  if (!client) return { error };
  try {
    const trimmedEmail = email.trim();
    const emailsToTry = Array.from(
      new Set([trimmedEmail, trimmedEmail.toLowerCase()].filter(Boolean))
    );
    const trimmed = code.trim();
    const otpCandidate = (() => {
      const matches = trimmed.match(/\b\d{6,8}\b/g);
      if (matches?.length === 1) return matches[0];
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (
        digitsOnly.length >= 6 &&
        digitsOnly.length <= 8 &&
        /^[\d\s-]+$/.test(trimmed)
      ) {
        return digitsOnly;
      }
      return '';
    })();
    let session: Session | null = null;
    let userId = '';

    const tryVerify = async () => {
      const url = (() => {
        try {
          return new URL(trimmed);
        } catch {
          return null;
        }
      })();

      const typeParam = asEmailOtpType(url?.searchParams.get('type') ?? null);
      const typesToTry: EmailOtpType[] = typeParam ? [typeParam] : ['signup', 'email', 'magiclink'];
      const tokenHash = url?.searchParams.get('token_hash') || '';
      const token = url?.searchParams.get('token') || '';
      const authCode = url?.searchParams.get('code') || '';

      if (authCode) {
        const { data, error } = await client.auth.exchangeCodeForSession(authCode);
        if (error) throw error;
        session = data.session;
        userId = session?.user?.id ?? '';
        return;
      }

      if (tokenHash) {
        let lastError: unknown = null;
        for (const type of typesToTry) {
          const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) {
            lastError = error;
            continue;
          }
          session = data.session;
          userId = session?.user?.id ?? data.user?.id ?? '';
          return;
        }
        throw lastError ?? new Error('Verification failed.');
      }

      const tokenCandidate = token || otpCandidate || trimmed;

      let tokenError: unknown = null;
      for (const type of typesToTry) {
        for (const email of emailsToTry) {
          const { data, error } = await client.auth.verifyOtp({ email, token: tokenCandidate, type });
          if (error) {
            tokenError = error;
            continue;
          }
          session = data.session;
          userId = session?.user?.id ?? data.user?.id ?? '';
          return;
        }
      }

      let tokenHashError: unknown = null;
      for (const type of typesToTry) {
        const { data, error } = await client.auth.verifyOtp({ token_hash: tokenCandidate, type });
        if (error) {
          tokenHashError = error;
          continue;
        }
        session = data.session;
        userId = session?.user?.id ?? data.user?.id ?? '';
        return;
      }
      throw tokenError ?? tokenHashError ?? new Error('Verification failed.');
    };

    await tryVerify();
    if (!session || !userId) {
      throw new Error('Verification succeeded but no session returned.');
    }

    const authedClient = createServerClient(session) ?? client;
    const resolvedEmail = session.user?.email ?? trimmedEmail;
    await upsertProfile(authedClient, { id: userId, name: username, contact_email: resolvedEmail });
    await insertUsername(authedClient, { profile_id: userId, username });

    writeServerAuthCookies(cookies, session);
    return { session };
  } catch (err) {
    return { error: asErrorMessage(err, 'Verification failed.') };
  }
};
