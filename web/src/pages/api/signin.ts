import type { APIContext } from 'astro';
import { readSessionFromCookies, signInWithIdentifier } from '../../services/supabase';

export const prerender = false;

const redirectWithStatus = (pathname: string, status?: string, tone?: 'error' | 'success') => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (tone) params.set('tone', tone);
  const search = params.toString();
  const location = `${pathname}${search ? `?${search}` : ''}`;
  return new Response(null, { status: 303, headers: { Location: location } });
};

export async function POST({ request, cookies }: APIContext) {
  const session = readSessionFromCookies(cookies);
  if (session) return new Response(null, { status: 303, headers: { Location: '/' } });

  const formData = await request.formData();
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();

  if (!identifier || !password) {
    return redirectWithStatus('/signin', 'Email or username and password are required.', 'error');
  }

  const { error, notice } = await signInWithIdentifier(cookies, identifier, password);
  if (error) return redirectWithStatus('/signin', error, 'error');
  if (notice) return redirectWithStatus('/signin', notice, 'success');

  return new Response(null, { status: 303, headers: { Location: '/' } });
}
