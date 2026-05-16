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
        sb.from('commentaires').select('item_id').eq('item_type','post').eq('visible',true).in('item_id', ids)
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
    const img = p.video_url
      ? `<div class="card-img-wrap"><video class="card-img" src="${Utils.esc(p.video_url)}" playsinline controls preload="auto" style="max-height:500px;background:#000;width:100%;"></video></div>`
      : (p.photo_url ? `<div class="card-img-wrap"><img class="card-img" src="${Utils.esc(p.photo_url)}" loading="lazy"></div>` : '')
    return `
    <article class="card" id="card-${p.id}">
      <div class="card-head">
        ${av}
        <div class="card-meta">
          <div class="card-author">${p.quartier ? Utils.esc(p.quartier) : Utils.esc(p.prenom||'Anonyme')}</div>
          <div class="card-ts">${p.quartier ? Utils.esc(p.prenom||'Anonyme') + ' · ' : ''}${Utils.timeAgo(p.created_at)}</div>
        </div>
        ${isMine ? `<div style="position:relative;">
          <button class="card-more" onclick="Feed.toggleMenu(${p.id},event)" aria-label="Options" style="font-size:1.2rem;color:var(--txt3);letter-spacing:1px;padding:4px 8px;">···</button>
          <div id="menu-${p.id}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:0.5px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:100;min-width:140px;">
            <button onclick="Feed.deletePost(${p.id})" style="width:100%;padding:11px 14px;background:none;border:none;text-align:left;font-family:'Barlow',sans-serif;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              Supprimer
            </button>
          </div>
        </div>` : (_isAdmin ? `<div style="position:relative;">
          <button class="card-more" onclick="Feed.toggleMenu(${p.id},event)" aria-label="Options admin" style="font-size:1.2rem;color:#C8102E;letter-spacing:1px;padding:4px 8px;">···</button>
          <div id="menu-${p.id}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:0.5px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:100;min-width:160px;">
            <div style="padding:6px 14px 4px;font-size:.65rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--txt3);font-family:'Barlow Condensed',sans-serif;">Admin</div>
            <button onclick="Feed.adminHidePost(${p.id})" style="width:100%;padding:9px 14px;background:none;border:none;text-align:left;font-family:'Barlow',sans-serif;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              Masquer ce post
            </button>
          </div>
        </div>` : '')}
      </div>
      ${p.contenu ? `<div class="card-text">${Utils.esc(p.contenu)}</div>` : ''}
      ${img}
      <div class="card-actions">
        <button class="action-btn ${liked?'liked':''}" id="like-${p.id}" onclick="Feed.toggleLike(${p.id},this)">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="${liked?'currentColor':'none'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="lc-${p.id}">${likeCount}</span>
        </button>
        <button class="action-btn" onclick="openSheet('post',${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="cc-${p.id}">${cmtCount}</span>
        </button>
        <button class="action-btn" onclick="Feed.share(${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
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

  const loadMore = () => _renderChunk()

  // ── COULEURS PAR CATÉGORIE ANNONCE ────────────────────────────
  const _annonceColor = cat => ({
    'Vente':'#E65100','Don':'#2E7D32','Service':'#1565C0',
    'Emploi':'#6A1B9A','Logement':'#00695C','Autre':'#546E7A'
  }[cat] || '#546E7A')

  const _annonceIcon = cat => ({
    'Vente':'ti-tag','Don':'ti-gift','Service':'ti-tool',
    'Emploi':'ti-briefcase','Logement':'ti-home','Autre':'ti-file'
  }[cat] || 'ti-file')

  // ── BLOC ANNONCES (scroll horizontal, peek) ───────────────────
  const _blocAnnonces = (annonces) => {
    const cards = annonces.slice(0, 6).map(a => {
      const color = _annonceColor(a._data.categorie)
      const icon = _annonceIcon(a._data.categorie)
      const img = a._data.photo_url
        ? '<img src="' + Utils.esc(a._data.photo_url) + '" style="width:100%;height:100%;object-fit:cover;">'
        : '<i class="ti ' + icon + '" style="font-size:32px;color:rgba(255,255,255,.85);" aria-hidden="true"></i>'
      return '<div style="flex-shrink:0;width:72vw;max-width:280px;background:#fff;border-radius:12px;overflow:hidden;border:0.5px solid #e4e6eb;">'
        + '<div style="height:120px;background:' + color + ';display:flex;align-items:center;justify-content:center;">' + img + '</div>'
        + '<div style="padding:10px 12px;">'
        + '<div style="font-size:.8rem;font-weight:600;color:#1c1e21;line-height:1.35;margin-bottom:3px;">' + Utils.esc(a._data.titre) + '</div>'
        + '<div style="font-size:.72rem;color:#65676b;">' + Utils.esc(a._data.categorie||'') + (a._data.quartier ? ' · ' + Utils.esc(a._data.quartier) : '') + '</div>'
        + '</div></div>'
    }).join('')
    return '<div style="background:#fff;border-bottom:8px solid #e4e6eb;padding:14px 0;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 14px 10px;">'
      + '<span style="font-size:.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#65676b;">Annonces du quartier</span>'
      + '<a href="annonces.html" style="font-size:.78rem;color:#C8102E;font-weight:600;text-decoration:none;">Voir tout</a>'
      + '</div>'
      + '<div style="display:flex;gap:10px;overflow-x:auto;padding:0 14px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;">'
      + cards
      + '</div></div>'
  }

  // ── BLOC ÉVÉNEMENTS (grille 2 col, grande hauteur, peek) ──────
  const _blocEvts = (evts) => {
    const COLORS = ['#C8102E','#1565C0','#2E7D32','#6A1B9A','#E65100','#00695C']
    const cards = evts.slice(0, 6).map((e, i) => {
      const d = new Date(e._data.date_debut)
      const dateStr = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' }).toUpperCase()
      const color = COLORS[i % COLORS.length]
      const img = e._data.photo_url
        ? '<img src="' + Utils.esc(e._data.photo_url) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
        : ''
      return '<div style="flex-shrink:0;width:44vw;max-width:170px;border-radius:12px;overflow:hidden;position:relative;">'
        + '<div style="height:240px;background:' + color + ';position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:10px;">'
        + img
        + '<div style="position:relative;background:rgba(255,255,255,.2);border-radius:6px;padding:3px 7px;width:fit-content;">'
        + '<span style="font-size:.6rem;color:#fff;font-weight:600;">' + dateStr + '</span></div>'
        + '<div style="position:relative;">'
        + '<div style="font-size:.78rem;font-weight:600;color:#fff;line-height:1.35;">' + Utils.esc(e._data.titre) + '</div>'
        + (e._data.lieu ? '<div style="font-size:.65rem;color:rgba(255,255,255,.75);margin-top:3px;">' + Utils.esc(e._data.lieu.split(',')[0]) + '</div>' : '')
        + '</div></div></div>'
    }).join('')
    return '<div style="background:#fff;border-bottom:8px solid #e4e6eb;padding:14px 0;">'
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

  return { init, loadMore, prepend, toggleLike, setupDoubleTap, deletePost, adminHidePost, toggleMenu, share, setupPullToRefresh, refresh }
})()
