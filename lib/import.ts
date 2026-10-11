export type ImportRow = {
    title: string;
    caption: string;
    date: string;
    time: string;
    filename: string;
    source: string;
    warnings: string[];
};
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
        return rows.map(r => ({ title: at(r, ['title', 'headline']), caption: at(r, ['caption', 'message', 'description', 'text']), date: at(r, ['date', 'publish_date']) || date, time: normalizeTime(at(r, ['time', 'publish_time'])), filename: at(r, ['photo', 'image', 'filename', 'media_file', 'file']), source: at(r, ['source', 'source_name']), warnings: [] }));
    }
    const blocks = text.replace(/\r/g, '').trim().split(/\n\s*\n|\n(?=(?:Post|पोस्ट)\s*#?\d+\s*[:.\-])/i);
    return blocks.filter(Boolean).map(block => { const lines = block.split('\n'); const fields: Record<string, string> = {}; const body: string[] = []; for (const line of lines) {
        const m = line.match(/^(title|headline|caption|message|description|time|date|photo|image|filename|source)\s*:\s*(.*)$/i);
        if (m)
            fields[m[1].toLowerCase()] = m[2];
        else if (!/^(post|पोस्ट)\s*#?\d+\s*[:.\-]?$/i.test(line.trim()))
            body.push(line);
    } return { title: fields.title || fields.headline || '', caption: [fields.caption || fields.message || fields.description || '', ...body].filter(Boolean).join('\n'), date: fields.date || date, time: normalizeTime(fields.time || ''), filename: fields.photo || fields.image || fields.filename || '', source: fields.source || '', warnings: fields.time ? [] : ['No labelled time found; choose a time before scheduling.'] }; });
}
export function normalizeTime(v: string) { const m = v.trim().match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i); if (!m)
    return v; let h = +m[1]; const mins = +m[2]; if (m[3]) {
    if (h < 1 || h > 12)
        return v;
    h = h % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
} if (h > 23 || mins > 59)
    return v; return `${h}`.padStart(2, '0') + ':' + m[2]; }
export function csvCell(s: string) { return '"' + s.replace(/"/g, '""') + '"'; }
