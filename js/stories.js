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
      <div class="add-story" style="cursor:pointer;" onclick="if(Auth.getCode()){Stories.openCompose()}else{window.location.href='profil.html'}">
        <div class="add-story-photo">${photo ? `<img src="${Utils.esc(photo)}" alt="">` : ''}</div>
        <div class="add-story-ring">+</div>
        <div class="add-story-txt">Créer une<br>story</div>
      </div>`

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
    _initSwipe()
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
        svBg.innerHTML = `<video id="sv-video" src="${Utils.esc(s.video_url)}" autoplay muted playsinline preload="auto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;"></video>`
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
        svBg.innerHTML = `<img src="${Utils.esc(s.photo_url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">`
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

  const _cubeTransition = (direction, callback) => {
    const sv = document.getElementById('sv')
    if (!sv) { callback(); return }
    // direction: 'left' (next) ou 'right' (prev)
    const rotY = direction === 'left' ? -90 : 90
    sv.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)'
    sv.style.transformOrigin = direction === 'left' ? 'right center' : 'left center'
    sv.style.transform = `perspective(1200px) rotateY(${rotY}deg)`
    setTimeout(() => {
      sv.style.transition = 'none'
      sv.style.transform = `perspective(1200px) rotateY(${-rotY}deg)`
      callback()
      requestAnimationFrame(() => {
        sv.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)'
        sv.style.transform = 'perspective(1200px) rotateY(0deg)'
        setTimeout(() => { sv.style.transform = ''; sv.style.transition = '' }, 350)
      })
    }, 350)
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

  // Vrai cube 3D à deux faces — comme Facebook
  const _initSwipe = () => {
    const sv = document.getElementById('sv')
    if (!sv || sv.dataset.swipe) return
    sv.dataset.swipe = '1'

    let startX = 0, startY = 0, currentDx = 0, animating = false

    // Créer le conteneur cube
    const setupCube = () => {
      if (document.getElementById('sv-cube')) return
      const W = sv.offsetWidth || window.innerWidth
      const cube = document.createElement('div')
      cube.id = 'sv-cube'
      cube.style.cssText = `position:absolute;inset:0;transform-style:preserve-3d;width:${W}px;`

      // Face front — contient tout le viewer actuel (on clone le contenu)
      const front = document.createElement('div')
      front.id = 'sv-face-front'
      front.style.cssText = `position:absolute;width:${W}px;height:100%;top:0;left:0;backface-visibility:hidden;overflow:hidden;`
      // Copier le contenu visuel du sv dans la face front
      const svBg = document.getElementById('sv-bg')
      const svMeta = document.getElementById('sv-meta')
      const svBars = document.getElementById('sv-bars')
      if (svBg) front.appendChild(svBg.cloneNode(true))

      // Face suivante — à 90deg sur la droite du cube
      const next = document.createElement('div')
      next.id = 'sv-face-next'
      next.style.cssText = `position:absolute;width:${W}px;height:100%;top:0;left:0;backface-visibility:hidden;overflow:hidden;transform:rotateY(90deg) translateZ(${W/2}px) translateX(-${W/2}px);background:#111;display:flex;align-items:center;justify-content:center;`

      cube.appendChild(front)
      cube.appendChild(next)
      sv.style.perspective = `${W * 2}px`
      sv.style.perspectiveOrigin = 'center center'
      sv.style.position = 'relative'
      sv.appendChild(cube)
    }

    sv.addEventListener('touchstart', e => {
      if (animating) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      currentDx = 0
      setupCube()
    }, { passive: true })

    sv.addEventListener('touchmove', e => {
      if (animating) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(currentDx) < 10) return
      currentDx = dx

      const cube = document.getElementById('sv-cube')
      const nextFace = document.getElementById('sv-face-next')
      if (!cube) return

      // Rotation max ±90deg
      const rot = (dx / window.innerWidth) * 90

      // Préparer la face suivante
      const quartiersAvecStories = QUARTIERS.filter(q => (_storiesByQuartier[q] || []).length > 0)
      const idx = quartiersAvecStories.indexOf(_currentQuartier)
      const nextQ = dx < 0 ? quartiersAvecStories[idx + 1] : quartiersAvecStories[idx - 1]
      if (nextFace && nextQ) {
        const bg = '#1c1e21'
        const stories = _storiesByQuartier[nextQ] || []
        const s = stories[0]
        if (s?.photo_url) {
          nextFace.style.backgroundImage = `url(${s.photo_url})`
          nextFace.style.backgroundSize = 'cover'
          nextFace.style.backgroundPosition = 'center'
        } else {
          nextFace.style.background = '#1c1e21'
          nextFace.innerHTML = `<div style="color:#fff;font-size:18px;font-weight:700;">${nextQ}</div>`
        }
        // Positionner la face selon la direction
        const W = sv.offsetWidth || window.innerWidth
        if (dx < 0) {
          nextFace.style.transform = `rotateY(90deg) translateZ(${W/2}px) translateX(-${W/2}px)`
        } else {
          nextFace.style.transform = `rotateY(-90deg) translateZ(${W/2}px) translateX(${W/2}px)`
        }
      }

      cube.style.transition = 'none'
      cube.style.transform = `rotateY(${rot}deg)`
    }, { passive: true })

    sv.addEventListener('touchend', e => {
      if (animating) return
      const dx = currentDx
      const cube = document.getElementById('sv-cube')
      const quartiersAvecStories = QUARTIERS.filter(q => (_storiesByQuartier[q] || []).length > 0)
      const idx = quartiersAvecStories.indexOf(_currentQuartier)
      const threshold = window.innerWidth * 0.25

      const cleanup = () => {
        if (cube) cube.remove()
        sv.style.perspective = ''
        sv.dataset.swipe = ''
        animating = false
        _initSwipe()
      }

      if (dx < -threshold && idx < quartiersAvecStories.length - 1) {
        animating = true
        cube.style.transition = 'transform 0.3s cubic-bezier(.4,0,.2,1)'
        cube.style.transform = 'rotateY(-90deg)'
        setTimeout(() => { openQuartier(quartiersAvecStories[idx + 1]); cleanup() }, 300)
      } else if (dx > threshold && idx > 0) {
        animating = true
        cube.style.transition = 'transform 0.3s cubic-bezier(.4,0,.2,1)'
        cube.style.transform = 'rotateY(90deg)'
        setTimeout(() => { openQuartier(quartiersAvecStories[idx - 1]); cleanup() }, 300)
      } else {
        if (cube) {
          cube.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1)'
          cube.style.transform = 'rotateY(0deg)'
          setTimeout(cleanup, 250)
        }
      }
    }, { passive: true })
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
    // Lire le quartier sélectionné
    const sel = document.getElementById('story-quartier-select')
    if (sel && sel.value) _selectedQuartier = sel.value
    // Passer à l'étape 2
    const s1 = document.getElementById('story-step1')
    const s2 = document.getElementById('story-step2')
    if (s1) s1.style.display = 'none'
    if (s2) s2.style.display = 'block'
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
    const s1 = document.getElementById('story-step1')
    const s2 = document.getElementById('story-step2')
    if (s1) s1.style.display = 'block'
    if (s2) s2.style.display = 'none'
    _selectedFile = null
  }

  const openCompose = (preselectedQuartier = null) => {
    if (!Auth.getCode()) { window.location.href = 'profil.html'; return }
    _selectedQuartier = preselectedQuartier || localStorage.getItem('cqp_quartier') || QUARTIERS[0]
    // Montrer étape 1
    const s1 = document.getElementById('story-step1')
    const s2 = document.getElementById('story-step2')
    if (s1) s1.style.display = 'block'
    if (s2) s2.style.display = 'none'
    // Remplir le select
    const sel = document.getElementById('story-quartier-select')
    if (sel) {
      sel.innerHTML = QUARTIERS.map(q =>
        `<option value="${q}"${q === _selectedQuartier ? ' selected' : ''}>${q}</option>`
      ).join('')
      sel.onchange = () => { _selectedQuartier = sel.value }
    }
    const drawer = document.getElementById('story-drawer')
    if (drawer) { drawer.classList.add('open'); document.body.style.overflow = 'hidden' }
  }

  // ── PUBLISH ──────────────────────────────────────────────────
  const publish = async () => {
    const prenom = Auth.getPrenom() || 'Anonyme'
    const file = _selectedFile
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
