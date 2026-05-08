// CQP Toulouse — feed.js (logique feed paginée + likes + commentaires)
const Feed = (() => {
  let _el = null, _page = 0, _done = false, _loading = false
  let _myCode = null
  let _mySid = null
  let _myLikes = new Set(JSON.parse(localStorage.getItem('cqp_likes') || '[]'))

  const saveLikes = () => localStorage.setItem('cqp_likes', JSON.stringify([..._myLikes]))
  const spinner = () => `<div class="spinner"><div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div></div>`

  const init = async el => {
    _el = el; _page = 0; _done = false
    _myCode = Auth.getCode()
    _mySid = Auth.getSid()
    _el.innerHTML = spinner()
    await _loadPromos()
    loadMore()
    _setupInfiniteScroll()
  }

  const loadMore = async () => {
    if (_loading || _done) return
    _loading = true
    try {
      const { data, error } = await Api.getFeed(_page, CQP.FEED_SIZE)
      if (error) throw error

      if (!data?.length) {
        if (_page === 0) {
          // Vraiment vide : aucun post
          _el.innerHTML = '<div class="empty">Aucune publication pour l\'instant.</div>'
          _done = true
          return
        }
        // Fin des posts — repart du début (scroll circulaire)
        _page = 0
        return // finally remet _loading=false, le prochain scroll relancera
      }

      // Première page : vider le DOM
      if (_page === 0 && _el.children.length === 0) _el.innerHTML = ''

      // Charger likes ET commentaires en batch (parallèle)
      const ids = data.map(p => p.id)
      const [{ data: likesData }, { data: cmtData }] = await Promise.all([
        Api.getLikesForFeed(ids),
        sb.from('commentaires').select('item_id').eq('item_type', 'post').eq('visible', true).in('item_id', ids)
      ])
      const likeCounts = {}, cmtCounts = {}
      const currentCode = Auth.getCode() || _myCode
      const currentSid = Auth.getSid() || _mySid
      ;(likesData || []).forEach(l => {
        likeCounts[l.item_id] = (likeCounts[l.item_id] || 0) + 1
        if (l.session_id === currentSid || l.session_id === currentCode) _myLikes.add(l.item_id)
      })
      ;(cmtData || []).forEach(c => {
        cmtCounts[c.item_id] = (cmtCounts[c.item_id] || 0) + 1
      })
      saveLikes()

      data.forEach((p, i) => {
        const liked = _myLikes.has(p.id)
        const isMine = p.profil_code === currentCode || p.session_id === currentSid
        _el.insertAdjacentHTML('beforeend', _card(p, likeCounts[p.id] || 0, cmtCounts[p.id] || 0, liked, isMine))
        // Injecter une annonce/événement toutes les 5 posts
        if ((i + 1) % 5 === 0) _injectPromo()
      })
      _page++
    } catch (e) {
      console.error('Feed:', e)
      if (_page === 0) _el.innerHTML = '<div class="empty">⚠️ Connexion impossible.</div>'
    } finally { _loading = false }
  }

  const _card = (p, likeCount, cmtCount, liked, isMine) => {
    const av = p.photo_url
      ? `<div class="c-av c-av-40"><img src="${Utils.esc(p.photo_url)}" alt=""></div>`
      : `<div class="c-av c-av-40 c-av-init">${Utils.esc((p.prenom||'?')[0].toUpperCase())}</div>`
    return `
    <article class="card" id="card-${p.id}">
      <div class="card-head">
        ${av}
        <div class="card-meta">
          <div class="card-author">${Utils.esc(p.prenom||'Anonyme')}</div>
          <div class="card-ts">${Utils.timeAgo(p.created_at)}</div>
        </div>
        ${isMine ? `<button class="card-more" onclick="Feed.deletePost(${p.id})" aria-label="Supprimer">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>` : ''}
      </div>
      ${p.contenu ? `<p class="card-text">${Utils.esc(p.contenu)}</p>` : ''}
      ${p.photo_url ? `<div class="card-img-wrap"><img class="card-img" src="${Utils.esc(p.photo_url)}" loading="lazy" alt=""></div>` : ''}
      <div class="card-actions">
        <button class="action-btn ${liked?'liked':''}" id="like-${p.id}" onclick="Feed.toggleLike(${p.id}, this)">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="${liked?'currentColor':'none'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="lc-${p.id}">${likeCount}</span>
        </button>
        <button class="action-btn" onclick="window.openSheet('post',${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="cc-${p.id}">${cmtCount}</span>
        </button>
        <button class="action-btn" onclick="Feed.share(${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
    </article>`
  }

  const prepend = post => {
    if (!_el) return
    _el.insertAdjacentHTML('afterbegin', _card(post, 0, 0, false, true))
  }

  // ── SCROLL INFINI ─────────────────────────────────────────────
  // ── INJECTION ANNONCES/ÉVÉNEMENTS DANS LE FEED ───────────────
  let _promoCache = [], _promoIndex = 0
  const _loadPromos = async () => {
    try {
      const [{ data: ann }, { data: evt }, { data: act }] = await Promise.all([
        Api.getAnnonces(null, 6),
        Api.getEvenements(4),
        Api.getActus(null, 4)
      ])
      _promoCache = []
      ;(ann || []).slice(0, 2).forEach(a => _promoCache.push({ type: 'annonce', data: a }))
      ;(evt || []).slice(0, 2).forEach(e => _promoCache.push({ type: 'evenement', data: e }))
      ;(act || []).slice(0, 2).forEach(a => _promoCache.push({ type: 'actu', data: a }))
      // Mélanger
      _promoCache.sort(() => Math.random() - 0.5)
    } catch(e) { /* silencieux */ }
  }

  const _injectPromo = () => {
    if (!_promoCache.length) return
    const promo = _promoCache[_promoIndex % _promoCache.length]
    _promoIndex++
    if (promo.type === 'annonce') {
      const a = promo.data
      _el.insertAdjacentHTML('beforeend', `
      <article class="card card-promo" onclick="location.href='annonces.html'" style="cursor:pointer;border-left:4px solid var(--rouge);background:#fff;">
        <div class="card-head">
          <div class="c-av c-av-40" style="background:#C8102E;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">📋</div>
          <div class="card-meta">
            <div style="font-size:.72rem;color:var(--rouge);font-weight:700;letter-spacing:.5px;">ANNONCE · ${Utils.esc(a.quartier || '')}</div>
            <div style="font-weight:600;font-size:.88rem;margin-top:1px;">${Utils.esc(a.prenom)}</div>
          </div>
          <span style="font-size:.72rem;color:var(--rouge);font-weight:600;white-space:nowrap;">Voir →</span>
        </div>
        <div class="card-text" style="padding-top:2px;color:var(--txt);font-weight:500;">${Utils.esc(a.titre)}</div>
      </article>`)
    } else {
      const e = promo.data
      const dateStr = e.date_debut ? new Date(e.date_debut).toLocaleDateString('fr-FR', {day:'numeric',month:'long'}) : ''
      _el.insertAdjacentHTML('beforeend', `
      <article class="card card-promo" onclick="location.href='evenements.html'" style="cursor:pointer;border-left:4px solid #1877F2;background:#fff;">
        <div class="card-head">
          <div class="c-av c-av-40" style="background:#1877F2;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">📅</div>
          <div class="card-meta">
            <div style="font-size:.72rem;color:#1877F2;font-weight:700;letter-spacing:.5px;">ÉVÉNEMENT · ${dateStr}</div>
            <div style="font-weight:600;font-size:.88rem;margin-top:1px;">${Utils.esc(e.prenom || '')}</div>
          </div>
          <span style="font-size:.72rem;color:#1877F2;font-weight:600;white-space:nowrap;">Voir →</span>
        </div>
        <div class="card-text" style="padding-top:2px;color:var(--txt);font-weight:500;">${Utils.esc(e.titre)}</div>
      </article>`)
    } else if (promo.type === 'actu') {
      const a = promo.data
      _el.insertAdjacentHTML('beforeend', `
      <article class="card card-promo" onclick="location.href='actus2.html'" style="cursor:pointer;border-left:4px solid #e67e22;background:#fff;">
        <div class="card-head">
          <div class="c-av c-av-40" style="background:#e67e22;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">📰</div>
          <div class="card-meta">
            <div style="font-size:.72rem;color:#e67e22;font-weight:700;letter-spacing:.5px;">ACTU · ${Utils.esc(a.categorie || 'Quartier')}</div>
            <div style="font-weight:600;font-size:.88rem;margin-top:1px;">${Utils.esc(Utils.timeAgo ? Utils.timeAgo(a.date_publication) : '')}</div>
          </div>
          <span style="font-size:.72rem;color:#e67e22;font-weight:600;white-space:nowrap;">Lire →</span>
        </div>
        <div class="card-text" style="padding-top:2px;color:var(--txt);font-weight:500;">${Utils.esc(a.titre)}</div>
      </article>`)
    }
  }

  const _setupInfiniteScroll = () => {
    // Sentinel IntersectionObserver
    const s = document.createElement('div')
    s.id = 'feed-sentinel'
    s.style.height = '20px'
    _el.parentElement?.appendChild(s)
    new IntersectionObserver(e => {
      if (e[0].isIntersecting && !_loading) loadMore()
    }, { rootMargin: '400px' }).observe(s)

    // Scroll event
    window.addEventListener('scroll', () => {
      if (_loading) return
      const scrollBottom = window.scrollY + window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      if (docHeight - scrollBottom < 600) loadMore()
    }, { passive: true })

    // Polling toutes les 2s quand on est en bas (au cas où scroll event manqué)
    setInterval(() => {
      if (_loading) return
      const scrollBottom = window.scrollY + window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      if (docHeight - scrollBottom < 400) loadMore()
    }, 2000)
  }

  // ── LIKES (optimiste) ─────────────────────────────────────────
  const toggleLike = async (postId, btn) => {
    const liked = _myLikes.has(postId)
    const countEl = document.getElementById(`lc-${postId}`)
    const svg = btn.querySelector('svg')
    if (!liked) {
      // Optimiste : like immédiat
      _myLikes.add(postId); btn.classList.add('liked')
      if (svg) svg.setAttribute('fill', 'currentColor')
      if (countEl) countEl.textContent = parseInt(countEl.textContent||0) + 1
      saveLikes()
      try {
        await Api.addLike(postId)
      } catch(e) {
        // Rollback si erreur
        _myLikes.delete(postId); btn.classList.remove('liked')
        if (svg) svg.setAttribute('fill', 'none')
        if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent)-1)
        saveLikes()
      }
    } else {
      // Optimiste : unlike immédiat
      _myLikes.delete(postId); btn.classList.remove('liked')
      if (svg) svg.setAttribute('fill', 'none')
      if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent||0)-1)
      saveLikes()
      try {
        await Api.removeLike(postId)
      } catch(e) {
        // Rollback si erreur
        _myLikes.add(postId); btn.classList.add('liked')
        if (svg) svg.setAttribute('fill', 'currentColor')
        if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1
        saveLikes()
      }
    }
  }

  // ── DOUBLE TAP ────────────────────────────────────────────────
  const setupDoubleTap = container => {
    let last = 0
    container.addEventListener('touchend', e => {
      const card = e.target.closest('.card')
      if (!card) return
      const now = Date.now()
      if (now - last < 300) {
        const id = parseInt(card.id.replace('card-',''))
        if (!_myLikes.has(id)) {
          const btn = document.getElementById(`like-${id}`)
          if (btn) {
            toggleLike(id, btn)
            const h = document.createElement('div')
            h.textContent = '❤️'
            h.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);font-size:3rem;pointer-events:none;z-index:10;transition:transform .3s,opacity .3s .2s;'
            card.style.position = 'relative'; card.appendChild(h)
            requestAnimationFrame(() => h.style.transform = 'translate(-50%,-50%) scale(1)')
            setTimeout(() => { h.style.opacity='0'; setTimeout(()=>h.remove(),300) }, 400)
          }
        }
      }
      last = now
    })
  }

  // ── DELETE ────────────────────────────────────────────────────
  const deletePost = async id => {
    if (!confirm('Supprimer cette publication ?')) return
    await Api.hidePost(id)
    document.getElementById(`card-${id}`)?.remove()
    Utils.toast('Publication supprimée', 'success')
  }

  // ── SHARE ─────────────────────────────────────────────────────
  const share = id => {
    const url = `${location.origin}/?p=${id}`
    if (navigator.share) navigator.share({ url }).catch(()=>{})
    else Utils.copy(url).then(() => Utils.toast('Lien copié !', 'success'))
  }

  // ── PULL TO REFRESH ───────────────────────────────────────────
  const setupPullToRefresh = () => {
    let startY = 0, pulling = false
    const ind = document.getElementById('ptr')
    document.addEventListener('touchstart', e => { startY = e.touches[0].clientY }, { passive:true })
    document.addEventListener('touchmove', e => {
      if (window.scrollY > 0 || pulling) return
      if (e.touches[0].clientY - startY > 60) { pulling=true; if(ind) ind.style.display='flex' }
    }, { passive:true })
    document.addEventListener('touchend', () => {
      if (!pulling) return
      pulling = false; if(ind) ind.style.display='none'
      refresh()
    })
  }

  const refresh = () => {
    if (!_el) return
    _page=0; _done=false; _el.innerHTML = spinner(); loadMore()
  }

  return { init, loadMore, prepend, toggleLike, setupDoubleTap, deletePost, share, setupPullToRefresh, refresh }
})()
