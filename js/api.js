/* ═══════════════════════════════════════════════════════════════
   CQP TOULOUSE — api.js  (TOUTES les requêtes Supabase)
   Dépend de : config.js, auth.js
   ═══════════════════════════════════════════════════════════════ */

const Api = (() => {
  let _sb = null;
  const init = sb => { _sb = sb; };
  const sb   = () => _sb;

  // ── PROFILS ────────────────────────────────────────────────────
  const getProfil       = code           => sb().from('profils').select('*').eq('code', code).limit(1).then(r => r.data?.[0] ?? null);
  const updateProfil    = (code, fields) => sb().from('profils').update(fields).eq('code', code);
  const getProfilStats  = async code => {
    const [a, b, c] = await Promise.all([
      sb().from('posts').select('*', { count:'exact', head:true }).eq('profil_code', code).eq('visible', true),
      sb().from('likes').select('*', { count:'exact', head:true }).eq('profil_code', code),
      sb().from('commentaires').select('*', { count:'exact', head:true }).eq('profil_code', code),
    ]);
    return { posts: a.count ?? 0, likes: b.count ?? 0, commentaires: c.count ?? 0 };
  };

  // ── POSTS (feed) ───────────────────────────────────────────────
  const getFeed = (page = 0, size = CQP.FEED_PAGE_SIZE) =>
    sb().from('posts').select('*').eq('visible', true)
      .order('created_at', { ascending: false })
      .range(page * size, (page + 1) * size - 1);

  const getMesPosts = (code, limit = 10) =>
    sb().from('posts').select('*').eq('profil_code', code).eq('visible', true)
      .order('created_at', { ascending: false }).limit(limit);

  const createPost  = fields => sb().from('posts').insert({ visible: true, ...fields }).select().single();
  const hidePost    = id     => sb().from('posts').update({ visible: false }).eq('id', id);

  // ── LIKES ──────────────────────────────────────────────────────
  const getLikesForPost = post_id          => sb().from('likes').select('profil_code').eq('post_id', post_id);
  const addLike         = (post_id, code)  => sb().from('likes').insert({ post_id, profil_code: code });
  const removeLike      = (post_id, code)  => sb().from('likes').delete().eq('post_id', post_id).eq('profil_code', code);

  // ── COMMENTAIRES ──────────────────────────────────────────────
  const getComments = post_id => sb().from('commentaires').select('*').eq('post_id', post_id).eq('visible', true).order('created_at');
  const addComment  = fields  => sb().from('commentaires').insert({ visible: true, ...fields });

  // ── STORIES ───────────────────────────────────────────────────
  const getStories   = ()      => sb().from('stories').select('*').eq('visible', true).order('created_at', { ascending: false }).limit(20);
  const createStory  = fields  => sb().from('stories').insert({ visible: true, ...fields });
  const hideStory    = id      => sb().from('stories').update({ visible: false }).eq('id', id);

  // ── ACTUS ─────────────────────────────────────────────────────
  const getActus     = (cat, limit = 50) => {
    let q = sb().from('actus').select('*').eq('visible', true).order('date_publication', { ascending: false }).limit(limit);
    if (cat) q = q.eq('categorie', cat);
    return q;
  };
  const createActu   = fields  => sb().from('actus').insert({ visible: true, ...fields });
  const hideActu     = id      => sb().from('actus').update({ visible: false }).eq('id', id);

  // ── ANNONCES ──────────────────────────────────────────────────
  const getAnnonces  = (cat)   => {
    let q = sb().from('annonces').select('*').eq('visible', true).order('created_at', { ascending: false }).limit(40);
    if (cat) q = q.eq('categorie', cat);
    return q;
  };
  const createAnnonce = fields => sb().from('annonces').insert({ visible: false, validee: false, ...fields });
  const approveAnnonce = id    => sb().from('annonces').update({ visible: true, validee: true }).eq('id', id);
  const hideAnnonce   = id     => sb().from('annonces').update({ visible: false }).eq('id', id);

  // ── ÉVÉNEMENTS ────────────────────────────────────────────────
  const getEvenements = ()     => sb().from('evenements').select('*').eq('visible', true).eq('validee', true).gte('date_debut', new Date().toISOString()).order('date_debut').limit(30);
  const createEvenement = fields => sb().from('evenements').insert({ visible: false, validee: false, ...fields });
  const approveEvenement = id  => sb().from('evenements').update({ visible: true, validee: true }).eq('id', id);
  const hideEvenement  = id    => sb().from('evenements').update({ visible: false }).eq('id', id);

  // ── GROUPES + MESSAGES ────────────────────────────────────────
  const getGroupes     = ()            => sb().from('groupes').select('*').eq('visible', true).order('created_at', { ascending: false });
  const createGroupe   = fields        => sb().from('groupes').insert({ visible: true, ...fields }).select().single();
  const rejoindreGroupe = (gId, code, prenom) => sb().from('groupe_membres').insert({ groupe_id: gId, profil_code: code, prenom });
  const quitterGroupe  = (gId, code)   => sb().from('groupe_membres').delete().eq('groupe_id', gId).eq('profil_code', code);
  const getGroupeMembres = gId         => sb().from('groupe_membres').select('*', { count:'exact', head:true }).eq('groupe_id', gId);
  const getMesGroupes  = code          => sb().from('groupe_membres').select('groupe_id').eq('profil_code', code);
  const getMessages    = (gId, limit = 60) => sb().from('groupe_messages').select('*').eq('groupe_id', gId).eq('visible', true).order('created_at').limit(limit);
  const sendMessage    = fields        => sb().from('groupe_messages').insert({ visible: true, ...fields });

  // ── ADMIN ─────────────────────────────────────────────────────
  const getAllProfils   = ()           => sb().from('profils').select('*').order('created_at', { ascending: false }).limit(100);
  const setAdminRole   = (code, val)  => sb().from('profils').update({ is_admin: val }).eq('code', code);
  const getPendingAnnonces = ()       => sb().from('annonces').select('*').order('created_at', { ascending: false }).limit(50);
  const getPendingEvenements = ()     => sb().from('evenements').select('*').order('created_at', { ascending: false }).limit(50);
  const getAllPosts     = (limit = 50) => sb().from('posts').select('*').eq('visible', true).order('created_at', { ascending: false }).limit(limit);
  const getTableCount  = table        => sb().from(table).select('*', { count:'exact', head:true });

  // ── UPLOAD PHOTO ──────────────────────────────────────────────
  const uploadPhoto = async (file, folder = 'posts') => {
    const compressed = await Utils.compressImage(file);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const name = `${folder}/${Date.now()}-${Auth.getSid()}.${ext}`;
    const { error } = await sb().storage.from(CQP.BUCKET).upload(name, compressed, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return sb().storage.from(CQP.BUCKET).getPublicUrl(name).data.publicUrl;
  };

  // ── TRACKER VISITE ────────────────────────────────────────────
  const trackVisit = (page) => {
    const code = Auth.getCode();
    if (code) sb().from('page_views').insert({ page, profil_code: code }).catch(() => {});
  };

  return {
    init,
    getProfil, updateProfil, getProfilStats,
    getFeed, getMesPosts, createPost, hidePost,
    getLikesForPost, addLike, removeLike,
    getComments, addComment,
    getStories, createStory, hideStory,
    getActus, createActu, hideActu,
    getAnnonces, createAnnonce, approveAnnonce, hideAnnonce,
    getEvenements, createEvenement, approveEvenement, hideEvenement,
    getGroupes, createGroupe, rejoindreGroupe, quitterGroupe, getGroupeMembres, getMesGroupes, getMessages, sendMessage,
    getAllProfils, setAdminRole, getPendingAnnonces, getPendingEvenements, getAllPosts, getTableCount,
    uploadPhoto, trackVisit,
  };
})();
