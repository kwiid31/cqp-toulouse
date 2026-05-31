// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE — api.js  (toutes les requêtes Supabase)
// Schéma DB réel vérifié — session_id requis partout
// ═══════════════════════════════════════════════════════════════════

const Api = (() => {

  // ── UTILITAIRE SESSION ─────────────────────────────────────────
  // session_id = code si connecté, sinon UUID anonyme
  const sid = () => Auth.getCode() || Auth.getSid()

  // ── PROFILS ───────────────────────────────────────────────────
  const getProfil = code =>
    sb.from('profils').select('*').eq('code', code).limit(1).then(r => r.data?.[0] ?? null)

  const updateProfil = (code, fields) =>
    sb.from('profils').update(fields).eq('code', code)

  const getProfilStats = async code => {
    const [p, l, c] = await Promise.all([
      sb.from('posts').select('*', { count:'exact', head:true }).eq('profil_code', code).eq('visible', true),
      sb.from('likes').select('*', { count:'exact', head:true }).eq('profil_code', code),
      sb.from('commentaires').select('*', { count:'exact', head:true }).eq('profil_code', code).eq('visible', true),
    ])
    return { posts: p.count ?? 0, likes: l.count ?? 0, commentaires: c.count ?? 0 }
  }

  // ── FEED / POSTS ──────────────────────────────────────────────
  const getFeed = (page = 0, size = CQP.FEED_SIZE) =>
    sb.from('posts').select('*').eq('visible', true)
      .order('created_at', { ascending: false })
      .range(page * size, (page + 1) * size - 1)

  const getMesPosts = (code, limit = 15) =>
    sb.from('posts').select('*').eq('profil_code', code).eq('visible', true)
      .order('created_at', { ascending: false }).limit(limit)

  const createPost = ({ prenom, contenu, photo_url, video_url, quartier, media_urls }) =>
    sb.from('posts').insert({
      session_id: sid(),
      profil_code: Auth.getCode() || null,
      prenom,
      contenu: contenu || null,
      photo_url: photo_url || null,
      video_url: video_url || null,
      media_urls: media_urls || null,
      quartier: quartier || null,
      visible: true,
    }).select().single()

  const hidePost = id => sb.from('posts').update({ visible: false }).eq('id', id)

  // ── LIKES ─────────────────────────────────────────────────────
  const getLikesForFeed = ids =>
    sb.from('likes').select('item_id, session_id').eq('item_type', 'post').in('item_id', ids)

  const addLike = postId =>
    sb.from('likes').insert({
      item_type: 'post',
      item_id: postId,
      session_id: sid(),
      profil_code: Auth.getCode() || null,
    })

  const removeLike = postId =>
    sb.from('likes').delete().eq('item_type', 'post').eq('item_id', postId).eq('session_id', sid())

  // ── COMMENTAIRES ──────────────────────────────────────────────
  const getComments = (itemType, itemId) =>
    sb.from('commentaires').select('*')
      .eq('item_type', itemType).eq('item_id', itemId).eq('visible', true)
      .order('created_at', { ascending: true })

  const addComment = ({ itemType, itemId, message, prenom, parentId }) =>
    sb.from('commentaires').insert({
      item_type: itemType,
      item_id: itemId,
      message,
      prenom,
      parent_id: parentId || null,
      profil_code: Auth.getCode() || null,
      visible: true,
    }).select().single()

  // ── STORIES ───────────────────────────────────────────────────
  const getStories = () =>
    sb.from('stories').select('*')
      .eq('visible', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(20)

  const createStory = ({ prenom, photo_url, video_url, texte, quartier }) => {
    if (!photo_url && !video_url) throw new Error('Photo ou vidéo obligatoire pour une story')
    return sb.from('stories').insert({
      session_id: sid(),
      profil_code: Auth.getCode() || null,
      prenom,
      photo_url: photo_url || null,
      video_url: video_url || null,
      texte: texte || null,
      quartier: quartier || 'Autre',
      visible: true,
      media_type: video_url ? 'video' : 'image',
    }).select().single()
  }

  // ── ACTUS ─────────────────────────────────────────────────────
  const getActus = (cat, limit = 30) => {
    let q = sb.from('actus').select('*').eq('visible', true)
      .order('date_publication', { ascending: false }).limit(limit)
    if (cat) q = q.eq('categorie', cat)
    return q
  }

  const createActu = fields =>
    sb.from('actus').insert({ visible: true, ...fields })

  const deleteActu = id =>
    sb.from('actus').update({ visible: false }).eq('id', id)

  // ── ANNONCES ──────────────────────────────────────────────────
  const getAnnonces = (cat, limit = 30) => {
    let q = sb.from('annonces').select('*').eq('visible', true).eq('validee', true)
      .order('created_at', { ascending: false }).limit(limit)
    if (cat) q = q.eq('categorie', cat)
    return q
  }

  const getPendingAnnonces = () =>
    sb.from('annonces').select('*').eq('validee', false)
      .order('created_at', { ascending: false })

  const createAnnonce = ({ prenom, nom = '', email = '', quartier = '', categorie, titre, description, contenu, telephone, photo_url }) =>
    sb.from('annonces').insert({
      prenom,
      nom,
      email,
      quartier,
      categorie,
      titre,
      description: description || contenu || '',
      contenu: contenu || description || null,
      telephone: telephone || null,
      photo_url: photo_url || null,
      profil_code: Auth.getCode() || null,
      visible: false,
      validee: false,
    })

  const approveAnnonce = id =>
    sb.from('annonces').update({ visible: true, validee: true }).eq('id', id)

  const rejectAnnonce = id =>
    sb.from('annonces').update({ visible: false }).eq('id', id)

  // ── ÉVÉNEMENTS ────────────────────────────────────────────────
  const getEvenements = (cat, limit = 20) => {
    let q = sb.from('evenements').select('*').eq('visible', true).eq('validee', true)
      .gte('date_debut', new Date().toISOString())
      .order('date_debut', { ascending: true }).limit(limit)
    if (cat) q = q.eq('categorie', cat)
    return q
  }

  const getPendingEvenements = () =>
    sb.from('evenements').select('*').eq('validee', false)
      .order('created_at', { ascending: false })

  const createEvenement = ({ titre, date_debut, categorie, lieu, description, propose_par, photo_url }) =>
    sb.from('evenements').insert({
      titre,
      date_debut,
      categorie: categorie || 'Événement',
      lieu: lieu || null,
      description: description || null,
      propose_par: propose_par || Auth.getPrenom() || null,
      prenom: Auth.getPrenom() || null,
      profil_code: Auth.getCode() || null,
      photo_url: photo_url || null,
      visible: false,
      validee: false,
    })

  const approveEvenement = id =>
    sb.from('evenements').update({ visible: true, validee: true }).eq('id', id)

  const rejectEvenement = id =>
    sb.from('evenements').update({ visible: false }).eq('id', id)

  const createInscription = ({ evenement_id, prenom, nom = '', email = '', telephone }) =>
    sb.from('inscriptions_evenements').insert({
      evenement_id,
      prenom,
      nom,
      email,
      telephone: telephone || null,
    })

  // ── GROUPES ───────────────────────────────────────────────────
  const getGroupes = () =>
    sb.from('groupes').select('*').eq('visible', true)
      .order('created_at', { ascending: false })

  const createGroupe = ({ nom, description, categorie, quartier }) =>
    sb.from('groupes').insert({
      nom,
      description: description || null,
      categorie: categorie || null,
      quartier: quartier || null,
      created_by: sid(),
      created_by_prenom: Auth.getPrenom() || null,
      membres_count: 1,
      visible: true,
    }).select().single()

  const getMesGroupes = () =>
    sb.from('groupe_membres').select('groupe_id').eq('session_id', sid())

  const joinGroupe = (groupeId) =>
    sb.from('groupe_membres').insert({
      groupe_id: groupeId,
      session_id: sid(),
      profil_code: Auth.getCode() || null,
      prenom: Auth.getPrenom() || 'Anonyme',
    })

  const leaveGroupe = (groupeId) =>
    sb.from('groupe_membres').delete()
      .eq('groupe_id', groupeId).eq('session_id', sid())

  const getMembresCount = (groupeId) =>
    sb.from('groupe_membres').select('*', { count:'exact', head:true })
      .eq('groupe_id', groupeId)

  // ── MESSAGES GROUPES ──────────────────────────────────────────
  const getMessages = (groupeId, limit = 60) =>
    sb.from('groupe_messages').select('*').eq('groupe_id', groupeId)
      .eq('visible', true)
      .order('created_at', { ascending: true }).limit(limit)

  const sendMessage = ({ groupe_id, contenu, photo_url }) =>
    sb.from('groupe_messages').insert({
      groupe_id,
      session_id: sid(),
      profil_code: Auth.getCode() || null,
      prenom: Auth.getPrenom() || 'Anonyme',
      contenu: contenu || null,
      photo_url: photo_url || null,
      visible: true,
    }).select().single()

  // ── ADMIN ─────────────────────────────────────────────────────
  const getStats = () =>
    sb.from('v_stats_admin').select('*').single()

  const getAllPosts = (limit = 50) =>
    sb.from('posts').select('*').eq('visible', true)
      .order('created_at', { ascending: false }).limit(limit)

  const getAllProfils = (limit = 100) =>
    sb.from('profils').select('*').order('created_at', { ascending: false }).limit(limit)

  const setAdmin = (code, val) =>
    sb.from('profils').update({ is_admin: val }).eq('code', code)

  const hidePostAdmin = id =>
    sb.from('posts').update({ visible: false }).eq('id', id)

  // ── UPLOAD VERS CLOUDINARY — zéro bande passante Supabase ─────
  const CLOUDINARY_CLOUD = 'dbpe9xree'
  const CLOUDINARY_PRESET = 'cqp_toulouse'

  const uploadPhoto = async (file, folder = 'posts') => {
    if (file.type.startsWith('video/')) return uploadVideo(file, folder)
    const compressed = await Utils.compressImage(file)
    const fd = new FormData()
    fd.append('file', compressed)
    fd.append('upload_preset', CLOUDINARY_PRESET)
    fd.append('folder', 'cqp/' + folder)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload Cloudinary échoué: ' + res.status)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.secure_url
  }

  const uploadVideo = async (file, folder = 'posts') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', CLOUDINARY_PRESET)
    fd.append('folder', 'cqp/' + folder)
    fd.append('resource_type', 'video')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload vidéo Cloudinary échoué: ' + res.status)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.secure_url
  }

  // ── PAGE VIEW ─────────────────────────────────────────────────
  const trackView = page => {
    sb.from('page_views').insert({
      session_id: sid(),
      profil_code: Auth.getCode() || null,
      page,
    }).then(() => {}).catch(() => {})
  }

  return {
    sid,
    getProfil, updateProfil, getProfilStats,
    getFeed, getMesPosts, createPost, hidePost,
    getLikesForFeed, addLike, removeLike,
    getComments, addComment,
    getStories, createStory,
    getActus, createActu, deleteActu, createAnnonce, createEvenement,
    getAnnonces, getPendingAnnonces, createAnnonce, approveAnnonce, rejectAnnonce,
    getEvenements, getPendingEvenements, createEvenement, approveEvenement, rejectEvenement,
    createInscription,
    getGroupes, createGroupe, getMesGroupes, joinGroupe, leaveGroupe, getMembresCount,
    getMessages, sendMessage,
    getStats, getAllPosts, getAllProfils, setAdmin, hidePostAdmin,
    uploadPhoto, trackView,
  }
})()
