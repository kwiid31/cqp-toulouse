// ═══════════════════════════════════════════════════════════════════════════
// CQP TOULOUSE — Core JS partagé v3
// Code 6 chiffres = UNIQUE identité permanente de l'utilisateur.
// Ce fichier est chargé AVANT sb=createClient() donc NE PAS utiliser sb.
// ═══════════════════════════════════════════════════════════════════════════

const CQP_SBU = 'https://vzfwtyczqfbhbjzotjft.supabase.co';
const CQP_SBK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Znd0eWN6cWZiaGJqem90amZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDY0OTIsImV4cCI6MjA5MTMyMjQ5Mn0.heto5Qc6WdIjlurllzXhi1PmnRY7_x65Bdof-vKqyGk';
const CQP_EFN = 'https://vzfwtyczqfbhbjzotjft.supabase.co/functions/v1/groq-auto';

// ── Identité permanente : code 6 chiffres ────────────────────────────────────
const getCode   = () => localStorage.getItem('cqp_code')   || null;
const getPrenom = () => localStorage.getItem('cqp_prenom') || '';
const getPhoto  = () => localStorage.getItem('cqp_photo')  || null;
const getSid    = () => { let s=localStorage.getItem('cqp_sid'); if(!s){s=crypto.randomUUID?.()??Math.random().toString(36).slice(2);localStorage.setItem('cqp_sid',s);} return s; };
const esc       = s  => { const d=document.createElement('div');d.textContent=s||'';return d.innerHTML; };

function saveSession(p) {
  localStorage.setItem('cqp_code',   p.code      || '');
  localStorage.setItem('cqp_prenom', p.prenom    || '');
  localStorage.setItem('cqp_photo',  p.photo_url || '');
}
function clearSession() {
  ['cqp_code','cqp_prenom','cqp_photo','cqp_sid','cqp_token'].forEach(k => localStorage.removeItem(k));
}

// ── Vérification connexion (sb passé en paramètre) ───────────────────────────
async function requireAuth(sb, redirectTo = 'profil.html') {
  const code = getCode();
  if (!code) { window.location.href = redirectTo; return null; }
  try {
    const { data } = await sb.from('profils').select('*').eq('code', code).limit(1);
    if (!data?.length) { clearSession(); window.location.href = redirectTo; return null; }
    saveSession(data[0]);
    return data[0];
  } catch {
    return { code: getCode(), prenom: getPrenom(), photo_url: getPhoto() };
  }
}

// ── Verrouiller tous les champs prénom ───────────────────────────────────────
function lockPrenom(prenom) {
  if (!prenom) return;
  ['c-name','sp-prenom','an-prenom','pe-prenom','sheet-prenom',
   'pub-prenom','post-prenom','story-prenom','comment-prenom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = prenom; el.readOnly = true; el.style.cssText = 'background:var(--bg3,#E4E6EB);color:var(--txt2,#65676B);cursor:default;pointer-events:none;'; }
  });
}

// ── Tracker une visite (sb passé en paramètre) ───────────────────────────────
function trackVisit(sb, page) {
  const code = getCode();
  if (code && sb) sb.from('page_views').insert({ page, profil_code: code }).catch(() => {});
}

// ── Temps relatif ─────────────────────────────────────────────────────────────
function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "À l'instant";
  if (s < 3600) return `Il y a ${Math.floor(s/60)} min`;
  if (s < 86400) return `Il y a ${Math.floor(s/3600)} h`;
  if (s < 604800) return `Il y a ${Math.floor(s/86400)} j`;
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
}

// ── Compression image ─────────────────────────────────────────────────────────
async function compressImage(file, maxW = 1200, q = 0.82) {
  if (!file?.type?.startsWith('image/')) return file;
  return new Promise(res => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => res(new File([b], file.name, { type: 'image/jpeg' })), 'image/jpeg', q);
    };
    img.onerror = () => res(file); img.src = url;
  });
}

// ── Groq via Edge Function Supabase ───────────────────────────────────────────
async function groqViaEF(messages, prompt) {
  const body = {};
  if (messages?.length) body.messages = messages;
  if (prompt) body.prompt = prompt;
  const r = await fetch(CQP_EFN + '?mode=chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('EF ' + r.status);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Erreur Groq');
  return d.reply;
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV(data, filename) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(row => keys.map(k => `"${String(row[k]??'').replace(/"/g,'""')}"`).join(','))];
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Upload photo (sb passé en paramètre) ─────────────────────────────────────
async function uploadPhoto(sb, file, folder = 'posts') {
  file = await compressImage(file);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const name = `${folder}/${Date.now()}-${getSid()}.${ext}`;
  const { error } = await sb.storage.from('site-photos').upload(name, file, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return sb.storage.from('site-photos').getPublicUrl(name).data.publicUrl;
}

// ── Token JWT (auth sécurisée) ───────────────────────────────────────────────
const getToken   = () => localStorage.getItem('cqp_token') || null;
const saveToken  = (t) => t ? localStorage.setItem('cqp_token', t) : null;
const clearToken = () => localStorage.removeItem('cqp_token');


// ── Validation URL photo (anti-XSS) ──────────────────────────────────────────
function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return '';
    if (!u.hostname.endsWith('.supabase.co') && !u.hostname.endsWith('.supabase.in')) return '';
    return url;
  } catch { return ''; }
}
