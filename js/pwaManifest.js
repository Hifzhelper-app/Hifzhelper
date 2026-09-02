/* Hifzhelper build 4.2.8 | js/pwaManifest.js */
// ============================================================
// Hifzhelper — platform-specific Web App Manifest link
// ============================================================

// iPhone/iPad Home Screen apps have storage separate from Safari. Linking
// the shared manifest there would force every installation to its generic
// start_url (/), discarding the /<uniqueID> page the student installed from
// before the standalone app has any remembered ID of its own.
//
// On Apple mobile devices, omit the shared manifest and let Add to Home
// Screen save the current personal URL. The existing Apple meta tags and
// touch icon still provide the standalone presentation. Other platforms keep
// the full manifest (including its generic start_url) for PWA installability,
// with V3.8.1's remembered-ID route still available there.
function isAppleMobilePlatform(nav = navigator){
  const userAgent = nav.userAgent || '';
  return /iPad|iPhone|iPod/.test(userAgent) ||
    (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
}

(function linkPlatformManifest(){
  if(isAppleMobilePlatform()) return;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = 'manifest.json';
  document.head.appendChild(link);
})();
