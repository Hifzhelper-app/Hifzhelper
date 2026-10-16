/* Hifzhelper build 4.2.15.29 | worker/src/academy-profile-sync.js */
// Authenticated, one-way Academy delivery. Ordinary Hifz requests stay local.
const fail=(message,status=400)=>({error:message,status});
const text=(value,max)=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
async function boundedBody(request){
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
  try{body=await boundedBody(request);packet=JSON.parse(body);}catch{return fail('Invalid sync body.');}
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ACADEMY_PROFILE_SYNC_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(signature.match(/../g),part=>parseInt(part,16));
  if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body)))return fail('Not authorized.',401);
  if(packet?.target!==env.ACADEMY_SYNC_TARGET||!Number.isSafeInteger(packet.issuedAt)||Math.abs(Date.now()-packet.issuedAt)>300000)return fail('Expired or wrong-target sync.',401);
  if(!Array.isArray(packet.profiles)||!packet.profiles.length||packet.profiles.length>8)return fail('Send one to eight profiles.');
  const fields=new Set(['academyUserId','revision','pinResetVersion','name','loginId','whatsappNumber','role','active']);
  const seen=new Set();
  for(const p of packet.profiles){
    if(!p||Object.keys(p).some(field=>!fields.has(field))||!text(p.academyUserId,160)||!text(p.name,160)||!text(p.loginId,160)
      ||typeof p.whatsappNumber!=='string'||p.whatsappNumber.length>32||!['student','teacher','admin'].includes(p.role)||![0,1].includes(p.active)
      ||!Number.isSafeInteger(p.revision)||p.revision<1||!Number.isSafeInteger(p.pinResetVersion)||p.pinResetVersion<0||seen.has(p.academyUserId))return fail('Invalid profile snapshot.');
    seen.add(p.academyUserId);
  }
  const statements=[];
  for(const p of packet.profiles){
    // Existing profiles are linked through reviewed immutable IDs. New Hifz
    // grants create a profile using the permanent Academy ID; a conflicting
    // legacy login alias fails the transaction rather than claiming its data.
    statements.push(env.DB.prepare(`INSERT INTO students(id,login_id,name,whatsapp_number,role,active,created_date,academy_managed)
      SELECT ?,?,?,?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM academy_profile_links WHERE academy_user_id=?)
      AND NOT EXISTS(SELECT 1 FROM students WHERE id=?)`).bind(p.academyUserId,p.loginId,p.name,p.whatsappNumber||null,p.role,p.active,new Date().toISOString().slice(0,10),p.academyUserId,p.academyUserId));
    statements.push(env.DB.prepare(`INSERT INTO academy_profile_links(academy_user_id,student_id) VALUES(?,?) ON CONFLICT(academy_user_id) DO NOTHING`).bind(p.academyUserId,p.academyUserId));
    const reset=`? > (SELECT pin_reset_version FROM academy_profile_links WHERE academy_user_id=?)`;
    statements.push(env.DB.prepare(`UPDATE students SET name=?,login_id=?,whatsapp_number=?,role=?,active=?,
      pin_hash=CASE WHEN ${reset} THEN NULL ELSE pin_hash END,
      failed_attempts=CASE WHEN ${reset} THEN 0 ELSE failed_attempts END,
      locked_until=CASE WHEN ${reset} THEN NULL ELSE locked_until END,
      credential_epoch=credential_epoch+CASE WHEN ${reset} THEN 1 ELSE 0 END
      WHERE id=(SELECT student_id FROM academy_profile_links WHERE academy_user_id=? AND source_revision<?)`)
      .bind(p.name,p.loginId,p.whatsappNumber||null,p.role,p.active,
        p.pinResetVersion,p.academyUserId,p.pinResetVersion,p.academyUserId,p.pinResetVersion,p.academyUserId,p.pinResetVersion,p.academyUserId,p.academyUserId,p.revision));
    statements.push(env.DB.prepare(`UPDATE academy_profile_links SET source_revision=?,pin_reset_version=MAX(pin_reset_version,?)
      WHERE academy_user_id=? AND source_revision<?`).bind(p.revision,p.pinResetVersion,p.academyUserId,p.revision));
  }
  try{await env.DB.batch(statements);}catch(error){
    if(/UNIQUE|FOREIGN KEY|CHECK/.test(String(error.message)))return fail('Profile link or login ID conflict. Review the mapping.',409);
    throw error;
  }
  return {data:{accepted:packet.profiles.length}};
}
