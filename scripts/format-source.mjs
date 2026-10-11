import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(/\.tsx?$/.test(file)){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);fs.writeFileSync(file,printer.printFile(source));}}}
visit('app');visit('db');for(const name of ['model.ts','import.ts','server.ts','meta.ts']){const file=path.join('lib',name);const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);fs.writeFileSync(file,printer.printFile(source));}
