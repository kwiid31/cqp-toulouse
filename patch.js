/**
 * CQP Toulouse — patch.js v4
 * Stories complètes + scroll infini + UX fixes
 * Toutes les fonctions accessibles depuis window.*
 */

// ── VARIABLES GLOBALES (si pas encore définies) ──────────────────────────────
if(typeof window.storyFile==='undefined') window.storyFile=null;
if(typeof window.storyVideoFile==='undefined') window.storyVideoFile=null;
if(typeof window.storyDataUrl==='undefined') window.storyDataUrl=null;
if(typeof window.svStories==='undefined') window.svStories=[];
if(typeof window.svIdx==='undefined') window.svIdx=0;
if(typeof window.svTimer==='undefined') window.svTimer=null;
if(typeof window.SV_DURATION==='undefined') window.SV_DURATION=5000;

// ── STORIES : toutes les fonctions sur window ─────────────────────────────────
window.showStoryMsg = function(txt, type){
  const el=document.getElementById('story-msg');
  if(!el)return;
  el.textContent=txt;
  el.className='form-msg '+(type==='ok'?'ok':'err');
};

window.openStoryUpload = function(){
  window.storyFile=null; window.storyVideoFile=null; window.storyDataUrl=null;
  const zone=document.getElementById('story-zone');
  if(zone){ zone.querySelectorAll('img,video').forEach(el=>el.remove()); }
  const lbl=document.getElementById('story-zone-label');
  const hnt=document.getElementById('story-zone-hint');
  if(lbl)lbl.style.display='';
  if(hnt)hnt.style.display='';
  const msg=document.getElementById('story-msg');
  if(msg){msg.className='form-msg';msg.textContent='';}
  const btn=document.getElementById('story-submit-btn');
  if(btn){btn.disabled=false;btn.textContent='Publier ma story ✨';}
  try{const p=localStorage.getItem('cqp_prenom');if(p){const el=document.getElementById('story-prenom');if(el)el.value=p;}}catch{}
  const modal=document.getElementById('story-modal-ov');
  if(modal)modal.classList.add('open');
  document.body.style.overflow='hidden';
  // Ouvrir caméra directement
  setTimeout(()=>{
    const inp=document.getElementById('story-file-input');
    if(inp){inp.accept='image/*';inp.setAttribute('capture','environment');inp.click();}
  },200);
};

window.closeStoryUpload = function(){
  const modal=document.getElementById('story-modal-ov');
  if(modal)modal.classList.remove('open');
  document.body.style.overflow='';
};

window.triggerStoryCapture = function(mode){
  const inp=document.getElementById('story-file-input');
  if(!inp)return;
  inp.accept=mode==='video'?'video/*':'image/*';
  inp.setAttribute('capture','environment');
  inp.click();
};

window.triggerStoryGallery = function(){
  const inp=document.getElementById('story-file-input');
  if(!inp)return;
  inp.accept='image/*,video/*';
  inp.removeAttribute('capture');
  inp.click();
};

