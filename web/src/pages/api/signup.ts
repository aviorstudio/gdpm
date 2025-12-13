import type { APIContext } from 'astro';
import { readSessionFromCookies, signUpWithProfile } from '../../services/supabase';

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
  const username = String(formData.get('username') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();

  if (!username || !email || !password) {
    return redirectWithStatus('/signup', 'Username, email, and password are required.', 'error');
  }

  const { error, notice } = await signUpWithProfile(cookies, username, email, password);
  if (error) return redirectWithStatus('/signup', error, 'error');
  if (notice) return redirectWithStatus('/signup', notice, 'success');

  return new Response(null, { status: 303, headers: { Location: '/' } });
}
