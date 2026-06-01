// ═══════════════════════════════════════════════════════════════════
// CQP TOULOUSE v2 — app.js  Point d'entrée unique
// Chargé en premier sur toutes les pages
// ═══════════════════════════════════════════════════════════════════

const CQP = Object.freeze({
  SBU: 'https://yjcbhtmpfhyjwuqfldsx.supabase.co',
  SBK: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqY2JodG1wZmh5and1cWZsZHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzcyNjEsImV4cCI6MjA5NTkxMzI2MX0.23oZJLeOc--qxu3l4ivmbSYF0yUu_Mo7f5QqbGSkzto',
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
