// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v2 — utils.js  Fonctions pures sans état
// ═══════════════════════════════════════════════════════════════════

const Utils = (() => {

  // ── Escape HTML ───────────────────────────────────────────────
  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  };

  // ── Temps relatif ─────────────────────────────────────────────
  const timeAgo = (d) => {
    if (!d) return '';
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60)     return "À l'instant";
    if (s < 3600)   return `Il y a ${Math.floor(s / 60)} min`;
    if (s < 86400)  return `Il y a ${Math.floor(s / 3600)} h`;
    if (s < 604800) return `Il y a ${Math.floor(s / 86400)} j`;
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  // ── Compression image avant upload ────────────────────────────
  const compressImage = (file, maxW = 1200, quality = 0.82) => {
    if (!file?.type?.startsWith('image/')) return Promise.resolve(file);
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
          'image/jpeg', quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  };

  // ── Toast notification ────────────────────────────────────────
  const toast = (msg, type = 'info', duration = 2500) => {
    const colors = { info: 'var(--blue)', success: 'var(--green)', error: 'var(--rouge)', warn: 'var(--orange)' };
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position:fixed;bottom:calc(var(--nav,58px) + 12px + env(safe-area-inset-bottom));
      left:50%;transform:translateX(-50%);
      background:${colors[type] || colors.info};color:#fff;
      padding:10px 20px;border-radius:24px;
      font-family:'Barlow Condensed',sans-serif;font-size:.82rem;letter-spacing:1px;
      z-index:9999;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.2);
      white-space:nowrap;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  };

  // ── Countdown événement ───────────────────────────────────────
  const countdown = (dateStr) => {
    const ms = new Date(dateStr) - Date.now();
    if (ms < 0) return 'Passé';
    const d = Math.floor(ms / 86400000);
    if (d === 0) return "Aujourd'hui";
    if (d === 1) return 'Demain';
    if (d <= 7)  return `Dans ${d} j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // ── Debounce ──────────────────────────────────────────────────
  const debounce = (fn, ms = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // ── Copier dans le presse-papier ──────────────────────────────
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
  };

  // ── Export CSV ────────────────────────────────────────────────
  const exportCSV = (data, filename = 'export.csv') => {
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys, ...data.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`))]
      .map(r => r.join(','));
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: filename
    });
    document.body.appendChild(a); a.click(); a.remove();
  };

  return { esc, timeAgo, compressImage, toast, countdown, debounce, copy, exportCSV };
})();
