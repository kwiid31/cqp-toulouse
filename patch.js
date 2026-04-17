/**
 * CQP Toulouse — patch.js v2
 * Corrections UX : caméra directe, swipe stories, toasts, fixes mobile
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

// ── 2. Remplacer openStoryUpload : ouvrir caméra DIRECTEMENT ─────────────────
window.openStoryUpload = function(){
  storyFile=null; storyVideoFile=null; storyDataUrl=null;
  // Reset preview
  const zone=document.getElementById('story-zone');
  if(zone){
    zone.querySelectorAll('img,video').forEach(el=>el.remove());
    const lbl=document.getElementById('story-zone-label');
    const hnt=document.getElementById('story-zone-hint');
    if(lbl)lbl.style.display='';
    if(hnt)hnt.style.display='';
  }
  const msg=document.getElementById('story-msg');
  if(msg)msg.className='form-msg';
  const btn=document.getElementById('story-submit-btn');
  if(btn){btn.disabled=false;btn.textContent='Publier ma story ✨';}
  try{const p=localStorage.getItem('cqp_prenom');if(p){const el=document.getElementById('story-prenom');if(el)el.value=p;}}catch{}
  // Ouvrir DIRECTEMENT la caméra photo
  const inp=document.getElementById('story-file-input');
  if(inp){
    inp.accept='image/*';
    inp.setAttribute('capture','environment');
    inp.onchange=handleStoryFile;
    inp.click();
  }
  document.getElementById('story-modal-ov').classList.add('open');
  document.body.style.overflow='hidden';
};

// ── 3. Boutons du modal story : photo direct, vidéo direct, galerie ──────────
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

// ── 4. Toast UX après like ────────────────────────────────────────────────────
function showToast(msg, dur=2000){
  let t=document.getElementById('cqp-toast');
  if(!t){
    t=document.createElement('div');
    t.id='cqp-toast';
    t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(13,13,13,.9);color:#fff;padding:8px 18px;border-radius:20px;font-family:Barlow Condensed,sans-serif;font-size:.82rem;letter-spacing:.5px;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap';
    document.body.appendChild(t);
  }
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>{t.style.opacity='0';},dur);
}

// Wrapper toggleLike pour ajouter le toast
const _origToggleLike=window.toggleLike;
window.toggleLike=async function(type,id){
  await _origToggleLike(type,id);
  const btn=document.getElementById('lk-'+id);
  if(btn&&btn.classList.contains('liked')) showToast('❤️ +1');
};

// ── 5. Swipe horizontal sur le viewer story ───────────────────────────────────
(function(){
  let touchStartX=0,touchStartY=0;
  const viewer=document.getElementById('story-viewer');
  if(!viewer)return;
  viewer.addEventListener('touchstart',e=>{
    touchStartX=e.touches[0].clientX;
    touchStartY=e.touches[0].clientY;
  },{passive:true});
  viewer.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-touchStartX;
    const dy=Math.abs(e.changedTouches[0].clientY-touchStartY);
    if(Math.abs(dx)>50&&dy<60){
      if(dx<0) storyViewerNav(1);
      else storyViewerNav(-1);
    }
  },{passive:true});
})();

// ── 6. Mettre à jour le label du menu Publier ─────────────────────────────────
(function(){
  const items=document.querySelectorAll('.pub-menu-item');
  items.forEach(item=>{
    const small=item.querySelector('div div:last-child');
    if(small&&small.textContent.includes('Photo visible 24h')){
      small.textContent='Photo ou vidéo visible 24h par tous';
    }
  });
})();

console.log('patch.js v2 chargé ✅');
