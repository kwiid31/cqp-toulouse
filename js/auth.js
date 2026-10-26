// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v3 — auth.js
// Code 6 chiffres = identifiant public ; clé secrète = mot de passe
// Supabase Auth. La base vérifie l'identité (RLS), plus le navigateur.
// ═══════════════════════════════════════════════════════════════════

const Auth = (() => {
  const LS = {
    code:    'cqp_code',
    prenom:  'cqp_prenom',
    photo:   'cqp_photo',
    sid:     'cqp_sid',
    admin:   'cqp_admin',
    quartier:'cqp_quartier',
  };
  const DOMAIN = 'membres.cqp-toulouse.fr';
  const emailFor = code => `${code}@${DOMAIN}`;

  // ── Getters (lecture localStorage — synchrone, immédiat) ───────
  const getCode   = () => localStorage.getItem(LS.code)   || null;
  const getPrenom = () => localStorage.getItem(LS.prenom) || '';
  const getPhoto  = () => localStorage.getItem(LS.photo)  || '';
  const isAdmin   = () => localStorage.getItem(LS.admin) === '1';
  const getSid    = () => {
    let s = localStorage.getItem(LS.sid);
    if (!s) {
      s = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LS.sid, s);
    }
    return s;
  };

  // ── Save / clear ───────────────────────────────────────────────
  const save = (profil) => {
    if (profil.code)      localStorage.setItem(LS.code,    profil.code);
    if (profil.prenom)    localStorage.setItem(LS.prenom,  profil.prenom);
    if (profil.photo_url !== undefined) localStorage.setItem(LS.photo, profil.photo_url || '');
    if (profil.quartier !== undefined)  localStorage.setItem(LS.quartier, profil.quartier || '');
    localStorage.setItem(LS.admin, profil.is_admin ? '1' : '0');
  };

  const clear = () => Object.values(LS).forEach(k => localStorage.removeItem(k));

  const fetchProfil = async (code) => {
    const { data } = await sb.from('profils').select(CQP.PROFIL_COLS).eq('code', code).limit(1);
    return data?.[0] ?? null;
  };

  const callFn = async (body) => {
    const { data, error } = await sb.functions.invoke('profil-auth', { body });
    if (error) {
      let msg = 'Erreur serveur';
      try { msg = (await error.context.json()).error || msg; } catch {}
      const err = new Error(msg);
      err.status = error.context?.status;
      throw err;
    }
    return data;
  };

  // ── Popup « note ta clé secrète » ──────────────────────────────
  const showCle = (code, cle, { titre = 'Bienvenue !', onClose } = {}) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    box.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px 24px;width:100%;max-width:340px;text-align:center;">'
      + '<div style="font-size:40px;margin-bottom:12px;">🔐</div>'
      + '<h3 style="font-size:20px;font-weight:700;margin-bottom:8px;">' + Utils.esc(titre) + '</h3>'
      + '<p style="font-size:14px;color:#65676b;margin-bottom:16px;">Note ton code <b>et</b> ta clé secrète. Ils te permettent de te connecter depuis n\'importe quel appareil. Ne donne jamais ta clé.</p>'
      + '<div style="font-size:12px;color:#65676b;text-align:left;">Code</div>'
      + '<div style="font-family:monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:#000;background:#f0f2f5;border-radius:10px;padding:10px;margin-bottom:10px;">' + Utils.esc(code) + '</div>'
      + '<div style="font-size:12px;color:#65676b;text-align:left;">Clé secrète</div>'
      + '<div style="font-family:monospace;font-size:24px;font-weight:700;letter-spacing:3px;color:#C8102E;background:#fff0f2;border-radius:10px;padding:10px;margin-bottom:20px;user-select:all;">' + Utils.esc(cle) + '</div>'
      + '<button style="width:100%;background:#000;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;">J\'ai noté ma clé</button>'
      + '</div>';
    box.querySelector('button').onclick = () => { box.remove(); onClose?.(); };
    document.body.appendChild(box);
  };

  // ── Synchronisation au chargement de chaque page ───────────────
  // Appareil déjà connecté à l'ancienne (code seul) : on protège le
  // profil en lui créant sa clé secrète, une seule fois.
  const sync = async () => {
    const code = getCode();
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const sessionCode = session.user.email?.split('@')[0];
      if (code && sessionCode !== code) { await sb.auth.signOut(); clear(); return null; }
      const p = await fetchProfil(sessionCode);
      if (p) { save(p); document.dispatchEvent(new CustomEvent('cqp:profil', { detail: p })); }
      return p;
    }
    if (!code) return null;
    try {
      const { cle } = await callFn({ action: 'claim', code });
      await sb.auth.signInWithPassword({ email: emailFor(code), password: cle });
      showCle(code, cle, { titre: 'Ton profil est protégé' });
      const p = await fetchProfil(code);
      if (p) { save(p); document.dispatchEvent(new CustomEvent('cqp:profil', { detail: p })); }
      return p;
    } catch (e) {
      // Profil déjà protégé (ou introuvable) : il faut se reconnecter avec la clé
      if (e.status === 409 || e.status === 404 || e.status === 403) {
        clear();
        if (!location.pathname.endsWith('profil.html')) location.href = 'profil.html';
      }
      return null;
    }
  };
  const ready = (typeof sb !== 'undefined') ? sync().catch(() => null) : Promise.resolve(null);

  // ── requireAuth : redirige si pas connecté ─────────────────────
  // NON bloquant — affiche immédiatement ce qui est en cache
  const requireAuth = (redirectTo = 'profil.html') => {
    if (!getCode()) {
      window.location.href = redirectTo;
      return false;
    }
    ready.then(p => { if (!p) window.location.href = redirectTo; });
    return true;
  };

  // ── Login : code + clé secrète ─────────────────────────────────
  const login = async (code, cle) => {
    if (!/^\d{6}$/.test(code)) throw new Error('Code invalide (6 chiffres requis)');
    cle = String(cle || '').trim().toUpperCase();
    if (!cle) throw new Error('Clé secrète obligatoire');
    const { error } = await sb.auth.signInWithPassword({ email: emailFor(code), password: cle });
    if (error) {
      // Profil ancien jamais protégé : la clé n'existe pas encore
      throw new Error(/rate|many/i.test(error.message) ? 'Trop d\'essais, réessaie dans quelques minutes.' : 'Code ou clé incorrect.');
    }
    const p = await fetchProfil(code);
    if (!p) throw new Error('Profil introuvable');
    save(p);
    document.dispatchEvent(new CustomEvent('cqp:profil', { detail: p }));
    return p;
  };

  // ── Créer un nouveau profil (code et clé générés par le serveur) ─
  const signup = async ({ prenom, quartier, bio, email }) => {
    if (!prenom?.trim()) throw new Error('Prénom obligatoire');
    const { code, cle } = await callFn({ action: 'signup', prenom, quartier, bio, email });
    await sb.auth.signInWithPassword({ email: emailFor(code), password: cle });
    const p = await fetchProfil(code);
    if (p) save(p);
    return { profil: p, code, cle };
  };

  // ── Admin : nouvelle clé pour un membre qui a perdu la sienne ──
  const resetCle = async (code) => (await callFn({ action: 'reset', code })).cle;

  // ── Logout ─────────────────────────────────────────────────────
  const logout = async () => {
    await sb.auth.signOut().catch(() => {});
    clear();
    window.location.href = 'profil.html';
  };

  // ── Verrouiller les champs prénom dans le DOM ──────────────────
  const lockPrenomFields = (prenom) => {
    if (!prenom) return;
    const IDS = ['c-name','sp-prenom','an-prenom','pe-prenom',
                 'pub-prenom','post-prenom','story-prenom','comment-prenom'];
    IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = prenom;
      el.readOnly = true;
      el.style.cssText = 'background:var(--bg3);color:var(--txt2);cursor:default;pointer-events:none;';
    });
  };

  return { getCode, getPrenom, getPhoto, isAdmin, getSid, save, clear, ready, requireAuth, login, signup, resetCle, showCle, logout, lockPrenomFields };
})();
