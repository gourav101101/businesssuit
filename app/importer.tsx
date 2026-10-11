'use client';
import { useState } from 'react';
import JSZip from 'jszip';
import { UploadCloud, FileArchive, FileText, CheckCircle2, AlertCircle, ArrowRight, Download, Plus, X } from 'lucide-react';
import { parseManifest, type ImportRow } from '@/lib/import';
import { today } from '@/lib/model';
import { Field, download } from './ui';
type Media = {
    name: string;
    file: File;
    url: string;
};
export default function Importer({ workspace, onImport, upload, notify }: {
    workspace: string;
    onImport: (posts: any[]) => Promise<void>;
    upload: (file: File) => Promise<string>;
    notify: (s: string) => void;
}) {
    const [media, setMedia] = useState<Media[]>([]), [manifest, setManifest] = useState(''), [format, setFormat] = useState<'csv' | 'txt'>('csv'), [rows, setRows] = useState<ImportRow[]>([]), [step, setStep] = useState(1), [busy, setBusy] = useState(false), [date, setDate] = useState(today()), [source, setSource] = useState(''), [filename, setFilename] = useState(''), [progress, setProgress] = useState('');
    async function files(files: FileList | File[] | null) { if (!files)
        return; setBusy(true); try {
        const added: Media[] = [];
        for (const f of Array.from(files)) {
            if (f.size > 60 * 1024 * 1024)
                throw new Error('Each ZIP must be under 60 MB.');
            if (/\.zip$/i.test(f.name)) {
                const zip = await JSZip.loadAsync(f);
                const entries = Object.values(zip.files).filter(e => !e.dir);
                if (entries.length > 150)
                    throw new Error('ZIP supports up to 150 files.');
                let size = 0;
                for (const e of entries) {
                    const raw = (e as any).unsafeOriginalName || e.name;
                    if (raw.includes('..') || raw.startsWith('/') || /^[A-Za-z]:/.test(raw))
                        throw new Error('ZIP contains an unsafe path');
                    const declared = (e as any)._data?.uncompressedSize || 0;
                    if (declared > 15 * 1024 * 1024 || size + declared > 100 * 1024 * 1024)
                        throw new Error('ZIP expands beyond the 100 MB limit');
                    size += declared;
                    if (/\.(jpe?g|png|webp)$/i.test(e.name)) {
                        const blob = await e.async('blob');
                        const name = e.name.split('/').pop()!;
                        const type = /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg';
                        const file = new File([blob], name, { type });
                        added.push({ name, file, url: URL.createObjectURL(file) });
                    }
                    else if (/\.(csv|txt)$/i.test(e.name) && !/^readme/i.test(e.name.split('/').pop()!)) {
                        setManifest(await e.async('string'));
                        setFormat(/\.csv$/i.test(e.name) ? 'csv' : 'txt');
                        setFilename(e.name);
                    }
                }
            }
            else if (/\.(csv|txt)$/i.test(f.name)) {
                setManifest(await f.text());
                setFormat(/\.csv$/i.test(f.name) ? 'csv' : 'txt');
                setFilename(f.name);
            }
            else if (/^image\/(jpeg|png|webp)$/.test(f.type)) {
                added.push({ name: f.name, file: f, url: URL.createObjectURL(f) });
            }
            else
                throw new Error('Import ZIP, CSV, TXT, JPEG, PNG or WebP. Upload newspapers in Source library.');
        }
        setMedia(old => { const all = [...old, ...added]; const seen = new Set<string>(); return all.filter(m => { if (seen.has(m.name)) {
            URL.revokeObjectURL(m.url);
            return false;
        } seen.add(m.name); return true; }); });
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function preview() { try {
        let parsed = manifest.trim() ? parseManifest(manifest, format, date) : media.map(m => ({ title: m.name.replace(/\.[^.]+$/, ''), caption: '', date, time: '', filename: m.name, source: '', warnings: ['Image-only draft: add a caption before approval.'] }));
        if (!parsed.length)
            throw new Error('Add images or captions first');
        if (parsed.length > 100)
            throw new Error('Import up to 100 posts at a time');
        parsed = parsed.map(r => ({ ...r, filename: media.some(m => m.name === r.filename) ? r.filename : '', source: r.source || source, warnings: [...r.warnings, ...(!media.some(m => m.name === r.filename) ? ['Match an image manually.'] : [])] }));
        setRows(parsed);
        setStep(2);
    }
    catch (e) {
        notify((e as Error).message);
    } }
    async function commit() { setBusy(true); try {
        if (rows.some(r => !r.caption.trim() && !r.title.trim()))
            throw new Error('Each row needs a title or caption');
        const ids: Record<string, string> = {};
        const selected = media.filter(m => rows.some(r => r.filename === m.name));
        for (let i = 0; i < selected.length; i++) {
            setProgress(`Uploading image ${i + 1} of ${selected.length}`);
            ids[selected[i].name] = await upload(selected[i].file);
        }
        setProgress('Creating drafts…');
        await onImport(rows.map(r => ({ ...r, media: ids[r.filename] || '' })));
        media.forEach(m => URL.revokeObjectURL(m.url));
        setMedia([]);
        setRows([]);
        setManifest('');
        setStep(3);
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
        setProgress('');
    } }
    function sample() { download(new Blob(['\uFEFFdate,time,title,message,photo,source\n2026-10-12,07:30,"Example headline","Write the full Hindi caption here.",01_image.jpg,"Publisher name"\n'], { type: 'text/csv;charset=utf-8' }), 'newsdesk-import-template.csv'); }
    return <><div className="page-heading"><div><span className="eyebrow">FROM META AI TO YOUR NEWSROOM</span><h1>Import your content pack</h1><p>Your images, captions and timings. Together in one place.</p></div><button className="btn" onClick={sample}><Download size={16}/> CSV template</button></div><div className="steps">{['Upload files', 'Match & review', 'Ready to edit'].map((s, i) => <div key={s} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}><b>{step > i + 1 ? <CheckCircle2 size={17}/> : i + 1}</b>{s}{i < 2 && <span />}</div>)}</div>
 {step === 1 && <><div className="import-grid"><section className="panel"><div className="section-head"><h3>01 <span>Images & content files</span></h3><span className="badge">ZIP + CSV / TXT</span></div><label className={'dropzone ' + (busy ? 'disabled' : '')} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void files(e.dataTransfer.files); }}><input aria-label="Upload content pack" type="file" multiple accept=".zip,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={e => void files(e.target.files)} disabled={busy}/><div className="upload-symbol"><UploadCloud size={30}/></div><h3>{busy ? 'Reading your files…' : 'Drop your content pack here'}</h3><p>ZIP of images + CSV or TXT from Meta AI</p><span className="btn">Browse files <ArrowRight size={15}/></span><small>Up to 100 posts · ZIP under 60 MB · images under 15 MB</small></label>{filename && <div className="file-line"><FileText size={19}/><span>{filename}</span><CheckCircle2 size={17}/></div>}{media.length > 0 && <><div className="section-head"><p>{media.length} images ready</p><button className="text-btn" onClick={() => { media.forEach(m => URL.revokeObjectURL(m.url)); setMedia([]); }}>Clear images</button></div><div className="mini-media">{media.slice(0, 12).map(m => <figure key={m.name}><img src={m.url} alt={m.name}/><figcaption>{m.name}</figcaption></figure>)}</div></>}</section><section className="panel"><div className="section-head"><h3>02 <span>Caption & schedule details</span></h3></div><div className="segmented"><button className={format === 'csv' ? 'active' : ''} onClick={() => setFormat('csv')}>CSV format</button><button className={format === 'txt' ? 'active' : ''} onClick={() => setFormat('txt')}>Plain text</button></div><Field label={format === 'csv' ? 'Paste CSV, or upload a file' : 'Paste the text from Meta AI'} hint={format === 'csv' ? 'Recognizes caption / message / description and photo / image / filename.' : 'Separate posts with blank lines. Use labels: Title:, Caption:, Time:, Photo:, Source:.'}><textarea rows={9} value={manifest} onChange={e => setManifest(e.target.value)} placeholder={format === 'csv' ? 'date,time,message,photo\n2026-10-12,07:30,"आपकी खबर का विवरण",01_image.jpg' : 'Title: शहर की नई खबर\nCaption: खबर का पूरा विवरण\nTime: 07:30 AM\nPhoto: 01_image.jpg\nSource: Publisher name'}/></Field><div className="form-grid"><Field label="Default edition date"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field><Field label="Default source"><input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Your original reporting"/></Field></div></section></div><div className="notice"><FileArchive size={21}/><div><b>Already have posters from Meta AI? You’re all set.</b><p>Upload the ZIP and its CSV or TXT. Images stay exactly as supplied. You can edit them later in the poster studio.</p></div></div><div className="bottom-actions"><span>Nothing is published during import.</span><button className="btn primary" disabled={busy} onClick={preview}>Match & review <ArrowRight size={16}/></button></div></>}
 {step === 2 && <section className="panel"><div className="section-head"><div><h3>Review {rows.length} posts</h3><p>Confirm every match. Unmatched images can be added later.</p></div><button className="btn" onClick={() => setStep(1)}>Back to files</button></div><div className="table-scroll"><table><thead><tr><th>Image match</th><th>Headline & caption</th><th>Schedule · IST</th><th>Source</th><th /></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td><select aria-label={`Image for row ${i + 1}`} value={r.filename} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, filename: e.target.value } : x))}><option value="">No image matched</option>{media.map(m => <option key={m.name}>{m.name}</option>)}</select>{r.filename && <img className="match-image" src={media.find(m => m.name === r.filename)?.url} alt="Matched image"/>}</td><td><input aria-label={`Title for row ${i + 1}`} value={r.title} placeholder="Headline (optional)" onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}/><textarea aria-label={`Caption for row ${i + 1}`} rows={3} value={r.caption} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}/>{rows.some((x, j) => j !== i && x.caption.trim() && x.caption.trim() === r.caption.trim()) && <small className="warning">Duplicate caption in this pack</small>}</td><td><input aria-label={`Date for row ${i + 1}`} type="date" value={r.date} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}/><input aria-label={`Time for row ${i + 1}`} type="time" value={r.time} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, time: e.target.value } : x))}/></td><td><input aria-label={`Source for row ${i + 1}`} value={r.source} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, source: e.target.value } : x))}/>{!r.filename && <small className="warning">Image needed before approval</small>}</td><td><button className="icon-btn" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X size={16}/></button></td></tr>)}</tbody></table></div><div className="bottom-actions"><span>{progress || 'Imports create drafts. Approval is a separate step.'}</span><button className="btn primary" disabled={busy || !rows.length} onClick={() => void commit()}>{busy ? 'Importing…' : `Import ${rows.length} drafts`}<ArrowRight size={16}/></button></div></section>}
 {step === 3 && <div className="success-panel"><CheckCircle2 size={48}/><h2>Your content is in.</h2><p>Open the content library to review your drafts, check sources and approve posts.</p><button className="btn" onClick={() => setStep(1)}><Plus size={16}/> Import another pack</button></div>}
 </>;
}
