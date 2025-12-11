import { createClient } from '@supabase/supabase-js';

const init = () => {
	const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

	const form = document.querySelector<HTMLFormElement>('[data-auth-form]');
	const identifierInput = form?.querySelector<HTMLInputElement>('[data-identifier]');
	const emailInput = form?.querySelector<HTMLInputElement>('[data-email]');
	const usernameInput = form?.querySelector<HTMLInputElement>('[data-username]');
	const passwordInput = form?.querySelector<HTMLInputElement>('[data-password]');
	const statusEl = form?.querySelector<HTMLElement>('[data-status]');
	const submitButton = form?.querySelector<HTMLButtonElement>('[data-submit]');
	const modeButtons = Array.from(
		document.querySelectorAll<HTMLButtonElement>('[data-mode]')
	);
	const modeFields = Array.from(
		form?.querySelectorAll<HTMLElement>('[data-mode-visible]') || []
	);

const sessionBadge = document.querySelector<HTMLElement>('[data-session-status]');
const sessionEmail = document.querySelector<HTMLElement>('[data-session-email]');
const signOutButton = document.querySelector<HTMLButtonElement>('[data-signout]');

	let currentMode: 'signin' | 'signup' = 'signin';
	let authCleanup: (() => void) | undefined;
	let supabase: ReturnType<typeof createClient> | undefined;

	const setStatus = (text: string, tone: 'muted' | 'error' | 'success' = 'muted') => {
		if (!statusEl) return;
		statusEl.textContent = text;
		statusEl.dataset.tone = tone;
	};

const setLoading = (isLoading: boolean) => {
	if (submitButton) submitButton.disabled = isLoading;
	if (signOutButton && isLoading) signOutButton.disabled = true;
};

	const applyFieldVisibility = () => {
		modeFields.forEach((field) => {
			const visibleFor = field.dataset.modeVisible;
			const shouldShow = !visibleFor || (visibleFor as typeof currentMode) === currentMode;
			field.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
			const input = field.querySelector<HTMLInputElement>('input');
			if (input) {
				input.required = shouldShow;
				input.disabled = !shouldShow;
			}
		});
	};

	const setMode = (mode: typeof currentMode) => {
		currentMode = mode;
		if (form) form.dataset.mode = mode;
		modeButtons.forEach((button) => {
			const isActive = button.dataset.mode === mode;
			button.classList.toggle('active', isActive);
		});
		if (statusEl) statusEl.textContent = '';
		if (submitButton) {
			submitButton.textContent = currentMode === 'signin' ? 'Sign in' : 'Create account';
		}
		applyFieldVisibility();
	};

	const renderSession = (session: any) => {
		const hasSession = Boolean(session);
		if (sessionBadge) sessionBadge.textContent = hasSession ? 'Signed in' : '';
		if (sessionEmail) sessionEmail.textContent = hasSession ? session.user.email ?? '' : '';
		if (signOutButton) signOutButton.disabled = !hasSession;
	};

	const refreshSession = async () => {
		if (!supabase) return;
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			setStatus(error.message, 'error');
			return;
		}
		renderSession(data?.session ?? null);
		const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
			renderSession(session);
			setStatus('');
		});
		authCleanup = () => listener.subscription.unsubscribe();
	};

	const resolveEmailFromIdentifier = async (identifier: string) => {
		if (!identifier) throw new Error('Email or username is required.');
		if (!supabase) throw new Error('Supabase not initialized.');
		if (identifier.includes('@')) return identifier;

		const { data, error } = await supabase
			.from('profiles')
			.select('email')
			.eq('username', identifier)
			.limit(1)
			.single();

		if (error) {
			throw new Error(
				error.code === '42P01'
					? 'To sign in with a username, add a "profiles" table with username + email and a public policy to select email by username. For now, sign in with your email.'
					: error.message || 'Could not resolve username.'
			);
		}

		if (!data?.email) throw new Error('No account found for that username.');
		return data.email as string;
	};

	modeButtons.forEach((button) => {
		button.addEventListener('click', () => {
			setMode((button.dataset.mode as typeof currentMode) || 'signin');
		});
	});

	if (!supabaseUrl || !supabaseAnonKey) {
		setStatus(
			'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Add them and reload.',
			'error'
		);
	} else {
		try {
			supabase = createClient(supabaseUrl, supabaseAnonKey);
		} catch (err) {
			console.error('Supabase client initialization failed', err);
			setStatus('Supabase client failed to initialize. Check your env values.', 'error');
		}
	}

	form?.addEventListener('submit', async (event) => {
		event.preventDefault();
		setStatus('');

	const identifier = (identifierInput?.value || '').trim();
	const email = (emailInput?.value || '').trim();
	const username = (usernameInput?.value || '').trim();
	const password = passwordInput?.value || '';

		if (!supabase) {
			setStatus('Supabase is not configured. Check your environment variables.', 'error');
			return;
		}

		if (!password) return setStatus('Password is required.', 'error');

		setLoading(true);
		if (currentMode === 'signin') {
			try {
				const resolvedEmail = await resolveEmailFromIdentifier(identifier);
				const { error, data } = await supabase.auth.signInWithPassword({
					email: resolvedEmail,
					password,
				});
				if (error) throw error;
				setStatus('Signed in successfully.', 'success');
				renderSession(data.session);
			} catch (err: any) {
				setStatus(err?.message || 'Sign in failed.', 'error');
			}
		} else {
			if (!username) {
				setStatus('Username is required.', 'error');
				setLoading(false);
				return;
			}
			if (!email) {
				setStatus('Email is required.', 'error');
				setLoading(false);
				return;
			}
			try {
				const { error, data } = await supabase.auth.signUp({
					email,
					password,
					options: { data: { username } },
				});
				if (error) {
					setStatus(error.message, 'error');
				} else {
					setStatus(
						'Account created. Confirm your email to finish setup. Username saved.',
						'success'
					);
					renderSession(data.session);

					if (data.user) {
						const { error: profileError } = await supabase
							.from('profiles')
							.upsert({ id: data.user.id, username, email });
						if (profileError) {
							console.warn('Profile upsert failed', profileError);
							setStatus(
								'Account created. To sign in with username, ensure a "profiles" table exists with username/email and allows selecting email by username.',
								'success'
							);
						}
					}
				}
			} catch (err: any) {
				setStatus(err?.message || 'Account creation failed.', 'error');
			}
		}
		setLoading(false);
	});

	signOutButton?.addEventListener('click', async () => {
		setStatus('');
		setLoading(true);
		if (!supabase) {
			setStatus('Supabase is not configured.', 'error');
			setLoading(false);
			return;
		}
		const { error } = await supabase.auth.signOut();
		if (error) {
			setStatus(error.message, 'error');
		} else {
			setStatus('Signed out.', 'success');
			renderSession(null);
		}
		setLoading(false);
	});

	setMode(currentMode);
	refreshSession();
	window.addEventListener('beforeunload', () => authCleanup?.());
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
	init();
}
