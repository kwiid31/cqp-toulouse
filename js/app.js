// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v2 — app.js  Point d'entrée unique
// Chargé en premier sur toutes les pages
// ═══════════════════════════════════════════════════════════════════

const CQP = Object.freeze({
  SBU: 'https://vzfwtyczqfbhbjzotjft.supabase.co',
  SBK: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Znd0eWN6cWZiaGJqem90amZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDY0OTIsImV4cCI6MjA5MTMyMjQ5Mn0.heto5Qc6WdIjlurllzXhi1PmnRY7_x65Bdof-vKqyGk',
  BUCKET: 'site-photos',
  FEED_SIZE: 10,
  STORY_TTL: 24 * 60 * 60 * 1000,
  VERSION: '2.0.0',
});

// Instance Supabase partagée — une seule sur toute l'app
const sb = supabase.createClient(CQP.SBU, CQP.SBK);
window.__sb = sb;

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
