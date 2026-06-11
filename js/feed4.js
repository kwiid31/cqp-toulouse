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
        Api.getEvenements(null, 6)
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
    let blocInserted = false

    // Construire le bloc mixé annonces+événements
    const mixed = []
    const ml = Math.max((annonces||[]).length, (evts||[]).length)
    for (let i = 0; i < ml; i++) {
      if (evts[i]) mixed.push(evts[i])
      if (annonces[i]) mixed.push(annonces[i])
    }
    const mixedBloc = mixed.length ? { _type: 'mixed-bloc', _items: mixed.slice(0, 8) } : null

    posts.forEach((p, i) => {
      result.push(p)
      // Toutes les 4 posts → actu
      if ((i + 1) % 4 === 0 && aIdx < actus.length) {
        result.push(actus[aIdx++])
      }
      // Après le 5ème post → bloc annonces+événements (1 seule fois)
      if (!blocInserted && i === 4 && mixedBloc) {
        result.push(mixedBloc)
        blocInserted = true
      }
      // Toutes les 10 posts après → réinsérer le bloc
      if (blocInserted && i > 4 && (i + 1) % 10 === 0 && mixedBloc) {
        result.push(mixedBloc)
      }
    })

    // Si moins de 5 posts → mettre le bloc à la fin quand même
    if (!blocInserted && mixedBloc) {
      result.push(mixedBloc)
    }

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
      if (item._type === 'mixed-bloc') {
        const mc = item._items || []
        if (mc.length) {
          let bhtml = '<div style="padding:12px 0 4px;">'
          bhtml += '<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a8d91;padding:0 16px 8px 62px;">À voir dans le quartier</div>'
          bhtml += '<div style="display:flex;gap:10px;overflow-x:auto;padding:0 16px 12px 62px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">'
          mc.forEach(function(ci) {
            if (ci._type === 'evt') bhtml += Feed.renderEvtCard(ci._data)
            else bhtml += Feed.renderAnnCard(ci._data)
          })
          bhtml += '</div></div><div style="height:.5px;background:#fff;"></div>'
          _el.insertAdjacentHTML('beforeend', bhtml)
        }
      } else if (item._type === 'post') {
        _el.insertAdjacentHTML('beforeend', _cardPost(item._data, item._likes, item._cmts, item._liked))
      } else if (item._type === 'actu') {
        _el.insertAdjacentHTML('beforeend', _cardActu(item._data))
      }
      // annonce et evenement individuels ignorés — gérés dans mixed-bloc
    })

    _loading = false
  }

  // ── CARDS ────────────────────────────────────────────────────
  const _cardPost = (p, likeCount, cmtCount, liked) => {
    const isMine = p.profil_code === _myCode || p.session_id === _mySid
    const av = p.photo_url
      ? `<div class="c-av c-av-40"><img src="${Utils.esc(p.photo_url)}" alt=""></div>`
      : `<div class="c-av c-av-40 c-av-init">${Utils.esc((p.prenom||'?')[0].toUpperCase())}</div>`
    // Carousel multi-médias — inclure image_url si pas de media_urls
    if (!p.media_urls && p.image_url) {
      p.media_urls = [{type: 'image', url: p.image_url}]
    }
    const carousel = p.media_urls && p.media_urls.length > 0 ? (() => {
      const items = p.media_urls
      const cid = 'car-' + p.id
      let slides = items.map(function(m) {
        if (m.type === 'video') {
          return `<div style="flex-shrink:0;width:70vw;max-width:280px;height:220px;border-radius:16px;overflow:hidden;border:0.5px solid #e4e6eb;scroll-snap-align:start;background:#000;position:relative;cursor:pointer;" onclick="openMedia('${Utils.esc(m.url)}','video')"><video src="${Utils.esc(m.url)}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video><button onclick="event.stopPropagation();var v=this.previousElementSibling;v.muted=!v.muted;this.textContent=v.muted?'🔇':'🔊'" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.5);border:none;border-radius:50%;width:28px;height:28px;font-size:12px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;">🔇</button></div>`
        }
        return `<div style="flex-shrink:0;width:70vw;max-width:280px;height:220px;border-radius:16px;overflow:hidden;border:0.5px solid #e4e6eb;scroll-snap-align:start;cursor:pointer;" onclick="openMedia('${Utils.esc(m.url)}','image')"><img src="${Utils.esc(m.url)}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`
      }).join('')
      return `<div style="margin:6px -16px 6px -16px;"><div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;padding:0 16px;">${slides}<div style="flex-shrink:0;width:1px;"></div></div></div>`
    })() : null


    const img = p.video_url
      ? `<div class="card-img-wrap" style="border-radius:16px;overflow:hidden;border:0.5px solid #e4e6eb;position:relative;cursor:pointer;" onclick="openMedia('${Utils.esc(p.video_url)}','video')"><video src="${Utils.esc(p.video_url)}" autoplay muted loop playsinline preload="auto" style="width:100%;height:auto;display:block;max-height:350px;object-fit:cover;filter:brightness(1.08) saturate(1.35) contrast(1.08);" onended="this.currentTime=0;this.play()" oncanplay="this.muted=true;this.play()"></video><button onclick="event.stopPropagation();var v=this.previousElementSibling;v.muted=!v.muted;this.textContent=v.muted?'🔇':'🔊'" style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.5);border:none;border-radius:50%;width:32px;height:32px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;z-index:2;">🔇</button></div>`
      : (p.photo_url ? `<div class="card-img-wrap" style="border-radius:16px;overflow:hidden;border:0.5px solid #e4e6eb;cursor:pointer;" onclick="openMedia('${Utils.esc(p.photo_url)}','image')"><img src="${Utils.esc(p.photo_url)}" loading="lazy" style="width:100%;height:auto;display:block;max-height:400px;object-fit:cover;filter:brightness(1.08) saturate(1.35) contrast(1.08);"></div>` : '')
    // Post texte sans photo — visuel immersif auto
    const textCard = ''
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
    <article id="card-${p.id}" style="padding:12px 16px 0;background:#fff;border-bottom:1px solid #fff;">
      <div style="display:flex;gap:10px;">
        <div style="flex-shrink:0;width:42px;">
          <div style="width:42px;height:42px;border-radius:50%;background:#cfd9de;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#333333;"></div>
        </div>
        <div style="flex:1;min-width:0;padding-bottom:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
            <div>
              <span onclick="openSheet('post',${p.id})" style="font-size:15px;font-weight:800;color:#000000;cursor:pointer;">${p.quartier ? Utils.esc(p.quartier) : Utils.esc(p.prenom||'Anonyme')}</span>
              <span style="font-size:15px;color:#333333;margin-left:6px;font-weight:400;">${p.quartier && p.prenom ? Utils.esc(p.prenom)+' · ' : ''}${Utils.timeAgo(p.created_at)}</span>
            </div>
            ${menuBtn}
          </div>
          ${p.contenu ? `<p onclick="openSheet('post',${p.id})" style="font-size:17px;color:#000000;margin:4px 0 12px;line-height:1.5;font-weight:400;cursor:pointer;">${Utils.esc(p.contenu)}</p>` : ''}
          ${carousel || ''}
          ${img || ''}
          <div style="display:flex;gap:0;margin-top:4px;margin-bottom:4px;align-items:center;justify-content:space-between;max-width:280px;">
            <button id="like-${p.id}" onclick="Feed.toggleLike(${p.id},this)" style="background:none;border:none;padding:8px;cursor:pointer;display:flex;align-items:center;gap:5px;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="${liked?'#C8102E':'#65676b'}" fill="${liked?'#C8102E':'none'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span id="lc-${p.id}" style="font-size:13px;color:#333333;">${likeCount > 0 ? likeCount : ''}</span>
            </button>
            <button onclick="openSheet('post',${p.id})" style="background:none;border:none;padding:8px;cursor:pointer;display:flex;align-items:center;gap:5px;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#65676b" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span id="cc-${p.id}" style="font-size:13px;color:#333333;">${cmtCount > 0 ? cmtCount : ''}</span>
            </button>
            <button onclick="Feed.share(${p.id})" style="background:none;border:none;padding:8px;cursor:pointer;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#65676b" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
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
    const imgHtml = (a.image_url || a.photo_url) ? `<div style="border-radius:12px;overflow:hidden;margin-top:8px;"><img src="${Utils.esc(a.image_url||a.photo_url)}" style="width:100%;max-height:220px;object-fit:cover;display:block;"></div>` : ''
    return `<article class="card" class="card-clickable card-border-vert" onclick="location.href='annonces.html#an-${a.id}'">
      <div class="card-head">
        <div class="c-av c-av-40 c-av-init" class="c-av c-av-40 c-av-init card-av-annonce-v2">${av}</div>
        <div class="card-meta">
          <div class="card-author" class="card-author-annonce">📋 ANNONCE${qrt ? ' · ' + qrt : ''}</div>
          <div class="card-ts">${prenom}</div>
        </div>
        ${(_isAdmin ? `<div style="position:relative;">
          <button onclick="Feed.toggleMenu('ann-${a.id}',event)" style="background:none;border:none;color:#C8102E;font-size:1.1rem;letter-spacing:1px;padding:4px 6px;cursor:pointer;line-height:1;">···</button>
          <div id="menu-ann-${a.id}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:0.5px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:100;min-width:160px;">
            <button onclick="Feed.adminHideAnn(${a.id})" style="width:100%;padding:9px 14px;background:none;border:none;text-align:left;font-size:.85rem;color:#E24B4A;cursor:pointer;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Masquer
            </button>
          </div>
        </div>` : '')}
        <span class="card-link-annonce">Voir →</span>
      </div>
      <div class="card-text" class="card-titre-lg">${titre}</div>
      ${desc ? `<div style="font-size:13px;color:#000000;margin-top:6px;line-height:1.4;">${desc}</div>` : ''}
      ${imgHtml}
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
    const photoHtml = (e.image_url || e.photo_url) ? `<div style="border-radius:12px;overflow:hidden;margin-top:8px;"><img src="${Utils.esc(e.image_url || e.photo_url)}" style="width:100%;height:auto;display:block;max-height:300px;object-fit:cover;"></div>` : ''
    return `<article class="card card-clickable card-border-bleu" onclick="location.href='evenements.html'" style="padding:0;overflow:hidden;">
      ${photoHtml ? photoHtml.replace('margin-top:8px;', 'margin-top:0;border-radius:0;') : `<div style="height:8px;background:linear-gradient(90deg,#1a1a2e,#0f3460);"></div>`}
      <div style="padding:12px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:11px;font-weight:700;color:#0f3460;text-transform:uppercase;letter-spacing:.5px;">📅 AGENDA${dateStr ? ' · ' + dateStr : ''}</div>
          ${(_isAdmin ? `<div style="position:relative;">
            <button onclick="event.stopPropagation();Feed.toggleMenu('evt-${e.id}',event)" style="background:none;border:none;color:#C8102E;font-size:1.2rem;letter-spacing:2px;padding:2px 6px;cursor:pointer;line-height:1;">···</button>
            <div id="menu-evt-${e.id}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:0.5px solid #ddd;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:200;min-width:140px;">
              <button onclick="Feed.adminHideEvt(${e.id})" style="width:100%;padding:9px 14px;background:none;border:none;text-align:left;font-size:.85rem;color:#E24B4A;cursor:pointer;">👁 Masquer</button>
            </div>
          </div>` : '')}
        </div>
        <div style="font-size:16px;font-weight:700;color:#000000;margin-bottom:4px;line-height:1.3;">${titre}</div>
        ${heureStr || lieu ? `<div style="font-size:12px;color:#888;">${heureStr ? '🕐 ' + heureStr : ''}${lieu ? ' · 📍 ' + lieu : ''}</div>` : ''}
        ${desc ? `<div style="font-size:13px;color:#000000;margin-top:6px;line-height:1.4;">${desc}</div>` : ''}
      </div>
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
        if (countEl) { const n=Math.max(0,parseInt(countEl.textContent)-1); countEl.textContent=n||'' }
        saveLikes()
      }
    } else {
      _myLikes.delete(postId); btn.classList.remove('liked')
      if (svg) svg.setAttribute('fill', 'none')
      if (countEl) { const n=Math.max(0,parseInt(countEl.textContent||0)-1); countEl.textContent=n||'' }
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
        photoZone = '<div style="height:35vw;max-height:140px;background:#111;display:flex;align-items:center;justify-content:center;position:relative;">'
          + _adminMenuAnnonce(a._data.id)
          + '<img src="' + Utils.esc(a._data.photo_url) + '" style="width:100%;height:100%;object-fit:cover;">'
          + '</div>'
      } else {
        photoZone = '<div style="height:35vw;max-height:140px;background:#f0f2f5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;position:relative;">' + _adminMenuAnnonce(a._data.id)
          + '<div style="width:48px;height:48px;border-radius:50%;background:#e4e6eb;display:flex;align-items:center;justify-content:center;">'
          + '<i class="ti ' + icon + '" style="font-size:22px;color:#adb5bd;" aria-hidden="true"></i>'
          + '</div>'
          + '<span style="font-size:.72rem;color:#adb5bd;font-weight:600;">' + Utils.esc(a._data.categorie||'Annonce') + '</span>'
          + '</div>'
      }
      return '<div style="flex-shrink:0;width:72vw;max-width:280px;background:#fff;border-radius:12px;overflow:hidden;border:0.5px solid #e4e6eb;box-shadow:0 1px 4px rgba(0,0,0,.08);">'
        + photoZone
        + '<div style="padding:8px 12px 10px;">'
        + '<div style="font-size:.85rem;font-weight:700;color:#000000;line-height:1.3;margin-bottom:2px;">' + Utils.esc(a._data.titre) + '</div>'
        + '<div style="font-size:.72rem;color:#333333;margin-bottom:8px;">' + Utils.esc(a._data.categorie||'') + (a._data.quartier ? ' · ' + Utils.esc(a._data.quartier) : '') + '</div>'
        + '<a href="annonces.html" style="display:block;background:#C8102E;color:#fff;text-align:center;padding:7px;border-radius:8px;font-size:.78rem;font-weight:700;text-decoration:none;font-family:-apple-system,system-ui,sans-serif;">Voir l&#39;annonce</a>'
        + '</div></div>'
    }).join('')
    return '<div style="background:#fff;border-bottom:4px solid #e4e6eb;padding:0 0 12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px 10px 62px;">'
      + '<span style="font-size:.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#333333;">Annonces du quartier</span>'
      + '<a href="annonces.html" style="font-size:.78rem;color:#C8102E;font-weight:600;text-decoration:none;">Voir tout</a>'
      + '</div>'
      + '<div style="display:flex;gap:10px;overflow-x:auto;padding:0 16px 0 62px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;">'
      + cards
      + '<div style="flex-shrink:0;width:8px;"></div>'
      + '</div></div>'
  }

  // ── BLOC ÉVÉNEMENTS (grille 2 col, grande hauteur, peek) ──────
  const _blocEvts = (evts) => {
    const cards = evts.slice(0, 6).map((e, i) => {
      if (!e._data) e = { _data: e }
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
        + '<div style="font-size:.82rem;font-weight:700;color:#000000;line-height:1.3;">' + Utils.esc(e._data.titre) + '</div>'
        + (e._data.lieu ? '<div style="font-size:.68rem;color:#333333;line-height:1.3;">' + Utils.esc(e._data.lieu.split(',')[0]) + '</div>' : '')
        + '</div>'
        + '<div style="padding:10px 12px;">'
        + '<a href="evenements.html" style="display:block;background:#C8102E;color:#fff;text-align:center;padding:9px;border-radius:8px;font-size:.8rem;font-weight:700;text-decoration:none;font-family:-apple-system,system-ui,sans-serif;">Je participe</a>'
        + '</div></div>'
    }).join('')
    return '<div style="background:#fff;border-bottom:4px solid #e4e6eb;padding:14px 0;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 14px 10px;">'
      + '<span style="font-size:.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#333333;">Cette semaine</span>'
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

  // ── CARDS UNIFIÉES MÊME TAILLE ──────────────────────────────
  function _renderUnifiedCard(type, titre, meta, photoUrl, onClick) {
    const typeColor = type === 'evenement' ? '#1877F2' : '#e67e22'
    const typeLabel = type === 'evenement' ? '📅 Événement' : '📋 Annonce'
    const photo = photoUrl
      ? '<img src="' + Utils.esc(photoUrl) + '" style="width:100%;height:100%;object-fit:cover;" alt="">'
      : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f2f5;"><span style="font-size:28px;">' + (type==='evenement'?'📅':'📋') + '</span></div>'
    return '<div onclick="' + onClick + '" style="flex-shrink:0;width:180px;border-radius:16px;overflow:hidden;border:.5px solid rgba(0,0,0,.08);background:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.06);">'
      + '<div style="height:150px;position:relative;overflow:hidden;">' + photo + '</div>'
      + '<div style="padding:8px 10px;">'
      + '<div style="font-size:10px;font-weight:600;color:' + typeColor + ';margin-bottom:3px;">' + typeLabel + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:#000000;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + Utils.esc(titre) + '</div>'
      + (meta ? '<div style="font-size:11px;color:#333333;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + meta + '</div>' : '')
      + '</div></div>'
  }


  return { init, loadMore, prepend, toggleLike, setupDoubleTap, deletePost, adminHidePost, toggleMenu, share, setupPullToRefresh, refresh, hideAnnonce, hideEvt, updateDots, carouselFitHeight, renderAnnonces: _blocAnnonces, renderEvts: _blocEvts ,
    renderEvtCard: function(e) {
      var d = e.date_debut ? new Date(e.date_debut) : null
      var dateStr = d ? d.toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) : ''
      var meta = [dateStr, e.lieu].filter(Boolean).join(' · ')
      return _renderUnifiedCard('evenement', e.titre || 'Événement', meta, e.image_url || e.photo_url, "location.href='evenements.html#evt-" + e.id + "'")
    },
    renderAnnCard: function(a) {
      var meta = [a.categorie, a.quartier].filter(Boolean).join(' · ')
      return _renderUnifiedCard('annonce', a.titre || 'Annonce', meta, a.image_url || a.photo_url, "location.href='annonces.html#an-" + a.id + "'")
    }
  }
})()