window.handleStoryFile = function(input){
  const file=input.files[0]; if(!file)return;
  const isVideo=file.type.startsWith('video/');
  if(isVideo){window.storyVideoFile=file;window.storyFile=null;}
  else{window.storyFile=file;window.storyVideoFile=null;}
  const zone=document.getElementById('story-zone');
  const lbl=document.getElementById('story-zone-label');
  const hnt=document.getElementById('story-zone-hint');
  if(lbl)lbl.style.display='none';
  if(hnt)hnt.style.display='none';
  if(zone)zone.querySelectorAll('img,video').forEach(el=>el.remove());
  if(isVideo){
    const vid=document.createElement('video');
    vid.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
    vid.autoplay=true;vid.muted=true;vid.loop=true;vid.playsInline=true;
    vid.src=URL.createObjectURL(file);
    if(zone)zone.appendChild(vid);
  }else{
    const reader=new FileReader();
    reader.onload=e=>{
      window.storyDataUrl=e.target.result;
      const img=document.createElement('img');
      img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      img.src=window.storyDataUrl;
      if(zone)zone.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
};

window.submitStory = async function(){
  const prenom=(document.getElementById('story-prenom')?.value||'').trim();
  const file=window.storyVideoFile||window.storyFile;
  if(!file){window.showStoryMsg('⚠ Choisis une photo ou vidéo','err');return;}
  if(!prenom){window.showStoryMsg('⚠ Entre ton prénom','err');return;}
  const btn=document.getElementById('story-submit-btn');
  if(btn){btn.disabled=true;btn.textContent='Publication…';}
  try{
    const isVideo=file.type.startsWith('video/');
    const ext=(file.name||'').split('.').pop()||(isVideo?'mp4':'jpg');
    const fname='story_'+Date.now()+'.'+ext;
    const{data:up,error:upErr}=await sb.storage.from('stories').upload(fname,file,{contentType:file.type,upsert:false});
    if(upErr)throw upErr;
    const{data:{publicUrl}}=sb.storage.from('stories').getPublicUrl(fname);
    const{error:dbErr}=await sb.from('stories').insert({
      prenom,photo_url:publicUrl,visible:false,
      media_type:isVideo?'video':'photo',views:0,
      expires_at:new Date(Date.now()+24*3600*1000).toISOString()
    });
    if(dbErr)throw dbErr;
    window.showStoryMsg('✅ Story envoyée ! Visible après validation.','ok');
    try{localStorage.setItem('cqp_prenom',prenom);}catch{}
    setTimeout(()=>window.closeStoryUpload(),2000);
  }catch(e){
    window.showStoryMsg('⚠ Erreur: '+e.message,'err');
    if(btn){btn.disabled=false;btn.textContent='Publier ma story ✨';}
  }
};

window.loadStories = async function(){
  try{
    const now=new Date().toISOString();
    const{data}=await sb.from('stories').select('*')
      .eq('visible',true).gt('expires_at',now)
      .order('created_at',{ascending:false}).limit(20);
    window.svStories=data||[];
    window.renderStoriesBar(window.svStories);
  }catch(e){console.warn('loadStories:',e);}
};

window.renderStoriesBar = function(stories){
  const bar=document.getElementById('stories-bar');
  if(!bar)return;
  bar.querySelectorAll('.story-dynamic').forEach(el=>el.remove());
  const seen=window.getSeenStories();
  stories.forEach((s,i)=>{
    const el=document.createElement('div');
    el.className='story story-dynamic'+(seen.has(String(s.id))?' seen':'');
    el.onclick=()=>window.openStoryViewer(i);
    const isVid=s.media_type==='video';
    el.innerHTML='<div class="story-ring" style="position:relative"><div class="story-inner">'
      +(isVid?'<span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border-radius:3px;font-size:.45rem;padding:1px 3px;z-index:2">▶</span>':'')
      +'<img src="'+(s.photo_url||'')+'" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div></div>'
      +'<span class="story-label">'+((s.prenom||'').substring(0,12))+'</span>'
      +((s.views||0)>0?'<span style="font-size:.52rem;color:#999;font-family:Barlow Condensed,sans-serif">👁 '+(s.views||0)+'</span>':'');
    bar.appendChild(el);
  });
};

window.getSeenStories = function(){
  try{return new Set(JSON.parse(localStorage.getItem('cqp_seen_stories')||'[]'));}catch{return new Set();}
};

window.markStorySeen = function(id){
  try{const s=window.getSeenStories();s.add(String(id));localStorage.setItem('cqp_seen_stories',JSON.stringify([...s]));}catch{}
};

window.openStoryViewer = function(idx){
  if(!window.svStories.length)return;
  window.svIdx=idx;
  const v=document.getElementById('story-viewer');
  if(v)v.classList.add('open');
  document.body.style.overflow='hidden';
  window.renderSvSlide();
  const s=window.svStories[idx];
  if(s&&s.id){
    sb.from('stories').update({views:(s.views||0)+1}).eq('id',s.id).then(()=>{
      s.views=(s.views||0)+1;
      const vc=document.getElementById('sv-views-count');
      if(vc)vc.textContent=s.views;
      window.renderStoriesBar(window.svStories);
    });
  }
};

window.closeStoryViewer = function(){
  clearTimeout(window.svTimer);
  const v=document.getElementById('story-viewer');
  if(v)v.classList.remove('open');
  document.body.style.overflow='';
  const vid=document.getElementById('sv-vid');
  if(vid){vid.pause();vid.src='';}
};

window.storyViewerNav = function(dir){
  clearTimeout(window.svTimer);
  window.svIdx+=dir;
  if(window.svIdx<0){window.closeStoryViewer();return;}
  if(window.svIdx>=window.svStories.length){window.closeStoryViewer();return;}
  window.renderSvSlide();
};

window.renderSvSlide = function(){
  clearTimeout(window.svTimer);
  const s=window.svStories[window.svIdx]; if(!s)return;
  window.markStorySeen(s.id);
  const vc=document.getElementById('sv-views-count');
  if(vc)vc.textContent=s.views||0;
  const imgEl=document.getElementById('sv-img');
  const vidEl=document.getElementById('sv-vid');
  if(s.media_type==='video'){
    if(imgEl)imgEl.style.display='none';
    if(vidEl){vidEl.style.display='block';vidEl.src=s.photo_url||'';vidEl.play().catch(()=>{});}
  }else{
    if(vidEl){vidEl.style.display='none';vidEl.pause();vidEl.src='';}
    if(imgEl){imgEl.style.display='block';imgEl.src=s.photo_url||'';}
  }
  const name=document.getElementById('sv-name');
  const time=document.getElementById('sv-time');
  const av=document.getElementById('sv-av');
  if(name)name.textContent=s.prenom||'';
  if(time)time.textContent=timeAgo(s.created_at);
  if(av)av.textContent=(s.prenom||'?')[0].toUpperCase();
  const prog=document.getElementById('sv-progress');
  if(prog)prog.innerHTML=window.svStories.map((_,i)=>'<div class="sv-bar"><div class="sv-bar-fill'+(i<window.svIdx?' done':'')+'" id="sv-fill-'+i+'"></div></div>').join('');
  requestAnimationFrame(()=>{
    const fill=document.getElementById('sv-fill-'+window.svIdx);
    if(fill){fill.style.transition='width '+window.SV_DURATION+'ms linear';fill.style.width='100%';}
  });
  window.svTimer=setTimeout(()=>window.storyViewerNav(1),window.SV_DURATION);
};

// ── SWIPE stories ─────────────────────────────────────────────────────────────
(function(){
  let sx=0,sy=0;
  const v=document.getElementById('story-viewer');if(!v)return;
  v.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  v.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx,dy=Math.abs(e.changedTouches[0].clientY-sy);
    if(Math.abs(dx)>50&&dy<60){dx<0?window.storyViewerNav(1):window.storyViewerNav(-1);}
  },{passive:true});
})();

