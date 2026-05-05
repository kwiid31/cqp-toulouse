// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v2 — api.js
// TOUTES les requêtes Supabase passent ici. Zéro sb.from() ailleurs.
// ═══════════════════════════════════════════════════════════════════

const Api = (() => {

  // ── PROFILS ───────────────────────────────────────────────────
  const getProfil     = (code)       => sb.from('profils').select('*').eq('code', code).limit(1).then(r => r.data?.[0] ?? null);
  const updateProfil  = (code, data) => sb.from('profils').update(data).eq('code', code);
  const getProfilStats = async (code) => {
    const [p, l, c] = await Promise.all([
      sb.from('posts').select('*', { count: 'exact', head: true }).eq('profil_code', code).eq('visible', true),
      sb.from('likes').select('*', { count: 'exact', head: true }).eq('profil_code', code),
      sb.from('commentaires').select('*', { count: 'exact', head: true }).eq('profil_code', code).eq('visible', true),
    ]);
    return { posts: p.count ?? 0, likes: l.count ?? 0, commentaires: c.count ?? 0 };
  };

  // ── FEED (posts paginés) ──────────────────────────────────────
  const getFeed = (page = 0, size = CQP.FEED_SIZE) =>
    sb.from('posts').select('*').eq('visible', true)
      .order('created_at', { ascending: false })
      .range(page * size, (page + 1) * size - 1);

  const getMesPosts = (code, limit = 15) =>
    sb.from('posts').select('*').eq('profil_code', code).eq('visible', true)
      .order('created_at', { ascending: false }).limit(limit);

  const createPost  = (fields) => sb.from('posts').insert({ visible: true, ...fields }).select().single();
  const hidePost    = (id)     => sb.from('posts').update({ visible: false }).eq('id', id);

  // ── LIKES ─────────────────────────────────────────────────────
  const getLikesForPosts = (ids) =>
    sb.from('likes').select('post_id, profil_code').in('post_id', ids);
  const addLike    = (postId, code) => sb.from('likes').insert({ post_id: postId, profil_code: code });
  const removeLike = (postId, code) => sb.from('likes').delete().eq('post_id', postId).eq('profil_code', code);

  // ── COMMENTAIRES ─────────────────────────────────────────────
  const getComments  = (postId) =>
    sb.from('commentaires').select('*').eq('post_id', postId).eq('visible', true)
      .order('created_at', { ascending: true });
  const addComment   = (fields) => sb.from('commentaires').insert({ visible: true, ...fields }).select().single();
  const hideComment  = (id)     => sb.from('commentaires').update({ visible: false }).eq('id', id);

  // ── STORIES ───────────────────────────────────────────────────
  const getStories  = ()       =>
    sb.from('stories').select('*, profils(prenom, photo_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(20);
  const createStory = (fields) => sb.from('stories').insert(fields).select().single();

  // ── ACTUS ─────────────────────────────────────────────────────
  const getActus    = (cat, limit = 30) => {
    let q = sb.from('actus').select('*').eq('visible', true)
      .order('date_publication', { ascending: false }).limit(limit);
    if (cat) q = q.eq('categorie', cat);
    return q;
  };
  const createActu  = (fields) => sb.from('actus').insert({ visible: true, ...fields });
  const updateActu  = (id, f)  => sb.from('actus').update(f).eq('id', id);
  const deleteActu  = (id)     => sb.from('actus').update({ visible: false }).eq('id', id);

  // ── ANNONCES ──────────────────────────────────────────────────
  const getAnnonces = (cat, limit = 30) => {
    let q = sb.from('annonces').select('*').eq('visible', true).eq('validee', true)
      .order('created_at', { ascending: false }).limit(limit);
    if (cat) q = q.eq('categorie', cat);
    return q;
  };
  const getPendingAnnonces = () =>
    sb.from('annonces').select('*').eq('validee', false)
      .order('created_at', { ascending: false });
  const createAnnonce  = (f) => sb.from('annonces').insert({ visible: false, validee: false, ...f });
  const approveAnnonce = (id) => sb.from('annonces').update({ visible: true, validee: true }).eq('id', id);
  const rejectAnnonce  = (id) => sb.from('annonces').update({ visible: false }).eq('id', id);

  // ── ÉVÉNEMENTS ────────────────────────────────────────────────
  const getEvenements = (limit = 20) =>
    sb.from('evenements').select('*').eq('visible', true).eq('validee', true)
      .gte('date_debut', new Date().toISOString())
      .order('date_debut', { ascending: true }).limit(limit);
  const getPendingEvenements = () =>
    sb.from('evenements').select('*').eq('validee', false).order('created_at', { ascending: false });
  const createEvenement  = (f) => sb.from('evenements').insert({ visible: false, validee: false, ...f });
  const approveEvenement = (id) => sb.from('evenements').update({ visible: true, validee: true }).eq('id', id);
  const rejectEvenement  = (id) => sb.from('evenements').update({ visible: false }).eq('id', id);
  const getInscriptions  = (code) =>
    sb.from('event_inscriptions').select('evenement_id').eq('profil_code', code);
  const addInscription   = (evtId, code) =>
    sb.from('event_inscriptions').insert({ evenement_id: evtId, profil_code: code });
  const removeInscription = (evtId, code) =>
    sb.from('event_inscriptions').delete().eq('evenement_id', evtId).eq('profil_code', code);

  // ── GROUPES ───────────────────────────────────────────────────
  const getGroupes    = ()           => sb.from('groupes').select('*').eq('visible', true).order('created_at', { ascending: false });
  const createGroupe  = (f)          => sb.from('groupes').insert({ visible: true, ...f }).select().single();
  const getMesGroupes = (code)       => sb.from('groupe_membres').select('groupe_id').eq('profil_code', code);
  const joinGroupe    = (gId, code)  => sb.from('groupe_membres').insert({ groupe_id: gId, profil_code: code });
  const leaveGroupe   = (gId, code)  => sb.from('groupe_membres').delete().eq('groupe_id', gId).eq('profil_code', code);
  const getMembresCount = (gId)      => sb.from('groupe_membres').select('*', { count: 'exact', head: true }).eq('groupe_id', gId);
  const getMessages   = (gId, lim = 60) =>
    sb.from('groupe_messages').select('*').eq('groupe_id', gId)
      .order('created_at', { ascending: true }).limit(lim);
  const sendMessage   = (f)          => sb.from('groupe_messages').insert(f).select().single();

  // ── NOTIFICATIONS ─────────────────────────────────────────────
  const getNotifs     = (code) =>
    sb.from('notifications').select('*').eq('profil_code', code)
      .order('created_at', { ascending: false }).limit(30);
  const markNotifRead = (id)   => sb.from('notifications').update({ lu: true }).eq('id', id);
  const markAllRead   = (code) => sb.from('notifications').update({ lu: true }).eq('profil_code', code).eq('lu', false);
  const createNotif   = (f)    => sb.from('notifications').insert(f);

  // ── ADMIN ─────────────────────────────────────────────────────
  const getStats      = ()          => sb.from('v_stats_admin').select('*').single();
  const getAllProfils  = (lim = 100) => sb.from('profils').select('*').order('created_at', { ascending: false }).limit(lim);
  const getAllPosts    = (lim = 50)  => sb.from('posts').select('*').eq('visible', true).order('created_at', { ascending: false }).limit(lim);
  const setAdmin      = (code, val) => sb.from('profils').update({ is_admin: val }).eq('code', code);
  const hidePostAdmin = (id)        => sb.from('posts').update({ visible: false }).eq('id', id);

  // ── UPLOAD PHOTO ──────────────────────────────────────────────
  const uploadPhoto = async (file, folder = 'posts') => {
    const compressed = await Utils.compressImage(file);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, 'jpg');
    const name = `${folder}/${Date.now()}-${Auth.getSid().slice(0, 8)}.${ext}`;
    const { error } = await sb.storage.from(CQP.BUCKET).upload(name, compressed, {
      contentType: 'image/jpeg', upsert: false,
    });
    if (error) throw error;
    return sb.storage.from(CQP.BUCKET).getPublicUrl(name).data.publicUrl;
  };

  // ── PAGE VIEW ─────────────────────────────────────────────────
  const trackView = (page) => {
    const code = Auth.getCode();
    sb.from('page_views').insert({ page, profil_code: code || null }).catch(() => {});
  };

  return {
    getProfil, updateProfil, getProfilStats,
    getFeed, getMesPosts, createPost, hidePost,
    getLikesForPosts, addLike, removeLike,
    getComments, addComment, hideComment,
    getStories, createStory,
    getActus, createActu, updateActu, deleteActu,
    getAnnonces, getPendingAnnonces, createAnnonce, approveAnnonce, rejectAnnonce,
    getEvenements, getPendingEvenements, createEvenement, approveEvenement, rejectEvenement,
    getInscriptions, addInscription, removeInscription,
    getGroupes, createGroupe, getMesGroupes, joinGroupe, leaveGroupe, getMembresCount, getMessages, sendMessage,
    getNotifs, markNotifRead, markAllRead, createNotif,
    getStats, getAllProfils, getAllPosts, setAdmin, hidePostAdmin,
    uploadPhoto, trackView,
  };
})();
