import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseManifest} from '../lib/import.ts';
test('labelled stories retain paragraph breaks, disclaimer and hashtags with metadata at the end',()=>{
 const caption='इंदौर की खबर।\n\nदूसरा पैराग्राफ।\n\nDisclaimer: समाचार के लिए।\n\n#Indore #News';
 const text=Array.from({length:30},(_,i)=>`Title: Story ${i+1}\nCaption: ${caption}\nTime: 07:30 AM\nPhoto: ${String(i+1).padStart(2,'0')}_image.jpg\nSource: Newspaper`).join('\n\n');
 const rows=parseManifest(text,'txt','2026-10-12');assert.equal(rows.length,30);
 rows.forEach((r,i)=>{assert.equal(r.caption,caption);assert.equal(r.title,`Story ${i+1}`);assert.equal(r.filename,`${String(i+1).padStart(2,'0')}_image.jpg`);assert.equal(r.time,'07:30');assert.equal(r.source,'Newspaper');assert.deepEqual(r.warnings,[]);});
});
test('numbered stories with titles and CRLF keep disclaimers attached',()=>{
 const text='Post 1:\r\nTitle: First\r\nCaption: One\r\n\r\nDisclaimer: Keep\r\nTime: 8:00 PM\r\n\r\nPost 2:\r\nTitle: Second\r\nCaption: Two\r\n\r\n#Tag\r\nPhoto: two.jpg';
 const rows=parseManifest(text,'txt','2026-10-12');assert.equal(rows.length,2);assert.equal(rows[0].caption,'One\n\nDisclaimer: Keep');assert.equal(rows[0].time,'20:00');assert.equal(rows[1].caption,'Two\n\n#Tag');assert.equal(rows[1].filename,'two.jpg');
});
test('single labelled caption preserves multiple paragraphs without a title',()=>{
 const [r]=parseManifest('Caption: Main text\n\nDisclaimer: Keep\n\n#News\nTime: 12:00 PM','txt','2026-10-12');assert.equal(r.caption,'Main text\n\nDisclaimer: Keep\n\n#News');assert.equal(r.time,'12:00');
});
