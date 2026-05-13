// CQP Toulouse — stories.js
const Stories = (() => {
  let _stories = [], _idx = 0, _timer = null
  const TTL = 5000

  const load = async barEl => {
    if (!barEl) return
    const { data } = await Api.getStories()
    _stories = data || []
    _render(barEl)
  }

  const _render = barEl => {
    barEl.innerHTML = `
      <div class="add-story" onclick="Stories.openCompose()">
        <div class="add-story-ring">+</div>
        <div class="add-story-txt">Votre story</div>
      </div>
      ${_stories.map((s,i) => {
        const bg = s.photo_url || s.video_url
        const isVideo = s.media_type === 'video' || (!s.photo_url && s.video_url)
        return `
        <div class="story-thumb" onclick="Stories.open(${i})">
          ${isVideo && s.video_url
            ? `<video class="story-thumb-bg" src="${Utils.esc(s.video_url)}" muted playsinline></video>`
            : s.photo_url
            ? `<img class="story-thumb-bg" src="${Utils.esc(s.photo_url)}" alt="">`
            : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,var(--rouge),#8B0000);"></div>`
          }
          <div class="story-thumb-overlay"></div>
          <div class="story-ring ${s.seen ? 'story-ring-seen' : ''}">
            <div class="story-av">
              ${s.photo_url ? `<img src="${Utils.esc(s.photo_url)}" alt="">` : Utils.esc((s.prenom||'?')[0].toUpperCase())}
            </div>
          </div>
          <div class="story-name">${Utils.esc(s.prenom||'')}</div>
        </div>`
      }).join('')}`
  }

  const open = idx => {
    _idx = idx
    const viewer = document.getElementById('sv')
    if (!viewer || !_stories[idx]) return
    viewer.classList.add('open')
    document.body.style.overflow = 'hidden'
    _renderViewer()
    _startTimer()
  }

  const _renderViewer = () => {
    const s = _stories[_idx]; if (!s) return
    const content = document.getElementById('sv-content')
    if (content) content.innerHTML = `
      ${s.photo_url ? `<img src="${Utils.esc(s.photo_url)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" alt="">` : ''}
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.4) 0%,transparent 40%,transparent 70%,rgba(0,0,0,.5) 100%);"></div>`
    const head = document.getElementById('sv-head')
    if (head) head.innerHTML = `
      <div class="c-av c-av-36 c-av-init">${Utils.esc((s.prenom||'?')[0].toUpperCase())}</div>
      <div style="flex:1;"><div style="color:#fff;font-weight:600;font-size:.9rem;">${Utils.esc(s.prenom||'')}</div><div style="color:rgba(255,255,255,.6);font-size:.75rem;">${Utils.timeAgo(s.created_at)}</div></div>
      <button onclick="Stories.close()" style="background:none;border:none;color:rgba(255,255,255,.8);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>`
    const bars = document.getElementById('sv-bars')
    if (bars) bars.innerHTML = _stories.map((_,i) => `<div class="sv-bar"><div class="sv-bar-fill" id="svb-${i}" style="width:${i<_idx?'100%':'0%'}"></div></div>`).join('')
  }

  const _startTimer = () => {
    clearTimeout(_timer)
    const bar = document.getElementById(`svb-${_idx}`)
    if (bar) { bar.style.transition='none'; bar.style.width='0%'; setTimeout(()=>{ bar.style.transition=`width ${TTL}ms linear`; bar.style.width='100%' },50) }
    _timer = setTimeout(next, TTL)
  }

  const next = () => { clearTimeout(_timer); if (_idx < _stories.length-1) open(_idx+1); else close() }
  const prev = () => { clearTimeout(_timer); if (_idx > 0) open(_idx-1) }
  const close = () => {
    clearTimeout(_timer)
    document.getElementById('sv')?.classList.remove('open')
    document.body.style.overflow = ''
  }

  const openCompose = () => {
    if (!Auth.getCode()) { window.location.href = 'profil.html'; return }
    // Ouvrir directement le sélecteur de fichier natif (photo/vidéo/bibliothèque)
    const inp = document.getElementById('story-photo-inp')
    if (inp) {
      inp.accept = 'image/*,video/*'
      inp.capture = '' // laisser le choix : galerie ou appareil
      inp.click()
      // Quand un fichier est choisi, afficher le drawer
      inp.onchange = () => {
        if (inp.files && inp.files[0]) {
          document.getElementById('story-drawer')?.classList.add('open')
          document.body.style.overflow = 'hidden'
          // Prévisualisation
          const reader = new FileReader()
          reader.onload = e => {
            const prev = document.getElementById('story-preview-img')
            if (prev) { prev.src = e.target.result; prev.style.display = 'block' }
          }
          reader.readAsDataURL(inp.files[0])
        }
      }
    } else {
      document.getElementById('story-drawer')?.classList.add('open')
      document.body.style.overflow = 'hidden'
    }
  }

  const publish = async () => {
    const prenom = Auth.getPrenom()
    const file = document.getElementById('story-photo-inp')?.files?.[0]
    const texte = document.getElementById('story-texte')?.value?.trim() || ''
    const msg = document.getElementById('story-msg')
    if (!file) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='⚠️ Photo ou vidéo obligatoire' }
      Utils.toast('Photo ou vidéo obligatoire', 'error')
      return
    }
    const isVideo = file.type.startsWith('video/')
    if (msg) { msg.style.color='var(--txt3)'; msg.textContent='Upload en cours…' }
    try {
      let photo_url = null, video_url = null
      if (isVideo) {
        video_url = await Api.uploadPhoto(file, 'stories')
      } else {
        photo_url = await Api.uploadPhoto(file, 'stories')
      }
      const { error } = await Api.createStory({ prenom, photo_url, video_url, texte })
      if (error) throw error
      Utils.toast('Story publiée !', 'success')
      document.getElementById('story-drawer')?.classList.remove('open')
      document.body.style.overflow = ''
      document.getElementById('story-photo-inp').value = ''
      const img = document.getElementById('story-preview-img')
      const vid = document.getElementById('story-preview-vid')
      if (img) img.style.display='none'
      if (vid) { vid.style.display='none'; vid.src='' }
      if (document.getElementById('story-texte')) document.getElementById('story-texte').value = ''
      if (msg) msg.textContent = ''
      load(document.querySelector('.stories-bar'))
    } catch (e) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='Erreur: '+e.message }
      Utils.toast('Erreur publication story', 'error')
    }
  }

  return { load, open, close, next, prev, openCompose, publish }
})()
