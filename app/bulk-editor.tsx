'use client';
import { useState } from 'react';
import LocationPicker from './location-picker';
import { Modal, Field } from './ui';
import { previewBulk, publicationCaption, type BulkOptions } from '@/lib/bulk-edit';
import type { Post } from '@/lib/model';
export default function BulkEditor({workspace,posts,city,busy,onClose,onSave,presets=[],onSavePreset,onDeletePreset}:{workspace:string;posts:Post[];city:string;busy:boolean;onClose:()=>void;onSave:(options:BulkOptions)=>Promise<unknown>;presets?:{id:string;name:string;options:BulkOptions}[];onSavePreset:(name:string,options:BulkOptions)=>Promise<boolean>;onDeletePreset:(id:string)=>Promise<boolean>}) {
    const [preset,setPreset]=useState(''),[presetName,setPresetName]=useState('');
    const [options,setOptions]=useState<BulkOptions>({}),[index,setIndex]=useState(0);
    const set=(key:keyof BulkOptions,value:string)=>setOptions({...options,[key]:value});
    const toggle=(key:keyof BulkOptions,on:boolean)=>{const next={...options};if(on)next[key]=key==='location'?city:'';else delete next[key];setOptions(next);};
    let error='',preview:Post|undefined;
    try{preview=posts[index]?previewBulk(posts[index],options):undefined;}catch(e){error=(e as Error).message;}
    const locked=posts.filter(p=>p.remoteId||['scheduled','published','unknown','submitting'].includes(p.status)).length;
    const changed=posts.filter(p=>{try{return JSON.stringify(previewBulk(p,options))!==JSON.stringify(p);}catch{return false;}}).length;
    return <Modal title="Bulk controls" onClose={onClose}><form className="bulk-controls" onSubmit={async e=>{e.preventDefault();await onSave(options);}}>
        <p>Update {posts.length} selected stories together. Changes require approval again and remove these stories from the pending submission queue.</p>
        <section className="preset-controls"><Field label="Saved presets for this workspace"><select value={preset} onChange={e=>setPreset(e.target.value)}><option value="">Choose preset</option>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><div className="button-row"><button type="button" className="btn" disabled={!preset||busy} onClick={()=>{const saved=presets.find(p=>p.id===preset);if(saved)setOptions({...saved.options});}}>Load into preview</button><button type="button" className="btn" disabled={!preset||busy} onClick={async()=>{if(await onDeletePreset(preset))setPreset('');}}>Remove preset</button></div><Field label="Save these settings as a preset" hint="Saves location, category and caption prefix/footer. Find-and-replace is not saved. Posts are unchanged until you apply the preview."><input maxLength={60} value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Dewas evening edition"/></Field><button type="button" className="btn" disabled={!presetName.trim()||busy} onClick={async()=>{if(await onSavePreset(presetName,options))setPresetName('');}}>Save preset</button></section>
        {locked>0&&<p role="alert" className="auth-error">{locked} selected stories have remote deliveries. Select local drafts, or copy remote posts as drafts first.</p>}
        <label className="bulk-toggle"><input type="checkbox" checked={options.location!==undefined} onChange={e=>toggle('location',e.target.checked)}/> Add or replace location line</label>
        {options.location!==undefined&&<Field label="Visible location" hint="Appears above the caption as 📍 Dewas, Madhya Pradesh. Empty removes the line. This does not target a geographic audience."><input maxLength={160} value={options.location} onChange={e=>set('location',e.target.value)} placeholder="Dewas, Madhya Pradesh"/></Field>}
        <label className="bulk-toggle"><input type="checkbox" checked={options.placeId!==undefined} onChange={e=>toggle('placeId',e.target.checked)}/> Set Facebook location for selected posts</label>
        {options.placeId!==undefined&&<LocationPicker workspace={workspace} value={options.placeId} onChange={id=>set('placeId',id)}/>} 
        <label className="bulk-toggle"><input type="checkbox" checked={options.category!==undefined} onChange={e=>toggle('category',e.target.checked)}/> Change category</label>
        {options.category!==undefined&&<Field label="Category"><input required maxLength={100} value={options.category} onChange={e=>set('category',e.target.value)} placeholder="City news"/></Field>}
        <div className="form-grid"><Field label="Find exact text"><input value={options.find||''} maxLength={500} onChange={e=>set('find',e.target.value)}/></Field><Field label="Replace with" hint="Case-sensitive, literal replacement."><input value={options.replace||''} onChange={e=>set('replace',e.target.value)}/></Field></div>
        <Field label="Text before caption"><textarea rows={2} value={options.prefix||''} onChange={e=>set('prefix',e.target.value)}/></Field>
        <Field label="Text after caption" hint="Add hashtags, a footer or disclosure. Reapplying the same footer will not duplicate it."><textarea rows={3} value={options.suffix||''} onChange={e=>set('suffix',e.target.value)}/></Field>
        <section className="bulk-preview"><Field label="Preview story"><select value={index} onChange={e=>setIndex(Number(e.target.value))}>{posts.map((p,i)=><option key={p.id} value={i}>{p.title}</option>)}</select></Field>{preview&&<><small>Category: {preview.category} · Native Place ID: {preview.placeId||'None'}</small><p>{publicationCaption(preview)}</p></>}</section>
        {error&&<p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy||!!locked||!!error||!changed||posts.length>100}>Save changes to {changed} stories</button></div>
    </form></Modal>;
}
