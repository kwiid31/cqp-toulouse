-- ═══════════════════════════════════════════════════════════════════
-- CQP TOULOUSE — Stockage des photos et vidéos dans Supabase (26/10/2026)
-- Remplace Cloudinary (compte désactivé). Offre gratuite : 1 Go.
-- Chemin des fichiers : <code membre>/<dossier>/<fichier>
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1. Espace « medias » : lecture publique, 8 Mo max, images/vidéos seulement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medias', 'medias', true, 8 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Nombre d'envois du membre sur 24 h (max 30) ─────────────────
create or replace function prive.envois_24h() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from storage.objects
  where bucket_id = 'medias' and owner_id = auth.uid()::text
    and created_at > now() - interval '24 hours'
$$;
revoke execute on function prive.envois_24h() from public;
grant execute on function prive.envois_24h() to authenticated;

-- ── 3. Règles d'accès ──────────────────────────────────────────────
-- Envoyer : membre connecté, dans SON dossier, dossiers prévus, quota respecté
drop policy if exists medias_envoi on storage.objects;
create policy medias_envoi on storage.objects for insert to authenticated
  with check (
    bucket_id = 'medias'
    and (storage.foldername(name))[1] = prive.my_code()
    and (storage.foldername(name))[2] in ('posts', 'stories', 'avatars', 'annonces', 'evenements', 'comments', 'groupes')
    and prive.envois_24h() < 30
  );

-- Supprimer : ses propres fichiers, ou un admin
drop policy if exists medias_suppression on storage.objects;
create policy medias_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'medias' and (owner_id = auth.uid()::text or prive.is_admin()));

-- Lister : seulement ses propres fichiers (nécessaire pour pouvoir les supprimer).
-- Les fichiers s'affichent par leur lien public, sans avoir à lister l'espace.
drop policy if exists medias_lecture on storage.objects;
create policy medias_lecture on storage.objects for select to authenticated
  using (bucket_id = 'medias' and (owner_id = auth.uid()::text or prive.is_admin()));

-- ── 4. Jauge pour la page admin ────────────────────────────────────
create or replace function public.stockage_utilise() returns table (fichiers bigint, octets bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not prive.is_admin() then raise exception 'Réservé aux admins'; end if;
  return query
    select count(*), coalesce(sum((metadata->>'size')::bigint), 0)::bigint
    from storage.objects where bucket_id = 'medias';
end $$;
revoke execute on function public.stockage_utilise() from public, anon;
grant execute on function public.stockage_utilise() to authenticated;

-- ── 5. Liste des fichiers de stories de plus de 7 jours ────────────
-- Utilisée uniquement par l'Edge Function de nettoyage (clé service)
create or replace function public.medias_stories_expirees() returns setof text
language sql stable security definer set search_path = public as $$
  select name from storage.objects
  where bucket_id = 'medias' and (storage.foldername(name))[2] = 'stories'
    and created_at < now() - interval '7 days'
  limit 1000
$$;
revoke execute on function public.medias_stories_expirees() from public, anon, authenticated;
grant execute on function public.medias_stories_expirees() to service_role;

commit;

-- ── 6. Nettoyage automatique : fichiers de stories de plus de 7 jours
-- (l'Edge Function « nettoyage-medias » les supprime via l'API Storage,
--  appelée chaque nuit à 4 h par pg_cron)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('nettoyage-medias') where exists (select 1 from cron.job where jobname = 'nettoyage-medias');
select cron.schedule('nettoyage-medias', '0 4 * * *', $$
  select net.http_post(
    url := 'https://rlrazcitmwxfaxlnnfau.supabase.co/functions/v1/nettoyage-medias',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
$$);
