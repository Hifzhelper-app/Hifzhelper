/* Hifzhelper build 5.0 | js/academy-handoff.js */
// A PKCE round trip binds Academy's one-use pass to the tab that requested it.
// No PIN, Academy session token or credential hash crosses through the URL.
async function handleAcademyHandoff(){
 const source=new URLSearchParams(location.search).get('academy');
 const starting=['1','www','pages'].includes(source);
 const returning=location.pathname==='/academy';
 if(!starting&&!returning)return false;
 hideAllLoginScreens();clearToken();document.getElementById('appShell').style.display='none';
 document.getElementById('academyHandoffScreen').classList.remove('hidden');
 const status=document.getElementById('academyHandoffStatus'),key='hh_academy_handoff';
 const pattern=/^[A-Za-z0-9_-]{43}$/;
 const base64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 try{
  if(!ACADEMY_INTEGRATION)throw new Error('Academy sign-in is not available at this address.');
  const academyOrigin=starting?(ACADEMY_INTEGRATION.origins?.[source]||new URL(ACADEMY_INTEGRATION.home).origin):new URL(ACADEMY_INTEGRATION.home).origin;
  document.getElementById('academyHandoffReturn').href=academyOrigin+'/academy/';
  if(starting){
   if(location.origin!==ACADEMY_INTEGRATION.hifzOrigin){location.replace(ACADEMY_INTEGRATION.hifzOrigin+location.pathname+'?academy='+encodeURIComponent(source));return true;}
   const loginId=getPathLoginId();if(!/^[A-Za-z0-9]+$/.test(loginId||''))throw new Error('Open Hifz using the link in Academy.');
   const verifier=base64(crypto.getRandomValues(new Uint8Array(32))),state=base64(crypto.getRandomValues(new Uint8Array(32)));
   const challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   sessionStorage.setItem(key,JSON.stringify({state,verifier,createdAt:Date.now()}));
   const target=new URL('/academy/hifz/',academyOrigin);target.search=new URLSearchParams({state,challenge,login:loginId}).toString();
   location.replace(target.href);return true;
  }
  const params=new URLSearchParams(location.hash.slice(1));
  history.replaceState(null,'','/academy');
  const stored=sessionStorage.getItem(key);sessionStorage.removeItem(key);
  const pending=stored?JSON.parse(stored):null;
  if(!pending||pending.state!==params.get('state')||!pattern.test(pending.verifier||'')||!pattern.test(params.get('code')||'')||!Number.isFinite(pending.createdAt)||Date.now()-pending.createdAt>180000||Date.now()<pending.createdAt)throw new Error('This sign-in request expired. Open Hifz from Academy again.');
  const result=await apiFetch('/auth/academy',{method:'POST',body:JSON.stringify({code:params.get('code'),verifier:pending.verifier})});
  if(!result.token||typeof result.login_id!=='string')throw new Error('Hifz could not complete sign-in.');
  setToken(result.token);rememberLoginId(result.login_id);replaceUrlWithLoginId(result.login_id);
  await bootApp();
 }catch(error){status.textContent=error.message||'Please return to Academy and open Hifz again.';}
 return true;
}
