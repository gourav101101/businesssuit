import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseCSV,parseManifest,normalizeTime,csvCell,detectManifestFormat,matchImageFilename,captionWarnings} from '../lib/import.ts';
import {distribute,epoch,freshPost} from '../lib/model.ts';
test('CSV preserves Hindi, commas, escaped quotes and multiline captions',()=>{const rows=parseCSV('\uFEFFdate,time,message,photo\r\n2026-10-12,07:30,"इंदौर, शहर की खबर\nदूसरी पंक्ति ""quoted""",a.jpg');assert.equal(rows[1][2],'इंदौर, शहर की खबर\nदूसरी पंक्ति "quoted"');assert.equal(rows[1][3],'a.jpg');});
test('Reject malformed quoted CSV',()=>assert.throws(()=>parseCSV('a,b\n"unfinished'),/unclosed/));
test('Caption/image aliases and 12-hour times normalize',()=>{const [r]=parseManifest('description,image,time\n"शहर की खबर",01.jpg,9:15 PM','csv','2026-10-12');assert.equal(r.caption,'शहर की खबर');assert.equal(r.filename,'01.jpg');assert.equal(r.time,'21:15');assert.equal(r.date,'2026-10-12');});
test('TXT paragraphs produce reviewable labelled rows',()=>{const rows=parseManifest('Title: पहली खबर\nCaption: विवरण\nTime: 7:30 AM\nPhoto: first.jpg\n\nTitle: दूसरी खबर\nDescription: और विवरण\nTime: 12:00 PM','txt','2026-10-12');assert.equal(rows.length,2);assert.equal(rows[0].time,'07:30');assert.equal(rows[1].time,'12:00');assert.equal(rows[1].caption,'और विवरण');});
test('Unlabelled TXT is preserved, never invented or discarded',()=>{const [r]=parseManifest('इंदौर की खबर\nविस्तार से विवरण','txt','2026-10-12');assert.equal(r.caption,'इंदौर की खबर\nविस्तार से विवरण');assert.ok(r.warnings.length);});
test('32 slots include both endpoints without rounding drift',()=>{const slots=distribute(32,'07:30','21:00');assert.equal(slots[0],'07:30');assert.equal(slots.at(-1),'21:00');assert.equal(new Set(slots).size,32);assert.deepEqual(slots,[...slots].sort());});
test('Small counts and impossible windows',()=>{assert.deepEqual(distribute(0,'07:30','21:00'),[]);assert.deepEqual(distribute(1,'07:30','21:00'),['07:30']);assert.throws(()=>distribute(32,'07:30','07:35'));assert.throws(()=>distribute(2,'21:00','07:30'));});
test('IST timestamp conversion uses seconds and the intended date',()=>{const p=freshPost({date:'2026-10-12',time:'07:30'});assert.equal(new Date(epoch(p)*1000).toISOString(),'2026-10-12T02:00:00.000Z');});
test('Exports round-trip exact captions',()=>{const s='Hindi हिन्दी, "quote"\nnewline';assert.equal(parseCSV('caption\n'+csvCell(s))[1][0],s);});
test('Time normalizer handles midnight and noon',()=>{assert.equal(normalizeTime('12:00 AM'),'00:00');assert.equal(normalizeTime('12:00 PM'),'12:00');assert.equal(normalizeTime('13:80'),'13:80');});

test('Meta AI headings skip instructions and preserve multiline caption paragraphs',()=>{
 const text='Copy these captions one by one into Bulk Scheduler Text boxes:\n\n=== 07:30 AM - RE-2 Road Clearance ===\nImage: images/first.webp\nCaption: इंदौर की खबर\nअगली पंक्ति\n\nदूसरा पैराग्राफ\n\n=== 12:15 PM - Festival ===\nImage: second.webp\nCaption: Complete second caption';
 const rows=parseManifest(text,'txt','2026-10-14');
 assert.equal(rows.length,2);assert.equal(rows[0].title,'RE-2 Road Clearance');assert.equal(rows[0].time,'07:30');
 assert.equal(rows[0].caption,'इंदौर की खबर\nअगली पंक्ति\n\nदूसरा पैराग्राफ');assert.equal(rows[1].time,'12:15');assert.equal(rows[1].date,'2026-10-14');
});
test('Pasted format detection and unambiguous filename matching',()=>{
 assert.equal(detectManifestFormat('=== 07:30 AM - News ===\nCaption: news'),'txt');
 assert.equal(detectManifestFormat('date,time,caption,image\n2026-10-14,07:30,text,a.webp'),'csv');
 assert.equal(matchImageFilename('"folder/IMAGE.webp"',['image.webp']),'image.webp');
 assert.equal(matchImageFilename('IMAGE.webp',['Image.webp','image.webp']),'');
});
test('Placeholder captions are flagged without rewriting content',()=>{
 const rows=parseManifest('=== 07:30 AM - News ===\nImage: a.webp\nCaption: Full article from earlier chat copy here with disclaimer','txt','2026-10-14');
 assert.match(rows[0].warnings[0],/Placeholder/);assert.equal(captionWarnings('Complete verified news caption').length,0);
});
