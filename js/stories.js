// CQP Toulouse — stories.js
const Stories = (() => {
  let _stories = []
  let _idx = 0
  let _timer = null
  const TTL = 5000

  const load = async (barEl) => {
    if (!barEl) return
    const { data } = await Api.getStories()
    _stories = data || []
    _render(barEl)
  }

  const _render = (barEl) => {
    const code = Auth.getCode()
    const prenom = Auth.getPrenom()
    barEl.innerHTML = `
      <div class="add-story" onclick="Stories.openCompose()">
        <div class="add-story-ring">+</div>
        <div class="add-story-txt">Story</div>
      </div>
      ${_stories.map((s, i) => `
        <div class="story-thumb" onclick="Stories.open(${i})">
          <div class="story-ring">
            <div class="story-av">
              ${s.photo_url ? `<img src="${Utils.esc(s.photo_url)}" alt="">` : Utils.esc((s.prenom || '?')[0].toUpperCase())}
            </div>
          </div>
          <div class="story-name">${Utils.esc(s.prenom || '')}</div>
        </div>`).join('')}`
  }

  const open = (idx) => {
    _idx = idx
    const viewer = document.getElementById('sv')
    if (!viewer || !_stories[idx]) return
    viewer.classList.add('open')
    document.body.style.overflow = 'hidden'
    _renderViewer()
    _startTimer()
  }

  const _renderViewer = () => {
    const s = _stories[_idx]
    if (!s) return
    const content = document.getElementById('sv-content')
    if (content) {
      content.innerHTML = `
        ${s.photo_url ? `<img src="${Utils.esc(s.photo_url)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" alt="">` : ''}
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.4) 0%,transparent 40%,transparent 60%,rgba(0,0,0,.6) 100%);"></div>
        <div style="position:absolute;top:50px;left:16px;right:16px;bottom:60px;display:flex;align-items:flex-end;">
          ${s.texte ? `<div style="color:#fff;font-size:1.1rem;line-height:1.6;text-shadow:0 1px 4px rgba(0,0,0,.5);">${Utils.esc(s.texte)}</div>` : ''}
        </div>`
    }
    const head = document.getElementById('sv-head')
    if (head) {
      head.innerHTML = `
        <div class="c-av c-av-36 c-av-init" style="background:var(--rouge);">${Utils.esc((s.prenom || '?')[0].toUpperCase())}</div>
        <div style="flex:1;"><div style="color:#fff;font-weight:600;font-size:.9rem;">${Utils.esc(s.prenom || '')}</div><div style="color:rgba(255,255,255,.6);font-size:.75rem;">${Utils.timeAgo(s.created_at)}</div></div>
        <button onclick="Stories.close()" style="background:none;border:none;color:rgba(255,255,255,.8);font-size:1.4rem;cursor:pointer;">✕</button>`
    }
    // Progress bars
    const bars = document.getElementById('sv-bars')
    if (bars) {
      bars.innerHTML = _stories.map((_, i) => `<div class="sv-bar"><div class="sv-bar-fill" id="svb-${i}" style="width:${i < _idx ? '100%' : '0%'}"></div></div>`).join('')
    }
  }

  const _startTimer = () => {
    clearTimeout(_timer)
    const bar = document.getElementById(`svb-${_idx}`)
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; setTimeout(() => { bar.style.transition = `width ${TTL}ms linear`; bar.style.width = '100%' }, 50) }
    _timer = setTimeout(next, TTL)
  }

  const next = () => { clearTimeout(_timer); if (_idx < _stories.length - 1) open(_idx + 1); else close() }
  const prev = () => { clearTimeout(_timer); if (_idx > 0) open(_idx - 1) }

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
    const code = Auth.getCode()
    const prenom = Auth.getPrenom()
    if (!code) return
    const texte = document.getElementById('story-texte')?.value.trim()
    const file = document.getElementById('story-photo-inp')?.files?.[0]
    let photo_url = null
    if (file) { try { photo_url = await Api.uploadPhoto(file, 'stories') } catch (e) { Utils.toast('Erreur upload photo', 'error'); return } }
    if (!texte && !photo_url) { Utils.toast('Ajoute du texte ou une photo', 'warn'); return }
    const { error } = await Api.createStory({ profil_code: code, prenom, texte: texte || null, photo_url })
    if (error) { Utils.toast('Erreur publication', 'error'); return }
    Utils.toast('Story publiée !', 'success')
    document.getElementById('story-drawer')?.classList.remove('open')
    document.body.style.overflow = ''
    if (document.getElementById('story-texte')) document.getElementById('story-texte').value = ''
    load(document.querySelector('.stories-bar'))
  }

  return { load, open, close, next, prev, openCompose, publish }
})()
