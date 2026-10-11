import AuthForm from '../auth-form';
import { hasAccounts } from '@/lib/auth-store';
import { safeReturn } from '@/lib/passwords';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocalSetup, sessionUser } from '@/lib/auth-store';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{return_to?:string}>}) {
    const ready=await hasAccounts();
    const query=await searchParams;
    const h=await headers();
    if(await sessionUser(h))redirect(safeReturn(query.return_to||'/overview'));
    return <main className="auth-page"><section className="auth-card"><span className="wordmark">Newsdesk.</span><h1>{ready?'Sign in to Newsdesk':'Create your Newsdesk login'}</h1><p>{ready?'Manage your Facebook Pages and schedule posts from your dashboard.':'One-time setup: choose your email and a new password. Your existing Pages and posts will stay in your account.'}</p><AuthForm mode={ready?'login':'setup'} localSetup={isLocalSetup(h)} returnTo={safeReturn(query.return_to||'/overview')}/><small>Your Newsdesk login is separate from your Facebook login.</small></section></main>;
}
