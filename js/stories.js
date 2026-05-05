/* ═══════════════════════════════════════════════════════════════
   CQP TOULOUSE — stories.js
   Dépend de : api.js, auth.js, ui.js, utils.js
   ═══════════════════════════════════════════════════════════════ */

const Stories = (() => {
  let _stories = [];
  let _currentIdx = 0;
  let _timer = null;
  const DURATION = 5000;

  // ── Charger et rendre la barre stories ────────────────────────
  const load = async (barEl) => {
    if (!barEl) return;
    const { data } = await Api.getStories();
    _stories = data || [];
    render(barEl);
  };

  const render = (barEl) => {
    const code = Auth.getCode();
    const prenom = Auth.getPrenom();
    const photo = Auth.getPhoto();
    barEl.innerHTML = `
      <div class="add-story" onclick="Stories.openCompose()">
        <div class="story-add-icon">+</div>
        <div class="story-add-txt">Story</div>
      </div>
      ${_stories.map(s => UI.storyThumb(s)).join('')}`;
  };

  // ── Ouvrir une story ───────────────────────────────────────────
  const open = (idx) => {
    _currentIdx = idx;
    if (!_stories[idx]) return;
    const s = _stories[idx];
    const viewer = document.getElementById('story-viewer');
    if (!viewer) return;
    viewer.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _render_viewer(s);
    _startTimer();
  };

  window._openStoryById = (id) => {
    const idx = _stories.findIndex(s => String(s.id) === String(id));
    if (idx >= 0) open(idx);
  };

  const _render_viewer = (s) => {
    const el = document.getElementById('story-content');
    if (!el) return;
    el.innerHTML = `
      ${s.photo_url ? `<img src="${Utils.esc(s.photo_url)}" class="story-img">` : ''}
      <div class="story-overlay">
        <div class="story-info">
          ${UI.avInitiales(s.prenom, 'av-36')}
          <div>
            <div class="story-name">${Utils.esc(s.prenom || 'Anonyme')}</div>
            <div class="story-ts">${Utils.timeAgo(s.created_at)}</div>
          </div>
        </div>
        ${s.texte ? `<div class="story-texte">${Utils.esc(s.texte)}</div>` : ''}
      </div>`;
  };

  const close = () => {
    clearTimeout(_timer);
    const viewer = document.getElementById('story-viewer');
    if (viewer) viewer.style.display = 'none';
    document.body.style.overflow = '';
  };

  const next = () => {
    clearTimeout(_timer);
    if (_currentIdx < _stories.length - 1) open(_currentIdx + 1); else close();
  };
  const prev = () => {
    clearTimeout(_timer);
    if (_currentIdx > 0) open(_currentIdx - 1);
  };

  const _startTimer = () => {
    clearTimeout(_timer);
    _timer = setTimeout(next, DURATION);
    // Progress bar
    const bar = document.getElementById('story-progress-bar');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; setTimeout(() => { bar.style.transition = `width ${DURATION}ms linear`; bar.style.width = '100%'; }, 50); }
  };

  // ── Composer story ─────────────────────────────────────────────
  const openCompose = () => {
    if (!Auth.getCode()) { window.location.href = 'profil.html'; return; }
    UI.openDrawer('story-drawer');
  };

  const publish = async () => {
    const code = Auth.getCode();
    const prenom = Auth.getPrenom();
    if (!code) return;
    await Auth.ensureAuth(window._sb);
    const texte = document.getElementById('story-texte')?.value.trim();
    const fileInp = document.getElementById('story-photo-inp');
    const file = fileInp?.files[0];
    let photo_url = null;
    if (file) photo_url = await Api.uploadPhoto(file, 'stories');
    const { error } = await Api.createStory({ profil_code: code, prenom, texte: texte || null, photo_url });
    if (error) { Utils.toast('Erreur publication', 'error'); return; }
    Utils.toast('Story publiée !', 'success');
    UI.closeDrawer('story-drawer');
    const bar = document.querySelector('.stories-bar');
    if (bar) load(bar);
  };

  return { load, render, open, close, next, prev, openCompose, publish };
})();
