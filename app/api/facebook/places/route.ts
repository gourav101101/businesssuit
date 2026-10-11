import { access, failure } from '@/lib/server';
import { connection, graph } from '@/lib/meta';
export async function GET(req:Request){try{
 const url=new URL(req.url),workspace=url.searchParams.get('workspace')||'',query=(url.searchParams.get('q')||'').trim();
 await access(workspace,['owner','editor','publisher']);
 if(query.length<2||query.length>120)throw Error('Enter a location name or numeric Facebook Place ID (2–120 characters).');
 const {token}=await connection(workspace);
 const fields='id,name,location';
 let rows:any[];
 try{const result=await graph(/^\d+$/.test(query)?`${query}?fields=${fields}`:`pages/search?q=${encodeURIComponent(query)}&fields=${fields}&limit=20`,token);rows=Array.isArray(result.data)?result.data:[result];}
 catch{ return Response.json({error:'Meta could not look up this location with the current Page connection. Name search may require additional Meta access. Try a known numeric Facebook Place ID; no location has been selected.'},{status:400});}
 const places=rows.filter(p=>p.id&&p.name&&p.location&&(p.location.city||p.location.street||typeof p.location.latitude==='number')).map(p=>({id:String(p.id),name:String(p.name),address:[p.location.street,p.location.city,p.location.state,p.location.country].filter(Boolean).join(', ')}));
 return Response.json({places,message:places.length?'Choose the correct Facebook location.':'No locations with an address were returned. Try a more specific name or a known Place ID.'},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
