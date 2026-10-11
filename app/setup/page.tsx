import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasAccounts, isLocalSetup } from '@/lib/auth-store';
import AuthForm from '../auth-form';
export const dynamic='force-dynamic';
export default async function Setup() {
    if(await hasAccounts())redirect('/login');
    const local=isLocalSetup(await headers());
    return <main className="auth-page"><section className="auth-card"><a className="wordmark" href="/overview">Newsdesk.</a><h1>Create your owner account.</h1><p>{local?'Your existing Pages, posts and connections will move to this account.':'Enter your server setup key and choose your login details.'}</p><AuthForm mode="setup" localSetup={local}/></section></main>;
}
