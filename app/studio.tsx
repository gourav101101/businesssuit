'use client';
import { useEffect, useState, useRef } from 'react';
import { LayoutDashboard, Library, UploadCloud, CalendarDays, Palette, FolderOpen, BarChart3, Users, Plug, Settings, ChevronDown, ChevronLeft, ChevronRight, Plus, ArrowUpRight, ArrowRight, Search, Bell, Check, CheckCircle2, Clock, FileText, MoreHorizontal, Grid2X2, List, Download, RefreshCw, Pause, Play, Send, Trash2, Copy, ExternalLink, AlertCircle, Menu, X, Newspaper, ShieldCheck, Sparkles, Image as ImageIcon, FileArchive, HelpCircle } from 'lucide-react';
import JSZip from 'jszip';
import { blankData, freshPost, today, statuses, statusLabels, distribute, type Data, type Post, type Brand } from '@/lib/model';
import { csvCell } from '@/lib/import';
import { Modal, Field, Empty, Poster, renderPoster, download } from './ui';
import Importer from './importer';
type Asset = {
    id: string;
    name: string;
    type: string;
    size: number;
    created_at: string;
};
type Snapshot = {
    data: Data;
    revision: number;
    role: string;
    assets: Asset[];
    members: {
        id: string;
        email: string;
        role: string;
    }[];
    events: {
        id: string;
        actor: string;
        action: string;
        created_at: string;
    }[];
    connection: {
        page_id: string;
        page_name: string;
    } | null;
};
const navigation = [['Overview', LayoutDashboard], ['Content library', Library], ['Import content', UploadCloud], ['Calendar', CalendarDays], ['Poster studio', Palette], ['Source library', FolderOpen], ['Analytics', BarChart3]] as const;
const settingsNav = [['Team & activity', Users], ['Integrations', Plug], ['Brand settings', Settings]] as const;
async function request(url: string, body?: unknown): Promise<any> { const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); const d: any = await r.json(); if (!r.ok)
    throw new Error(d.error || 'Request failed'); return d; }
