import type { AstroCookies } from 'astro';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

const AUTH_COOKIE_OPTIONS = { path: '/' } as const;

export const AUTH_COOKIE_NAMES = {
  access: 'sb-access-token',
  refresh: 'sb-refresh-token',
} as const;

export const getAuthCookies = (cookies: AstroCookies) => {
  const accessToken = cookies.get(AUTH_COOKIE_NAMES.access);
  const refreshToken = cookies.get(AUTH_COOKIE_NAMES.refresh);
  return { accessToken, refreshToken };
};

export const hasAuthCookies = (cookies: AstroCookies) => {
  const { accessToken, refreshToken } = getAuthCookies(cookies);
  return Boolean(accessToken && refreshToken);
};

export const clearAuthCookies = (cookies: AstroCookies) => {
  cookies.delete(AUTH_COOKIE_NAMES.access, AUTH_COOKIE_OPTIONS);
  cookies.delete(AUTH_COOKIE_NAMES.refresh, AUTH_COOKIE_OPTIONS);
};

export const writeAuthCookies = (cookies: AstroCookies, tokens: { accessToken: string; refreshToken: string }) => {
  cookies.set(AUTH_COOKIE_NAMES.access, tokens.accessToken, AUTH_COOKIE_OPTIONS);
  cookies.set(AUTH_COOKIE_NAMES.refresh, tokens.refreshToken, AUTH_COOKIE_OPTIONS);
};

export const getSessionFromCookies = async (cookies: AstroCookies): Promise<Session | null> => {
  const { accessToken, refreshToken } = getAuthCookies(cookies);
  if (!accessToken || !refreshToken) {
    if (accessToken || refreshToken) clearAuthCookies(cookies);
    return null;
  }

  try {
    const { data, error } = await supabase.auth.setSession({
      refresh_token: refreshToken.value,
      access_token: accessToken.value,
    });
    if (error) {
      clearAuthCookies(cookies);
      return null;
    }

    const session = data.session;
    if (!session) {
      clearAuthCookies(cookies);
      return null;
    }

    writeAuthCookies(cookies, { accessToken: session.access_token, refreshToken: session.refresh_token });
    return session;
  } catch {
    clearAuthCookies(cookies);
    return null;
  }
};
