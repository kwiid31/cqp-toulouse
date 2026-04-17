
// Patch: compteur de vues stories
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
console.log('patch.js: openStoryViewer patché ✅');
