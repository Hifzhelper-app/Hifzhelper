import {applyAcademyProfiles,boundedAcademyBody} from './academy-profile-sync.js';
import {issueHifzSession} from './auth.js';
const enc=new TextEncoder(),fail=(message,status=401)=>({error:message,status});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const digest=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)));
const codePattern=/^[A-Za-z0-9_-]{43}$/;
export async function handleAcademyHandoff(request,env){
 if(env.ACADEMY_HANDOFF_ENABLED!=='1'||typeof env.SHARED_PIN_SECRET!=='string'||env.SHARED_PIN_SECRET.length<32||typeof env.ACADEMY_PROFILE_SYNC_SECRET!=='string'||env.ACADEMY_PROFILE_SYNC_SECRET.length<32)return fail('Academy sign-in is unavailable.',503);
 if(request.method!=='POST')return fail('Use POST.',405);
 const signature=request.headers.get('X-Academy-Handoff-Signature')||'';
 if(!/^[0-9a-f]{64}$/.test(signature))return fail('Not authorized.');
 let body,packet;try{body=await boundedAcademyBody(request);packet=JSON.parse(body);}catch{return fail('Invalid request.',400);}
 const key=await crypto.subtle.importKey('raw',enc.encode(env.ACADEMY_PROFILE_SYNC_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),b=>parseInt(b,16)),enc.encode('hifz-handoff-v1:'+body)))return fail('Not authorized.');
 if(packet?.target!==env.ACADEMY_SYNC_TARGET||!Number.isSafeInteger(packet.issuedAt)||Math.abs(Date.now()-packet.issuedAt)>30000||!codePattern.test(packet.codeChallenge||'')||packet.profile?.active!==1||!Number.isSafeInteger(packet.profile?.credentialEpoch))return fail('Invalid or expired sign-in request.');
 const applied=await applyAcademyProfiles([packet.profile],env);if(applied.error)return applied;
 const p=packet.profile,code=b64(crypto.getRandomValues(new Uint8Array(32))),codeHash=b64(await digest(code)),expiresAt=Date.now()+60000;
 // A stale assertion cannot mint a pass after a newer local delivery. The
 // code is tied to the resulting local epoch, not to a mutable login alias.
 const result=await env.DB.batch([
  env.DB.prepare('DELETE FROM academy_signin_tickets WHERE expires_at<=?').bind(Date.now()),
  env.DB.prepare(`INSERT INTO academy_signin_tickets(code_hash,student_id,code_challenge,credential_epoch,expires_at)
   SELECT ?,s.id,?,s.credential_epoch,? FROM students s JOIN academy_profile_links l ON l.student_id=s.id
   WHERE l.academy_user_id=? AND l.source_revision=? AND l.source_credential_epoch=? AND s.active=1 AND s.academy_managed=1`)
   .bind(codeHash,packet.codeChallenge,expiresAt,p.academyUserId,p.revision,p.credentialEpoch)
 ]);
 if(result[1].meta.changes!==1)return fail('Profile changed. Open Hifz from Academy again.',409);
 return {data:{code,expiresIn:60}};
}
export async function handleAcademySignin(request,env){
 if(env.ACADEMY_HANDOFF_ENABLED!=='1')return fail('Academy sign-in is unavailable.',503);
 if(request.headers.get('Origin')!==env.HIFZ_FRONTEND_ORIGIN)return fail('Open Hifz from Academy again.');
 let input;try{const body=await boundedAcademyBody(request);if(body.length>1024)return fail('Invalid request.',400);input=JSON.parse(body);}catch{return fail('Invalid request.',400);}
 if(!codePattern.test(input?.code||'')||!codePattern.test(input?.verifier||''))return fail('Invalid sign-in pass.');
 const codeHash=b64(await digest(input.code)),challenge=b64(await digest(input.verifier));
 // DELETE ... RETURNING is the one atomic consume. A competing request can
 // never redeem the same pass; an invalid verifier does not destroy it.
 const ticket=await env.DB.prepare(`DELETE FROM academy_signin_tickets WHERE code_hash=? AND code_challenge=? AND expires_at>?
  AND EXISTS(SELECT 1 FROM students s WHERE s.id=student_id AND s.active=1 AND s.academy_managed=1 AND s.credential_epoch=academy_signin_tickets.credential_epoch)
  RETURNING student_id,credential_epoch`).bind(codeHash,challenge,Date.now()).first();
 if(!ticket)return fail('This sign-in pass expired or was already used. Open Hifz from Academy again.');
 const row=await env.DB.prepare('SELECT id,login_id,name,role,credential_epoch FROM students WHERE id=? AND active=1 AND credential_epoch=?').bind(ticket.student_id,ticket.credential_epoch).first();
 if(!row)return fail('Your profile changed. Open Hifz from Academy again.');
 return {data:await issueHifzSession(row,env)};
}
