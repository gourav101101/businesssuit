import { requireChatGPTUser } from '../chatgpt-auth';
import AuthForm from '../auth-form';
import { hasAccounts } from '@/lib/auth-store';
export const dynamic='force-dynamic';
export default async function Account() {
    const user=await requireChatGPTUser('/account');
    const ready=await hasAccounts();
    return <main className="auth-page"><section className="auth-card"><a className="btn" href="/overview">Back to newsroom</a><h1>Your account</h1>{ready?<><p>{user.email}</p><AuthForm mode="password"/></>:<><p>Create your owner account to protect this newsroom with a password.</p><a className="btn primary" href="/setup">Set up login</a></>}</section></main>;
}
