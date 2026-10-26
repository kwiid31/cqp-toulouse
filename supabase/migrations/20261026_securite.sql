-- ═══════════════════════════════════════════════════════════════════
-- CQP TOULOUSE — Sécurisation de la base (26/10/2026)
-- Avant : toutes les tables ouvertes en lecture/écriture à tout le monde.
-- Après : chaque membre connecté (Supabase Auth) ne modifie que ses
-- propres contenus ; les admins sont vérifiés côté base.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1. Lien profil ↔ compte Supabase Auth ──────────────────────────
alter table profils add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- ── 2. Fonctions utilitaires ───────────────────────────────────────
create or replace function public.my_code() returns varchar
language sql stable security definer set search_path = public as $$
  select code from profils where user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profils where user_id = auth.uid() limit 1), false)
$$;

-- Seul un admin peut nommer / retirer un admin
create or replace function public.set_admin(p_code varchar, p_val boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux admins'; end if;
  update profils set is_admin = p_val where code = p_code;
end $$;

-- Annonces / événements : seul un admin peut valider ou ré-afficher
create or replace function public.enforce_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.validee := false;
    new.visible := false;
  else
    new.validee := old.validee;
    new.profil_code := old.profil_code;
    if new.visible and not old.visible then new.visible := old.visible; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_moderation on annonces;
create trigger trg_moderation before insert or update on annonces
  for each row execute function public.enforce_moderation();
drop trigger if exists trg_moderation on evenements;
create trigger trg_moderation before insert or update on evenements
  for each row execute function public.enforce_moderation();

-- ── 3. Supprimer toutes les anciennes règles « ouvert à tous » ─────
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── 4. PROFILS : email caché, is_admin / code non modifiables ──────
revoke select, insert, update, delete on profils from anon, authenticated;
grant select (id, prenom, quartier, bio, photo_url, created_at, updated_at, code, is_admin)
  on profils to anon, authenticated;
grant update (prenom, quartier, bio, photo_url, updated_at) on profils to authenticated;
-- (les créations de profil passent par l'Edge Function « profil-auth »)

create policy profils_lecture on profils for select to anon, authenticated using (true);
create policy profils_maj on profils for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 5. Contenus des membres ────────────────────────────────────────
-- POSTS
create policy posts_lecture on posts for select to anon, authenticated
  using (visible or profil_code = my_code() or is_admin());
create policy posts_creation on posts for insert to authenticated
  with check (profil_code = my_code());
create policy posts_maj on posts for update to authenticated
  using (profil_code = my_code() or is_admin());

-- LIKES
create policy likes_lecture on likes for select to anon, authenticated using (true);
create policy likes_creation on likes for insert to authenticated
  with check (profil_code = my_code());
create policy likes_suppression on likes for delete to authenticated
  using (profil_code = my_code());

-- COMMENTAIRES
create policy comm_lecture on commentaires for select to anon, authenticated
  using (visible or profil_code = my_code() or is_admin());
create policy comm_creation on commentaires for insert to authenticated
  with check (profil_code = my_code());
create policy comm_maj on commentaires for update to authenticated
  using (profil_code = my_code() or is_admin());

-- STORIES
create policy stories_lecture on stories for select to anon, authenticated
  using (visible or profil_code = my_code() or is_admin());
create policy stories_creation on stories for insert to authenticated
  with check (profil_code = my_code());
create policy stories_maj on stories for update to authenticated
  using (profil_code = my_code() or is_admin());

-- ANNONCES (validation forcée par le trigger)
create policy annonces_lecture on annonces for select to anon, authenticated
  using ((visible and validee) or profil_code = my_code() or is_admin());
create policy annonces_creation on annonces for insert to authenticated
  with check (profil_code = my_code());
create policy annonces_maj on annonces for update to authenticated
  using (profil_code = my_code() or is_admin());

-- ÉVÉNEMENTS (validation forcée par le trigger)
create policy evts_lecture on evenements for select to anon, authenticated
  using ((visible and validee) or profil_code = my_code() or is_admin());
create policy evts_creation on evenements for insert to authenticated
  with check (profil_code = my_code() or is_admin());
create policy evts_maj on evenements for update to authenticated
  using (profil_code = my_code() or is_admin());

-- INSCRIPTIONS AUX ÉVÉNEMENTS (nom, email, téléphone : admin seulement)
create policy insc_creation on inscriptions_evenements for insert to anon, authenticated
  with check (true);
create policy insc_lecture on inscriptions_evenements for select to authenticated
  using (is_admin());

-- GROUPES
create policy groupes_lecture on groupes for select to anon, authenticated
  using (visible or is_admin());
create policy groupes_creation on groupes for insert to authenticated
  with check (created_by = my_code());
create policy groupes_maj on groupes for update to authenticated
  using (created_by = my_code() or is_admin());

create policy membres_lecture on groupe_membres for select to anon, authenticated using (true);
create policy membres_creation on groupe_membres for insert to authenticated
  with check (profil_code = my_code());
create policy membres_suppression on groupe_membres for delete to authenticated
  using (profil_code = my_code() or is_admin());

create policy gmsg_lecture on groupe_messages for select to anon, authenticated
  using (visible or is_admin());
create policy gmsg_creation on groupe_messages for insert to authenticated
  with check (profil_code = my_code());
create policy gmsg_maj on groupe_messages for update to authenticated
  using (profil_code = my_code() or is_admin());

-- NOTIFICATIONS : chacun ne voit que les siennes
create policy notifs_lecture on notifications for select to authenticated
  using (dest_code = my_code());
create policy notifs_maj on notifications for update to authenticated
  using (dest_code = my_code());

-- ── 6. Contenus admin ──────────────────────────────────────────────
create policy actus_lecture on actus for select to anon, authenticated
  using (visible or is_admin());
create policy actus_admin on actus for all to authenticated
  using (is_admin()) with check (is_admin());

create policy config_lecture on site_config for select to anon, authenticated using (true);
create policy config_admin on site_config for all to authenticated
  using (is_admin()) with check (is_admin());

-- ── 7. Statistiques de visite ──────────────────────────────────────
create policy vues_creation on page_views for insert to anon, authenticated with check (true);
create policy vues_lecture on page_views for select to authenticated using (is_admin());

commit;
