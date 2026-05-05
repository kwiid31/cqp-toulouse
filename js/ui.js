/* ═══════════════════════════════════════════════════════════════
   CQP TOULOUSE — ui.js  (renderers HTML réutilisables)
   Dépend de : utils.js, auth.js
   ═══════════════════════════════════════════════════════════════ */

const UI = (() => {
  const { esc, timeAgo } = Utils;

  // ── Spinner ────────────────────────────────────────────────────
  const spinner = () => `<div class="spinner"><div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div></div>`;

  // ── Empty state ────────────────────────────────────────────────
  const empty = (msg = 'Aucun contenu') => `<div class="empty">${esc(msg)}</div>`;

  // ── Avatar initiales ───────────────────────────────────────────
  const avInitiales = (prenom, size = 'av-40', color = 'background:var(--rouge)') =>
    `<div class="av ${size}" style="${color}">${esc((prenom || '?')[0].toUpperCase())}</div>`;

  const avPhoto = (url, prenom, size = 'av-40') =>
    url ? `<div class="av ${size}"><img src="${esc(url)}" alt="${esc(prenom)}"></div>`
        : avInitiales(prenom, size);

  // ── Card post principale ───────────────────────────────────────
  const postCard = (p, myCode) => {
    const liked = window._likedPosts?.has(p.id);
    const isMine = p.profil_code === myCode;
    return `
    <div class="card" id="card-${p.id}">
      <div class="card-head">
        ${avPhoto(p.photo_url, p.prenom, 'av-40')}
        <div class="card-meta">
          <div class="card-author">${esc(p.prenom || 'Anonyme')}</div>
          <div class="card-ts">${p.quartier ? `📍 ${esc(p.quartier)} · ` : ''}${timeAgo(p.created_at)}</div>
        </div>
        ${isMine ? `<button class="card-menu-btn" onclick="UI.openDeleteMenu(${p.id})" aria-label="Options">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="var(--txt3)" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>` : ''}
      </div>
      ${p.contenu ? `<div class="card-text">${esc(p.contenu)}</div>` : ''}
      ${p.photo_url && p.type !== 'story' ? `<div class="card-img-wrap"><img class="card-img" src="${esc(p.photo_url)}" loading="lazy" alt=""></div>` : ''}
      <div class="card-actions">
        <button class="action-btn ${liked ? 'liked' : ''}" id="like-btn-${p.id}" onclick="Feed.toggleLike(${p.id}, this)">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="${liked ? 'currentColor' : 'none'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="like-count-${p.id}">${p.likes_count ?? 0}</span>
        </button>
        <button class="action-btn" onclick="Feed.toggleComments(${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="cmt-count-${p.id}">${p.commentaires_count ?? 0}</span>
        </button>
        <button class="action-btn" onclick="UI.sharePost(${p.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      <div class="card-comments" id="cmt-${p.id}" style="display:none;"></div>
    </div>`;
  };

  // ── Story thumb ────────────────────────────────────────────────
  const storyThumb = (s) => `
    <div class="story-thumb" onclick="UI.openStory('${esc(s.id)}')">
      <div class="story-thumb-inner">
        ${s.photo_url ? `<img class="story-thumb-img" src="${esc(s.photo_url)}" loading="lazy" alt="">` : ''}
        <div class="story-thumb-grad"></div>
        <span class="story-thumb-name">${esc((s.prenom || '?')[0].toUpperCase())}</span>
      </div>
    </div>`;

  // ── Commentaire ────────────────────────────────────────────────
  const commentItem = (c) => `
    <div class="cmt-item">
      ${avInitiales(c.prenom, 'av-28')}
      <div class="cmt-bubble">
        <span class="cmt-name">${esc(c.prenom || 'Anonyme')}</span>
        <span class="cmt-text">${esc(c.contenu || '')}</span>
        <span class="cmt-ts">${timeAgo(c.created_at)}</span>
      </div>
    </div>`;

  // ── Actu card ──────────────────────────────────────────────────
  const actuCard = (a, onclick) => `
    <div class="actu-card">
      ${a.photo_url ? `<img class="actu-img" src="${esc(a.photo_url)}" loading="lazy" alt="">` : `<div class="card-cover cv-rouge"><div class="card-cover-cat">${esc(a.categorie || 'Actualité')}</div><div class="card-cover-title">${esc(a.titre)}</div></div>`}
      <div class="actu-head">
        <div class="av av-36" style="background:var(--rouge);font-family:'Bebas Neue',sans-serif;color:#fff;display:flex;align-items:center;justify-content:center;">CQP</div>
        <div style="flex:1"><div style="font-weight:600;font-size:.88rem;">${esc(a.titre)}</div><div style="font-size:.72rem;color:var(--txt3);">${timeAgo(a.date_publication)}</div></div>
        <span class="badge badge-rouge">${esc(a.categorie || 'Actu')}</span>
      </div>
      <div style="padding:0 14px 12px;font-size:.86rem;color:var(--txt2);line-height:1.6;">${esc((a.contenu || '').substring(0, 180))}${(a.contenu || '').length > 180 ? '…' : ''}</div>
      <button class="card-read-more" onclick="${onclick}">Lire l'article →</button>
    </div>`;

  // ── Annonce card ───────────────────────────────────────────────
  const annonceCard = (a, onclick) => `
    <div class="annonce-card" onclick="${onclick}">
      ${a.photo_url ? `<img class="annonce-img" src="${esc(a.photo_url)}" loading="lazy" alt="">` : `<div class="card-cover cv-${a.categorie === 'Logement' ? 'blue' : a.categorie === 'Emploi' ? 'green' : 'purple'}" style="min-height:100px;"><div class="card-cover-cat">${esc(a.categorie || '')}</div><div class="card-cover-title">${esc(a.titre)}</div></div>`}
      <div style="padding:12px 14px;">
        <div style="font-weight:600;font-size:.9rem;">${esc(a.titre)}</div>
        <div style="font-size:.78rem;color:var(--txt3);margin-top:3px;">${esc(a.prenom || '')} · ${timeAgo(a.created_at)}</div>
        ${a.prix ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--rouge);margin-top:4px;">${esc(a.prix)} €</div>` : ''}
      </div>
    </div>`;

  // ── Drawer helper ──────────────────────────────────────────────
  const openDrawer = (id) => {
    document.getElementById(id)?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const closeDrawer = (id) => {
    document.getElementById(id)?.classList.remove('open');
    document.body.style.overflow = '';
  };

  // ── Partager post ──────────────────────────────────────────────
  const sharePost = (id) => {
    const url = `${location.origin}/?post=${id}`;
    if (navigator.share) navigator.share({ url });
    else { navigator.clipboard?.writeText(url); Utils.toast('Lien copié !', 'success'); }
  };

  // ── Menu suppression ───────────────────────────────────────────
  const openDeleteMenu = (id) => {
    if (confirm('Supprimer cette publication ?')) {
      window._deletePost?.(id);
    }
  };

  // ── Story viewer ───────────────────────────────────────────────
  const openStory = (id) => {
    window._openStoryById?.(id);
  };

  return { spinner, empty, avInitiales, avPhoto, postCard, storyThumb, commentItem, actuCard, annonceCard, openDrawer, closeDrawer, sharePost, openDeleteMenu, openStory };
})();
