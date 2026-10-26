-- ═══════════════════════════════════════════════════════════════════
-- CQP TOULOUSE — Nettoyage des avertissements Supabase (26/10/2026)
-- Les fonctions de sécurité ne doivent pas être appelables via l'API
-- (/rest/v1/rpc/...). On les range dans un schéma « prive » que l'API
-- n'expose pas ; les règles RLS continuent de les utiliser.
-- ═══════════════════════════════════════════════════════════════════

begin;

create schema if not exists prive;
revoke all on schema prive from public;
grant usage on schema prive to anon, authenticated;

-- 1. my_code() et is_admin() : utilisées par les règles RLS.
--    Déplacer le schéma garde les règles existantes (elles pointent la fonction, pas son nom).
alter function public.my_code() set schema prive;
alter function public.is_admin() set schema prive;
revoke execute on function prive.my_code(), prive.is_admin() from public;
grant execute on function prive.my_code(), prive.is_admin() to anon, authenticated;

-- 2. Fonction du trigger de modération : jamais appelée directement.
alter function public.enforce_moderation() set schema prive;
revoke execute on function prive.enforce_moderation() from public, anon, authenticated;
create or replace function prive.enforce_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if prive.is_admin() then return new; end if;
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

-- 3. set_admin() : reste appelable par la page admin, mais plus par les visiteurs.
create or replace function public.set_admin(p_code varchar, p_val boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not prive.is_admin() then raise exception 'Réservé aux admins'; end if;
  update profils set is_admin = p_val where code = p_code;
end $$;
revoke execute on function public.set_admin(varchar, boolean) from public, anon;
grant execute on function public.set_admin(varchar, boolean) to authenticated;

commit;
