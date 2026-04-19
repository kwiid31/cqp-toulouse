// CQP Toulouse — core.js
// Fonctions partagées entre toutes les pages

var SUPA_URL = 'https://vzfwtyczqfbhbjzotjft.supabase.co';
var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Znd0eWN6cWZiaGJqem90amZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDY0OTIsImV4cCI6MjA5MTMyMjQ5Mn0.heto5Qc6WdIjlurllzXhi1PmnRY7_x65Bdof-vKqyGk';
var sb = supabase.createClient(SUPA_URL, SUPA_KEY);

function getSid() {
  var s = sessionStorage.getItem('cqp_sid');
  if (!s) {
    s = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    sessionStorage.setItem('cqp_sid', s);
  }
  return s;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(d) {
  var diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'j';
  return new Date(d).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'});
}

function toast(msg, type) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  if (type === 'ok') el.style.background = '#16a34a';
  else if (type === 'err') el.style.background = '#dc2626';
  else el.style.background = '';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 3200);
}

function trackPage() {
  var k = 'pv_' + location.pathname;
  if (!sessionStorage.getItem(k)) {
    sessionStorage.setItem(k, '1');
    sb.from('page_views').insert({session_id: getSid(), page: location.pathname});
  }
}

// ── Shared UX helpers ─────────────────────────────────────────

// Injecte les styles partagés (skeleton, ripple, countPop, ring-pulse)
(function() {
  var s = document.createElement('style');
  s.textContent = [
    '.skel-card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px;}',
    '.skel-img{height:180px;}',
    '.skel-body{padding:12px 14px 16px;}',
    '.skel-line{border-radius:6px;margin-bottom:10px;}',
    '.skel-footer{height:44px;border-top:1px solid #f5f5f5;margin-top:8px;}',
    '.skeleton{background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);background-size:400% 100%;animation:shimmer 1.4s ease-in-out infinite;}',
    '@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}',
    '@keyframes countPop{0%,100%{transform:scale(1)}40%{transform:scale(1.5)}}',
    '.count-pop{display:inline-block;animation:countPop .28s cubic-bezier(.36,.07,.19,.97);}',
    '@keyframes ripple-anim{to{transform:scale(4);opacity:0}}',
    '.ripple-el{position:absolute;border-radius:50%;background:rgba(0,0,0,.1);width:20px;height:20px;pointer-events:none;animation:ripple-anim .55s ease-out forwards;transform-origin:center;}',
    '.btn-act{position:relative!important;overflow:hidden!important;}',
    '@keyframes ring-pulse{0%,100%{box-shadow:0 0 0 0 rgba(200,16,46,.3)}60%{box-shadow:0 0 0 6px rgba(200,16,46,0)}}',
    '.story-ring:not(.seen):not(.add){animation:ring-pulse 2.5s ease-in-out infinite;}',
  ].join('');
  document.head.appendChild(s);
})();

// Skeleton cards HTML (hasImg=true par défaut)
function buildSkeletons(n, hasImg) {
  var html = '';
  for (var i = 0; i < (n || 3); i++) {
    if (hasImg === false) {
      html += '<div class="skel-card" style="padding:14px">';
      html += '<div style="display:flex;gap:10px;margin-bottom:10px">';
      html += '<div class="skeleton" style="width:40px;height:40px;border-radius:10px;flex-shrink:0"></div>';
      html += '<div style="flex:1"><div class="skel-line skeleton" style="height:16px;width:70%;margin-bottom:8px"></div>';
      html += '<div class="skel-line skeleton" style="height:12px;width:45%"></div></div></div>';
      html += '<div class="skel-line skeleton" style="height:12px;width:88%"></div>';
      html += '<div class="skel-footer skeleton" style="margin-top:10px"></div>';
      html += '</div>';
    } else {
      html += '<div class="skel-card">';
      html += '<div class="skel-img skeleton"></div>';
      html += '<div class="skel-body">';
      html += '<div class="skel-line skeleton" style="height:14px;width:38%"></div>';
      html += '<div class="skel-line skeleton" style="height:20px;width:80%"></div>';
      html += '<div class="skel-line skeleton" style="height:13px;width:62%"></div>';
      html += '</div>';
      html += '<div class="skel-footer skeleton"></div>';
      html += '</div>';
    }
  }
  return html;
}

// Pop animation sur un compteur quand sa valeur change
function animCount(el, to) {
  if (!el) return;
  el.textContent = to;
  el.classList.remove('count-pop');
  void el.offsetWidth;
  el.classList.add('count-pop');
}

// Ripple material sur un bouton
function ripple(btn, e) {
  if (!btn || !e) return;
  var r = btn.getBoundingClientRect();
  var d = document.createElement('span');
  d.className = 'ripple-el';
  d.style.left = ((e.clientX - r.left) - 10) + 'px';
  d.style.top = ((e.clientY - r.top) - 10) + 'px';
  btn.appendChild(d);
  d.addEventListener('animationend', function() { d.parentNode && d.parentNode.removeChild(d); });
}
