-- ═══════════════════════════════════════════════════════════════
-- CQP Toulouse — Politiques RLS (Row-Level Security)
-- À exécuter dans Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Colonne admin sur profils
ALTER TABLE profils ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Fonction helper : extrait profil_code du JWT
CREATE OR REPLACE FUNCTION auth_profil_code() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::json->>'profil_code'
$$ LANGUAGE sql STABLE;

-- ── profils ──────────────────────────────────────────────────────
ALTER TABLE profils ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profils_read"   ON profils;
DROP POLICY IF EXISTS "profils_insert" ON profils;
DROP POLICY IF EXISTS "profils_update" ON profils;
CREATE POLICY "profils_read"   ON profils FOR SELECT USING (true);
CREATE POLICY "profils_insert" ON profils FOR INSERT WITH CHECK (true);  -- inscription libre
CREATE POLICY "profils_update" ON profils FOR UPDATE USING (code = auth_profil_code());

-- ── posts ─────────────────────────────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_read"   ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_read"   ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (profil_code = auth_profil_code());
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (profil_code = auth_profil_code());

-- ── stories ───────────────────────────────────────────────────────
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_read"   ON stories;
DROP POLICY IF EXISTS "stories_insert" ON stories;
DROP POLICY IF EXISTS "stories_delete" ON stories;
CREATE POLICY "stories_read"   ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "stories_delete" ON stories FOR DELETE USING (profil_code = auth_profil_code());

-- ── likes ─────────────────────────────────────────────────────────
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_read"   ON likes;
DROP POLICY IF EXISTS "likes_insert" ON likes;
DROP POLICY IF EXISTS "likes_delete" ON likes;
CREATE POLICY "likes_read"   ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (profil_code = auth_profil_code());

-- ── commentaires ──────────────────────────────────────────────────
ALTER TABLE commentaires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_read"   ON commentaires;
DROP POLICY IF EXISTS "comments_insert" ON commentaires;
DROP POLICY IF EXISTS "comments_delete" ON commentaires;
CREATE POLICY "comments_read"   ON commentaires FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON commentaires FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "comments_delete" ON commentaires FOR DELETE USING (profil_code = auth_profil_code());

-- ── groupe_membres ────────────────────────────────────────────────
ALTER TABLE groupe_membres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gm_read"   ON groupe_membres;
DROP POLICY IF EXISTS "gm_insert" ON groupe_membres;
DROP POLICY IF EXISTS "gm_delete" ON groupe_membres;
CREATE POLICY "gm_read"   ON groupe_membres FOR SELECT USING (true);
CREATE POLICY "gm_insert" ON groupe_membres FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "gm_delete" ON groupe_membres FOR DELETE USING (profil_code = auth_profil_code());

-- ── groupe_messages ───────────────────────────────────────────────
ALTER TABLE groupe_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gmsg_read"   ON groupe_messages;
DROP POLICY IF EXISTS "gmsg_insert" ON groupe_messages;
CREATE POLICY "gmsg_read"   ON groupe_messages FOR SELECT USING (true);
CREATE POLICY "gmsg_insert" ON groupe_messages FOR INSERT WITH CHECK (profil_code = auth_profil_code());

-- ── annonces ──────────────────────────────────────────────────────
ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ann_read"   ON annonces;
DROP POLICY IF EXISTS "ann_insert" ON annonces;
DROP POLICY IF EXISTS "ann_update" ON annonces;
DROP POLICY IF EXISTS "ann_delete" ON annonces;
CREATE POLICY "ann_read"   ON annonces FOR SELECT USING (true);
CREATE POLICY "ann_insert" ON annonces FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "ann_update" ON annonces FOR UPDATE USING (profil_code = auth_profil_code());
CREATE POLICY "ann_delete" ON annonces FOR DELETE USING (profil_code = auth_profil_code());

-- ── evenements ────────────────────────────────────────────────────
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evt_read"   ON evenements;
DROP POLICY IF EXISTS "evt_insert" ON evenements;
DROP POLICY IF EXISTS "evt_update" ON evenements;
DROP POLICY IF EXISTS "evt_delete" ON evenements;
CREATE POLICY "evt_read"   ON evenements FOR SELECT USING (true);
CREATE POLICY "evt_insert" ON evenements FOR INSERT WITH CHECK (profil_code = auth_profil_code());
CREATE POLICY "evt_update" ON evenements FOR UPDATE USING (profil_code = auth_profil_code());
CREATE POLICY "evt_delete" ON evenements FOR DELETE USING (profil_code = auth_profil_code());
