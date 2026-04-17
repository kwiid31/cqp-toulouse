/**
 * CQP Toulouse — patch.js v3
 * Stories modération, caméra directe, swipe, toast, typo, contraste nav
 */

// ── 1. openStoryViewer avec compteur de vues ─────────────────────────────────
window.openStoryViewer = function(idx){
  if(!svStories.length)return;
  svIdx=idx;
  document.getElementById('story-viewer').classList.add('open');
  document.body.style.overflow='hidden';
  renderSvSlide();
  const s=svStories[idx];
  if(s&&s.id){
    sb.from('stories').update({views:(s.views||0)+1}).eq('id',s.id).then(()=>{
      s.views=(s.views||0)+1;
      const vc=document.getElementById('sv-views-count');
      if(vc)vc.textContent=s.views;
      renderStoriesBar(svStories);
    });
  }
};

// ── 2. Caméra directe au clic sur le + ───────────────────────────────────────
window.openStoryUpload = function(){
  storyFile=null; storyVideoFile=null; storyDataUrl=null;
  const zone=document.getElementById('story-zone');
  if(zone){
    zone.querySelectorAll('img,video').forEach(el=>el.remove());
    const lbl=document.getElementById('story-zone-label');
    const hnt=document.getElementById('story-zone-hint');
    if(lbl)lbl.style.display='';
    if(hnt)hnt.style.display='';
  }
  const msg=document.getElementById('story-msg');
  if(msg){msg.className='form-msg';msg.textContent='';}
  const btn=document.getElementById('story-submit-btn');
  if(btn){btn.disabled=false;btn.textContent='Publier ma story ✨';}
  try{const p=localStorage.getItem('cqp_prenom');if(p){const el=document.getElementById('story-prenom');if(el)el.value=p;}}catch{}
  // Ouvrir d'abord le modal, puis déclencher la caméra
  document.getElementById('story-modal-ov').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>{
    const inp=document.getElementById('story-file-input');
    if(inp){inp.accept='image/*';inp.setAttribute('capture','environment');inp.click();}
  },100);
};

// ── 3. Boutons du modal ───────────────────────────────────────────────────────
window.triggerStoryCapture = function(mode){
  const inp=document.getElementById('story-file-input');
  if(!inp)return;
  inp.accept=mode==='video'?'video/*':'image/*';
  inp.setAttribute('capture','environment');
  inp.onchange=handleStoryFile;
  inp.click();
};
window.triggerStoryGallery = function(){
  const inp=document.getElementById('story-file-input');
  if(!inp)return;
  inp.accept='image/*,video/*';
  inp.removeAttribute('capture');
  inp.onchange=handleStoryFile;
  inp.click();
};

// ── 4. submitStory : visible=false par défaut (modération) ───────────────────
window.submitStory = async function(){
  const prenom=(document.getElementById('story-prenom')?.value||'').trim();
  const msg=document.getElementById('story-msg');
  const btn=document.getElementById('story-submit-btn');
  const file=storyVideoFile||storyFile;
  if(!file){showStoryMsg('⚠ Choisis une photo ou une vidéo','err');return;}
  if(!prenom){showStoryMsg('⚠ Entre ton prénom','err');return;}
  btn.disabled=true;btn.textContent='Publication…';
  try{
    const isVideo=file.type.startsWith('video/');
    const ext=(file.name||'').split('.').pop()||(isVideo?'mp4':'jpg');
    const fname='story_'+Date.now()+'.'+ext;
    const{data:up,error:upErr}=await sb.storage.from('stories').upload(fname,file,{contentType:file.type,upsert:false});
    if(upErr)throw upErr;
    const{data:{publicUrl}}=sb.storage.from('stories').getPublicUrl(fname);
    const{error:dbErr}=await sb.from('stories').insert({
      prenom, photo_url:publicUrl,
      visible:false,   // ← modération : admin valide avant publication
      media_type:isVideo?'video':'photo',
      views:0,
      expires_at:new Date(Date.now()+24*3600*1000).toISOString()
    });
    if(dbErr)throw dbErr;
    // Message rassurant
    showStoryMsg('✅ Story envoyée ! Elle sera visible après validation (quelques minutes).','ok');
    try{localStorage.setItem('cqp_prenom',prenom);}catch{}
    setTimeout(()=>{closeStoryUpload();},2500);
  }catch(e){
    showStoryMsg('⚠ Erreur: '+e.message,'err');
    btn.disabled=false;btn.textContent='Publier ma story ✨';
  }
};

// ── 5. Toast après like ───────────────────────────────────────────────────────
function showToast(msg,dur=2000){
  let t=document.getElementById('cqp-toast');
  if(!t){
    t=document.createElement('div');t.id='cqp-toast';
    t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(13,13,13,.9);color:#fff;padding:8px 18px;border-radius:20px;font-family:Barlow Condensed,sans-serif;font-size:.82rem;letter-spacing:.5px;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap;opacity:0';
    document.body.appendChild(t);
  }
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>{t.style.opacity='0';},dur);
}
const _origToggleLike=window.toggleLike;
window.toggleLike=async function(type,id){
  await _origToggleLike(type,id);
  const btn=document.getElementById('lk-'+id);
  if(btn&&btn.classList.contains('liked'))showToast('❤️ +1');
};

// ── 6. Swipe horizontal viewer story ─────────────────────────────────────────
(function(){
  let sx=0,sy=0;
  const v=document.getElementById('story-viewer');if(!v)return;
  v.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  v.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx;
    const dy=Math.abs(e.changedTouches[0].clientY-sy);
    if(Math.abs(dx)>50&&dy<60){dx<0?storyViewerNav(1):storyViewerNav(-1);}
  },{passive:true});
})();

// ── 7. Bouton signaler une story ──────────────────────────────────────────────
window.reportStory = async function(storyId){
  if(!confirm('Signaler cette story comme inappropriée ?'))return;
  await sb.from('stories').update({reported:1}).eq('id',storyId);
  showToast('🚩 Story signalée, merci.');
};

// ── 8. Typo hero "Le Peuples'organise" → "Le Peuple s'organise" ──────────────
(function(){
  const h=document.querySelector('.hero-title');
  if(h&&h.innerHTML.includes("Le Peuple<br>"))return; // déjà bon
  if(h){
    // Chercher le texte mal formé
    h.innerHTML=h.innerHTML.replace("Le Peuples'organise","Le Peuple<br>s'organise");
  }
})();

// ── 9. Contraste bottom nav : item actif bien rouge ──────────────────────────
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .nav-item.active,.nav-item.active svg{color:var(--rouge)!important;stroke:var(--rouge)!important}
    .nav-item{color:#888!important}
    .nav-item:active{color:var(--rouge)!important}
  `;
  document.head.appendChild(style);
})();

console.log('patch.js v3 ✅');
