// Navbar partagée — chargée sur toutes les pages
(function() {
  const page = window.location.pathname.split('/').pop() || 'index.html'
  
  const active = (href) => page === href ? 'active' : ''

  const navbar = `
<nav class="bottom-nav">
  <a class="nav-item ${active('index.html')}" href="index.html" aria-label="Accueil"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Accueil</a>
  <a class="nav-item ${active('annonces2.html')}" href="annonces2.html" aria-label="Annonces"><svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>Annonces</a>
  <a class="nav-item ${active('evenements.html')}" href="evenements.html" aria-label="Agenda"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Agenda</a>
  <div class="nav-center"><button class="nav-pub" onclick="openNavPub()" aria-label="Publier"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>
  <a class="nav-item ${active('actus2.html')}" href="actus2.html" aria-label="Actus"><svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>Actus</a>
  <a class="nav-item" href="profil.html#notifs" aria-label="Notifs"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Notifs</a>
  <a class="nav-item ${active('profil.html')}" href="profil.html" aria-label="Profil"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Profil</a>
</nav>
<div class="pub-overlay" id="nav-pub-overlay" onclick="closeNavPub()"></div>
<div class="pub-menu" id="nav-pub-menu">
  <div class="pub-menu-title">Que voulez-vous partager ?</div>
  <div class="pub-options">
    <button class="pub-opt" onclick="closeNavPub();window.location.href='index.html#post'">
      <div class="pub-opt-icon" style="background:#fff0f2;">💬</div>
      <div><div class="pub-opt-label">Post</div><div class="pub-opt-sub">Texte ou photo</div></div>
    </button>
    <button class="pub-opt" onclick="closeNavPub();window.location.href='index.html#story'">
      <div class="pub-opt-icon" style="background:#f3f0ff;">📸</div>
      <div><div class="pub-opt-label">Story</div><div class="pub-opt-sub">Éphémère 24h</div></div>
    </button>
    <button class="pub-opt" onclick="closeNavPub();window.location.href='annonces2.html?new=1'">
      <div class="pub-opt-icon" style="background:#f0fdf4;">📋</div>
      <div><div class="pub-opt-label">Annonce</div><div class="pub-opt-sub">Vente, service…</div></div>
    </button>
    <button class="pub-opt" onclick="closeNavPub();window.location.href='evenements.html?new=1'">
      <div class="pub-opt-icon" style="background:#fff7ed;">📅</div>
      <div><div class="pub-opt-label">Événement</div><div class="pub-opt-sub">Organiser…</div></div>
    </button>
  </div>
</div>`

  // Injecter la navbar
  document.body.insertAdjacentHTML('beforeend', navbar)
})()

function openNavPub() {
  if (typeof Auth !== 'undefined' && !Auth.getCode()) { window.location.href = 'profil.html'; return }
  document.getElementById('nav-pub-overlay').classList.add('open')
  document.getElementById('nav-pub-menu').classList.add('open')
  document.body.style.overflow = 'hidden'
}
function closeNavPub() {
  document.getElementById('nav-pub-overlay').classList.remove('open')
  document.getElementById('nav-pub-menu').classList.remove('open')
  document.body.style.overflow = ''
}
