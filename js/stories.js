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
      <label class="add-story" style="cursor:pointer;">
        <div class="add-story-photo">${photo ? `<img src="${Utils.esc(photo)}" alt="">` : ''}</div>
        <div class="add-story-ring">+</div>
        <div class="add-story-txt">Créer une<br>story</div>
        <input type="file" accept="image/*,video/*" style="display:none"
          onchange="if(Auth.getCode()){Stories.previewFile(this)}else{window.location.href='profil.html'}">
      </label>`

    // Cards quartier
    const quartierCards = QUARTIERS.map(q => {
      const stories = _storiesByQuartier[q] || []
      const latest = stories[0]
      const hasNew = stories.length > 0
      const bg = '#e4e6eb'
      const count = stories.length

      return `
        <div class="story-thumb" onclick="Stories.openQuartier('${q.replace(/'/g,"\\'")}')">
          ${latest?.photo_url
            ? `<img class="story-thumb-bg" src="${Utils.esc(latest.photo_url)}" alt="">`
            : `<div style="position:absolute;inset:0;background:${bg};"></div>`
          }
          <div class="story-thumb-overlay"></div>
          ${count > 0 ? `<div style="position:absolute;top:6px;right:6px;background:#C8102E;color:#fff;font-size:9px;font-weight:700;border-radius:10px;padding:2px 6px;">${count}</div>` : ''}
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
      const bg = '#f0f2f5'
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

    // Bouton admin supprimer (visible seulement pour les admins)
    const adminBtn = document.getElementById('sv-admin-del')
    if (adminBtn) { adminBtn.style.display = Auth.isAdmin() ? 'block' : 'none'; adminBtn.textContent = '🗑 Supprimer'; adminBtn.disabled = false }

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
        const soundBtn = document.getElementById('sv-sound-btn')
        if (soundBtn) { soundBtn.style.display = 'flex'; soundBtn.textContent = '🔇' }
        // Dès que l'utilisateur touche le bouton volume physique → activer le son
        requestAnimationFrame(() => {
          const v = document.getElementById('sv-video')
          if (!v) return
          v.addEventListener('volumechange', () => {
            if (v.muted) return
            if (soundBtn) { soundBtn.textContent = '🔊' }
          }, { once: true })
        })
      } else if (s.photo_url) {
        svBg.innerHTML = `<img src="${Utils.esc(s.photo_url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
        const soundBtn = document.getElementById('sv-sound-btn')
        if (soundBtn) soundBtn.style.display = 'none'
      } else {
        svBg.innerHTML = `<div style="position:absolute;inset:0;background:#1c1e21;"></div>`
        const soundBtn = document.getElementById('sv-sound-btn')
        if (soundBtn) soundBtn.style.display = 'none'
      }
    }

    // Meta
    const bg = '#1c1e21'
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
  const closeCompose = () => {
    document.getElementById('story-drawer')?.classList.remove('open')
    document.body.style.overflow = ''
    const img = document.getElementById('story-preview-img')
    const vid = document.getElementById('story-preview-vid')
    if (img) { img.style.display = 'none'; img.src = '' }
    if (vid) { vid.style.display = 'none'; vid.src = '' }
    if (document.getElementById('story-msg')) document.getElementById('story-msg').textContent = ''
    _selectedFile = null
    _selectedQuartier = null
  }

  let _selectedFile = null
  let _selectedQuartier = null

  const previewFile = (inp) => {
    const f = inp.files[0]
    if (!f) return
    _selectedFile = f
    const isVideo = f.type.startsWith('video/')
    const img = document.getElementById('story-preview-img')
    const vid = document.getElementById('story-preview-vid')
    if (isVideo) { vid.src = URL.createObjectURL(f); vid.style.display = 'block'; if(img){img.style.display='none';img.src=''} }
    else { img.src = URL.createObjectURL(f); img.style.display = 'block'; if(vid){vid.style.display='none';vid.src=''} }
    // Quartier par défaut = celui du profil
    _selectedQuartier = localStorage.getItem('cqp_quartier') || 'Reynerie'
    // Ouvrir le drawer d'abord
    const drawer = document.getElementById('story-drawer')
    if (drawer) { drawer.classList.add('open'); document.body.style.overflow = 'hidden' }
    // Remplir le select après que le DOM soit visible
    setTimeout(() => {
      const sel = document.getElementById('story-quartier-select')
      if (!sel) return
      sel.innerHTML = QUARTIERS.map(q =>
        `<option value="${q}"${q === _selectedQuartier ? ' selected' : ''}>${q}</option>`
      ).join('')
      sel.onchange = () => { _selectedQuartier = sel.value }
    }, 50)
  }

  const selectQuartier = (el, q) => {
    _selectedQuartier = q
    const list = document.getElementById('story-quartier-list')
    if (!list) return
    list.querySelectorAll('div').forEach(d => {
      const isThis = d === el
      d.style.background = isThis ? '#C8102E' : 'var(--bg3)'
      const span = d.querySelector('span')
      if (span) { span.style.color = isThis ? '#fff' : 'var(--txt1)'; span.style.fontWeight = isThis ? '600' : '400' }
    })
  }

  const backToStep1 = () => {
    document.getElementById('story-step1').style.display = 'block'
    document.getElementById('story-step2').style.display = 'none'
    _selectedFile = null
  }

  const openCompose = (preselectedQuartier = null) => {
    if (!Auth.getCode()) { window.location.href = 'profil.html'; return }
    _selectedQuartier = preselectedQuartier || localStorage.getItem('cqp_quartier') || QUARTIERS[0]
    document.getElementById('story-step1').style.display = 'block'
    document.getElementById('story-step2').style.display = 'none'
    const drawer = document.getElementById('story-drawer')
    if (!drawer) return
    drawer.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  // ── PUBLISH ──────────────────────────────────────────────────
  const publish = async () => {
    const prenom = Auth.getPrenom() || 'Anonyme'
    const file = _selectedFile
    // Lire la valeur du select au moment de publier
    const sel = document.getElementById('story-quartier-select')
    const quartier = (sel && sel.value) || _selectedQuartier || localStorage.getItem('cqp_quartier') || 'Autre'
    const msg = document.getElementById('story-msg')

    if (!file) {
      if (msg) { msg.textContent = 'Sélectionne une photo ou vidéo' }
      return
    }
    const isVideo = file.type.startsWith('video/')
    if (msg) { msg.style.color='var(--txt3)'; msg.textContent='Upload en cours…' }
    try {
      let photo_url = null, video_url = null
      if (isVideo) video_url = await Api.uploadPhoto(file, 'stories')
      else photo_url = await Api.uploadPhoto(file, 'stories')

      const { error } = await Api.createStory({ prenom, photo_url, video_url, quartier })
      if (error) throw error

      Utils.toast('Story publiée dans ' + quartier + ' !', 'success')
      closeCompose()
      load(document.querySelector('.stories-bar'))
    } catch(e) {
      if (msg) { msg.style.color='var(--rouge)'; msg.textContent='Erreur: '+e.message }
      Utils.toast('Erreur publication', 'error')
    }
  }

  const toggleSound = () => {
    const v = document.getElementById('sv-video')
    const btn = document.getElementById('sv-sound-btn')
    if (!v) return
    v.muted = !v.muted
    if (btn) btn.textContent = v.muted ? '🔇' : '🔊'
  }

  const adminDeleteCurrent = async () => {
    const stories = _storiesByQuartier[_currentQuartier] || []
    const s = stories[_currentIdx]
    if (!s) return
    const adminBtn = document.getElementById('sv-admin-del')
    if (adminBtn) { adminBtn.textContent = '…'; adminBtn.disabled = true }
    const { error } = await sb.from('stories').update({ visible: false }).eq('id', s.id)
    if (error) { Utils.toast('Erreur : ' + error.message, 'error'); if (adminBtn) { adminBtn.textContent = '🗑 Supprimer'; adminBtn.disabled = false } return }
    _storiesByQuartier[_currentQuartier] = stories.filter(x => x.id !== s.id)
    Utils.toast('Story supprimée', 'success')
    const remaining = _storiesByQuartier[_currentQuartier]
    if (!remaining.length) close()
    else { if (_currentIdx >= remaining.length) _currentIdx = remaining.length - 1; _renderViewer(remaining) }
    const bar = document.getElementById('stories-bar')
    if (bar) load(bar)
  }

  // Realtime — retire les stories masquées par l'admin instantanément
  sb.channel('stories-moderation')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stories' }, (payload) => {
      if (payload.new?.visible === false) {
        const id = payload.new.id
        // Retirer de toutes les listes quartier
        for (const q of Object.keys(_storiesByQuartier)) {
          _storiesByQuartier[q] = _storiesByQuartier[q].filter(s => s.id !== id)
        }
        // Si on est en train de voir cette story → passer à la suivante ou fermer
        if (document.getElementById('sv')?.classList.contains('open')) {
          const stories = _storiesByQuartier[_currentQuartier] || []
          if (!stories.length) close()
          else _renderViewer(stories)
        }
        // Recharger la barre de stories
        const bar = document.getElementById('stories-bar')
        if (bar) load(bar)
      }
    })
    .subscribe()

  return { load, openQuartier, openCompose, closeCompose, previewFile, selectQuartier, backToStep1, close, next, prev, publish, toggleSound, adminDeleteCurrent, QUARTIERS }
})()
