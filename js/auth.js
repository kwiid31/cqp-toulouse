/* ═══════════════════════════════════════════════════════════════
   CQP TOULOUSE — auth.js  (session, login, logout)
   Dépend de : config.js chargé avant
   ═══════════════════════════════════════════════════════════════ */

const Auth = (() => {
  // ── Clés localStorage ──────────────────────────────────────────
  const K = { code:'cqp_code', prenom:'cqp_prenom', photo:'cqp_photo', sid:'cqp_sid' };

  // ── Getters session ────────────────────────────────────────────
  const getCode   = () => localStorage.getItem(K.code)   || null;
  const getPrenom = () => localStorage.getItem(K.prenom) || '';
  const getPhoto  = () => localStorage.getItem(K.photo)  || '';
  const getSid    = () => {
    let s = localStorage.getItem(K.sid);
    if (!s) { s = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)); localStorage.setItem(K.sid, s); }
    return s;
  };

  // ── Sauvegarder / vider la session ────────────────────────────
  const save = p => {
    if (p.code)      localStorage.setItem(K.code,   p.code);
    if (p.prenom)    localStorage.setItem(K.prenom,  p.prenom);
    if (p.photo_url) localStorage.setItem(K.photo,   p.photo_url);
  };
  const clear = () => Object.values(K).forEach(k => localStorage.removeItem(k));

  // ── Email/password dérivés du code (sans Edge Function) ────────
  const toEmail = code => `code-${code}@cqp-toulouse.fr`;
  const toPass  = code => `cqp-${code}-secret2025`;

  // ── Restaurer la session Supabase Auth (non bloquant) ──────────
  let _authDone = false;
  const ensureAuth = async (sb) => {
    if (_authDone) return;
    const code = getCode();
    if (!code || !sb) return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) { _authDone = true; return; }
      const { error } = await sb.auth.signInWithPassword({ email: toEmail(code), password: toPass(code) });
      if (!error) { _authDone = true; return; }
      // Fallback : créer le compte si n'existe pas encore
      await sb.auth.signUp({ email: toEmail(code), password: toPass(code), options: { data: { profil_code: code } } });
      await sb.auth.signInWithPassword({ email: toEmail(code), password: toPass(code) });
      _authDone = true;
    } catch (e) { console.warn('ensureAuth:', e); }
  };

  // ── requireAuth : redirige si pas connecté, retourne le profil ─
  const requireAuth = async (sb, redirect = 'profil.html') => {
    const code = getCode();
    if (!code) { window.location.href = redirect; return null; }
    ensureAuth(sb).catch(() => {}); // non-bloquant
    try {
      const { data } = await sb.from('profils').select('*').eq('code', code).limit(1);
      if (!data?.length) { clear(); window.location.href = redirect; return null; }
      save(data[0]);
      return data[0];
    } catch {
      return { code, prenom: getPrenom(), photo_url: getPhoto() };
    }
  };

  // ── Login avec code 6 chiffres ─────────────────────────────────
  const loginWithCode = async (sb, code) => {
    if (!code || code.length !== 6) throw new Error('Code 6 chiffres requis');
    // Vérifier en base
    const { data, error: dbErr } = await sb.from('profils').select('*').eq('code', code).limit(1);
    if (dbErr || !data?.length) throw new Error('Code introuvable');
    // Auth Supabase
    const { error: authErr } = await sb.auth.signInWithPassword({ email: toEmail(code), password: toPass(code) });
    if (authErr) {
      // Créer le compte si pas encore existant
      await sb.auth.signUp({ email: toEmail(code), password: toPass(code), options: { data: { profil_code: code } } });
      await sb.auth.signInWithPassword({ email: toEmail(code), password: toPass(code) });
    }
    _authDone = true;
    save(data[0]);
    return data[0];
  };

  // ── Créer un nouveau profil ─────────────────────────────────────
  const createProfil = async (sb, { prenom, quartier, bio }) => {
    if (!prenom) throw new Error('Prénom obligatoire');
    // Générer code unique
    let code, tries = 0;
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
      const { data } = await sb.from('profils').select('code').eq('code', code).limit(1);
      if (!data?.length) break;
    } while (++tries < 20);
    // Créer compte auth
    const { error: ae } = await sb.auth.signUp({ email: toEmail(code), password: toPass(code), options: { data: { profil_code: code } } });
    if (ae && !ae.message.includes('already')) throw ae;
    await sb.auth.signInWithPassword({ email: toEmail(code), password: toPass(code) });
    _authDone = true;
    // Insérer profil
    const { error: ie } = await sb.from('profils').insert({ code, prenom, quartier: quartier || null, bio: bio || null });
    if (ie) throw ie;
    save({ code, prenom, photo_url: null });
    return code;
  };

  // ── Logout ──────────────────────────────────────────────────────
  const logout = async (sb) => {
    _authDone = false;
    await sb?.auth.signOut().catch(() => {});
    clear();
  };

  // ── Verrouiller les champs prénom ──────────────────────────────
  const lockPrenom = (prenom) => {
    if (!prenom) return;
    ['c-name','sp-prenom','an-prenom','pe-prenom','sheet-prenom',
     'pub-prenom','post-prenom','story-prenom','comment-prenom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = prenom; el.readOnly = true; el.style.cssText = 'background:var(--bg3);color:var(--txt2);cursor:default;pointer-events:none;'; }
    });
  };

  return { getCode, getPrenom, getPhoto, getSid, save, clear, ensureAuth, requireAuth, loginWithCode, createProfil, logout, lockPrenom, toEmail, toPass };
})();
