-- ═══════════════════════════════════════════════════════════════════
-- CQP TOULOUSE — Liens Cloudinary cassés (compte désactivé, fichiers perdus)
-- On sauvegarde les anciens liens (au cas où Cloudinary revienne), puis on
-- les retire pour que le site n'affiche plus d'images cassées.
-- Les stories concernées ont toutes expiré : elles ne sont pas touchées.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- 1. Sauvegarde (schéma privé, invisible depuis l'API)
create table if not exists prive.medias_cloudinary_perdus (
  table_source text, ligne_id bigint, colonne text, ancienne_valeur text,
  sauvegarde_le timestamptz default now()
);

insert into prive.medias_cloudinary_perdus (table_source, ligne_id, colonne, ancienne_valeur)
select 'posts', id, c.col, c.val from posts,
  lateral (values ('photo_url', photo_url), ('video_url', video_url), ('image_url', image_url), ('media_urls', media_urls::text)) c(col, val)
  where c.val like '%cloudinary%'
union all
select 'evenements', id, c.col, c.val from evenements,
  lateral (values ('photo_url', photo_url), ('image_url', image_url)) c(col, val)
  where c.val like '%cloudinary%'
union all
select 'profils', id, 'photo_url', photo_url from profils where photo_url like '%cloudinary%';

-- 2. Posts sans texte dont le seul contenu était le média perdu : masqués (pas supprimés)
update posts set visible = false
  where coalesce(trim(contenu), '') = ''
    and coalesce(photo_url, '') || coalesce(video_url, '') || coalesce(image_url, '') || coalesce(media_urls::text, '') like '%cloudinary%';

-- 3. Retirer les liens cassés (le texte des posts reste)
update posts set
  photo_url  = case when photo_url  like '%cloudinary%' then null else photo_url end,
  video_url  = case when video_url  like '%cloudinary%' then null else video_url end,
  image_url  = case when image_url  like '%cloudinary%' then null else image_url end,
  media_urls = case when media_urls::text like '%cloudinary%' then null else media_urls end
  where coalesce(photo_url, '') || coalesce(video_url, '') || coalesce(image_url, '') || coalesce(media_urls::text, '') like '%cloudinary%';

update evenements set
  photo_url = case when photo_url like '%cloudinary%' then '' else photo_url end,
  image_url = case when image_url like '%cloudinary%' then null else image_url end
  where coalesce(photo_url, '') || coalesce(image_url, '') like '%cloudinary%';

update profils set photo_url = null where photo_url like '%cloudinary%';  -- l'initiale du prénom s'affiche à la place

commit;