// ── SCROLL INFINI ─────────────────────────────────────────────────────────────
const FEED_PAGE=8;
let allFeedItems=[];
let feedCursor=0;
let feedLoading=false;

window.renderNextBatch = function(){
  if(feedLoading)return;
  const batch=allFeedItems.slice(feedCursor,feedCursor+FEED_PAGE);
  if(!batch.length)return;
  feedLoading=true;
  const feed=document.getElementById('feed');
  batch.forEach(item=>{
    let html='';
    if(item._type==='actu')html=renderActuCard(item);
    else if(item._type==='evt')html=renderEvtCard(item);
    else if(item._type==='ann')html=renderAnnCard(item);
    if(html){
      const tmp=document.createElement('div');tmp.innerHTML=html;
      const card=tmp.firstElementChild;
      if(card){
        card.classList.add('reveal-card');
        feed.appendChild(card);
        requestAnimationFrame(()=>requestAnimationFrame(()=>card.classList.add('revealed')));
      }
    }
  });
  // Charger les counts pour ce batch
  const actuIds=batch.filter(i=>i._type==='actu').map(i=>i.id);
  const evtIds=batch.filter(i=>i._type==='evt').map(i=>i.id);
  const annIds=batch.filter(i=>i._type==='ann').map(i=>i.id);
  if(actuIds.length)loadAllCounts('actu',actuIds);
  if(evtIds.length)loadAllCounts('evenement',evtIds);
  if(annIds.length)loadAllCounts('annonce',annIds);
  feedCursor+=FEED_PAGE;
  feedLoading=false;
  if(feedCursor>=allFeedItems.length){
    const sep=document.createElement('div');
    sep.style.cssText='text-align:center;padding:24px;color:var(--txt3);font-family:Barlow Condensed,sans-serif;font-size:.75rem;letter-spacing:2px';
    sep.textContent='— depuis le début —';
    feed.appendChild(sep);
    feedCursor=0; // reboucler
  }
};

window.initScrollSentinel = function(){
  const sentinel=document.createElement('div');
  sentinel.id='scroll-sentinel';
  sentinel.style.height='1px';
  document.getElementById('feed')?.appendChild(sentinel);
  const obs=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting)window.renderNextBatch();
  },{rootMargin:'200px'});
  obs.observe(sentinel);
};

// ── Toast likes ───────────────────────────────────────────────────────────────
function showToast(msg,dur=2000){
  let t=document.getElementById('cqp-toast');
  if(!t){t=document.createElement('div');t.id='cqp-toast';t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(13,13,13,.9);color:#fff;padding:8px 18px;border-radius:20px;font-family:Barlow Condensed,sans-serif;font-size:.82rem;letter-spacing:.5px;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap;opacity:0';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';},dur);
}
const _origToggleLike=window.toggleLike;
if(_origToggleLike){
  window.toggleLike=async function(type,id){
    await _origToggleLike(type,id);
    const btn=document.getElementById('lk-'+id);
    if(btn&&btn.classList.contains('liked'))showToast('❤️ +1');
  };
}

// ── Contraste nav ─────────────────────────────────────────────────────────────
(function(){
  const s=document.createElement('style');
  s.textContent='.nav-item.active,.nav-item.active svg{color:var(--rouge)!important;stroke:var(--rouge)!important}.nav-item{color:#888!important}';
  document.head.appendChild(s);
})();

// ── Init au chargement ────────────────────────────────────────────────────────
window.addEventListener('load',()=>{
  if(typeof window.loadStories==='function') window.loadStories();
});

console.log('patch.js v4 ✅ — stories + scroll + UX');
