/* ═══════════════════════════════════════════════════════════════
   CQP TOULOUSE — feed.js  (logique feed paginé + likes + cmts)
   Dépend de : api.js, auth.js, ui.js, utils.js
   ═══════════════════════════════════════════════════════════════ */

const Feed = (() => {
  let _page       = 0;
  let _loading    = false;
  let _exhausted  = false;
  let _container  = null;
  const _cache    = new Map(); // id → post data

  // ── Initialiser le feed ────────────────────────────────────────
  const init = (containerEl) => {
    _container = containerEl;
    _page = 0;
    _loading = false;
    _exhausted = false;
    _container.innerHTML = UI.spinner();
    loadMore();
    _setupInfiniteScroll();
  };

  // ── Charger une page ───────────────────────────────────────────
  const loadMore = async () => {
    if (_loading || _exhausted) return;
    _loading = true;

    try {
      const { data, error } = await Api.getFeed(_page, CQP.FEED_PAGE_SIZE);
      if (error) throw error;

      if (_page === 0) {
        _container.innerHTML = '';
        if (!data?.length) { _container.innerHTML = UI.empty('Aucune publication pour l\'instant.'); return; }
      }

      if (!data?.length) { _exhausted = true; return; }

      data.forEach(p => {
        _cache.set(p.id, p);
        const div = document.createElement('div');
        div.innerHTML = UI.postCard(p, Auth.getCode());
        _container.appendChild(div.firstElementChild);
      });

      _page++;
    } catch (e) {
      console.error('Feed.loadMore:', e);
      if (_page === 0) _container.innerHTML = UI.empty('⚠️ Connexion impossible.');
    } finally {
      _loading = false;
    }
  };

  // ── Scroll infini ──────────────────────────────────────────────
  const _setupInfiniteScroll = () => {
    const sentinel = document.createElement('div');
    sentinel.id = 'feed-sentinel';
    _container?.parentElement?.appendChild(sentinel);
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    obs.observe(sentinel);
  };

  // ── Ajouter un post en haut du feed ───────────────────────────
  const prepend = (post) => {
    if (!_container) return;
    _cache.set(post.id, post);
    const div = document.createElement('div');
    div.innerHTML = UI.postCard(post, Auth.getCode());
    _container.insertBefore(div.firstElementChild, _container.firstChild);
  };

  // ── Supprimer un post du feed ─────────────────────────────────
  const remove = async (postId) => {
    await Api.hidePost(postId);
    document.getElementById(`card-${postId}`)?.remove();
    _cache.delete(postId);
  };

  // ── Toggle like ────────────────────────────────────────────────
  window._likedPosts = window._likedPosts || new Set(JSON.parse(localStorage.getItem('cqp_likes') || '[]'));

  const saveLikes = () => localStorage.setItem('cqp_likes', JSON.stringify([..._likedPosts]));

  const toggleLike = async (postId, btn) => {
    const code = Auth.getCode();
    if (!code) { window.location.href = 'profil.html'; return; }
    await Auth.ensureAuth(window._sb);

    const liked = _likedPosts.has(postId);
    const countEl = document.getElementById(`like-count-${postId}`);
    const current = parseInt(countEl?.textContent || '0');

    if (!liked) {
      _likedPosts.add(postId);
      btn.classList.add('liked');
      btn.querySelector('svg')?.setAttribute('fill', 'currentColor');
      if (countEl) countEl.textContent = current + 1;
      saveLikes();
      Api.addLike(postId, code).catch(() => {});
    } else {
      _likedPosts.delete(postId);
      btn.classList.remove('liked');
      btn.querySelector('svg')?.setAttribute('fill', 'none');
      if (countEl) countEl.textContent = Math.max(0, current - 1);
      saveLikes();
      Api.removeLike(postId, code).catch(() => {});
    }
  };

  // ── Double tap to like ─────────────────────────────────────────
  const setupDoubleTap = (container) => {
    let lastTap = 0;
    container.addEventListener('touchend', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        const id = parseInt(card.id.replace('card-', ''));
        if (!_likedPosts.has(id)) {
          const btn = document.getElementById(`like-btn-${id}`);
          if (btn) toggleLike(id, btn);
          // Animation cœur
          const heart = document.createElement('div');
          heart.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3rem;pointer-events:none;z-index:10;animation:heartPop .6s forwards;';
          heart.textContent = '❤️';
          card.style.position = 'relative';
          card.appendChild(heart);
          setTimeout(() => heart.remove(), 600);
        }
      }
      lastTap = now;
    });
  };

  // ── Commentaires ──────────────────────────────────────────────
  const toggleComments = async (postId) => {
    const el = document.getElementById(`cmt-${postId}`);
    if (!el) return;
    const open = el.style.display !== 'none';
    if (open) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = UI.spinner();
    const { data } = await Api.getComments(postId);
    const code = Auth.getCode();
    const prenom = Auth.getPrenom();
    el.innerHTML = `
      <div class="cmt-list">${(data || []).map(c => UI.commentItem(c)).join('') || '<div class="cmt-empty">Sois le premier à commenter…</div>'}</div>
      ${code ? `<div class="cmt-compose">
        ${UI.avInitiales(prenom, 'av-28')}
        <input class="cmt-input" placeholder="Commenter…" id="cmt-input-${postId}">
        <button class="cmt-send" onclick="Feed.sendComment(${postId})">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="#fff" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>` : ''}`;
  };

  const sendComment = async (postId) => {
    const code = Auth.getCode();
    const prenom = Auth.getPrenom();
    if (!code) { window.location.href = 'profil.html'; return; }
    const inp = document.getElementById(`cmt-input-${postId}`);
    const contenu = inp?.value.trim();
    if (!contenu) return;
    await Auth.ensureAuth(window._sb);
    inp.value = '';
    const { data, error } = await Api.addComment({ post_id: postId, profil_code: code, prenom, contenu });
    if (error) return;
    const list = document.querySelector(`#cmt-${postId} .cmt-list`);
    if (list) {
      const item = document.createElement('div');
      item.innerHTML = UI.commentItem({ prenom, contenu, created_at: new Date().toISOString() });
      list.appendChild(item.firstElementChild);
    }
    // Incrémenter compteur
    const countEl = document.getElementById(`cmt-count-${postId}`);
    if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
  };

  // ── Pull to refresh ────────────────────────────────────────────
  const setupPullToRefresh = (indicator) => {
    let startY = 0, pulling = false;
    document.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (window.scrollY > 0 || pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 10) { pulling = true; if (indicator) { indicator.style.display = 'flex'; indicator.style.transform = `translateY(${Math.min(dy - 10, 50)}px)`; } }
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (pulling) {
        pulling = false;
        if (indicator) { indicator.style.display = 'none'; indicator.style.transform = ''; }
        refresh();
      }
    });
  };

  const refresh = () => {
    if (!_container) return;
    _page = 0; _exhausted = false;
    _container.innerHTML = UI.spinner();
    loadMore();
  };

  return { init, loadMore, prepend, remove, toggleLike, toggleComments, sendComment, setupDoubleTap, setupPullToRefresh, refresh };
})();
