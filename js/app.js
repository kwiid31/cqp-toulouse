// CQP TOULOUSE v3 — app.js
// Nouveau projet Supabase org cc

const CQP = Object.freeze({
  SBU: 'https://rlrazcitmwxfaxlnnfau.supabase.co',
  SBK: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscmF6Y2l0bXd4ZmF4bG5uZmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODU4MzQsImV4cCI6MjA5NTk2MTgzNH0.0SSaUUq4x_-Slr4QJ3XJlF0mu0Ub_-ouXD3EC2-PGG0',
  BUCKET: 'site-photos',
  FEED_SIZE: 10,
  STORY_TTL: 24 * 60 * 60 * 1000,
  VERSION: '3.0.0',
});

const sb = supabase.createClient(CQP.SBU, CQP.SBK);
window.__sb = sb;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Navbar + Topbar scroll hide/show (Liquid Glass style) ────────
;(function() {
  var nav = document.querySelector('.bottom-nav')
  var top = document.querySelector('.topbar')
  if (!nav && !top) return
  var lastY = 0
  var ticking = false
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        var y = window.scrollY
        if (y > lastY + 6) {
          // Scroll vers le bas → cacher
          if (nav) nav.classList.add('hidden')
          if (top) top.classList.add('hidden')
        } else if (y < lastY - 6) {
          // Scroll vers le haut → montrer
          if (nav) nav.classList.remove('hidden')
          if (top) top.classList.remove('hidden')
        }
        lastY = y
        ticking = false
      })
      ticking = true
    }
  }, { passive: true })
})()
