export type Status = 'draft' | 'review' | 'approved' | 'planned' | 'submitting' | 'scheduled' | 'published' | 'failed' | 'unknown' | 'cancelled';
export type Post = {
    id: string;
    title: string;
    caption: string;
    location?: string;
    placeId?: string;
    category: string;
    media: string;
    sourceMedia: string;
    source: string;
    sourceDate: string;
    sourcePage: string;
    date: string;
    time: string;
    status: Status;
    template: string;
    color: string;
    version: number;
    approvedVersion?: number;
    remoteId?: string;
    permalink?: string;
    error?: string;
    updatedAt: string;
    history: {
        at: string;
        title: string;
        caption: string;
        version: number;
        location?: string;
        placeId?: string;
        category?: string;
    }[];
};
export type Brand = {
    name: string;
    city: string;
    color: string;
    initials: string;
    disclaimer: string;
    start: string;
    end: string;
    timezone: string;
    logo: string;
};
export type Data = {
    presets?: {id:string;name:string;options:import('./bulk-edit').BulkOptions}[];
    brand: Brand;
    posts: Post[];
    paused: boolean;
    queue?: { ids: string[]; pageId?: string; inFlight?: string; stopped?: string; updatedAt: string };
};
export const statuses: Status[] = ['draft', 'review', 'approved', 'planned', 'submitting', 'scheduled', 'published', 'failed', 'unknown', 'cancelled'];
export const statusLabels: Record<Status, string> = { draft: 'Draft', review: 'Needs review', approved: 'Approved', planned: 'Planned locally', submitting: 'Submitting', scheduled: 'On Facebook', published: 'Published', failed: 'Failed', unknown: 'Needs reconciliation', cancelled: 'Cancelled' };
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function freshPost(extra: Partial<Post> = {}): Post { return { id: crypto.randomUUID(), title: 'Untitled story', caption: '', category: 'City news', media: '', sourceMedia: '', source: '', sourceDate: today(), sourcePage: '', date: today(), time: '', status: 'draft', template: 'editorial', color: '#586345', version: 1, updatedAt: new Date().toISOString(), history: [], ...extra }; }
export function blankData(name: string, city: string): Data { return { brand: { name, city, color: '#586345', initials: city.slice(0, 2).toUpperCase(), disclaimer: '', start: '07:30', end: '21:00', timezone: 'Asia/Kolkata', logo: '' }, posts: [], paused: false }; }
export function distribute(count: number, start: string, end: string) { if (!Number.isInteger(count) || count < 1)
    return []; const mins = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; }; const a = mins(start), b = mins(end); if (!Number.isFinite(a + b) || a < 0 || b > 1439 || b < a || (count > 1 && b - a < count - 1))
    throw new Error('Choose a time window with at least one minute per post.'); return Array.from({ length: count }, (_, i) => { const n = Math.round(a + (count === 1 ? 0 : i * (b - a) / (count - 1))); return `${Math.floor(n / 60)}`.padStart(2, '0') + ':' + `${n % 60}`.padStart(2, '0'); }); }
export function epoch(post: Post) { return Math.floor(new Date(`${post.date}T${post.time}:00+05:30`).getTime() / 1000); }
