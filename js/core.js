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
