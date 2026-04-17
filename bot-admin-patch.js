/**
 * CQP Toulouse — Patch Bot IA pour admin.html
 * Ajouter UNE SEULE ligne juste avant </body> dans admin.html :
 *   <script src="bot-admin-patch.js"></script>
 */
(function() {
  'use strict';

  // ── 1. Injecter le bouton d'onglet ───────────────────────────────────────
  function injectTabButton() {
    // Cherche un bouton d'onglet existant pour s'y accrocher
    const tabBtns = document.querySelectorAll('.tab-btn');
    const lastBtn = tabBtns[tabBtns.length - 1];
    if (!lastBtn) { setTimeout(injectTabButton, 300); return; }

    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.tab = 't-bot';
    btn.textContent = '🤖 Bot Actus';
    btn.onclick = function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('t-bot').classList.add('active');
    };
    lastBtn.parentNode.insertBefore(btn, lastBtn.nextSibling);
  }

  // ── 2. Injecter le panneau ────────────────────────────────────────────────
  function injectPanel() {
    if (document.getElementById('t-bot')) return;
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = 't-bot';
    panel.innerHTML = `
      <div style="max-width:680px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;margin-bottom:6px">🤖 Bot Actualités IA</h3>
        <p style="font-size:.82rem;color:rgba(244,241,235,.5);margin-bottom:20px;line-height:1.5">
          Le bot scanne <strong>La Dépêche</strong> et <strong>Actu.fr Toulouse</strong>, filtre les articles liés aux quartiers populaires
          et les réécrit avec <strong>Groq (llama-3.1-8b)</strong>.
          Les actus générées apparaissent en <strong style="color:#E8940F">brouillon</strong> dans l'onglet Actualités pour validation.
        </p>

        <button id="bot-run-btn" style="background:#C8102E;color:#fff;border:none;border-radius:4px;padding:12px 24px;font-family:'Barlow Condensed',sans-serif;font-size:.95rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;margin-bottom:10px;transition:opacity .15s"
          onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'"
          onclick="runNewsBot()">▶ Lancer le bot maintenant</button>

        <div id="bot-msg" style="display:none;padding:10px 14px;border-radius:4px;font-family:'Barlow Condensed',sans-serif;font-size:.82rem;letter-spacing:1px;margin-bottom:16px"></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:14px">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:.7rem;letter-spacing:2px;text-transform:uppercase;color:rgba(244,241,235,.4);margin-bottom:10px">Sources</div>
            ${['La Dépêche — Haute-Garonne','Actu.fr Toulouse'].map(s=>
              `<div style="display:flex;align-items:center;gap:8px;font-size:.82rem;color:rgba(244,241,235,.7);margin-bottom:6px">
                <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0"></span>${s}
              </div>`).join('')}
          </div>
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:14px">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:.7rem;letter-spacing:2px;text-transform:uppercase;color:rgba(244,241,235,.4);margin-bottom:10px">Thèmes filtrés</div>
            ${['Logement / Expulsion','Emploi / Chômage','Mirail / Bellefontaine','Discrimination','Solidarité','Réfugiés'].map(t=>
              `<span style="display:inline-block;background:rgba(200,16,46,.15);border:1px solid rgba(200,16,46,.3);color:#ff6b6b;padding:3px 8px;border-radius:20px;font-family:'Barlow Condensed',sans-serif;font-size:.68rem;letter-spacing:1px;margin:0 4px 4px 0">${t}</span>`).join('')}
          </div>
        </div>

        <div id="bot-results" style="display:none">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:.7rem;letter-spacing:2px;text-transform:uppercase;color:rgba(244,241,235,.4);margin-bottom:10px">Résultats</div>
          <div id="bot-results-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // ── 3. Fonction runNewsBot ────────────────────────────────────────────────
  window.runNewsBot = async function() {
    const btn = document.getElementById('bot-run-btn');
    const msg = document.getElementById('bot-msg');
    btn.disabled = true;
    btn.textContent = '⏳ Bot en cours…';
    msg.style.display = 'none';

    // Récupère SBU et SBK depuis le contexte de la page admin
    const SBU = window.SBU || window._SBU || '';
    const SBK = window.SBK || window._SBK || '';
    if (!SBU) {
      showBotMsg('err', '⚠ Variables Supabase introuvables. Vérifie la console.');
      btn.disabled = false; btn.textContent = '▶ Lancer le bot maintenant';
      return;
    }

    try {
      const res = await fetch(`${SBU}/functions/v1/actu-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SBK}` }
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erreur inconnue');

      const list = document.getElementById('bot-results-list');
      list.innerHTML = (data.results || []).map(r => {
        const icon = r.mode === 'rss' ? '📰' : '✍️';
        const badge = r.mode === 'rss'
          ? `<span style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#4ade80;padding:2px 7px;border-radius:20px;font-size:.65rem;letter-spacing:1px">RSS</span>`
          : `<span style="background:rgba(232,148,15,.15);border:1px solid rgba(232,148,15,.3);color:#E8940F;padding:2px 7px;border-radius:20px;font-size:.65rem;letter-spacing:1px">Thème IA</span>`;
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">
          <span style="font-size:1rem;flex-shrink:0">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.84rem;color:rgba(244,241,235,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${r.titre || ''}</div>
            <div style="display:flex;align-items:center;gap:6px">${badge}
              <span style="font-family:'Barlow Condensed',sans-serif;font-size:.68rem;letter-spacing:1px;color:rgba(244,241,235,.35);text-transform:uppercase">${r.source}</span>
            </div>
          </div>
        </div>`;
      }).join('') || '<p style="color:rgba(244,241,235,.3);font-size:.82rem">Aucune actu générée (articles déjà en base ou RSS indisponible).</p>';

      document.getElementById('bot-results').style.display = 'block';
      const n = data.inserted || 0;
      showBotMsg('ok', `✅ ${n} actu${n>1?'s':''} générée${n>1?'s':''} — visibles dans l'onglet Actualités (brouillon).`);
      if (n > 0 && typeof renderActusAdmin === 'function') setTimeout(renderActusAdmin, 1000);
    } catch (e) {
      showBotMsg('err', '⚠ ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = '▶ Lancer le bot maintenant';
  };

  function showBotMsg(type, text) {
    const el = document.getElementById('bot-msg');
    el.textContent = text;
    el.style.display = 'block';
    el.style.background = type === 'ok' ? 'rgba(34,197,94,.12)' : 'rgba(200,16,46,.15)';
    el.style.border = type === 'ok' ? '1px solid rgba(34,197,94,.3)' : '1px solid rgba(200,16,46,.4)';
    el.style.color = type === 'ok' ? '#4ade80' : '#ff6b6b';
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectTabButton(); injectPanel(); });
  } else {
    injectTabButton();
    injectPanel();
  }
})();
