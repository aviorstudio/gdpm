import type { APIContext } from 'astro';
import { getServerSession, writeServerAuthCookies } from '../../services/supabase';

export const prerender = false;

export async function POST({ cookies }: APIContext) {
  const { client } = await getServerSession(cookies);
  try {
    await client?.auth.signOut();
  } catch {
    // Ignore sign-out failures; we'll still clear cookies.
  }
  writeServerAuthCookies(cookies, null);
  return new Response(null, { status: 303, headers: { Location: '/signin' } });
}
