import type { Post } from './model';
export type BulkOptions = { location?: string; placeId?: string; category?: string; prefix?: string; suffix?: string; find?: string; replace?: string };
export function validatePlace(value: unknown) {
    const id=String(value||'').trim();
    if(id && !/^\d{1,30}$/.test(id))throw Error('Facebook Place ID must contain digits only. Use a Place ID, not coordinates or a URL.');
    return id;
}
export function previewBulk(post: Post, options: BulkOptions): Post {
    const p={...post};
    if(options.category!==undefined){const category=options.category.trim();if(!category||category.length>100)throw Error('Category must be 1–100 characters.');p.category=category;}
    if(options.placeId!==undefined)p.placeId=validatePlace(options.placeId);
    if(options.location!==undefined){const location=options.location.trim();if(location.length>160||/[\r\n]/.test(location))throw Error('Location must be a single line, up to 160 characters.');p.location=location;}
    let caption=p.caption;
    if(options.find){if(options.find.length>500)throw Error('Search text must be at most 500 characters.');caption=caption.split(options.find).join(options.replace||'');}
    if(options.prefix?.trim()&&!caption.startsWith(options.prefix.trim()))caption=options.prefix.trim()+'\n\n'+caption;
    if(options.suffix?.trim()&&!caption.trimEnd().endsWith(options.suffix.trim()))caption=caption.trimEnd()+'\n\n'+options.suffix.trim();
    if(caption.length>20000)throw Error('An edited caption exceeds 20,000 characters. Shorten the added text.');
    p.caption=caption;
    return p;
}
export function publicationCaption(p: Pick<Post,'caption'|'location'>) {
    return p.location?.trim()?`📍 ${p.location.trim()}\n\n${p.caption}`:p.caption;
}
export function applyBulk(posts: Post[], ids: unknown, options: BulkOptions) {
    if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'))throw Error('Select 1–100 posts.');
    const selected=new Set(ids);
    if(posts.filter(p=>selected.has(p.id)).length!==selected.size)throw Error('Some selected posts no longer exist. Refresh the library.');
    if(posts.some(p=>selected.has(p.id)&&(p.remoteId||['scheduled','published','unknown','submitting'].includes(p.status))))throw Error('Selected posts include remote deliveries. Copy them as drafts before bulk editing.');
    let changed=0;
    const result=posts.map(p=>{
        if(!selected.has(p.id))return p;
        const next=previewBulk(p,options);
        if(['caption','category','placeId','location'].every(k=>(p as any)[k]===(next as any)[k]))return p;
        changed++;
        return {...next,version:p.version+1,status:'review' as const,approvedVersion:undefined,updatedAt:new Date().toISOString(),history:[{at:new Date().toISOString(),title:p.title,caption:p.caption,version:p.version,location:p.location,placeId:p.placeId,category:p.category},...p.history].slice(0,20)};
    });
    return {posts:result,changed};
}