export default function Studio({ user }: {
    user: {
        name: string;
        email: string;
    };
}) {
    const [view, setView] = useState('Overview'), [workspaces, setWorkspaces] = useState<{
        id: string;
        name: string;
    }[]>([]), [workspace, setWorkspace] = useState(''), [snapshot, setSnapshot] = useState<Snapshot | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [toast, setToast] = useState(''), [error, setError] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [category, setCategory] = useState('all'), [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<Post | null>(null), [modal, setModal] = useState(''), [menu, setMenu] = useState(false), [list, setList] = useState(false), [calendarDate, setCalendarDate] = useState(today()), [calendarMode, setCalendarMode] = useState('month'), [scheduleDate, setScheduleDate] = useState(today()), [start, setStart] = useState('07:30'), [end, setEnd] = useState('21:00'), [integrations, setIntegrations] = useState({ meta: false, ai: false, oauth: false, version: null }), [brand, setBrand] = useState<Brand | null>(null), [aiStories, setAiStories] = useState<any[]>([]), [newName, setNewName] = useState(''), [newCity, setNewCity] = useState('');
    const [pageChoices, setPageChoices] = useState<{
        id: string;
        name: string;
    }[]>([]), [connectSession, setConnectSession] = useState(''), [metrics, setMetrics] = useState<any>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const data = snapshot?.data || blankData('Indore Ki Baat', 'Indore');
    const posts = data.posts;
    const assets = snapshot?.assets || [];
    const canEdit = snapshot?.role !== 'viewer';
    const canPublish = ['owner', 'publisher'].includes(snapshot?.role || '');
    const owner = snapshot?.role === 'owner';
    function notify(s: string) { setToast(s); if (timer.current)
        clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 6000); }
    async function load(id = workspace) { if (!id)
        return; const s = await request('/api/workspace?id=' + id); setSnapshot(s); setBrand(s.data.brand); setWorkspaces(old => old.map(w => w.id === id ? { ...w, name: s.data.brand.name } : w)); }
    async function boot() { setLoading(true); setError(''); try {
        const r = await request('/api/workspace');
        setWorkspaces(r.workspaces);
        const id = r.workspaces[0]?.id;
        setWorkspace(id);
        await load(id);
        setIntegrations(await request('/api/integrations'));
        const q = new URLSearchParams(location.search);
        if (q.get('connection_error')) {
            notify(q.get('connection_error')!);
            history.replaceState(null, '', '/');
        }
        if (q.get('connect')) {
            const session = q.get('connect')!;
            try {
                const choices = await request('/api/facebook/pages?session=' + encodeURIComponent(session));
                setConnectSession(session);
                setPageChoices(choices.pages);
                setWorkspace(choices.workspace);
                await load(choices.workspace);
                setView('Integrations');
                setModal('choosePage');
            }
            finally {
                history.replaceState(null, '', '/');
            }
        }
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { void boot(); return () => { if (timer.current)
        clearTimeout(timer.current); }; }, []);
    useEffect(() => { setSelected([]); setSearch(''); setStatus('all'); }, [workspace]);
    useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setModal('');
        setEditing(null);
        setMenu(false);
    } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
    async function action(action: string, extra: any = {}) { setBusy(true); try {
        const r = await request('/api/workspace', { id: workspace, revision: snapshot?.revision, action, ...extra });
        await load();
        notify(r.message || 'Saved');
        return true;
    }
    catch (e) {
        notify((e as Error).message);
        await load().catch(() => { });
        return false;
    }
    finally {
        setBusy(false);
    } }
    async function upload(file: File) { const f = new FormData(); f.set('workspace', workspace); f.set('file', file); const r = await fetch('/api/assets', { method: 'POST', body: f }); const d: any = await r.json(); if (!r.ok)
        throw new Error(d.error); return d.id as string; }
    const filtered = posts.filter(p => (status === 'all' || p.status === status) && (category === 'all' || p.category === category) && (`${p.title} ${p.caption} ${p.source}`).toLowerCase().includes(search.toLowerCase()));
    const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    const counted = (...st: string[]) => posts.filter(p => st.includes(p.status)).length;
    function go(v: string) { setSelected([]); setSearch(''); setStatus('all'); setCategory('all'); setView(v); setMenu(false); }
    async function exportPack() { setBusy(true); try {
        const exportPosts = selected.length ? posts.filter(p => selected.includes(p.id)) : posts;
        if (!exportPosts.length)
            throw new Error('Add posts before exporting');
        const zip = new JSZip();
        const rows = [['post_key', 'date', 'time', 'title', 'message', 'photo', 'source']];
        for (let i = 0; i < exportPosts.length; i++) {
            const p = exportPosts[i];
            let file = '';
            if (p.media) {
                const r = await fetch('/api/assets?id=' + p.media);
                if (!r.ok)
                    throw new Error('Could not download image: ' + p.title);
                const blob = await r.blob();
                file = `${String(i + 1).padStart(2, '0')}_${p.id.slice(0, 8)}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
                zip.file(file, blob);
            }
            rows.push([p.id, p.date, p.time, p.title, p.caption, file, p.source]);
        }
        zip.file('manifest.csv', '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'));
        zip.file('README.txt', 'Newsdesk portable content pack\nImport into Newsdesk using ZIP + CSV. This is not a verified Meta Business Suite CSV format.\nTimezone: Asia/Kolkata (UTC+05:30)\nAll re-imported content becomes drafts.\n');
        download(await zip.generateAsync({ type: 'blob' }), `${data.brand.city.toLowerCase()}-${today()}-content.zip`);
        notify('Content pack downloaded');
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function publish(p: Post, mode: string) { setBusy(true); try {
        const r = await request('/api/publish', { id: workspace, postId: p.id, action: mode });
        notify(r.message || 'Delivery updated');
        await load();
    }
    catch (e) {
        notify((e as Error).message);
        await load().catch(() => { });
    }
    finally {
        setBusy(false);
        setModal('');
    } }
    async function ai(task: string, asset?: string, text?: string) { setBusy(true); try {
        const r = await request('/api/ai', { id: workspace, task, asset, text });
        setAiStories(r.stories.map((s: any) => ({ ...s, sourceMedia: asset || '' })));
        setModal('ai');
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function postCard(p: Post) { return <article className={'post-card ' + (selected.includes(p.id) ? 'selected' : '')} key={p.id} draggable={canEdit} onDragStart={e => e.dataTransfer.setData('text/newsdesk-post', p.id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData('text/newsdesk-post'); if (from && from !== p.id)
        void action('reorder', { from, to: p.id }); }}><div className="post-image" onClick={() => setEditing({ ...p })}>{p.media ? <img src={'/api/assets?id=' + p.media} alt={p.title}/> : <Poster post={p} brand={data.brand}/>}<button className={'select-check ' + (selected.includes(p.id) ? 'checked' : '')} aria-label={`Select ${p.title}`} onClick={e => { e.stopPropagation(); toggle(p.id); }}>{selected.includes(p.id) && <Check size={14}/>}</button><span className={'status ' + p.status}>{statusLabels[p.status]}</span></div><div className="post-card-body"><span className="eyebrow">{p.category}</span><h3><button onClick={() => setEditing({ ...p })}>{p.title}</button></h3><p>{p.caption || 'Add a caption to tell the story.'}</p>{p.caption && posts.some(q => q.id !== p.id && q.caption.trim() === p.caption.trim()) && <small className="warning">Matching caption in this workspace</small>}<div className="card-foot"><span><Clock size={13}/>{p.time ? p.date + ' · ' + p.time : 'Not scheduled'}</span><button className="icon-btn" aria-label={`Edit ${p.title}`} onClick={() => setEditing({ ...p })}><ArrowUpRight size={17}/></button></div></div></article>; }
    return <div className="app-shell"><aside className={'sidebar ' + (menu ? 'open' : '')}><a className="wordmark" href="#" onClick={e => { e.preventDefault(); go('Overview'); }}><span className="brand-icon"><Newspaper size={22}/></span>newsdesk<span className="brand-dot">.</span></a><div className="workspace-picker"><span className="workspace-avatar" style={{ background: data.brand.color }}>{data.brand.initials}</span><div><small>YOUR WORKSPACE</small><select aria-label="Select city workspace" value={workspace} onChange={async (e) => { setWorkspace(e.target.value); setLoading(true); try {
        await load(e.target.value);
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setLoading(false);
    } }}>{workspaces.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select></div><ChevronDown size={14}/></div><span className="nav-label">WORKSPACE</span><nav>{navigation.map(([name, Icon]) => <button key={name} onClick={() => go(name)} className={view === name ? 'active' : ''}><Icon size={18}/><span>{name}</span>{name === 'Content library' && posts.length > 0 && <b>{posts.length}</b>}{name === 'Import content' && <span className="nav-new">NEW</span>}</button>)}</nav><span className="nav-label">MANAGE</span><nav>{settingsNav.map(([name, Icon]) => <button key={name} onClick={() => go(name)} className={view === name ? 'active' : ''}><Icon size={18}/><span>{name}</span></button>)}</nav><div className="sidebar-bottom"><div className="workspace-note"><span className="green-dot"/><b>Your newsroom, connected.</b><p>Good stories deserve a better workflow.</p><button onClick={() => setModal('help')}>A quick guide <ArrowUpRight size={14}/></button></div><button className="user-block" onClick={() => go('Team & activity')}><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><b>{user.name.includes('@') ? 'Your account' : user.name}</b><small>{snapshot?.role || 'Workspace owner'}</small></span><MoreHorizontal size={18}/></button></div></aside>
 <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-btn mobile-menu" aria-label="Open navigation" onClick={() => setMenu(!menu)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={13}/><b>{view}</b></div><div className="topbar-right"><span className="timezone"><span className="green-dot"/> Asia/Kolkata · IST</span><button className="icon-btn" aria-label="Refresh workspace" onClick={() => void load().then(() => notify('Workspace refreshed')).catch(e => notify(e.message))}><RefreshCw size={17}/></button><button className="icon-btn notification" aria-label="View activity" onClick={() => go('Team & activity')}><Bell size={18}/>{counted('failed', 'unknown') > 0 && <i />}</button><span className="user-avatar small">{user.name.slice(0, 1).toUpperCase()}</span></div></header>
 <main>{loading ? <div className="loading-screen"><span className="spinner"/><h2>Opening your newsroom…</h2></div> : error ? <Empty title="We couldn’t open the workspace" description={error} action={<button className="btn primary" onClick={() => void boot()}>Try again</button>}/> : <>
 {view === 'Overview' && <><div className="page-heading"><div><span className="eyebrow">YOUR CITY. YOUR STORIES.</span><h1>A good day for good stories<span className="heading-dot">.</span></h1><p>Here’s what’s happening at {data.brand.name}.</p></div><button className="btn primary" onClick={() => go('Import content')}><Plus size={17}/> Import content</button></div><div className="stats-grid">{[[FileText, 'Total stories', posts.length, 'In your content library'], [ShieldCheck, 'Ready to publish', counted('approved'), 'Reviewed and approved'], [CalendarDays, 'Scheduled stories', counted('planned', 'scheduled'), 'Across your calendar'], [CheckCircle2, 'Published', counted('published'), 'Verified on Facebook']].map(([Icon, title, value, note]: any) => <button key={title} className="stat-card" onClick={() => { go('Content library'); setStatus(title === 'Ready to publish' ? 'approved' : title === 'Published' ? 'published' : 'all'); }}><div><span>{title}</span><Icon size={17}/></div><strong>{value}<small>{title === 'Scheduled stories' && counted('planned') > 0 ? 'local plans' : ''}</small></strong><p>{note}</p></button>)}</div>
 <section className="welcome-banner"><div className="welcome-copy"><span className="pill"><Sparkles size={13}/> LESS BUSYWORK. MORE STORIES.</span><h2>From a ZIP file to<br />a well-planned day.</h2><p>Bring your Meta AI images, captions and schedule.<br />We’ll help you turn them into your next edition.</p><button className="btn dark" onClick={() => go('Import content')}>Import your content pack <ArrowRight size={16}/></button><span className="supported"><FileArchive size={14}/> ZIP images <i /> CSV or TXT captions</span></div><div className="banner-art" aria-hidden="true"><div className="paper-stack back"/><div className="paper-stack"><div className="paper-bar"><span>IK</span> INDORE KI BAAT <b>✦</b></div><div className="city-art"><i /><i /><i /><i /><i /><span>इंदौर</span></div><div className="paper-caption"><small>LOCAL STORIES, BEAUTIFULLY TOLD</small><strong>शहर की हर खबर,<br />अब एक जगह।</strong><div /><p>Made for your newsroom.</p></div></div><span className="art-tag tag-one"><CheckCircle2 size={16}/> Ready for review</span><span className="art-tag tag-two"><CalendarDays size={16}/> A day, beautifully planned</span></div></section>
 <div className="section-heading"><div><h2>Your content pipeline</h2><p>A clear path from first draft to published story.</p></div><button className="text-btn" onClick={() => go('Content library')}>Open library <ArrowRight size={15}/></button></div><div className="pipeline">{[['Drafts', 'draft', FileText], ['In review', 'review', ShieldCheck], ['Approved', 'approved', CheckCircle2], ['Planned', 'planned', CalendarDays]].map(([title, key, Icon]: any, i) => <button key={key} onClick={() => { go('Content library'); setStatus(key); }}><span className={'pipeline-icon p' + i}><Icon size={18}/></span><span><b>{title}</b><small>{counted(key)} stories</small></span><ArrowUpRight size={16}/></button>)}</div>
 <div className="overview-bottom"><section className="panel"><div className="section-head"><h3>Next in your calendar</h3><button className="text-btn" onClick={() => go('Calendar')}>View calendar <ArrowUpRight size={14}/></button></div>{posts.some(p => ['planned', 'scheduled'].includes(p.status)) ? posts.filter(p => ['planned', 'scheduled'].includes(p.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3).map(p => <button className="upcoming-row" key={p.id} onClick={() => setEditing({ ...p })}><span className="time-box">{p.time}<small>IST</small></span><span><b>{p.title}</b><small>{p.date} · {statusLabels[p.status]}</small></span><ChevronRight size={16}/></button>) : <div className="calendar-empty"><CalendarDays size={30}/><div><b>A little space for your next big story.</b><p>Approved posts will find their place here.</p></div><button className="btn" onClick={() => go('Calendar')}>Plan your day</button></div>}</section><section className="panel connection-card"><div className="section-head"><h3>Publishing connection</h3><span className={'dot ' + (snapshot?.connection ? 'connected' : '')}/></div><div className="facebook-row"><span className="facebook-icon">f</span><div><b>{snapshot?.connection?.page_name || 'Facebook Page'}</b><p>{snapshot?.connection ? 'Connected · verify health in Integrations' : 'Ready to connect when you are'}</p></div></div><button className="text-btn" onClick={() => go('Integrations')}>{snapshot?.connection ? 'Manage connection' : 'Set up publishing'} <ArrowRight size={15}/></button></section></div></>}
 {view === 'Import content' && <Importer workspace={workspace} upload={upload} notify={notify} onImport={async (p) => { if (!await action('import', { posts: p }))
            throw new Error('Import not saved. Review the error and try again.'); }}/>}
 {(view === 'Content library' || view === 'Poster studio') && <><div className="page-heading"><div><span className="eyebrow">{view === 'Poster studio' ? 'DESIGNED FOR YOUR CITY' : 'THE HEART OF YOUR NEWSROOM'}</span><h1>{view === 'Poster studio' ? 'Make every story stand out.' : 'Your content, all together.'}</h1><p>{view === 'Poster studio' ? 'Branded templates, editable headlines and beautiful Hindi typography.' : 'Review, refine and prepare your next edition.'}</p></div><div className="button-row"><button className="btn" disabled={busy} onClick={() => void exportPack()}><Download size={16}/> Export pack</button>{canEdit && <button className="btn primary" onClick={() => { setEditing(freshPost({ title: '', color: data.brand.color })); }}><Plus size={16}/> New story</button>}</div></div><div className="tabs"><button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>All content <b>{posts.length}</b></button>{(['draft', 'review', 'approved', 'planned', 'published'] as const).map(s => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{statusLabels[s]} <b>{counted(s)}</b></button>)}</div><div className="filterbar"><div className="search-input"><Search size={17}/><input aria-label="Search stories" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search headlines, captions or sources…"/></div><select aria-label="Filter category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{Array.from(new Set(posts.map(p => p.category))).map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(s => <option value={s} key={s}>{statusLabels[s]}</option>)}</select><div className="segmented compact"><button aria-label="Grid view" className={!list ? 'active' : ''} onClick={() => setList(false)}><Grid2X2 size={17}/></button><button aria-label="List view" className={list ? 'active' : ''} onClick={() => setList(true)}><List size={17}/></button></div></div>{filtered.length > 0 && <div className="selection-bar"><label><input type="checkbox" checked={filtered.every(p => selected.includes(p.id))} onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])}/> {selected.length ? `${selected.length} selected` : 'Select all'}</label>{selected.length > 0 && <div className="button-row">{canEdit && <><button onClick={() => void action('review', { ids: selected })}>Send to review</button><button onClick={() => setModal('bulk')}>Bulk edit</button><button onClick={() => setModal('copy')}>Copy to city</button></>}{canPublish && <><button onClick={() => void action('approve', { ids: selected })}><CheckCircle2 size={14}/> Approve</button><button onClick={() => setModal('schedule')}><CalendarDays size={14}/> Schedule</button></>}<button onClick={() => void exportPack()}><Download size={14}/> Export</button>{canEdit && <button className="danger-text" onClick={() => setModal('delete')}><Trash2 size={14}/> Delete</button>}</div>}</div>}{filtered.length ? list ? <div className="panel table-scroll"><table><thead><tr><th>Story</th><th>Status</th><th>Category</th><th>Scheduled · IST</th><th>Source</th><th /></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><div className="table-story"><input aria-label={`Select ${p.title}`} type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)}/>{p.media && <img src={'/api/assets?id=' + p.media} alt=""/>}<button onClick={() => setEditing({ ...p })}>{p.title}</button></div></td><td><span className={'status ' + p.status}>{statusLabels[p.status]}</span></td><td>{p.category}</td><td>{p.time ? p.date + ' ' + p.time : '—'}</td><td>{p.source || 'Missing source'}</td><td><button className="icon-btn" aria-label="Edit story" onClick={() => setEditing({ ...p })}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table></div> : <div className="post-grid">{filtered.map(p => view === 'Poster studio' ? <article className="post-card" key={p.id}><button className="poster-button" onClick={() => setEditing({ ...p })}><Poster post={p} brand={data.brand}/></button><div className="post-card-body"><h3>{p.title}</h3><button className="text-btn" onClick={() => setEditing({ ...p })}>Customize poster <ArrowRight size={15}/></button></div></article> : postCard(p))}</div> : <Empty title={posts.length ? 'No matching stories' : 'Your next edition starts here'} description={posts.length ? 'Try a different search or filter.' : 'Import your Meta AI ZIP and captions, or create your first story manually.'} action={<button className="btn primary" onClick={() => go('Import content')}><UploadCloud size={17}/> Import content pack</button>}/>}</>}
 {view === 'Calendar' && <><div className="page-heading"><div><span className="eyebrow">A LITTLE PLANNING GOES A LONG WAY</span><h1>A clear view of your day.</h1><p>Space out your stories. Make room for what matters.</p></div><div className="button-row"><button className="btn" disabled={!canPublish || busy} onClick={() => void action('pause', { paused: !data.paused })}>{data.paused ? <Play size={16}/> : <Pause size={16}/>} {data.paused ? 'Resume submissions' : 'Pause submissions'}</button><button className="btn primary" disabled={!canPublish} onClick={() => { setSelected(posts.filter(p => p.status === 'approved').map(p => p.id)); setModal('schedule'); }}><Plus size={16}/> Plan approved posts</button></div></div>{data.paused && <div className="notice warning"><Pause size={20}/><p>Local submissions are paused. Previously submitted Facebook schedules remain active; cancel them individually if needed.</p></div>}<div className="calendar-toolbar"><div className="button-row"><button className="icon-btn" aria-label="Previous month" onClick={() => { const d = new Date(calendarDate + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setCalendarDate(d.toISOString().slice(0, 10)); }}><ChevronLeft size={19}/></button><h2>{new Date(calendarDate + 'T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><button className="icon-btn" aria-label="Next month" onClick={() => { const d = new Date(calendarDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); setCalendarDate(d.toISOString().slice(0, 10)); }}><ChevronRight size={19}/></button><button className="btn" onClick={() => setCalendarDate(today())}>Today</button></div><div className="segmented"><button className={calendarMode === 'month' ? 'active' : ''} onClick={() => setCalendarMode('month')}>Month</button><button className={calendarMode === 'agenda' ? 'active' : ''} onClick={() => setCalendarMode('agenda')}>Agenda</button></div></div>{calendarMode === 'month' ? <div className="calendar-grid">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <div className="day-name" key={d}>{d}</div>)}{Array.from({ length: 42 }, (_, i) => { const first = new Date(calendarDate.slice(0, 7) + '-01T12:00:00'); const offset = (first.getDay() + 6) % 7; const d = new Date(first); d.setDate(i - offset + 1); const day = d.toISOString().slice(0, 10); const dayPosts = posts.filter(p => p.date === day && p.time); return <div key={day} className={'calendar-cell ' + (day.slice(0, 7) !== calendarDate.slice(0, 7) ? 'outside ' : '') + (day === today() ? 'today' : '')}><span className="day-number">{d.getDate()}</span>{dayPosts.slice(0, 3).map(p => <button className={'calendar-post ' + p.status} key={p.id} onClick={() => setEditing({ ...p })}><i />{p.time} <span>{p.title}</span></button>)}{dayPosts.length > 3 && <button className="text-btn" onClick={() => { setCalendarDate(day); setCalendarMode('agenda'); }}>+{dayPosts.length - 3} more</button>}</div>; })}</div> : <section className="panel">{posts.filter(p => p.time && p.date.startsWith(calendarDate.slice(0, 7))).length ? posts.filter(p => p.time && p.date.startsWith(calendarDate.slice(0, 7))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(p => <div className="agenda-row" key={p.id}><span>{p.date}<b>{p.time} IST</b></span><button onClick={() => setEditing({ ...p })}>{p.title}</button><span className={'status ' + p.status}>{statusLabels[p.status]}</span>{p.status === 'planned' && <button className="btn" disabled={!canPublish || busy} onClick={() => { setEditing({ ...p }); setModal('publish'); }}>Submit to Facebook</button>}{p.status === 'planned' && <button className="text-btn" disabled={!canPublish || busy} onClick={() => void action('unschedule', { ids: [p.id] })}>Remove plan</button>}{['scheduled', 'unknown'].includes(p.status) && <button className="btn" disabled={busy || !canPublish} onClick={() => void publish(p, 'reconcile')}>Verify status</button>}</div>) : <Empty title="A fresh calendar" description="Plan approved stories to see them here."/>}</section>}<div className="legend"><span><i className="draft"/> Draft</span><span><i className="planned"/> Planned locally</span><span><i className="scheduled"/> Confirmed on Facebook</span><span><i className="published"/> Published</span></div><div className="notice"><AlertCircle size={20}/><p>Local plans are saved in Newsdesk. Submit them to Facebook to enable unattended publishing. Newsdesk never marks a local plan as published.</p></div></>}
 {view === 'Source library' && <><div className="page-heading"><div><span className="eyebrow">EVERY STORY STARTS SOMEWHERE</span><h1>Your source of truth.</h1><p>Keep newspaper pages, original images and evidence close to every story.</p></div><label className="btn primary"><UploadCloud size={16}/> Upload sources<input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={async (e) => { const files = Array.from(e.target.files || []); setBusy(true); try {
            for (const f of files)
                await upload(f);
            await load();
            notify(`${files.length} sources uploaded`);
        }
        catch (e) {
            notify((e as Error).message);
        }
        finally {
            setBusy(false);
        } }}/></label></div><div className="notice"><ShieldCheck size={22}/><div><b>Preserve the evidence. Write your own story.</b><p>Store sources you have rights to use. Check names, numbers and dates before approving a draft.</p></div></div>{assets.length ? <div className="asset-grid">{assets.map(a => <article className="asset-card" key={a.id}><a href={'/api/assets?id=' + a.id} target="_blank" rel="noreferrer">{a.type.startsWith('image') ? <img src={'/api/assets?id=' + a.id} alt={a.name}/> : <div className="pdf-preview"><FileText size={42}/><b>PDF DOCUMENT</b></div>}</a><div><h3 title={a.name}>{a.name}</h3><p>{(a.size / 1024).toFixed(0)} KB · {new Date(a.created_at).toLocaleDateString('en-IN')}</p><button className="text-btn" disabled={!canEdit} onClick={() => setEditing(freshPost({ sourceMedia: a.id, source: a.name, color: data.brand.color, title: '' }))}>Write from source <ArrowRight size={13}/></button><button className="btn" disabled={busy || !canEdit} onClick={() => void ai('extract', a.id)}><Sparkles size={14}/>{integrations.ai ? 'Extract stories' : 'Extract · AI setup needed'}</button></div></article>)}</div> : <Empty title="Build your source library" description="Upload newspaper PDFs, photos and original reporting. AI extraction can be enabled when your API is connected."/>}</>}
 {view === 'Analytics' && <><div className="page-heading"><div><span className="eyebrow">KNOW YOUR NEWSROOM</span><h1>A little perspective.</h1><p>Real workflow numbers, without invented reach or engagement.</p></div><button className="btn" onClick={() => { download(new Blob([['status,count', ...statuses.map(s => `${s},${counted(s)}`)].join('\n')], { type: 'text/csv' }), 'newsdesk-workflow.csv'); }}><Download size={16}/> Export report</button></div><div className="stats-grid">{[['Total stories', posts.length], ['Approval rate', posts.length ? Math.round(counted('approved', 'planned', 'scheduled', 'published') / posts.length * 100) + '%' : '—'], ['Confirmed published', counted('published')], ['Needs attention', counted('failed', 'unknown')]].map(([t, v]) => <div className="stat-card" key={t}><span>{t}</span><strong>{v}</strong><p>Current workspace</p></div>)}</div><div className="two-col"><section className="panel"><h3>Content by category</h3><div className="bar-chart">{Array.from(new Set(posts.map(p => p.category))).map(c => <div key={c}><span>{c}</span><div><i style={{ width: `${posts.filter(p => p.category === c).length / Math.max(1, posts.length) * 100}%` }}/></div><b>{posts.filter(p => p.category === c).length}</b></div>)}{!posts.length && <Empty title="Your insights will grow here" description="Add your first stories to see the distribution."/>}</div></section><section className="panel"><h3>Workflow health</h3>{statuses.filter(s => counted(s) > 0).map(s => <div className="metric-row" key={s}><span className={'status ' + s}>{statusLabels[s]}</span><b>{counted(s)}</b></div>)}<div className="notice"><BarChart3 size={20}/><p>Facebook reach, impressions and engagement require a connected Page and verified metric access. No estimates are shown as real data.</p></div></section></div></>}
 {view === 'Team & activity' && <><div className="page-heading"><div><span className="eyebrow">BETTER STORIES, TOGETHER</span><h1>Your newsroom team.</h1><p>Clear roles. A record of every important decision.</p></div>{owner && <button className="btn primary" onClick={() => setModal('member')}><Plus size={16}/> Add member</button>}</div><div className="two-col"><section className="panel"><div className="section-head"><h3>Workspace members</h3><span className="badge">{(snapshot?.members.length || 0) + 1} members</span></div><div className="member-row"><span className="user-avatar">{user.name.slice(0, 1)}</span><div><b>{owner ? user.email : 'Workspace owner'}</b><small>{owner ? 'You · full access' : 'Owner account'}</small></div><span className="badge">Owner</span></div>{snapshot?.members.map(m => <div className="member-row" key={m.id}><span className="user-avatar">{m.email[0].toUpperCase()}</span><div><b>{m.email}</b><small>Workspace access granted</small></div><span className="badge">{m.role}</span>{owner && <button className="icon-btn" aria-label={'Remove ' + m.email} onClick={() => void action('removeMember', { memberId: m.id })}><X size={15}/></button>}</div>)}<p className="help-text">Members must also be allowed by the site’s sharing policy. Adding a role does not send an email or change private site access.</p><div className="role-guide"><p><b>Editor</b> Import, create and edit stories</p><p><b>Publisher</b> Review, approve and submit posts</p><p><b>Viewer</b> Read content and export packs</p></div></section><section className="panel"><h3>Recent activity</h3><div className="activity-list">{snapshot?.events.length ? snapshot.events.map(e => <div key={e.id}><span className="activity-dot"/><div><b>{e.action}</b><p>{e.actor}</p><small>{new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</small></div></div>) : <Empty title="A fresh start" description="Imports, approvals and publishing events will appear here."/>}</div></section></div></>}
 {view === 'Integrations' && <><div className="page-heading"><div><span className="eyebrow">YOUR WORKFLOW, CONNECTED</span><h1>Bring your tools together.</h1><p>The newsroom works now. Connect services when you’re ready.</p></div><button className="btn" onClick={() => setModal('help')}><HelpCircle size={16}/> Setup guide</button></div><div className="integration-grid"><section className="panel integration"><span className="facebook-icon">f</span><span className={'badge ' + (snapshot?.connection ? 'green' : '')}>{snapshot?.connection ? 'Connected' : 'Not connected'}</span><h2>Facebook Pages</h2><p>Publish approved stories and hand scheduled posts to Facebook for delivery.</p><ul><li><Check size={14}/> Encrypted Page access tokens</li><li><Check size={14}/> Native scheduling & verification</li><li><Check size={14}/> Cancel schedules and track outcomes</li></ul>{snapshot?.connection ? <><p className="connected-name">{snapshot.connection.page_name} · {snapshot.connection.page_id}</p><div className="button-row"><button className="btn" disabled={!owner} onClick={async () => { try {
            const r = await request('/api/integrations', { id: workspace, action: 'health' });
            notify(r.message);
        }
        catch (e) {
            notify((e as Error).message);
        } }}>Check connection</button><button className="text-btn danger-text" disabled={!owner} onClick={() => setModal('disconnect')}>Disconnect</button></div></> : <button className="btn primary" disabled={!owner} onClick={() => setModal('connect')}>Connect a Page <ArrowRight size={15}/></button>}<small>{integrations.meta ? 'Server configuration ready' : 'Server needs API version and encryption key before connecting.'}</small></section><section className="panel integration"><span className="integration-symbol"><Sparkles size={27}/></span><span className={'badge ' + (integrations.ai ? 'green' : '')}>{integrations.ai ? 'Configured' : 'Not connected'}</span><h2>AI editorial assistant</h2><p>Extract stories from source documents and draft Hindi captions for your review.</p><ul><li><Check size={14}/> Newspaper image & PDF extraction</li><li><Check size={14}/> City-specific story drafts</li><li><Check size={14}/> Evidence warnings and human approval</li></ul><button className="btn" onClick={() => go('Source library')}>Open source library <ArrowRight size={15}/></button><small>Configure GEMINI_API_KEY and GEMINI_MODEL, or a custom AI service. Existing Meta AI packs need no AI API.</small></section><section className="panel integration"><span className="integration-symbol tan"><FileArchive size={27}/></span><span className="badge green">Ready to use</span><h2>Meta AI content packs</h2><p>Bring the files you already have. No API or special account connection needed.</p><ul><li><Check size={14}/> ZIP images + CSV or TXT</li><li><Check size={14}/> Preview and fix image matches</li><li><Check size={14}/> Portable downloads and re-import</li></ul><button className="btn" onClick={() => go('Import content')}>Import a pack <ArrowRight size={15}/></button></section></div><div className="notice"><ShieldCheck size={22}/><p>API secrets stay on the server. Only authorized publishers can submit approved content. External features report their real connection status.</p></div></>}
 {view === 'Brand settings' && brand && <><div className="page-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h1>A recognizable voice.</h1><p>Give every story the unmistakable feel of {data.brand.name}.</p></div><button className="btn primary" disabled={busy || !owner} onClick={() => void action('brand', { brand })}><Check size={16}/> Save brand settings</button></div><div className="two-col settings-layout"><section className="panel"><h3>Workspace identity</h3><div className="form-grid"><Field label="Publication name"><input value={brand.name} onChange={e => setBrand({ ...brand, name: e.target.value })}/></Field><Field label="City"><input value={brand.city} onChange={e => setBrand({ ...brand, city: e.target.value })}/></Field><Field label="Brand initials"><input maxLength={4} value={brand.initials} onChange={e => setBrand({ ...brand, initials: e.target.value })}/></Field><Field label="Brand color"><div className="color-field"><input type="color" value={brand.color} onChange={e => setBrand({ ...brand, color: e.target.value })}/><span>{brand.color}</span></div></Field></div><Field label="Default disclaimer" hint="A disclaimer does not replace permission to reuse content."><textarea rows={3} value={brand.disclaimer} onChange={e => setBrand({ ...brand, disclaimer: e.target.value })}/></Field><h3 className="section-divider">Default schedule</h3><div className="form-grid"><Field label="First post"><input type="time" value={brand.start} onChange={e => setBrand({ ...brand, start: e.target.value })}/></Field><Field label="Last post"><input type="time" value={brand.end} onChange={e => setBrand({ ...brand, end: e.target.value })}/></Field></div><p className="help-text">Timezone: Asia/Kolkata · UTC +05:30. All displayed times and schedule exports use IST.</p><button className="btn" onClick={() => setModal('workspace')}><Plus size={15}/> Create another city workspace</button></section><section className="panel brand-preview"><span className="eyebrow">YOUR BRAND PREVIEW</span><Poster post={freshPost({ title: 'आपके शहर की खबर, आपकी आवाज़।', category: 'Brand preview', source: 'Example layout · not a news story', color: brand.color })} brand={brand} large/><p>Your brand, consistently applied.<br />Final posters are rendered at 1080 × 1080.</p></section></div></>}
 {view === 'Analytics' && <section className="panel" style={{ marginTop: 24 }}><div className="section-head"><div><h3>Facebook engagement</h3><p>Verified counts for up to 20 published stories. Unavailable values remain blank.</p></div><button className="btn" disabled={busy || !snapshot?.connection} onClick={async () => { setBusy(true); try {
            setMetrics(await request('/api/metrics?workspace=' + workspace));
        }
        catch (e) {
            notify((e as Error).message);
        }
        finally {
            setBusy(false);
        } }}><RefreshCw size={14}/> Refresh metrics</button></div>{metrics?.rows?.length ? <div className="table-scroll"><table><thead><tr><th>Story</th><th>Reactions</th><th>Comments</th><th>Shares</th></tr></thead><tbody>{metrics.rows.map((r: any) => <tr key={r.id}><td>{r.title}{r.error && <small className="warning">{r.error}</small>}</td><td>{r.reactions ?? '—'}</td><td>{r.comments ?? '—'}</td><td>{r.shares ?? '—'}</td></tr>)}</tbody></table></div> : <p className="help-text">{snapshot?.connection ? 'Publish a story and refresh to request available engagement counts.' : 'Connect a Facebook Page to request live engagement counts.'}</p>}</section>}
 </>}</main><footer className="app-footer"><span>newsdesk<span>.</span> <i /> Made for the stories that matter.</span><span>Local plans stay local until submitted to Facebook.</span></footer></div>
 {toast && <div className="toast" role="status"><AlertCircle size={18}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
 {editing && !['publish'].includes(modal) && <Editor post={editing} brand={data.brand} assets={assets} existing={posts.some(p => p.id === editing.id)} busy={busy} canEdit={canEdit} canPublish={canPublish} notify={notify} upload={upload} onClose={() => setEditing(null)} onSave={async (p) => { const ok = await action(posts.some(x => x.id === p.id) ? 'edit' : 'import', posts.some(x => x.id === p.id) ? { post: p } : { posts: [p] }); if (ok)
        setEditing(null); }} onApprove={async (p) => { if (await action('approve', { ids: [p.id] }))
        setEditing(null); }} onPublish={p => { setEditing(p); setModal('publish'); }} onCancel={p => void publish(p, 'cancel')} onVerify={p => void publish(p, 'reconcile')} onDuplicate={async (p) => { if (await action('import', { posts: [{ ...p, title: p.title + ' · revised' }] }))
        setEditing(null); }} onAI={p => void ai('rewrite', undefined, p.caption)}/>}
 {modal === 'schedule' && <Modal title="Plan your edition" onClose={() => setModal('')}><p className="help-text">{selected.length} selected stories. Only approved content versions can be scheduled. Plans remain local until submitted.</p><div className="form-grid"><Field label="Publication date"><input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}/></Field><Field label="Timezone"><input readOnly value="Asia/Kolkata (IST)"/></Field><Field label="First post"><input type="time" value={start} onChange={e => setStart(e.target.value)}/></Field><Field label="Last post"><input type="time" value={end} onChange={e => setEnd(e.target.value)}/></Field></div><div className="slot-preview">{(() => { try {
        return distribute(selected.length, start, end).map((t, i) => <span key={i}>{t}</span>);
    }
    catch {
        return <p>Widen the time window to fit your posts.</p>;
    } })()}</div><div className="modal-actions"><button className="btn" onClick={() => setModal('')}>Cancel</button><button className="btn primary" disabled={busy || !selected.length} onClick={async () => { if (await action('plan', { ids: selected, date: scheduleDate, start, end })) {
        setModal('');
        setView('Calendar');
    } }}>Save local schedule <ArrowRight size={16}/></button></div></Modal>}
 {modal === 'delete' && <Modal title="Delete selected drafts?" onClose={() => setModal('')}><p>{selected.length} selected items will be removed from this workspace. Remote or published deliveries cannot be deleted here.</p><div className="modal-actions"><button className="btn" onClick={() => setModal('')}>Keep drafts</button><button className="btn danger" disabled={busy} onClick={async () => { if (await action('delete', { ids: selected })) {
        setSelected([]);
        setModal('');
    } }}>Delete drafts</button></div></Modal>}
 {modal === 'member' && <Modal title="Add a team member" onClose={() => setModal('')}><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await action('member', { email: f.get('email'), role: f.get('role') }))
        setModal(''); }}><Field label="Email address"><input name="email" type="email" required placeholder="editor@example.com"/></Field><Field label="Workspace role"><select name="role"><option value="editor">Editor — create and edit</option><option value="publisher">Publisher — approve and publish</option><option value="viewer">Viewer — read only</option></select></Field><p className="help-text">This grants a workspace role. Site access must also be shared with their account. No email will be sent.</p><div className="modal-actions"><button className="btn primary" disabled={busy}>Add member</button></div></form></Modal>}
 {modal === 'choosePage' && <Modal title="Select a Facebook Page" onClose={() => setModal('')}><p className="help-text">Choose the Page this city workspace will publish to. The other Pages remain unchanged.</p>{pageChoices.map(p => <button className="upcoming-row" key={p.id} onClick={async () => { setBusy(true); try {
        const r = await request('/api/facebook/pages', { session: connectSession, pageId: p.id });
        setWorkspace(r.workspace);
        await load(r.workspace);
        setModal('');
        notify('Facebook Page connected');
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }} disabled={busy}><span className="facebook-icon">f</span><span><b>{p.name}</b><small>{p.id}</small></span><ArrowRight size={16}/></button>)}</Modal>}
 {modal === 'connect' && <Modal title="Connect your Facebook Page" onClose={() => setModal('')}>{integrations.oauth && <a className="btn primary" target="_top" href={'/api/facebook/start?workspace=' + workspace}>Continue with Facebook <ArrowUpRight size={15}/></a>}<p className="help-text">Use Facebook authorization above when configured, or connect with a Page access token after your Meta app and server secrets are ready. Token values are encrypted server-side and never returned to the browser.</p><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); try {
        const r = await request('/api/integrations', { id: workspace, pageId: f.get('pageId'), token: f.get('token') });
        notify(r.message);
        setModal('');
        await load();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}><Field label="Facebook Page ID"><input name="pageId" required inputMode="numeric" pattern="[0-9]+" placeholder="Your numeric Page ID"/></Field><Field label="Page access token"><input name="token" type="password" autoComplete="off" required placeholder="Paste securely when ready"/></Field>{!integrations.meta && <div className="notice warning"><AlertCircle size={20}/><p>Configure META_API_VERSION and TOKEN_ENCRYPTION_KEY on the server first. You can continue preparing content now.</p></div>}<div className="modal-actions"><button className="btn primary" disabled={busy || !integrations.meta}>Verify & connect</button></div></form></Modal>}
 {modal === 'disconnect' && <Modal title="Disconnect this Page?" onClose={() => setModal('')}><p>The stored token will be removed. Schedules already submitted to Facebook remain active.</p><div className="modal-actions"><button className="btn" onClick={() => setModal('')}>Keep connection</button><button className="btn danger" onClick={async () => { try {
        const r = await request('/api/integrations', { id: workspace, action: 'disconnect' });
        notify(r.message);
        await load();
        setModal('');
    }
    catch (e) {
        notify((e as Error).message);
    } }}>Disconnect</button></div></Modal>}
 {modal === 'publish' && editing && <Modal title="Submit to Facebook" onClose={() => setModal('')}><div className="notice"><Send size={20}/><p>Destination: <b>{snapshot?.connection?.page_name || 'No Page connected'}</b>. This is a real external publishing action when connected.</p></div><h3>{editing.title}</h3><p>{editing.date} · {editing.time || 'No time assigned'} IST</p><p className="help-text">Native scheduling accepts times 20 minutes to 29 days ahead in this application. Publish now sends the post immediately.</p><div className="modal-actions"><button className="btn" disabled={busy || !snapshot?.connection} onClick={() => void publish(editing, 'now')}>Publish now</button><button className="btn primary" disabled={busy || !snapshot?.connection || !editing.time} onClick={() => void publish(editing, 'schedule')}>Submit schedule</button></div></Modal>}
 {modal === 'workspace' && <Modal title="Create a city workspace" onClose={() => setModal('')}><Field label="Publication name"><input value={newName} onChange={e => setNewName(e.target.value)}/></Field><Field label="City"><input value={newCity} onChange={e => setNewCity(e.target.value)}/></Field><div className="modal-actions"><button className="btn primary" disabled={!newName.trim() || !newCity.trim()} onClick={async () => { try {
        const r = await request('/api/workspace', { action: 'createWorkspace', name: newName, city: newCity });
        setWorkspaces([...workspaces, { id: r.id, name: newName }]);
        setWorkspace(r.id);
        await load(r.id);
        setModal('');
    }
    catch (e) {
        notify((e as Error).message);
    } }}>Create workspace</button></div></Modal>}
 {modal === 'ai' && <Modal title="Review AI story candidates" wide onClose={() => setModal('')}><p className="help-text">These are unverified drafts. Review against the original source before approval.</p>{aiStories.map((s, i) => <div className="candidate" key={i}><input aria-label="Candidate headline" value={s.title} onChange={e => setAiStories(aiStories.map((x, j) => i === j ? { ...x, title: e.target.value } : x))}/><textarea aria-label="Candidate caption" value={s.caption} onChange={e => setAiStories(aiStories.map((x, j) => i === j ? { ...x, caption: e.target.value } : x))}/><small>{s.warnings?.join(' · ')}</small><button className="text-btn danger-text" onClick={() => setAiStories(aiStories.filter((_, j) => j !== i))}>Discard candidate</button></div>)}<div className="modal-actions"><button className="btn primary" disabled={busy || !aiStories.length} onClick={async () => { if (await action('import', { posts: aiStories })) {
        setModal('');
        setEditing(null);
        go('Content library');
    } }}>Import {aiStories.length} drafts</button></div></Modal>}
 {modal === 'bulk' && <Modal title="Append text to selected captions" onClose={() => setModal('')}><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await action('bulkEdit', { ids: selected, text: f.get('text') }))
        setModal(''); }}><Field label="Text to append" hint="All edits are saved together and reset approval. Scheduled/published content is protected."><textarea name="text" required rows={4} defaultValue={data.brand.disclaimer}/></Field><div className="modal-actions"><button className="btn primary" disabled={busy}>Update {selected.length} captions</button></div></form></Modal>}
 {modal === 'copy' && <Modal title="Copy stories to another city" onClose={() => setModal('')}><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await action('copy', { ids: selected, target: f.get('target') }))
        setModal(''); }}><p className="help-text">Copy the selected content and its assets to a separate city workspace. Copies are drafts and must be reviewed for local relevance before approval.</p><Field label="Destination workspace"><select name="target" required>{workspaces.filter(w => w.id !== workspace).map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select></Field><div className="modal-actions"><button className="btn primary" disabled={busy || workspaces.length < 2}>Copy {selected.length} stories</button></div></form></Modal>}
 {modal === 'help' && <Modal title="Your newsroom, in six steps" onClose={() => setModal('')}><div className="guide">{[['Import', 'Upload a ZIP of images with CSV or TXT captions. Match files before importing.'], ['Review', 'Check the image, facts, caption and source. All imports begin as drafts.'], ['Design', 'Use the poster studio if you need a new branded layout. Existing posters can stay as they are.'], ['Approve', 'A publisher approves the current version. Edits reset that approval.'], ['Plan', 'Distribute approved posts between your first and last slot, in IST.'], ['Publish', 'After connecting a Page, submit schedules to Facebook and verify delivery.']].map(([a, b], i) => <div key={a}><b>{i + 1}</b><p><strong>{a}</strong>{b}</p></div>)}</div><a className="btn" href="/api-requirements.txt" download><Download size={15}/> Download API setup checklist</a></Modal>}
 </div>;
}
function Editor({ post, brand, assets, existing, busy, canEdit, canPublish, notify, upload, onClose, onSave, onApprove, onPublish, onCancel, onVerify, onDuplicate, onAI }: {
    post: Post;
    brand: Brand;
    assets: Asset[];
    existing: boolean;
    busy: boolean;
    canEdit: boolean;
    canPublish: boolean;
    notify: (s: string) => void;
    upload: (f: File) => Promise<string>;
    onClose: () => void;
    onSave: (p: Post) => Promise<void>;
    onApprove: (p: Post) => Promise<void>;
    onPublish: (p: Post) => void;
    onCancel: (p: Post) => void;
    onVerify: (p: Post) => void;
    onDuplicate: (p: Post) => void;
    onAI: (p: Post) => void;
}) {
    const [draft, setDraft] = useState<Post>({ ...post }), [tab, setTab] = useState('Content'), [rendering, setRendering] = useState(false), [changed, setChanged] = useState(false);
    const locked = ['scheduled', 'published', 'submitting', 'unknown'].includes(post.status);
    const edit = (values: Partial<Post>) => { setDraft({ ...draft, ...values }); setChanged(true); };
    return <Modal title={existing ? 'Story workspace' : 'Create a story'} wide onClose={onClose}><div className="editor-layout"><div className="editor-preview"><div className="section-head"><span className="eyebrow">{tab === 'Design' ? 'POSTER PREVIEW' : 'YOUR POST'}</span><span className={'status ' + post.status}>{statusLabels[post.status]}</span></div>{tab === 'Design' ? <Poster post={draft} brand={brand} large/> : draft.media ? <img className="editor-image" src={'/api/assets?id=' + draft.media} alt={draft.title}/> : <Poster post={draft} brand={brand} large/>}<p className="help-text">{tab === 'Design' ? 'Template preview. Render to make this design the publishing image.' : 'This is the actual image attached to the post.'}</p>{tab === 'Design' && <div className="button-row"><button className="btn" disabled={rendering} onClick={async () => { setRendering(true); try {
        download(await renderPoster(draft, brand), 'newsdesk-poster.jpg');
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setRendering(false);
    } }}><Download size={15}/> Download JPEG</button><button className="btn primary" disabled={rendering || locked || !canEdit} onClick={async () => { setRendering(true); try {
        const blob = await renderPoster(draft, brand);
        const id = await upload(new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
        edit({ media: id });
        setTab('Content');
        notify('Rendered poster attached. Save the story to keep it.');
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setRendering(false);
    } }}>{rendering ? 'Rendering…' : 'Use this design'}</button></div>}{post.error && <div className="notice warning"><AlertCircle size={18}/><p>{post.error}</p></div>}{post.remoteId && <small className="help-text">Remote ID: {post.remoteId}</small>}{post.permalink && <a className="btn" href={post.permalink} target="_blank" rel="noreferrer">View on Facebook <ExternalLink size={15}/></a>}</div><div><div className="tabs editor-tabs">{['Content', 'Design', 'Evidence', 'History'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>{tab === 'Content' && <><Field label="Headline"><input value={draft.title} disabled={locked || !canEdit} onChange={e => edit({ title: e.target.value })} placeholder="What’s the story?"/></Field><Field label="Caption"><textarea rows={7} value={draft.caption} disabled={locked || !canEdit} onChange={e => edit({ caption: e.target.value })} placeholder="Write your caption in Hindi or English…"/></Field><div className="caption-actions"><span>{draft.caption.length} characters</span><button className="text-btn" disabled={locked || !canEdit} onClick={() => onAI(draft)}><Sparkles size={13}/> AI draft</button><button className="text-btn" disabled={locked || !canEdit || !brand.disclaimer} onClick={() => edit({ caption: draft.caption + '\n\n' + brand.disclaimer })}>+ Disclaimer</button></div><div className="form-grid"><Field label="Category"><select disabled={locked || !canEdit} value={draft.category} onChange={e => edit({ category: e.target.value })}>{['City news', 'Civic', 'Transport', 'Culture', 'Education', 'Business', 'Weather', 'Public safety'].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Image"><select disabled={locked || !canEdit} value={draft.media} onChange={e => edit({ media: e.target.value })}><option value="">Choose image</option>{assets.filter(a => a.type.startsWith('image')).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}{draft.media && !assets.some(a => a.id === draft.media) && <option value={draft.media}>Newly uploaded image</option>}</select></Field></div><label className="btn"><UploadCloud size={15}/> Upload image<input hidden type="file" accept=".jpg,.jpeg,.png,.webp" disabled={locked || !canEdit} onChange={async (e) => { const f = e.target.files?.[0]; if (f)
        try {
            edit({ media: await upload(f) });
        }
        catch (e) {
            notify((e as Error).message);
        } }}/></label><div className="form-grid"><Field label="Date"><input type="date" disabled={locked || !canEdit} value={draft.date} onChange={e => edit({ date: e.target.value })}/></Field><Field label="Time · IST"><input type="time" disabled={locked || !canEdit} value={draft.time} onChange={e => edit({ time: e.target.value })}/></Field></div></>}{tab === 'Design' && <><Field label="Poster style"><div className="template-options">{[['editorial', 'Editorial', 'Bold & atmospheric'], ['minimal', 'Minimal', 'Clean & considered'], ['bulletin', 'Bulletin', 'Direct & distinctive']].map(([id, name, desc]) => <button disabled={locked || !canEdit} key={id} className={draft.template === id ? 'active' : ''} onClick={() => edit({ template: id })}><span className={'template-thumb ' + id}>Aa</span><b>{name}</b><small>{desc}</small></button>)}</div></Field><Field label="Headline"><textarea rows={3} value={draft.title} disabled={locked || !canEdit} onChange={e => edit({ title: e.target.value })}/></Field><Field label="Accent color"><input type="color" disabled={locked || !canEdit} value={draft.color} onChange={e => edit({ color: e.target.value })}/></Field><div className="notice"><Palette size={20}/><p>Original imported posters remain intact until you select “Use this design.” Final export: 1080 × 1080 JPEG.</p></div></>}{tab === 'Evidence' && <><Field label="Source / publisher" hint="Required before approval. Attribution alone does not grant reuse rights."><input disabled={locked || !canEdit} value={draft.source} onChange={e => edit({ source: e.target.value })} placeholder="Original reporting or publisher"/></Field><div className="form-grid"><Field label="Source date"><input type="date" disabled={locked || !canEdit} value={draft.sourceDate} onChange={e => edit({ sourceDate: e.target.value })}/></Field><Field label="Page / reference"><input disabled={locked || !canEdit} value={draft.sourcePage} onChange={e => edit({ sourcePage: e.target.value })} placeholder="Page 4, column 2"/></Field></div><Field label="Evidence document"><select disabled={locked || !canEdit} value={draft.sourceMedia} onChange={e => edit({ sourceMedia: e.target.value })}><option value="">Select a source</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>{draft.sourceMedia && <a href={'/api/assets?id=' + draft.sourceMedia} target="_blank" rel="noreferrer" className="btn">Open original source <ExternalLink size={15}/></a>}<div className="review-checklist"><h3>Before you approve</h3>{['Check names, locations, numbers and dates.', 'Preserve allegations and uncertainty.', 'Confirm rights to the image and source.', 'Ensure the story is still relevant.'].map(s => <p key={s}><ShieldCheck size={15}/>{s}</p>)}</div></>}{tab === 'History' && <><h3>Version {post.version}</h3><p className="help-text">Every saved edit resets approval. Previous text is retained below.</p>{post.history.length ? post.history.map((h, i) => <div className="history-item" key={i}><small>Version {h.version} · {new Date(h.at).toLocaleString()}</small><h4>{h.title}</h4><p>{h.caption}</p><button className="text-btn" disabled={locked || !canEdit} onClick={() => { edit({ title: h.title, caption: h.caption }); setTab('Content'); }}>Restore text to draft</button></div>) : <p>No previous versions yet.</p>}</>}</div></div><div className="modal-actions editor-actions"><div>{existing && canEdit && <button className="btn" disabled={busy} onClick={() => onDuplicate(draft)}><Copy size={15}/> Duplicate as draft</button>}{post.status === 'scheduled' && canPublish && <button className="btn danger-text" onClick={() => onCancel(post)}>Cancel remote schedule</button>}{['scheduled', 'unknown', 'submitting'].includes(post.status) && canPublish && <button className="btn" onClick={() => onVerify(post)}>Verify delivery</button>}</div><div className="button-row">{!locked && canEdit && <button className="btn" disabled={busy || !draft.title.trim()} onClick={() => void onSave(draft)}>Save draft</button>}{existing && canPublish && ['draft', 'review'].includes(post.status) && <button className="btn primary" disabled={busy || changed} title={changed ? 'Save changes before approval' : ''} onClick={() => void onApprove(post)}><CheckCircle2 size={15}/> Approve</button>}{existing && canPublish && ['approved', 'planned'].includes(post.status) && <button className="btn primary" disabled={busy || changed} onClick={() => onPublish(post)}><Send size={15}/> Publish / schedule</button>}</div></div></Modal>;
}
