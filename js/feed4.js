// CQP Toulouse — feed3.js
// Charge TOUT le contenu (posts + actus + annonces) en une fois
// Mélange intelligemment et fait scroll circulaire quand tout est lu

const Feed = (() => {
  let _el = null
  let _allItems = []   // Tous les items mélangés
  let _index = 0       // Position courante dans la liste
  let _loading = false
  let _myLikes = new Set(JSON.parse(localStorage.getItem('cqp_likes') || '[]'))
  let _myCode = null, _mySid = null, _isAdmin = false

  const saveLikes = () => localStorage.setItem('cqp_likes', JSON.stringify([..._myLikes]))
  const spinner = () => `<div class="spinner"><div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div></div>`
  const CHUNK = 10  // Nombre d'items affichés par scroll

  // ── INIT ─────────────────────────────────────────────────────
  const init = async el => {
    _el = el
    _myCode = Auth.getCode()
    _mySid = Auth.getSid()
    _isAdmin = Auth.isAdmin()
    _el.innerHTML = spinner()

    // Charger tout en parallèle
    try {
      const [postsRes, actusRes, annoncesRes, evtsRes] = await Promise.all([
        Api.getFeed(0, 100),
        Api.getActus(null, 20),
        Api.getAnnonces(null, 20),
        Api.getEvenements(10)
      ])

      const posts = (postsRes.data || []).map(p => ({ _type: 'post', _data: p }))
      const actus = (actusRes.data || []).map(a => ({ _type: 'actu', _data: a }))
      const annonces = (annoncesRes.data || []).map(a => ({ _type: 'annonce', _data: a }))
      const evts = (evtsRes.data || []).map(a => ({ _type: 'evt', _data: a }))

      if (!posts.length) {
        _el.innerHTML = '<div class="empty">Aucune publication pour l\'instant.</div>'
        return
      }

      // Mélanger : 1 actu toutes les 4 posts, 1 annonce toutes les 6 posts
      _allItems = _buildFeed(posts, actus, annonces, evts)
      _index = 0
      _el.innerHTML = ''

      // Charger les likes une seule fois
      const ids = posts.map(p => p._data.id)
      const [{ data: likesData }, { data: cmtData }] = await Promise.all([
        Api.getLikesForFeed(ids),
        window.__sb.from('commentaires').select('item_id').eq('item_type','post').eq('visible',true).in('item_id', ids)
      ])
      const likeCounts = {}, cmtCounts = {}
      ;(likesData || []).forEach(l => {
        likeCounts[l.item_id] = (likeCounts[l.item_id] || 0) + 1
        if (l.session_id === _mySid || l.session_id === _myCode) _myLikes.add(l.item_id)
      })
      ;(cmtData || []).forEach(c => { cmtCounts[c.item_id] = (cmtCounts[c.item_id] || 0) + 1 })
      saveLikes()

      // Stocker les counts sur les items
      _allItems.forEach(item => {
        if (item._type === 'post') {
          item._likes = likeCounts[item._data.id] || 0
          item._cmts = cmtCounts[item._data.id] || 0
          item._liked = _myLikes.has(item._data.id)
        }
      })

      _renderChunk()
      _setupInfiniteScroll()

    } catch(e) {
      console.error('Feed init:', e)
      _el.innerHTML = '<div class="empty">⚠️ Connexion impossible.</div>'
    }
  }

  // ── CONSTRUCTION DU FEED MIXTE ────────────────────────────────
  const _buildFeed = (posts, actus, annonces, evts) => {
    const result = []
    let aIdx = 0
    // Injecter un bloc annonces toutes les 4 posts, evenements toutes les 7 posts
    var annoncesBloc = annonces.length ? { _type: 'bloc_annonces', _data: annonces } : null
    var evtsBloc = evts && evts.length ? { _type: 'bloc_evts', _data: evts } : null
    var annoncesInserted = false, evtsInserted = false

    posts.forEach((p, i) => {
      result.push(p)
      // Toutes les 4 posts → actu
      if ((i + 1) % 4 === 0 && aIdx < actus.length) {
        result.push(actus[aIdx++])
      }
      // Apres 3 posts → bloc annonces
      if (i === 2 && annoncesBloc && !annoncesInserted) {
        result.push(annoncesBloc)
        annoncesInserted = true
      }
      // Apres 7 posts → bloc evenements
      if (i === 6 && evtsBloc && !evtsInserted) {
        result.push(evtsBloc)
        evtsInserted = true
      }
    })

    // Actus restantes a la fin
    while (aIdx < actus.length) result.push(actus[aIdx++])

    return result
  }

  // ── RENDER UN CHUNK ──────────────────────────────────────────
  const _renderChunk = () => {
    if (_loading) return
    _loading = true

    const total = _allItems.length
    if (!total) { _loading = false; return }

    // Si on a tout vu → repart du début
    if (_index >= total) {
      _index = 0
      // Séparateur visuel
      _el.insertAdjacentHTML('beforeend',
        '<div class="feed-end">— Tout vu ! On repart du début —</div>'
      )
    }

    const chunk = _allItems.slice(_index, _index + CHUNK)
    _index += CHUNK

    chunk.forEach(item => {
      if (item._type === 'post') {
        _el.insertAdjacentHTML('beforeend', _cardPost(item._data, item._likes, item._cmts, item._liked))
      } else if (item._type === 'actu') {
        _el.insertAdjacentHTML('beforeend', _cardActu(item._data))
      } else if (item._type === 'annonce') {
        _el.insertAdjacentHTML('beforeend', _cardAnnonce(item._data))
      } else if (item._type === 'evenement') {
        _el.insertAdjacentHTML('beforeend', _cardEvenement(item._data))
      } else if (item._type === 'bloc_annonces') {
        _el.insertAdjacentHTML('beforeend', _blocAnnonces(item._data))
      } else if (item._type === 'bloc_evts') {
        _el.insertAdjacentHTML('beforeend', _blocEvts(item._data))
      }
    })

    _loading = false
  }

  // ── CARDS ────────────────────────────────────────────────────
  const _cardPost = (p, likeCount, cmtCount, liked) => {
    const isMine = p.profil_code === _myCode || p.session_id === _mySid
    const av = p.photo_url
      ? `<div class="c-av c-av-40"><img src="${Utils.esc(p.photo_url)}" alt=""></div>`
      : `<div class="c-av c-av-40 c-av-init">${Utils.esc((p.prenom||'?')[0].toUpperCase())}</div>`
    // Carousel multi-médias
    const carousel = p.media_urls && p.media_urls.length > 0 ? (() => {
      const items = p.media_urls
      const cid = 'car-' + p.id
      let slides = items.map(function(m) {
        if (m.type === 'video') {
          return `<div style="flex-shrink:0;width:70vw;max-width:280px;height:220px;border-radius:10px;overflow:hidden;border:0.5px solid #e4e6eb;scroll-snap-align:start;background:#000;position:relative;cursor:pointer;" onclick="openMedia('${Utils.esc(m.url)}','video')"><video src="${Utils.esc(m.url)}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video><button onclick="event.stopPropagation();var v=this.previousElementSibling;v.muted=!v.muted;this.textContent=v.muted?'🔇':'🔊'" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.5);border:none;border-radius:50%;width:28px;height:28px;font-size:12px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;">🔇</button></div>`
        }
        return `<div style="flex-shrink:0;width:70vw;max-width:280px;height:220px;border-radius:10px;overflow:hidden;border:0.5px solid #e4e6eb;scroll-snap-align:start;cursor:pointer;" onclick="openMedia('${Utils.esc(m.url)}','image')"><img src="${Utils.esc(m.url)}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`
      }).join('')
      return `<div style="margin:6px -16px 6px -16px;"><div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;padding:0 16px;">${slides}<div style="flex-shrink:0;width:1px;"></div></div></div>`
    })() : null


    const img = p.video_url
      ? `<div class="card-img-wrap" style="border-radius:10px;overflow:hidden;border:0.5px solid #e4e6eb;position:relative;cursor:pointer;" onclick="openMedia('${Utils.esc(p.video_url)}','video')"><video src="${Utils.esc(p.video_url)}" autoplay muted loop playsinline preload="auto" style="width:100%;height:auto;display:block;max-height:500px;object-fit:cover;filter:brightness(1.05) saturate(1.15);" onended="this.currentTime=0;this.play()" oncanplay="this.muted=true;this.play()"></video><button onclick="event.stopPropagation();var v=this.previousElementSibling;v.muted=!v.muted;this.textContent=v.muted?'🔇':'🔊'" style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.5);border:none;border-radius:50%;width:32px;height:32px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;z-index:2;">🔇</button></div>`
      : (p.photo_url ? `<div class="card-img-wrap" style="border-radius:10px;overflow:hidden;border:0.5px solid #e4e6eb;cursor:pointer;" onclick="openMedia('${Utils.esc(p.photo_url)}','image')"><img src="${Utils.esc(p.photo_url)}" loading="lazy" style="width:100%;height:auto;display:block;max-height:600px;object-fit:cover;"></div>` : '')
    // Post texte sans photo — visuel immersif auto
    const textCard = (!p.video_url && !p.photo_url && !p.media_urls && p.contenu) ? (() => {
      const txt = p.contenu
      const isShort = txt.length < 80
      const fontSize = isShort ? '1.5rem' : (txt.length < 160 ? '1.15rem' : '.95rem')
      const quartier = p.quartier || ''
      return `<div style="background:#1c1e21;padding:28px 20px 24px;position:relative;min-height:160px;display:flex;flex-direction:column;justify-content:space-between;border-radius:10px;overflow:hidden;border:0.5px solid #333;">
        <div style="font-size:9px;font-weight:700;color:#C8102E;letter-spacing:2px;margin-bottom:14px;text-transform:uppercase;">${Utils.esc(quartier)}</div>
        <div style="font-size:${fontSize};font-weight:700;color:#fff;line-height:1.35;flex:1;display:flex;align-items:center;">${Utils.esc(txt)}</div>
        <div style="margin-top:16px;width:28px;height:2px;background:#C8102E;"></div>
      </div>`
    })() : ''
    const menuBtn = isMine
      ? `<div style="position:relative;">
          <button onclick="Feed.toggleMenu(${p.id},event)" style="background:none;border:none;color:var(--txt3);font-size:1.1rem;letter-spacing:1px;padding:4px 6px;cursor:pointer;line-height:1;">···</button>
          <div id="menu-${p.id}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:0.5px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:100;min-width:140px;">
            <button onclick="Feed.deletePost(${p.id})" style="width:100%;padding:11px 14px;background:none;border:none;text-align:left;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>Supprimer
            </button>
          </div>
        </div>`
      : (_isAdmin ? `<div style="position:relative;">
          <button onclick="Feed.toggleMenu(${p.id},event)" style="background:none;border:none;color:#C8102E;font-size:1.1rem;letter-spacing:1px;padding:4px 6px;cursor:pointer;line-height:1;">···</button>
          <div id="menu-${p.id}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:0.5px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:100;min-width:160px;">
            <button onclick="Feed.adminHidePost(${p.id})" style="width:100%;padding:9px 14px;background:none;border:none;text-align:left;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Masquer
            </button>
          </div>
        </div>` : '')
    return `
    <article id="card-${p.id}" style="padding:14px 16px 0;background:#fff;">
      <div style="display:flex;gap:10px;">
        <div style="flex-shrink:0;width:36px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#e4e6eb;"></div>
        </div>
        <div style="flex:1;min-width:0;padding-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
            <div>
              <span style="font-size:14px;font-weight:600;color:#1c1e21;">${p.quartier ? Utils.esc(p.quartier) : Utils.esc(p.prenom||'Anonyme')}</span>
              <span style="font-size:12px;color:#65676b;margin-left:6px;">${p.quartier && p.prenom ? Utils.esc(p.prenom) + ' · ' : ''}${Utils.timeAgo(p.created_at)}</span>
            </div>
            ${menuBtn}
          </div>
          ${p.contenu && !textCard ? `<p style="font-size:14px;color:#1c1e21;margin:4px 0 8px;line-height:1.5;">${Utils.esc(p.contenu)}</p>` : ''}
          ${carousel || ''}
          ${textCard ? textCard.replace('</div>', '') + '</div>' : ''}
          ${img || ''}
          <div style="display:flex;gap:0;margin-top:8px;align-items:center;justify-content:space-between;max-width:200px;">
            <button id="like-${p.id}" onclick="Feed.toggleLike(${p.id},this)" style="background:none;border:none;padding:8px;cursor:pointer;display:flex;align-items:center;gap:5px;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="${liked?'#C8102E':'#65676b'}" fill="${liked?'#C8102E':'none'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button onclick="openSheet('post',${p.id})" style="background:none;border:none;padding:8px;cursor:pointer;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#65676b" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button onclick="Feed.share(${p.id})" style="background:none;border:none;padding:8px;cursor:pointer;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#65676b" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
          ${(likeCount > 0 || cmtCount > 0) ? `<div style="margin-top:5px;font-size:12px;color:#65676b;">
            ${likeCount > 0 ? `<span id="lc-${p.id}">${likeCount} j'aime</span>` : `<span id="lc-${p.id}" style="display:none;">${likeCount}</span>`}
            ${likeCount > 0 && cmtCount > 0 ? ' · ' : ''}
            ${cmtCount > 0 ? `<span id="cc-${p.id}" style="cursor:pointer;" onclick="openSheet('post',${p.id})">${cmtCount} commentaire${cmtCount>1?'s':''}</span>` : `<span id="cc-${p.id}" style="display:none;">${cmtCount}</span>`}
          </div>` : `<span id="lc-${p.id}" style="display:none;">${likeCount}</span><span id="cc-${p.id}" style="display:none;">${cmtCount}</span>`}
        </div>
      </div>
    </article>`
  }

  const _cardActu = a => {
    const cat = Utils.esc(a.categorie || 'Actu')
    const titre = Utils.esc(a.titre)
    const time = Utils.timeAgo(a.date_publication)
    const excerpt = Utils.esc((a.contenu||'').substring(0,120)) + ((a.contenu||'').length>120?'…':'')
    return '<article class="card" onclick="location.href=\'actus2.html#act-' + a.id + '\'" class="card-clickable card-border-rouge">'
      + '<div class="card-head">'
      + '<div class="c-av c-av-40" style="background:#C8102E;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;font-family:\'Bebas Neue\',sans-serif;letter-spacing:1px;font-size:.8rem;">CQP</div>'
      + '<div class="card-meta">'
      + '<div class="card-author" class="badge-annonce">📰 ACTU · ' + cat + '</div>'
      + '<div class="card-ts">' + time + '</div>'
      + '</div>'
      + '<span class="card-link-rouge">Lire →</span>'
      + '</div>'
      + '<div class="card-text" class="card-titre-lg">' + titre + '</div>'
      + (excerpt ? '<div class="card-text" class="card-desc">' + excerpt + '</div>' : '')
      + '</article>'
  }

  const _cardAnnonce = a => {
    const qrt = Utils.esc(a.quartier || '')
    const prenom = Utils.esc(a.prenom)
    const titre = Utils.esc(a.titre)
    const desc = Utils.esc((a.description || '').substring(0, 100)) + ((a.description || '').length > 100 ? '…' : '')
    const av = prenom ? prenom[0].toUpperCase() : '?'
    return `<article class="card" class="card-clickable card-border-vert" onclick="location.href='annonces.html#an-${a.id}'">
      <div class="card-head">
        <div class="c-av c-av-40 c-av-init" class="c-av c-av-40 c-av-init card-av-annonce-v2">${av}</div>
        <div class="card-meta">
          <div class="card-author" class="card-author-annonce">📋 ANNONCE${qrt ? ' · ' + qrt : ''}</div>
          <div class="card-ts">${prenom}</div>
        </div>
        <span class="card-link-annonce">Voir →</span>
      </div>
      <div class="card-text" class="card-titre-lg">${titre}</div>
      ${desc ? `<div class="card-text" class="card-desc">${desc}</div>` : ''}
    </article>`
  }

  const _cardEvenement = e => {
    const titre = Utils.esc(e.titre)
    const lieu = e.lieu ? Utils.esc(e.lieu) : ''
    const desc = Utils.esc((e.description || '').substring(0, 100)) + ((e.description || '').length > 100 ? '…' : '')
    const d = e.date_debut ? new Date(e.date_debut) : null
    const dateStr = d ? d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) : ''
    const heureStr = d ? d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : ''
    const prenom = Utils.esc(e.prenom || 'CQP')
    const av = prenom[0].toUpperCase()
    return `<article class="card" class="card-clickable card-border-bleu" onclick="location.href='evenements.html#evt-${e.id}'">
      <div class="card-head">
        <div class="c-av c-av-40 c-av-init" class="c-av c-av-40 c-av-init card-av-evenement-v2">${av}</div>
        <div class="card-meta">
          <div class="card-author" class="card-author-evenement">📅 ÉVÉNEMENT${dateStr ? ' · ' + dateStr : ''}</div>
          <div class="card-ts">${heureStr ? '🕐 ' + heureStr : ''}${lieu ? ' · 📍 ' + lieu : ''}</div>
        </div>
        <span class="card-link-bleu">Voir →</span>
      </div>
      <div class="card-text" class="card-titre-lg">${titre}</div>
      ${desc ? `<div class="card-text" class="card-desc">${desc}</div>` : ''}
    </article>`
  }


  // ── SCROLL INFINI ─────────────────────────────────────────────
  const _setupInfiniteScroll = () => {
    const s = document.createElement('div')
    s.style.height = '20px'
    _el.parentElement?.appendChild(s)
    new IntersectionObserver(e => {
      if (e[0].isIntersecting && !_loading) _renderChunk()
    }, { rootMargin: '400px' }).observe(s)

    window.addEventListener('scroll', () => {
      if (_loading) return
      const bottom = window.scrollY + window.innerHeight
      if (document.documentElement.scrollHeight - bottom < 500) _renderChunk()
    }, { passive: true })

    // Auto play/pause vidéos selon visibilité
    const videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const vid = entry.target
        if (entry.isIntersecting) {
          vid.muted = true
          vid.play().catch(() => {})
        } else {
          vid.pause()
        }
      })
    }, { threshold: 0.3 })

    // Observer les vidéos existantes et futures
    const observeVideos = () => {
      _el.querySelectorAll('video').forEach(v => {
        if (!v.dataset.observed) {
          videoObserver.observe(v)
          v.dataset.observed = '1'
        }
      })
    }
    observeVideos()
    new MutationObserver(observeVideos).observe(_el, { childList: true, subtree: true })
  }

  // ── LIKES ────────────────────────────────────────────────────
  const toggleLike = async (postId, btn) => {
    const liked = _myLikes.has(postId)
    const countEl = document.getElementById(`lc-${postId}`)
    const svg = btn.querySelector('svg')
    if (!liked) {
      _myLikes.add(postId); btn.classList.add('liked')
      if (svg) svg.setAttribute('fill', 'currentColor')
      if (countEl) countEl.textContent = parseInt(countEl.textContent||0) + 1
      saveLikes()
      try { await Api.addLike(postId) } catch(e) {
        _myLikes.delete(postId); btn.classList.remove('liked')
        if (svg) svg.setAttribute('fill', 'none')
        if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent)-1)
        saveLikes()
      }
    } else {
      _myLikes.delete(postId); btn.classList.remove('liked')
      if (svg) svg.setAttribute('fill', 'none')
      if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent||0)-1)
      saveLikes()
      try { await Api.removeLike(postId) } catch(e) {
        _myLikes.add(postId); btn.classList.add('liked')
        if (svg) svg.setAttribute('fill', 'currentColor')
        if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1
        saveLikes()
      }
    }
  }

  // ── DOUBLE TAP LIKE ───────────────────────────────────────────
  const setupDoubleTap = container => {
    let _lastTap = 0, _lastId = null
    container.addEventListener('touchend', e => {
      const card = e.target.closest('.card[id^="card-"]')
      if (!card) return
      const id = parseInt(card.id.split('-')[1])
      const now = Date.now()
      if (now - _lastTap < 350 && _lastId === id) {
        const btn = document.getElementById(`like-${id}`)
        if (btn && !_myLikes.has(id)) toggleLike(id, btn)
        e.preventDefault()
      }
      _lastTap = now; _lastId = id
    }, { passive: false })
  }

  // ── DELETE POST ───────────────────────────────────────────────
  const toggleMenu = (id, e) => {
    e.stopPropagation()
    const menu = document.getElementById(`menu-${id}`)
    if (!menu) return
    const isOpen = menu.style.display === 'block'
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none')
    if (!isOpen) { menu.style.display = 'block'; setTimeout(() => document.addEventListener('click', () => { menu.style.display = 'none' }, { once: true }), 0) }
  }

  const deletePost = async (postId) => {
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none')
    await new Promise(r => setTimeout(r, 50))
    if (!await showConfirm('Supprimer ce post ?', 'Cette publication sera définitivement effacée.')) return
    const { error } = await Api.hidePost(postId)
    if (!error) {
      document.getElementById(`card-${postId}`)?.remove()
      _allItems = _allItems.filter(i => !(i._type==='post' && i._data.id===postId))
    }
  }

  const adminHidePost = async (postId) => {
    const card = document.getElementById(`card-${postId}`)
    if (card) card.style.opacity = '0.4'
    const { error } = await sb.from('posts').update({ visible: false }).eq('id', postId)
    if (error) { Utils.toast('Erreur : ' + error.message, 'error'); if (card) card.style.opacity = '1'; return }
    if (card) card.remove()
    _allItems = _allItems.filter(i => !(i._type === 'post' && i._data.id === postId))
    Utils.toast('Post masqué', 'success')
    // Fermer le menu
    document.getElementById(`menu-${postId}`)?.remove()
  }
  const share = postId => {
    const url = `${location.origin}/index.html#card-${postId}`
    if (navigator.share) navigator.share({ url })
    else { navigator.clipboard?.writeText(url); Utils.toast('Lien copié !') }
  }

  // ── PREPEND (nouveau post) ────────────────────────────────────
  const prepend = post => {
    if (!_el) return
    const item = { _type:'post', _data:post, _likes:0, _cmts:0, _liked:false }
    _allItems.unshift(item)
    _el.insertAdjacentHTML('afterbegin', _cardPost(post, 0, 0, false))
  }

  // ── PULL TO REFRESH ───────────────────────────────────────────
  const setupPullToRefresh = (container) => {
    container = container || document.getElementById('feed') || document.body
    let startY = 0, pulling = false
    container.addEventListener('touchstart', e => {
      if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true }
    }, { passive: true })
    container.addEventListener('touchend', e => {
      if (pulling && e.changedTouches[0].clientY - startY > 80) refresh()
      pulling = false
    }, { passive: true })
  }

  const refresh = async () => {
    _el.innerHTML = spinner()
    _allItems = []; _index = 0; _myLikes = new Set(JSON.parse(localStorage.getItem('cqp_likes')||'[]'))
    await init(_el)
  }


  const _adminMenuAnnonce = (id) => {
    if (!_isAdmin) return ''
    return '<div style="position:absolute;top:8px;right:8px;z-index:10;">'
      + '<button onclick="event.stopPropagation();document.getElementById(\'amenu-' + id + '\').style.display=\'block\'" '
      + 'style="background:rgba(0,0,0,.4);border:none;border-radius:50%;width:28px;height:28px;color:#fff;font-size:14px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;letter-spacing:1px;">···</button>'
      + '<div id="amenu-' + id + '" style="display:none;position:absolute;right:0;top:32px;background:#fff;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:100;min-width:150px;">'
      + '<button onclick="Feed.hideAnnonce(' + id + ')" style="width:100%;padding:11px 14px;background:none;border:none;text-align:left;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      + 'Masquer</button>'
      + '</div></div>'
  }

  const _adminMenuEvt = (id) => {
    if (!_isAdmin) return ''
    return '<div style="position:absolute;top:8px;right:8px;z-index:10;">'
      + '<button onclick="event.stopPropagation();document.getElementById(\'emenu-' + id + '\').style.display=\'block\'" '
      + 'style="background:rgba(0,0,0,.4);border:none;border-radius:50%;width:28px;height:28px;color:#fff;font-size:14px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;letter-spacing:1px;">···</button>'
      + '<div id="emenu-' + id + '" style="display:none;position:absolute;right:0;top:32px;background:#fff;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:100;min-width:150px;">'
      + '<button onclick="Feed.hideEvt(' + id + ')" style="width:100%;padding:11px 14px;background:none;border:none;text-align:left;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      + 'Masquer</button>'
      + '</div></div>'
  }

  const loadMore = () => _renderChunk()

  // ── COULEURS PAR CATÉGORIE ANNONCE ────────────────────────────
  const _annonceIcon = cat => ({
    'Vente':'ti-tag','Don':'ti-gift','Service':'ti-tool',
    'Emploi':'ti-briefcase','Logement':'ti-home','Autre':'ti-file'
  }[cat] || 'ti-file')

  // ── BLOC ANNONCES (scroll horizontal, peek) ───────────────────
  const _blocAnnonces = (annonces) => {
    const cards = annonces.slice(0, 6).map(a => {
      const hasPhoto = !!a._data.photo_url
      const icon = _annonceIcon(a._data.categorie)
      var photoZone
      if (hasPhoto) {
        photoZone = '<div style="height:52vw;max-height:210px;background:#111;display:flex;align-items:center;justify-content:center;position:relative;">'
          + _adminMenuAnnonce(a._data.id)
          + '<img src="' + Utils.esc(a._data.photo_url) + '" style="width:100%;height:100%;object-fit:cover;">'
          + '</div>'
      } else {
        photoZone = '<div style="height:52vw;max-height:210px;background:#f0f2f5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;position:relative;">' + _adminMenuAnnonce(a._data.id)
          + '<div style="width:48px;height:48px;border-radius:50%;background:#e4e6eb;display:flex;align-items:center;justify-content:center;">'
          + '<i class="ti ' + icon + '" style="font-size:22px;color:#adb5bd;" aria-hidden="true"></i>'
          + '</div>'
          + '<span style="font-size:.72rem;color:#adb5bd;font-weight:600;">' + Utils.esc(a._data.categorie||'Annonce') + '</span>'
          + '</div>'
      }
      return '<div style="flex-shrink:0;width:88vw;background:#fff;border-radius:12px;overflow:hidden;border:0.5px solid #e4e6eb;box-shadow:0 1px 4px rgba(0,0,0,.08);">'
        + photoZone
        + '<div style="padding:12px 14px 14px;">'
        + '<div style="font-size:.92rem;font-weight:700;color:#1c1e21;line-height:1.35;margin-bottom:3px;">' + Utils.esc(a._data.titre) + '</div>'
        + '<div style="font-size:.75rem;color:#65676b;margin-bottom:12px;">' + Utils.esc(a._data.categorie||'') + (a._data.quartier ? ' · ' + Utils.esc(a._data.quartier) : '') + '</div>'
        + '<a href="annonces.html" style="display:block;background:#C8102E;color:#fff;text-align:center;padding:11px;border-radius:8px;font-size:.85rem;font-weight:700;text-decoration:none;font-family:-apple-system,system-ui,sans-serif;">Voir l&#39;annonce</a>'
        + '</div></div>'
    }).join('')
    return '<div style="background:#fff;border-bottom:4px solid #e4e6eb;padding:0 0 12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 14px 10px;">'
      + '<span style="font-size:.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#65676b;">Annonces du quartier</span>'
      + '<a href="annonces.html" style="font-size:.78rem;color:#C8102E;font-weight:600;text-decoration:none;">Voir tout</a>'
      + '</div>'
      + '<div style="display:flex;gap:10px;overflow-x:auto;padding:0 16px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;">'
      + cards
      + '<div style="flex-shrink:0;width:8px;"></div>'
      + '</div></div>'
  }

  // ── BLOC ÉVÉNEMENTS (grille 2 col, grande hauteur, peek) ──────
  const _blocEvts = (evts) => {
    const cards = evts.slice(0, 6).map((e, i) => {
      const d = new Date(e._data.date_debut)
      const dateStr = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' }).toUpperCase()
      const hasPhoto = !!e._data.photo_url
      // Avec affiche — image plein format
      if (hasPhoto) {
        return '<div style="flex-shrink:0;width:48vw;max-width:185px;border-radius:14px;overflow:hidden;background:#fff;border:0.5px solid #e4e6eb;">'
          + '<div style="position:relative;height:320px;background:#111;">'
          + _adminMenuEvt(e._data.id)
          + '<img src="' + Utils.esc(e._data.photo_url) + '" style="width:100%;height:100%;object-fit:cover;display:block;">'
          + '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.55));padding:10px 10px 8px;">'
          + '<div style="font-size:.62rem;color:rgba(255,255,255,.9);font-weight:600;">' + dateStr + '</div>'
          + '</div></div>'
          + '<div style="padding:10px 12px;">'
          + '<a href="evenements.html" style="display:block;background:#C8102E;color:#fff;text-align:center;padding:9px;border-radius:8px;font-size:.8rem;font-weight:700;text-decoration:none;font-family:-apple-system,system-ui,sans-serif;">Je participe</a>'
          + '</div></div>'
      }
      // Sans affiche — fond gris neutre + infos centrees
      return '<div style="flex-shrink:0;width:48vw;max-width:185px;border-radius:14px;overflow:hidden;background:#fff;border:0.5px solid #e4e6eb;">'
        + '<div style="height:320px;background:#f0f2f5;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;text-align:center;gap:10px;position:relative;">'
        + _adminMenuEvt(e._data.id)
        + '<div style="width:56px;height:56px;border-radius:50%;background:#e4e6eb;display:flex;align-items:center;justify-content:center;">'
        + '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#adb5bd" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
        + '</div>'
        + '<div style="font-size:.75rem;font-weight:700;color:#C8102E;">' + dateStr + '</div>'
        + '<div style="font-size:.82rem;font-weight:700;color:#1c1e21;line-height:1.3;">' + Utils.esc(e._data.titre) + '</div>'
        + (e._data.lieu ? '<div style="font-size:.68rem;color:#65676b;line-height:1.3;">' + Utils.esc(e._data.lieu.split(',')[0]) + '</div>' : '')
        + '</div>'
        + '<div style="padding:10px 12px;">'
        + '<a href="evenements.html" style="display:block;background:#C8102E;color:#fff;text-align:center;padding:9px;border-radius:8px;font-size:.8rem;font-weight:700;text-decoration:none;font-family:-apple-system,system-ui,sans-serif;">Je participe</a>'
        + '</div></div>'
    }).join('')
    return '<div style="background:#fff;border-bottom:4px solid #e4e6eb;padding:14px 0;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 14px 10px;">'
      + '<span style="font-size:.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#65676b;">Cette semaine</span>'
      + '<a href="evenements.html" style="font-size:.78rem;color:#C8102E;font-weight:600;text-decoration:none;">Voir tout</a>'
      + '</div>'
      + '<div style="display:flex;gap:10px;overflow-x:auto;padding:0 14px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;">'
      + cards
      + '</div></div>'
  }

  // Realtime — retire les posts masqués par l'admin instantanément
  sb.channel('feed-moderation')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
      if (payload.new?.visible === false) {
        const card = document.getElementById('card-' + payload.new.id)
        if (card) card.remove()
        _allItems = _allItems.filter(p => p.id !== payload.new.id)
      }
    })
    .subscribe()

  const hideAnnonce = async (id) => {
    await window.__sb.from('annonces').update({visible:false}).eq('id',id)
    // Retirer uniquement la card (width:88vw) pas tout le bloc
    const menu = document.getElementById('amenu-' + id)
    if (menu) menu.closest('[style*="88vw"]')?.remove()
    Utils.toast('Annonce masquée')
  }
  const hideEvt = async (id) => {
    await window.__sb.from('evenements').update({visible:false}).eq('id',id)
    const menu = document.getElementById('emenu-' + id)
    if (menu) menu.closest('[style*="48vw"]')?.remove()
    Utils.toast('Événement masqué')
  }
  const carouselFitHeight = (el, cid) => {
    // Calculer la hauteur naturelle de la première image selon son ratio
    const container = document.getElementById(cid)
    if (!container) return
    const w = el.offsetWidth || container.offsetWidth * 0.85
    const h = el.tagName === 'VIDEO'
      ? (el.videoHeight ? Math.round(w * el.videoHeight / el.videoWidth) : 260)
      : Math.round(w * el.naturalHeight / el.naturalWidth)
    const clampedH = Math.min(Math.max(h, 180), 500)
    // Appliquer à toutes les slides du carousel
    container.querySelectorAll('[style*="scroll-snap-align"]').forEach(slide => {
      slide.style.height = clampedH + 'px'
    })
  }

  const updateDots = (id, count, el) => {
    const idx = Math.round(el.scrollLeft / el.offsetWidth)
    for (let i = 0; i < count; i++) {
      const d = document.getElementById('dot-' + id + '-' + i)
      if (d) d.style.background = i === idx ? '#1c1e21' : '#e4e6eb'
    }
  }

  return { init, loadMore, prepend, toggleLike, setupDoubleTap, deletePost, adminHidePost, toggleMenu, share, setupPullToRefresh, refresh, hideAnnonce, hideEvt, updateDots, carouselFitHeight }
})()
