import type { APIRoute } from 'astro';

import { writeAuthCookies } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return new Response('Email and password are required', { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  if (!data.session) {
    return new Response('No session returned', { status: 500 });
  }

  const { access_token, refresh_token } = data.session;
  writeAuthCookies(cookies, { accessToken: access_token, refreshToken: refresh_token });
  return redirect('/');
};
