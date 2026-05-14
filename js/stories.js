// CQP Toulouse — stories.js v3 — Stories par quartier
'use strict'

const Stories = (() => {
  const QUARTIERS = [
    'Bagatelle','Faourette','Reynerie','Bellefontaine',
    'Papus','Empalot','Izards','Croix d\'Aurade',
    'Arènes','Bourbaki','Grand Mirail','Autre'
  ]

  // Couleurs de fond par quartier si pas de photo
  const COLORS = {
    'Bagatelle':'#C8102E','Faourette':'#1565C0','Reynerie':'#2E7D32',
    'Bellefontaine':'#6A1B9A','Papus':'#E65100','Empalot':'#00695C',
    'Izards':'#AD1457','Croix d\'Aurade':'#4527A0','Arènes':'#558B2F',
    'Bourbaki':'#1565C0','Grand Mirail':'#C8102E','Autre':'#546E7A'
  }

  let _storiesByQuartier = {} // { quartier: [story, ...] }
  let _currentQuartier = null
  let _currentIdx = 0
  let _timer = null

  // ── LOAD ─────────────────────────────────────────────────────
  const load = async (barEl) => {
    if (!barEl) return
    const { data } = await Api.getStories()
    _storiesByQuartier = {}
    // Grouper par quartier
    ;(data || []).forEach(s => {
      const q = s.quartier || 'Autre'
      if (!_storiesByQuartier[q]) _storiesByQuartier[q] = []
      _storiesByQuartier[q].push(s)
    })
    _render(barEl)
  }

  // ── RENDER CARDS ──────────────────────────────────────────────
  const _render = barEl => {
    barEl.innerHTML = QUARTIERS.map(q => {
      const stories = _storiesByQuartier[q] || []
      const latest = stories[0]
      const hasNew = stories.length > 0
      const bg = COLORS[q] || '#546E7A'
      const count = stories.length

      return `
        <div class="story-thumb" onclick="Stories.openQuartier('${q.replace(/'/g,"\\'")}')">
          ${latest?.photo_url
            ? `<img class="story-thumb-bg" src="${Utils.esc(latest.photo_url)}" alt="">`
            : `<div style="position:absolute;inset:0;background:${bg};"></div>`
          }
          <div class="story-thumb-overlay"></div>
          ${hasNew ? `<div style="position:absolute;top:6px;right:6px;background:var(--rouge);color:#fff;font-size:9px;font-weight:700;border-radius:10px;padding:2px 6px;font-family:system-ui;">${count}</div>` : ''}
          <div class="story-ring ${hasNew ? '' : 'story-ring-seen'}" style="background:${bg};">
            <div class="story-av" style="font-size:8px;font-weight:700;color:#fff;font-family:system-ui;">📍</div>
          </div>
          <div class="story-name">${q}</div>
        </div>`
    }).join('')
  }

  // ── OPEN QUARTIER ─────────────────────────────────────────────
  const openQuartier = quartier => {
    const stories = _storiesByQuartier[quartier] || []
    if (!stories.length) {
      // Aucune story — proposer d'en créer une
      openCompose(quartier)
      return
    }
    _currentQuartier = quartier
    _currentIdx = 0
    _openViewer(stories)
  }

  const _openViewer = stories => {
    const viewer = document.getElementById('sv')
    if (!viewer) return
    viewer.classList.add('open')
    document.body.style.overflow = 'hidden'
    _renderViewer(stories)
  }

  const _renderViewer = stories => {
    const s = stories[_currentIdx]
    if (!s) return
    const viewer = document.getElementById('sv')

    const mediaHtml = s.video_url
      ? `<video src="${Utils.esc(s.video_url)}" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>`
      : s.photo_url
      ? `<img src="${Utils.esc(s.photo_url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
      : `<div style="position:absolute;inset:0;background:${COLORS[_currentQuartier]||'#333'};"></div>`

    const bars = viewer.querySelector('.sv-bars')
    if (bars) bars.innerHTML = stories.map((_,i) =>
      `<div class="sv-bar"><div class="sv-bar-fill" id="svb-${i}" style="width:${i<_currentIdx?'100%':'0%'}"></div></div>`
    ).join('')

    const bg = viewer.querySelector('.sv-bg')
    if (bg) bg.innerHTML = mediaHtml

    const meta = viewer.querySelector('.sv-meta')
    if (meta) meta.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${COLORS[_currentQuartier]||'#333'};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;">📍</div>
        <div>
          <div style="font-size:.88rem;font-weight:700;color:#fff;">${Utils.esc(_currentQuartier)}</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.7);">${Utils.esc(s.prenom||'')} · ${Utils.timeAgo(s.created_at)}</div>
        </div>
      </div>`

    const txt = viewer.querySelector('.sv-text')
    if (txt) txt.textContent = s.texte || ''

    clearTimeout(_timer)
    _timer = setTimeout(next, 5000)
    // Progress bar animation
    const fill = document.getElementById(`svb-${_currentIdx}`)
    if (fill) { fill.style.transition = 'width 5s linear'; fill.style.width = '100%' }
  }

  const close = () => {
    clearTimeout(_timer)
    document.getElementById('sv')?.classList.remove('open')
    document.body.style.overflow = ''
  }

  const next = () => {
    clearTimeout(_timer)
    const stories = _storiesByQuartier[_currentQuartier] || []
    if (_currentIdx < stories.length - 1) { _currentIdx++; _renderViewer(stories) }
    else close()
  }

  const prev = () => {
    clearTimeout(_timer)
    const stories = _storiesByQuartier[_currentQuartier] || []
    if (_currentIdx > 0) { _currentIdx--; _renderViewer(stories) }
  }

  // ── COMPOSE ──────────────────────────────────────────────────
  const openCompose = (preselectedQuartier = null) => {
    if (!Auth.getCode()) { window.location.href = 'profil.html'; return }
    const drawer = document.getElementById('story-drawer')
    if (!drawer) return

    // Injecter le sélecteur de quartier
    const select = document.getElementById('story-quartier-select')
    if (select) {
      select.innerHTML = QUARTIERS.map(q =>
        `<option value="${q}" ${q === (preselectedQuartier || Auth.getQuartier?.() || '') ? 'selected' : ''}>${q}</option>`
      ).join('')
    }

    drawer.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  // ── PUBLISH ──────────────────────────────────────────────────
  const publish = async () => {
    const prenom = Auth.getPrenom()
    const file = document.getElementById('story-photo-inp')?.files?.[0]
    const texte = document.getElementById('story-texte')?.value?.trim() || ''
    const quartier = document.getElementById('story-quartier-select')?.value || 'Autre'
    const msg = document.getElementById('story-msg')

    if (!file) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='⚠️ Photo ou vidéo obligatoire' }
      return
    }
    const isVideo = file.type.startsWith('video/')
    if (msg) { msg.style.color='var(--txt3)'; msg.textContent='Upload en cours…' }
    try {
      let photo_url = null, video_url = null
      if (isVideo) video_url = await Api.uploadPhoto(file, 'stories')
      else photo_url = await Api.uploadPhoto(file, 'stories')

      const { error } = await Api.createStory({ prenom, photo_url, video_url, texte, quartier })
      if (error) throw error

      Utils.toast('Story publiée dans ' + quartier + ' !', 'success')
      document.getElementById('story-drawer')?.classList.remove('open')
      document.body.style.overflow = ''
      document.getElementById('story-photo-inp').value = ''
      const img = document.getElementById('story-preview-img')
      const vid = document.getElementById('story-preview-vid')
      if (img) { img.style.display='none'; img.src='' }
      if (vid) { vid.style.display='none'; vid.src='' }
      if (document.getElementById('story-texte')) document.getElementById('story-texte').value = ''
      if (msg) msg.textContent = ''
      load(document.querySelector('.stories-bar'))
    } catch(e) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='Erreur: '+e.message }
      Utils.toast('Erreur publication', 'error')
    }
  }

  return { load, openQuartier, openCompose, close, next, prev, publish, QUARTIERS }
})()
