'use client';
import { X, ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Post, Brand } from '@/lib/model';
export function Modal({ title, children, onClose, wide = false }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    wide?: boolean;
}) { const ref = useRef<HTMLElement>(null); useEffect(() => { const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.focus(); const trap = (e: KeyboardEvent) => { if (e.key !== 'Tab')
    return; const all = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]):not([hidden]),select:not([disabled]),textarea:not([disabled])') || []).filter(x => x.offsetParent !== null); if (!all.length)
    return; const first = all[0], last = all[all.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
    last.focus();
    e.preventDefault();
}
else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
    first.focus();
    e.preventDefault();
} }; document.addEventListener('keydown', trap); return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); previous?.focus(); }; }, []); return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget)
    onClose(); }}><section ref={ref} tabIndex={-1} className={'modal ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-label={title}><header><div><span className="eyebrow">NEWSDESK WORKSPACE</span><h2>{title}</h2></div><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header>{children}</section></div>; }
export function Field({ label, children, hint }: {
    label: string;
    children: React.ReactNode;
    hint?: string;
}) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Empty({ title, description, action }: {
    title: string;
    description: string;
    action?: React.ReactNode;
}) { return <div className="empty"><div className="empty-icon"><ImageIcon size={26}/></div><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Poster({ post, brand, large = false }: {
    post: Post;
    brand: Brand;
    large?: boolean;
}) { return <div className={`poster ${post.template} ${large ? 'large' : ''}`} style={{ '--poster-color': post.color || brand.color } as React.CSSProperties}>{post.media ? <img src={'/api/assets?id=' + post.media} alt={post.title}/> : <div className="poster-art"><i /><i /><i /><i /><span>शहर की बात</span></div>}<div className="poster-top"><b>{brand.initials}</b><span>{brand.name}</span><ArrowUpRight size={16}/></div><div className="poster-copy"><span>{post.category || 'CITY NEWS'} · {brand.city}</span><h3>{post.title}</h3><div className="poster-rule"/><p>{post.source || 'Add source attribution'}</p></div></div>; }
export async function renderPoster(post: Post, brand: Brand): Promise<Blob> { await document.fonts.ready; const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; const x = c.getContext('2d')!; x.fillStyle = post.color || brand.color; x.fillRect(0, 0, 1080, 1080); if (post.media) {
    const image = new window.Image();
    image.src = '/api/assets?id=' + post.media;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not load poster image')); });
    const scale = Math.max(1080 / image.width, 1080 / image.height);
    x.drawImage(image, (1080 - image.width * scale) / 2, (1080 - image.height * scale) / 2, image.width * scale, image.height * scale);
} const g = x.createLinearGradient(0, 200, 0, 1080); g.addColorStop(0, 'rgba(18,28,20,.12)'); g.addColorStop(1, 'rgba(18,28,20,.96)'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1080); if (post.template === 'minimal') {
    x.fillStyle = '#f7f4eb';
    x.fillRect(0, 450, 1080, 630);
} const light = post.template === 'minimal' ? '#222d20' : '#fff'; x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText(brand.name, 55, 80); x.fillStyle = light; x.font = 'bold 23px sans-serif'; x.fillText(post.category.toUpperCase() + '  /  ' + brand.city, 55, 560); x.font = 'bold 64px "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif'; const words = post.title.split(/\s+/); let line = '', lines: string[] = []; for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (x.measureText(test).width > 950 && line) {
        lines.push(line);
        line = word;
    }
    else
        line = test;
} if (line)
    lines.push(line); if (lines.length > 4)
    throw new Error('Headline is too long for this template. Shorten it before rendering.'); lines.forEach((l, i) => x.fillText(l, 55, 655 + i * 88)); x.fillRect(55, 998, 60, 3); x.font = '20px sans-serif'; x.fillText('Source: ' + post.source.slice(0, 75), 135, 1006); return new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('Could not render poster')), 'image/jpeg', .94)); }
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
