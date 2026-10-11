// Generates SQL only. An administrator must apply it to the correct D1 database.
import fs from 'node:fs';
import ts from 'typescript';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
if(!process.stdin.isTTY)throw Error('Run in an interactive terminal.');
const email=String(process.argv[2]||'').trim().toLowerCase();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Usage: node scripts/password-recovery.mjs owner@example.com');
const source=fs.readFileSync(new URL('../lib/passwords.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const passwords={};new Function('exports',code)(passwords);
let hidden=false;
const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try{
 process.stdout.write('New owner password (hidden): ');hidden=true;const password=await rl.question('');
 process.stdout.write('\nConfirm password (hidden): ');const confirm=await rl.question('');hidden=false;process.stdout.write('\n');
 if(password!==confirm)throw Error('Passwords do not match.');
 const hash=await passwords.hashPassword(password),quote=s=>"'"+s.replaceAll("'","''")+"'";
 fs.mkdirSync(new URL('../work/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../work/password-recovery.sql',import.meta.url),`UPDATE auth_users SET password_hash=${quote(hash)} WHERE email=${quote(email)};\nDELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_users WHERE email=${quote(email)});\n`,{mode:0o600});
 console.log('Generated work/password-recovery.sql. Apply it to the intended D1 database with Wrangler, then delete the file. No database has been changed.');
}finally{rl.close();}
