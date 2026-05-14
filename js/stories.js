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
    const photo = Auth.getPhoto ? Auth.getPhoto() : null

    // Card "Créer ma story" en premier
    const createCard = `
      <div class="add-story" onclick="Stories.openCompose()">
        <div class="add-story-photo">${photo ? `<img src="${Utils.esc(photo)}" alt="">` : ''}</div>
        <div class="add-story-ring">+</div>
        <div class="add-story-txt">Créer une<br>story</div>
      </div>`

    // Cards quartier
    const quartierCards = QUARTIERS.map(q => {
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
          ${count > 0 ? `<div style="position:absolute;top:6px;right:6px;background:#C8102E;color:#fff;font-size:9px;font-weight:700;border-radius:10px;padding:2px 6px;">${count}</div>` : ''}
          <div class="story-ring" style="background:${bg};border-color:${hasNew ? '#fff' : 'rgba(255,255,255,.3)'};">
            <div class="story-av" style="font-size:12px;">📍</div>
          </div>
          <div class="story-name">${q}</div>
        </div>`
    }).join('')

    barEl.innerHTML = createCard + quartierCards
  }

  // ── OPEN QUARTIER ─────────────────────────────────────────────
  const openQuartier = quartier => {
    _currentQuartier = quartier
    _currentIdx = 0
    const stories = _storiesByQuartier[quartier] || []
    // Toujours ouvrir le viewer, même vide (on montre un état vide)
    _openViewer(quartier, stories)
  }

  const _openViewer = (quartier, stories) => {
    const viewer = document.getElementById('sv')
    if (!viewer) return
    viewer.classList.add('open')
    document.body.style.overflow = 'hidden'

    if (!stories.length) {
      // État vide — fond couleur + message
      const bg = COLORS[quartier] || '#333'
      const svBg = document.getElementById('sv-bg')
      if (svBg) svBg.innerHTML = `<div style="position:absolute;inset:0;background:${bg};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;"><div style="font-size:3rem;">📍</div><div style="color:#fff;font-size:1.1rem;font-weight:700;">${Utils.esc(quartier)}</div><div style="color:rgba(255,255,255,.7);font-size:.9rem;">Aucune story pour l'instant</div><button onclick="Stories.close();Stories.openCompose('${quartier.replace(/'/,"\\'")}');" style="background:#fff;color:#111;border:none;padding:10px 20px;border-radius:20px;font-weight:700;font-size:.88rem;cursor:pointer;margin-top:8px;">+ Publier une story ici</button></div>`
      const bars = document.getElementById('sv-bars')
      if (bars) bars.innerHTML = ''
      const meta = document.getElementById('sv-meta')
      if (meta) meta.innerHTML = ''
      const txt = document.getElementById('sv-text')
      if (txt) txt.textContent = ''
      return
    }
    _renderViewer(stories)
  }

  const _renderViewer = stories => {
    const s = stories[_currentIdx]
    if (!s) return

    // Bars
    const bars = document.getElementById('sv-bars')
    if (bars) bars.innerHTML = stories.map((_,i) =>
      `<div class="sv-bar"><div class="sv-bar-fill" id="svb-${i}" style="width:${i<_currentIdx?'100%':'0%'}"></div></div>`
    ).join('')

    // Media
    const svBg = document.getElementById('sv-bg')
    if (svBg) {
      if (s.video_url) {
        svBg.innerHTML = `<video id="sv-video" src="${Utils.esc(s.video_url)}" autoplay muted playsinline preload="auto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>`
        // Bouton son — dans svBg pour être sûr qu'il existe
        let soundBtn = document.getElementById('sv-sound-btn')
        if (!soundBtn) {
          soundBtn = document.createElement('button')
          soundBtn.id = 'sv-sound-btn'
          soundBtn.style.cssText = 'position:absolute;bottom:70px;right:16px;z-index:20;background:rgba(0,0,0,.55);border:none;border-radius:50%;width:40px;height:40px;font-size:1.2rem;display:flex;align-items:center;justify-content:center;cursor:pointer;'
          soundBtn.innerHTML = '🔇'
          svBg.appendChild(soundBtn)
        } else {
          soundBtn.style.display = 'flex'
          soundBtn.innerHTML = '🔇'
        }
        soundBtn.onclick = (e) => {
          e.stopPropagation()
          const v = document.getElementById('sv-video')
          if (!v) return
          v.muted = !v.muted
          soundBtn.innerHTML = v.muted ? '🔇' : '🔊'
        }
      } else if (s.photo_url) {
        svBg.innerHTML = `<img src="${Utils.esc(s.photo_url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
      } else {
        svBg.innerHTML = `<div style="position:absolute;inset:0;background:${COLORS[_currentQuartier]||'#333'};"></div>`
      }
    }

    // Meta
    const bg = COLORS[_currentQuartier] || '#333'
    const meta = document.getElementById('sv-meta')
    if (meta) meta.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:36px;height:36px;border-radius:50%;background:${bg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>
        <div>
          <div style="font-size:.9rem;font-weight:700;color:#fff;">${Utils.esc(_currentQuartier)}</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.75);">${Utils.esc(s.prenom||'')} · ${Utils.timeAgo(s.created_at)}</div>
        </div>
      </div>`

    // Texte
    const txt = document.getElementById('sv-text')
    if (txt) txt.textContent = s.texte || ''

    // Progress bar + timer
    clearTimeout(_timer)
    if (s.video_url) {
      // Pour les vidéos : attendre la durée réelle
      requestAnimationFrame(() => {
        const vid = document.getElementById('sv-video')
        const startTimer = (duration) => {
          const ms = Math.min(duration * 1000, 60000)
          const fill = document.getElementById(`svb-${_currentIdx}`)
          if (fill) { fill.style.transition = 'none'; fill.style.width = '0%';
            requestAnimationFrame(() => { fill.style.transition = `width ${ms/1000}s linear`; fill.style.width = '100%' })
          }
          _timer = setTimeout(next, ms)
        }
        if (vid) {
          if (vid.duration && !isNaN(vid.duration)) {
            startTimer(vid.duration)
          } else {
            vid.addEventListener('loadedmetadata', () => startTimer(vid.duration || 5), { once: true })
            // Fallback si metadata ne charge pas
            _timer = setTimeout(next, 60000)
          }
        }
      })
    } else {
      _timer = setTimeout(next, 5000)
      requestAnimationFrame(() => {
        const fill = document.getElementById(`svb-${_currentIdx}`)
        if (fill) { fill.style.transition = 'none'; fill.style.width = '0%';
          requestAnimationFrame(() => { fill.style.transition = 'width 5s linear'; fill.style.width = '100%' })
        }
      })
    }
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
