/* ═══════════════════════════════════════════════════════════════
   CQP TOULOUSE — utils.js  (fonctions utilitaires pures)
   ═══════════════════════════════════════════════════════════════ */

const Utils = (() => {

  // ── Temps relatif ──────────────────────────────────────────────
  const timeAgo = d => {
    if (!d) return '';
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60)     return "À l'instant";
    if (s < 3600)   return `Il y a ${Math.floor(s / 60)} min`;
    if (s < 86400)  return `Il y a ${Math.floor(s / 3600)} h`;
    if (s < 604800) return `Il y a ${Math.floor(s / 86400)} j`;
    return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  };

  // ── Escape HTML ────────────────────────────────────────────────
  const esc = s => {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  };

  // ── Compression image ──────────────────────────────────────────
  const compressImage = (file, maxW = 1200, q = 0.82) => {
    if (!file?.type?.startsWith('image/')) return Promise.resolve(file);
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
      img.onerror = () => res(file);
      img.src = url;
    });
  };

  // ── Countdown événement ────────────────────────────────────────
  const countdown = d => {
    const ms = new Date(d) - Date.now();
    if (ms < 0) return 'Passé';
    const days = Math.floor(ms / 86400000);
    if (days === 0) return "⚡ Aujourd'hui";
    if (days === 1) return '🔴 Demain';
    if (days <= 7)  return `🟠 Dans ${days} j`;
    return `📅 ${new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}`;
  };

  // ── Export CSV ─────────────────────────────────────────────────
  const exportCSV = (data, filename) => {
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(','), ...data.map(row =>
      keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')
    )];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Debounce ───────────────────────────────────────────────────
  const debounce = (fn, ms = 300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // ── Toast notification ────────────────────────────────────────
  const toast = (msg, type = 'info', duration = 2500) => {
    const el = document.createElement('div');
    const colors = { info:'var(--blue)', success:'var(--green)', error:'var(--rouge)' };
    el.style.cssText = `position:fixed;bottom:calc(var(--nav) + 12px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:${colors[type]||colors.info};color:#fff;padding:10px 20px;border-radius:24px;font-family:'Barlow Condensed',sans-serif;font-size:.8rem;letter-spacing:1px;z-index:9999;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.2);`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  };

  // ── Groq via Edge Function ─────────────────────────────────────
  const groq = async (prompt, messages) => {
    const body = {};
    if (messages?.length) body.messages = messages;
    if (prompt) body.prompt = prompt;
    const r = await fetch(CQP.EF + 'groq-auto?mode=chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Groq EF ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Erreur Groq');
    return d.reply;
  };

  return { timeAgo, esc, compressImage, countdown, exportCSV, debounce, toast, groq };
})();
