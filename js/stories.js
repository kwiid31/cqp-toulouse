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
        <div class="add-story-txt">Story</div>
      </div>
      ${_stories.map((s,i) => `
        <div class="story-thumb" onclick="Stories.open(${i})">
          <div class="story-ring">
            <div class="story-av">
              ${s.photo_url ? `<img src="${Utils.esc(s.photo_url)}" alt="">` : Utils.esc((s.prenom||'?')[0].toUpperCase())}
            </div>
          </div>
          <div class="story-name">${Utils.esc(s.prenom||'')}</div>
        </div>`).join('')}`
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
    document.getElementById('story-drawer')?.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  const publish = async () => {
    const prenom = Auth.getPrenom()
    const file = document.getElementById('story-photo-inp')?.files?.[0]
    const msg = document.getElementById('story-msg')
    // ⚠️ photo_url NOT NULL en DB — obligatoire
    if (!file) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='⚠️ Photo obligatoire pour une story' }
      Utils.toast('Photo obligatoire pour une story', 'error')
      return
    }
    if (msg) { msg.style.color='var(--txt3)'; msg.textContent='Upload en cours…' }
    try {
      const photo_url = await Api.uploadPhoto(file, 'stories')
      const { error } = await Api.createStory({ prenom, photo_url })
      if (error) throw error
      Utils.toast('Story publiée !', 'success')
      document.getElementById('story-drawer')?.classList.remove('open')
      document.body.style.overflow = ''
      if (document.getElementById('story-photo-inp')) document.getElementById('story-photo-inp').value = ''
      if (document.getElementById('story-preview-img')) { document.getElementById('story-preview-img').style.display='none' }
      if (msg) msg.textContent = ''
      load(document.querySelector('.stories-bar'))
    } catch (e) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='Erreur: '+e.message }
      Utils.toast('Erreur publication story', 'error')
    }
  }

  return { load, open, close, next, prev, openCompose, publish }
})()
