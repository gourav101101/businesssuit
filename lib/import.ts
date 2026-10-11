export type ImportRow = {
    title: string;
    caption: string;
    date: string;
    time: string;
    filename: string;
    source: string;
    location?: string;
    placeId?: string;
    warnings: string[];
};
export function captionWarnings(caption: string): string[] {
    return /full article from earlier chat|copy here with disclaimer|\b(?:insert|paste) (?:the )?(?:full |complete )?(?:article|caption) here\b|\[(?:caption|article|description)\]/i.test(caption)
        ? ['Placeholder caption: replace it with the complete story before approval.'] : [];
}
export function detectManifestFormat(text: string): 'csv' | 'txt' {
    const first = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)[0] || '';
    return /(?:^|,)\s*"?(caption|message|description|text)"?\s*(?:,|$)/i.test(first) ? 'csv' : 'txt';
}
export function matchImageFilename(filename: string, names: string[]): string {
    const base = filename.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\\/g, '/').split('/').pop() || '';
    if (names.includes(base)) return base;
    const matches = names.filter(name => name.toLowerCase() === base.toLowerCase());
    return matches.length === 1 ? matches[0] : '';
}
export function parseCSV(input: string): string[][] { const rows: string[][] = []; let row: string[] = [], field = '', quoted = false; input = input.replace(/^\uFEFF/, ''); for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
        if (quoted && input[i + 1] === '"') {
            field += '"';
            i++;
        }
        else if (quoted || field === '')
            quoted = !quoted;
        else
            field += c;
    }
    else if (c === ',' && !quoted) {
        row.push(field);
        field = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && input[i + 1] === '\n')
            i++;
        row.push(field);
        if (row.some(x => x.trim()))
            rows.push(row);
        row = [];
        field = '';
    }
    else
        field += c;
} if (quoted)
    throw new Error('CSV contains an unclosed quoted field.'); row.push(field); if (row.some(x => x.trim()))
    rows.push(row); return rows; }
export function parseManifest(text: string, type: 'csv' | 'txt', date: string): ImportRow[] {
    if (type === 'csv') {
        const [head, ...rows] = parseCSV(text);
        if (!head)
            return [];
        const normalized = head.map(x => x.trim().toLowerCase());
        const at = (r: string[], names: string[]) => r[normalized.findIndex(x => names.includes(x))]?.trim() || '';
        if (!normalized.some(x => ['message', 'caption', 'description', 'text'].includes(x)))
            throw new Error('CSV needs a caption, message, description or text column.');
        return rows.map(r => ({ title: at(r, ['title', 'headline']), caption: at(r, ['caption', 'message', 'description', 'text']), date: at(r, ['date', 'publish_date']) || date, time: normalizeTime(at(r, ['time', 'publish_time'])), filename: at(r, ['photo', 'image', 'filename', 'media_file', 'file']), source: at(r, ['source', 'source_name']), location: at(r,['location','city']), placeId: at(r,['place_id','placeid']), warnings: [] }));
    }
    text = text.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
    const metaHeading = /^\s*={3,}\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*[-–—]\s*(.*?)\s*={3,}\s*$/gim;
    const headings = [...text.matchAll(metaHeading)];
    if (headings.length) {
        return headings.map((heading, index) => {
            const start = heading.index! + heading[0].length;
            const content = text.slice(start, headings[index + 1]?.index ?? text.length).trim();
            const fields: Record<string, string> = {};
            const body: string[] = [];
            let active = '';
            for (const line of content.split('\n')) {
                const match = line.match(/^\s*(title|headline|caption|message|description|time|date|photo|image|filename|source|location|place_id)\s*:\s*(.*)$/i);
                if (match) {
                    active = match[1].toLowerCase();
                    fields[active] = match[2];
                } else if (['caption', 'message', 'description'].includes(active)) {
                    fields[active] += '\n' + line;
                } else if (line.trim()) body.push(line);
            }
            const caption = [fields.caption || fields.message || fields.description || '', ...body].filter(Boolean).join('\n').trim();
            return { title: fields.title || fields.headline || heading[2].trim(), caption,
                time: normalizeTime(fields.time || heading[1]), date: fields.date || date,
                filename: fields.photo || fields.image || fields.filename || '', source: fields.source || '', location: fields.location || '', placeId: fields.place_id || '',
                warnings: captionWarnings(caption) };
        });
    }
    // Blank lines belong to captions (paragraphs, disclaimers and hashtags).
    // Prefer explicit story boundaries; use paragraph splitting only for unstructured text.
    const numbered = /^[ \t]*(?:Post|पोस्ट)[ \t]*#?\d+[ \t]*[:.\-]?[ \t]*$/im.test(text);
    const titled = /^[ \t]*(?:title|headline)[ \t]*:/im.test(text);
    const blocks = numbered
        ? text.split(/\n(?=[ \t]*(?:Post|पोस्ट)[ \t]*#?\d+[ \t]*[:.\-]?[ \t]*(?:\n|$))/i)
        : titled ? text.split(/\n(?=[ \t]*(?:title|headline)[ \t]*:)/i)
        : /^(?:caption|message|description)[ \t]*:/im.test(text) ? [text]
        : text.split(/\n\s*\n/);
    return blocks.filter(Boolean).map(block => { const lines = block.split('\n'); const fields: Record<string, string> = {}; const body: string[] = []; for (const line of lines) {
        const m = line.match(/^[ \t]*(title|headline|caption|message|description|time|date|photo|image|filename|source|location|place_id)[ \t]*:[ \t]*(.*)$/i);
        if (m) {
            const key=m[1].toLowerCase();
            if (['caption','message','description'].includes(key)) body.push(m[2]);
            else fields[key] = m[2];
        }
        else if (!/^(post|पोस्ट)\s*#?\d+\s*[:.\-]?$/i.test(line.trim()))
            body.push(line);
    } const caption=body.join('\n').trim(); return { title: fields.title || fields.headline || '', caption, date: fields.date || date, time: normalizeTime(fields.time || ''), filename: fields.photo || fields.image || fields.filename || '', source: fields.source || '', location: fields.location || '', placeId: fields.place_id || '', warnings: [...captionWarnings(caption), ...(fields.time ? [] : ['No labelled time found; choose a time before scheduling.'])] }; });
}
export function normalizeTime(v: string) { const m = v.trim().match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i); if (!m)
    return v; let h = +m[1]; const mins = +m[2]; if (m[3]) {
    if (h < 1 || h > 12)
        return v;
    h = h % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
} if (h > 23 || mins > 59)
    return v; return `${h}`.padStart(2, '0') + ':' + m[2]; }
export function csvCell(s: string) { return '"' + s.replace(/"/g, '""') + '"'; }
