import { notFound } from 'next/navigation';
import Studio from '../studio';
import { requireChatGPTUser } from '../chatgpt-auth';
import { sections } from '@/lib/sections';
export const dynamic = 'force-dynamic';
export default async function SectionPage({ params, searchParams }: {
    params: Promise<{ section: string }>;
    searchParams: Promise<{ workspace?: string }>;
}) {
    const { section } = await params;
    if (!Object.hasOwn(sections, section)) notFound();
    const query = await searchParams;
    const workspace = typeof query.workspace === 'string' ? query.workspace : '';
    const path = '/' + section + (workspace ? '?workspace=' + encodeURIComponent(workspace) : '');
    const user = await requireChatGPTUser(path);
    return <Studio user={{ name: user.displayName, email: user.email }} initialView={sections[section]}/>;
}
