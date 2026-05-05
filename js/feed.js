// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v2 — feed.js
// Feed paginé, scroll infini, likes optimistes, double-tap
// ═══════════════════════════════════════════════════════════════════

const Feed = (() => {
  let _el        = null;   // conteneur DOM
  let _page      = 0;
  let _loading   = false;
  let _done      = false;
  let _myCode    = null;
  let _myLikes   = new Set(JSON.parse(localStorage.getItem('cqp_likes') || '[]'));

  // ── Persistance likes ──────────────────────────────────────────
  const _saveLikes = () => localStorage.setItem('cqp_likes', JSON.stringify([..._myLikes]));

  // ── Init ──────────────────────────────────────────────────────
  const init = (containerEl) => {
    _el = containerEl;
    _page = 0;
    _done = false;
    _myCode = Auth.getCode();
    _el.innerHTML = _spinner();
    loadMore();
    _setupScroll();
  };

  const _spinner = () => `<div class="spinner"><div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div></div>`;
  const _empty   = (msg) => `<div class="empty">${Utils.esc(msg)}</div>`;

  // ── Charger page suivante ─────────────────────────────────────
  const loadMore = async () => {
    if (_loading || _done) return;
    _loading = true;

    try {
      const { data, error } = await Api.getFeed(_page, CQP.FEED_SIZE);
      if (error) throw error;

      if (_page === 0) {
        _el.innerHTML = '';
        if (!data?.length) { _el.innerHTML = _empty('Aucune publication pour l\'instant.'); return; }
      }
      if (!data?.length) { _done = true; return; }

      // Charger likes pour cette batch
      const ids = data.map(p => p.id);
      const { data: likesData } = await Api.getLikesForPosts(ids);
      const likeCounts = {};
      const myNewLikes = new Set();
      (likesData || []).forEach(l => {
        likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
        if (l.profil_code === _myCode) myNewLikes.add(l.post_id);
      });
      myNewLikes.forEach(id => _myLikes.add(id));
      _saveLikes();

      data.forEach(p => {
        const card = _renderCard(p, likeCounts[p.id] || 0, _myLikes.has(p.id));
        _el.insertAdjacentHTML('beforeend', card);
      });

      _page++;
    } catch (e) {
      console.error('Feed.loadMore:', e);
      if (_page === 0) _el.innerHTML = _empty('⚠️ Connexion impossible. Réessaie.');
    } finally {
      _loading = false;
    }
  };

  // ── Scroll infini via IntersectionObserver ─────────────────────
  const _setupScroll = () => {
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    _el.parentElement?.appendChild(sentinel);
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' }).observe(sentinel);
  };

  // ── Render card ───────────────────────────────────────────────
  const _renderCard = (p, likeCount, liked) => {
    const isMine = p.profil_code === _myCode;
    const av = p.photo_url
      ? `<div class="c-av"><img src="${Utils.esc(p.photo_url)}" alt=""></div>`
      : `<div class="c-av c-av-init">${Utils.esc((p.prenom || '?')[0].toUpperCase())}</div>`;

    return `
    <article class="card" id="card-${p.id}">
      <div class="card-head">
        ${av}
        <div class="card-meta">
          <div class="card-author">${Utils.esc(p.prenom || 'Anonyme')}</div>
          <div class="card-ts">${p.quartier ? `📍 ${Utils.esc(p.quartier)} · ` : ''}${Utils.timeAgo(p.created_at)}</div>
        </div>
        ${isMine ? `<button class="card-more" onclick="Feed.deletePost(${p.id})" aria-label="Supprimer">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>` : ''}
      </div>
      ${p.contenu ? `<p class="card-text">${Utils.esc(p.contenu)}</p>` : ''}
      ${p.photo_url ? `<div class="card-img-wrap"><img class="card-img" src="${Utils.esc(p.photo_url)}" loading="lazy" alt=""></div>` : ''}
      <div class="card-actions">
        <button class="action-btn ${liked ? 'liked' : ''}" id="like-${p.id}" onclick="Feed.toggleLike(${p.id}, this)">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="${liked ? 'currentColor' : 'none'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="lc-${p.id}">${likeCount}</span>
        </button>
        <button class="action-btn" onclick="Feed.toggleComments(${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="cc-${p.id}">0</span>
        </button>
        <button class="action-btn" onclick="Feed.share(${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      <div class="card-comments" id="cmt-${p.id}" style="display:none"></div>
    </article>`;
  };

  // ── Ajouter un post en haut (après publication) ────────────────
  const prepend = (post) => {
    if (!_el) return;
    const card = _renderCard(post, 0, false);
    _el.insertAdjacentHTML('afterbegin', card);
  };

  // ── Toggle like (optimiste) ───────────────────────────────────
  const toggleLike = async (postId, btn) => {
    if (!_myCode) { window.location.href = 'profil.html'; return; }
    const liked = _myLikes.has(postId);
    const countEl = document.getElementById(`lc-${postId}`);
    const svg = btn.querySelector('svg');

    if (!liked) {
      _myLikes.add(postId);
      btn.classList.add('liked');
      if (svg) svg.setAttribute('fill', 'currentColor');
      if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
      _saveLikes();
      Api.addLike(postId, _myCode).catch(() => {
        _myLikes.delete(postId); btn.classList.remove('liked');
        if (svg) svg.setAttribute('fill', 'none');
        if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
        _saveLikes();
      });
    } else {
      _myLikes.delete(postId);
      btn.classList.remove('liked');
      if (svg) svg.setAttribute('fill', 'none');
      if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || 0) - 1);
      _saveLikes();
      Api.removeLike(postId, _myCode).catch(() => {
        _myLikes.add(postId); btn.classList.add('liked');
        if (svg) svg.setAttribute('fill', 'currentColor');
        if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
        _saveLikes();
      });
    }
  };

  // ── Double tap to like ────────────────────────────────────────
  const setupDoubleTap = (container) => {
    let lastTap = 0;
    container.addEventListener('touchend', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        const id = parseInt(card.id.replace('card-', ''));
        if (!_myLikes.has(id)) {
          const btn = document.getElementById(`like-${id}`);
          if (btn) {
            toggleLike(id, btn);
            _heartBurst(card);
          }
        }
      }
      lastTap = now;
    });
  };

  const _heartBurst = (card) => {
    const h = document.createElement('div');
    h.textContent = '❤️';
    h.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);font-size:3rem;pointer-events:none;z-index:10;transition:transform .3s ease,opacity .3s .2s;opacity:1;';
    card.style.position = 'relative';
    card.appendChild(h);
    requestAnimationFrame(() => { h.style.transform = 'translate(-50%,-50%) scale(1)'; });
    setTimeout(() => { h.style.opacity = '0'; setTimeout(() => h.remove(), 300); }, 400);
  };

  // ── Commentaires ──────────────────────────────────────────────
  const toggleComments = async (postId) => {
    const el = document.getElementById(`cmt-${postId}`);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<div class="spinner"><div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div></div>`;

    const { data } = await Api.getComments(postId);
    const code = Auth.getCode();
    const prenom = Auth.getPrenom();

    el.innerHTML = `
      <div class="cmt-list">${(data || []).map(_renderComment).join('') || '<p class="cmt-empty">Sois le premier à commenter…</p>'}</div>
      ${code ? `
      <div class="cmt-compose">
        <div class="c-av c-av-init c-av-28">${Utils.esc((prenom || '?')[0].toUpperCase())}</div>
        <input class="cmt-input" id="ci-${postId}" placeholder="Commenter…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Feed.sendComment(${postId});}">
        <button class="cmt-send" onclick="Feed.sendComment(${postId})">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="#fff" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>` : ''}`;
  };

  const _renderComment = (c) => `
    <div class="cmt-item">
      <div class="c-av c-av-init c-av-28">${Utils.esc((c.prenom || '?')[0].toUpperCase())}</div>
      <div class="cmt-bubble">
        <span class="cmt-name">${Utils.esc(c.prenom || 'Anonyme')}</span>
        <span class="cmt-text">${Utils.esc(c.contenu || '')}</span>
        <span class="cmt-ts">${Utils.timeAgo(c.created_at)}</span>
      </div>
    </div>`;

  const sendComment = async (postId) => {
    const code = Auth.getCode();
    const prenom = Auth.getPrenom();
    if (!code) { window.location.href = 'profil.html'; return; }
    const inp = document.getElementById(`ci-${postId}`);
    const contenu = inp?.value.trim();
    if (!contenu) return;
    inp.value = '';
    const { data, error } = await Api.addComment({ post_id: postId, profil_code: code, prenom, contenu });
    if (error) { Utils.toast('Erreur envoi', 'error'); return; }
    const list = document.querySelector(`#cmt-${postId} .cmt-list`);
    if (list) list.insertAdjacentHTML('beforeend', _renderComment(data || { prenom, contenu, created_at: new Date().toISOString() }));
    const cc = document.getElementById(`cc-${postId}`);
    if (cc) cc.textContent = parseInt(cc.textContent || 0) + 1;
  };

  // ── Supprimer un post ─────────────────────────────────────────
  const deletePost = async (postId) => {
    if (!confirm('Supprimer cette publication ?')) return;
    await Api.hidePost(postId);
    document.getElementById(`card-${postId}`)?.remove();
    Utils.toast('Publication supprimée', 'success');
  };

  // ── Partager ─────────────────────────────────────────────────
  const share = (postId) => {
    const url = `${location.origin}/?p=${postId}`;
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else Utils.copy(url).then(() => Utils.toast('Lien copié !', 'success'));
  };

  // ── Pull to refresh ───────────────────────────────────────────
  const setupPullToRefresh = () => {
    let startY = 0, pulling = false;
    const ind = document.getElementById('ptr-indicator');
    document.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (window.scrollY > 0 || pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 20) { pulling = true; if (ind) ind.style.display = 'flex'; }
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      if (ind) ind.style.display = 'none';
      refresh();
    });
  };

  const refresh = () => {
    if (!_el) return;
    _page = 0; _done = false;
    _el.innerHTML = _spinner();
    loadMore();
  };

  return { init, loadMore, prepend, toggleLike, toggleComments, sendComment, deletePost, share, setupDoubleTap, setupPullToRefresh, refresh };
})();
