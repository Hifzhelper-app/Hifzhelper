// Shared Academy/Hifz credential contract v3. Secrets stay in Worker bindings.
// Native Workers PBKDF2 is capped at 100,000 iterations; a separate server-only
// pepper protects the small four-digit PIN space if a database is disclosed.
const PREFIX='v3$pbkdf2-sha256$100000$';
const enc=new TextEncoder();
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function parseSharedPinHash(value){
 if(typeof value!=='string'||!value.startsWith(PREFIX)||value.length>160)return null;
 const parts=value.split('$');
 if(parts.length!==5||!/^[-_A-Za-z0-9]{22}$/.test(parts[3])||! /^[0-9a-f]{64}$/.test(parts[4]))return null;
 try{const salt=Uint8Array.from(atob(parts[3].replaceAll('-','+').replaceAll('_','/')+'=='),c=>c.charCodeAt(0));
  return salt.length===16&&b64(salt)===parts[3]?{salt,hash:parts[4]}:null;
 }catch{return null;}
}
export const isSharedPinHash=value=>parseSharedPinHash(value)!==null;
async function derive(pin,secret,salt){
 if(typeof secret!=='string'||secret.length<32)throw new Error('Shared PIN verification is not configured');
 const key=await crypto.subtle.importKey('raw',enc.encode(`${pin}\u0000${secret}`),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:100000},key,256));
}
export async function createSharedPinHash(pin,secret){
 if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw new Error('PIN must contain four digits');
 const salt=crypto.getRandomValues(new Uint8Array(16));
 return PREFIX+b64(salt)+'$'+hex(await derive(pin,secret,salt));
}
export async function verifySharedPin(pin,stored,secret){
 const parsed=parseSharedPinHash(stored);
 if(typeof pin!=='string'||!/^\d{4}$/.test(pin)||!parsed)return false;
 const actual=await derive(pin,secret,parsed.salt),expected=Uint8Array.from(parsed.hash.match(/../g),b=>parseInt(b,16));
 let difference=0;for(let i=0;i<32;i++)difference|=actual[i]^expected[i];
 return difference===0;
}
