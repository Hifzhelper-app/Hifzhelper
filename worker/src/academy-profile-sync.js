/* Hifzhelper build 5.0 | worker/src/academy-profile-sync.js */
import {isSharedPinHash} from './shared-pin-credential.js';
// Authenticated, one-way Academy delivery. Ordinary Hifz requests stay local.
const fail=(message,status=400)=>({error:message,status});
const text=(value,max)=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
export async function boundedAcademyBody(request){
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new Error('Body too large');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function handleAcademyProfileSync(request,env){
  if(!env.ACADEMY_SYNC_TARGET||typeof env.ACADEMY_PROFILE_SYNC_SECRET!=='string'||env.ACADEMY_PROFILE_SYNC_SECRET.length<32)return fail('Profile sync is not configured.',503);
  if(request.method!=='POST')return fail('Use POST.',405);
  const signature=request.headers.get('X-Academy-Sync-Signature')||'';
  if(!/^[0-9a-f]{64}$/.test(signature))return fail('Not authorized.',401);
  let body,packet;
  try{body=await boundedAcademyBody(request);packet=JSON.parse(body);}catch{return fail('Invalid sync body.');}
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ACADEMY_PROFILE_SYNC_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(signature.match(/../g),part=>parseInt(part,16));
  if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body)))return fail('Not authorized.',401);
  if(packet?.target!==env.ACADEMY_SYNC_TARGET||!Number.isSafeInteger(packet.issuedAt)||Math.abs(Date.now()-packet.issuedAt)>300000)return fail('Expired or wrong-target sync.',401);
  return applyAcademyProfiles(packet.profiles,env);
}
export async function applyAcademyProfiles(profiles,env){
  if(!Array.isArray(profiles)||!profiles.length||profiles.length>8)return fail('Send one to eight profiles.');
  const fields=new Set(['academyUserId','revision','pinResetVersion','name','loginId','whatsappNumber','role','active','credentialEpoch','pinHash']);
  const seen=new Set();
  for(const p of profiles){
    if(!p||Object.keys(p).some(field=>!fields.has(field))||!text(p.academyUserId,160)||!text(p.name,160)||!text(p.loginId,160)
      ||typeof p.whatsappNumber!=='string'||p.whatsappNumber.length>32||!['student','teacher','admin'].includes(p.role)||![0,1].includes(p.active)
      ||!Number.isSafeInteger(p.revision)||p.revision<1||!Number.isSafeInteger(p.pinResetVersion)||p.pinResetVersion<0||seen.has(p.academyUserId)
      ||(p.credentialEpoch!==undefined&&(!Number.isSafeInteger(p.credentialEpoch)||p.credentialEpoch<0))
      ||('pinHash' in p&&(p.credentialEpoch===undefined||(p.pinHash!==null&&!isSharedPinHash(p.pinHash)))))return fail('Invalid profile snapshot.');
    seen.add(p.academyUserId);
  }
  // Snapshots delivered before this release have no source credential epoch.
  // Bootstrap that metadata once even if the profile revision was already
  // acknowledged by the previous sender during the rolling deployment.
  const statements=[];
  for(const p of profiles){
    // Existing profiles are linked through reviewed immutable IDs. New Hifz
    // grants create a profile using the permanent Academy ID; a conflicting
    // legacy login alias fails the transaction rather than claiming its data.
    statements.push(env.DB.prepare(`INSERT INTO students(id,login_id,name,whatsapp_number,role,active,created_date,academy_managed)
      SELECT ?,?,?,?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM academy_profile_links WHERE academy_user_id=?)
      AND NOT EXISTS(SELECT 1 FROM students WHERE id=?)`).bind(p.academyUserId,p.loginId,p.name,p.whatsappNumber||null,p.role,p.active,new Date().toISOString().slice(0,10),p.academyUserId,p.academyUserId));
    statements.push(env.DB.prepare(`INSERT INTO academy_profile_links(academy_user_id,student_id) VALUES(?,?) ON CONFLICT(academy_user_id) DO NOTHING`).bind(p.academyUserId,p.academyUserId));
    const reset=`? > (SELECT pin_reset_version FROM academy_profile_links WHERE academy_user_id=?)`;
    const incoming='pinHash' in p, pin=p.pinHash??null;
    const changed=`(${reset} OR (?=1 AND pin_hash IS NOT ?))`;
    const changeArgs=[p.pinResetVersion,p.academyUserId,Number(incoming),pin];
    statements.push(env.DB.prepare(`UPDATE students SET name=?,login_id=?,whatsapp_number=?,role=?,active=?,
      failed_attempts=CASE WHEN ${changed} THEN 0 ELSE failed_attempts END,
      locked_until=CASE WHEN ${changed} THEN NULL ELSE locked_until END,
      credential_epoch=credential_epoch+CASE WHEN ${changed} THEN 1 ELSE 0 END,
      pin_hash=CASE WHEN ?=1 THEN ? WHEN ${reset} THEN NULL ELSE pin_hash END
      WHERE id=(SELECT student_id FROM academy_profile_links WHERE academy_user_id=? AND (source_revision<? OR(source_revision=? AND source_credential_epoch=0 AND ?>0)) AND source_credential_epoch<=?)`)
      .bind(p.name,p.loginId,p.whatsappNumber||null,p.role,p.active,...changeArgs,...changeArgs,...changeArgs,
        Number(incoming),pin,p.pinResetVersion,p.academyUserId,p.academyUserId,p.revision,p.revision,p.credentialEpoch??0,p.credentialEpoch??0));
    statements.push(env.DB.prepare(`UPDATE academy_profile_links SET source_revision=?,pin_reset_version=MAX(pin_reset_version,?),source_credential_epoch=MAX(source_credential_epoch,?)
      WHERE academy_user_id=? AND (source_revision<? OR(source_revision=? AND source_credential_epoch=0 AND ?>0)) AND source_credential_epoch<=?`).bind(p.revision,p.pinResetVersion,p.credentialEpoch??0,p.academyUserId,p.revision,p.revision,p.credentialEpoch??0,p.credentialEpoch??0));
  }
  try{await env.DB.batch(statements);}catch(error){
    if(/UNIQUE|FOREIGN KEY|CHECK/.test(String(error.message)))return fail('Profile link or login ID conflict. Review the mapping.',409);
    throw error;
  }
  return {data:{accepted:profiles.length}};
}
