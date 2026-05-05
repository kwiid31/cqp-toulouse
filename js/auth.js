// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v2 — auth.js
// Système de session basé sur code 6 chiffres
// Pas de dépendance à Supabase Auth JWT — anon key uniquement
// ═══════════════════════════════════════════════════════════════════

const Auth = (() => {
  const LS = {
    code:   'cqp_code',
    prenom: 'cqp_prenom',
    photo:  'cqp_photo',
    sid:    'cqp_sid',
    admin:  'cqp_admin',
  };

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
    if (profil.code)      localStorage.setItem(LS.code,   profil.code);
    if (profil.prenom)    localStorage.setItem(LS.prenom, profil.prenom);
    if (profil.photo_url !== undefined) localStorage.setItem(LS.photo, profil.photo_url || '');
    localStorage.setItem(LS.admin, profil.is_admin ? '1' : '0');
  };

  const clear = () => Object.values(LS).forEach(k => localStorage.removeItem(k));

  // ── requireAuth : redirige si pas connecté ─────────────────────
  // NON bloquant — affiche immédiatement ce qui est en cache
  // puis recharge depuis la DB en arrière-plan
  const requireAuth = (redirectTo = 'profil.html') => {
    const code = getCode();
    if (!code) {
      window.location.href = redirectTo;
      return false;
    }
    // Refresh profil en arrière-plan (non bloquant)
    sb.from('profils').select('*').eq('code', code).limit(1)
      .then(({ data }) => {
        if (!data?.length) { clear(); window.location.href = redirectTo; return; }
        save(data[0]);
        document.dispatchEvent(new CustomEvent('cqp:profil', { detail: data[0] }));
      })
      .catch(() => {});
    return true;
  };

  // ── Login avec code 6 chiffres ─────────────────────────────────
  const login = async (code) => {
    if (!/^\d{6}$/.test(code)) throw new Error('Code invalide (6 chiffres requis)');
    const { data, error } = await sb.from('profils').select('*').eq('code', code).limit(1);
    if (error) throw error;
    if (!data?.length) throw new Error('Code introuvable');
    save(data[0]);
    document.dispatchEvent(new CustomEvent('cqp:profil', { detail: data[0] }));
    return data[0];
  };

  // ── Créer un nouveau profil ─────────────────────────────────────
  const signup = async ({ prenom, quartier, bio }) => {
    if (!prenom?.trim()) throw new Error('Prénom obligatoire');
    // Générer un code unique
    let code, tries = 0, exists = true;
    while (exists && tries++ < 30) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      const { data } = await sb.from('profils').select('code').eq('code', code).limit(1);
      exists = !!data?.length;
    }
    const { data, error } = await sb.from('profils')
      .insert({ code, prenom: prenom.trim(), quartier: quartier?.trim() || null, bio: bio?.trim() || null })
      .select().single();
    if (error) throw error;
    save(data);
    return data;
  };

  // ── Logout ─────────────────────────────────────────────────────
  const logout = () => { clear(); window.location.href = 'profil.html'; };

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

  return { getCode, getPrenom, getPhoto, isAdmin, getSid, save, clear, requireAuth, login, signup, logout, lockPrenomFields };
})();
