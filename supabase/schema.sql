-- ═══════════════════════════════════════════════════════════════════
-- CQP TOULOUSE v2 — Schéma Supabase propre
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ── PROFILS ──────────────────────────────────────────────────────
create table if not exists profils (
  code        text primary key check (code ~ '^\d{6}$'),
  prenom      text not null check (length(prenom) between 1 and 30),
  quartier    text,
  bio         text check (length(bio) <= 300),
  photo_url   text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── POSTS ────────────────────────────────────────────────────────
create table if not exists posts (
  id          bigint primary key generated always as identity,
  profil_code text not null references profils(code) on delete cascade,
  contenu     text check (length(contenu) <= 2000),
  photo_url   text,
  type        text not null default 'post' check (type in ('post','actu','annonce','evenement')),
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists posts_feed_idx on posts(created_at desc) where visible = true;
create index if not exists posts_profil_idx on posts(profil_code, created_at desc);

-- ── LIKES ────────────────────────────────────────────────────────
create table if not exists likes (
  id          bigint primary key generated always as identity,
  profil_code text not null references profils(code) on delete cascade,
  post_id     bigint not null references posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profil_code, post_id)
);
create index if not exists likes_post_idx on likes(post_id);

-- ── COMMENTAIRES ─────────────────────────────────────────────────
create table if not exists commentaires (
  id          bigint primary key generated always as identity,
  profil_code text not null references profils(code) on delete cascade,
  post_id     bigint not null references posts(id) on delete cascade,
  contenu     text not null check (length(contenu) between 1 and 500),
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists commentaires_post_idx on commentaires(post_id, created_at);

-- ── STORIES ──────────────────────────────────────────────────────
create table if not exists stories (
  id          bigint primary key generated always as identity,
  profil_code text not null references profils(code) on delete cascade,
  photo_url   text,
  texte       text check (length(texte) <= 200),
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  created_at  timestamptz not null default now()
);
create index if not exists stories_active_idx on stories(expires_at desc);

-- ── ACTUS ────────────────────────────────────────────────────────
create table if not exists actus (
  id                bigint primary key generated always as identity,
  titre             text not null check (length(titre) between 1 and 120),
  contenu           text,
  categorie         text default 'Général',
  photo_url         text,
  visible           boolean not null default true,
  date_publication  timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index if not exists actus_pub_idx on actus(date_publication desc) where visible = true;

-- ── ANNONCES ─────────────────────────────────────────────────────
create table if not exists annonces (
  id          bigint primary key generated always as identity,
  profil_code text references profils(code) on delete set null,
  titre       text not null check (length(titre) between 1 and 100),
  contenu     text check (length(contenu) <= 1000),
  categorie   text default 'Divers',
  prix        numeric(10,2),
  photo_url   text,
  quartier    text,
  telephone   text,
  email       text,
  visible     boolean not null default false,
  validee     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists annonces_visible_idx on annonces(created_at desc) where visible = true and validee = true;

-- ── ÉVÉNEMENTS ───────────────────────────────────────────────────
create table if not exists evenements (
  id            bigint primary key generated always as identity,
  titre         text not null check (length(titre) between 1 and 120),
  description   text,
  lieu          text,
  date_debut    timestamptz not null,
  date_fin      timestamptz,
  categorie     text default 'Événement',
  photo_url     text,
  places_max    int,
  propose_par   text,
  visible       boolean not null default false,
  validee       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists evenements_upcoming_idx on evenements(date_debut asc)
  where visible = true and validee = true;

-- ── INSCRIPTIONS ÉVÉNEMENTS ──────────────────────────────────────
create table if not exists event_inscriptions (
  evenement_id  bigint not null references evenements(id) on delete cascade,
  profil_code   text not null references profils(code) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (evenement_id, profil_code)
);

-- ── GROUPES ──────────────────────────────────────────────────────
create table if not exists groupes (
  id          bigint primary key generated always as identity,
  nom         text not null check (length(nom) between 1 and 60),
  description text check (length(description) <= 300),
  emoji       text default '👥',
  couleur     text default 'blue',
  profil_code text references profils(code) on delete set null,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── MEMBRES GROUPES ──────────────────────────────────────────────
create table if not exists groupe_membres (
  groupe_id   bigint not null references groupes(id) on delete cascade,
  profil_code text not null references profils(code) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (groupe_id, profil_code)
);
create index if not exists groupe_membres_profil_idx on groupe_membres(profil_code);

-- ── MESSAGES GROUPES ─────────────────────────────────────────────
create table if not exists groupe_messages (
  id          bigint primary key generated always as identity,
  groupe_id   bigint not null references groupes(id) on delete cascade,
  profil_code text not null references profils(code) on delete cascade,
  contenu     text not null check (length(contenu) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists groupe_messages_idx on groupe_messages(groupe_id, created_at desc);

-- ── NOTIFICATIONS ────────────────────────────────────────────────
create table if not exists notifications (
  id          bigint primary key generated always as identity,
  profil_code text not null references profils(code) on delete cascade,
  type        text not null check (type in ('like','commentaire','mention','groupe','evenement','annonce')),
  titre       text not null,
  payload     jsonb default '{}',
  lu          boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifs_unread_idx on notifications(profil_code, created_at desc) where lu = false;

-- ── PAGE VIEWS ───────────────────────────────────────────────────
create table if not exists page_views (
  id          bigint primary key generated always as identity,
  profil_code text references profils(code) on delete set null,
  page        text not null,
  created_at  timestamptz not null default now()
);

-- ── VUE STATS ADMIN ──────────────────────────────────────────────
create or replace view v_stats_admin as
  select
    (select count(*) from profils)::int as nb_profils,
    (select count(*) from posts where visible = true)::int as nb_posts,
    (select count(*) from likes)::int as nb_likes,
    (select count(*) from stories where expires_at > now())::int as nb_stories,
    (select count(*) from annonces where validee = false)::int as nb_annonces_pending,
    (select count(*) from evenements where validee = false)::int as nb_events_pending,
    (select count(*) from groupes where visible = true)::int as nb_groupes,
    (select count(*) from page_views where created_at > now() - interval '7 days')::int as views_7j;

-- ── RLS ──────────────────────────────────────────────────────────
alter table profils enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table commentaires enable row level security;
alter table stories enable row level security;
alter table annonces enable row level security;
alter table evenements enable row level security;
alter table event_inscriptions enable row level security;
alter table groupes enable row level security;
alter table groupe_membres enable row level security;
alter table groupe_messages enable row level security;
alter table notifications enable row level security;
alter table page_views enable row level security;

-- Lecture publique
create policy "read_profils" on profils for select using (true);
create policy "read_posts" on posts for select using (visible = true);
create policy "read_likes" on likes for select using (true);
create policy "read_commentaires" on commentaires for select using (visible = true);
create policy "read_stories" on stories for select using (expires_at > now());
create policy "read_actus" on actus for select using (visible = true);
create policy "read_annonces" on annonces for select using (visible = true and validee = true);
create policy "read_evenements" on evenements for select using (visible = true and validee = true);
create policy "read_groupes" on groupes for select using (visible = true);
create policy "read_groupe_membres" on groupe_membres for select using (true);
create policy "read_groupe_messages" on groupe_messages for select using (true);
create policy "read_notifs" on notifications for select using (true);

-- Écriture ouverte (app code-based, pas JWT)
create policy "write_posts" on posts for insert with check (true);
create policy "write_likes" on likes for insert with check (true);
create policy "delete_likes" on likes for delete using (true);
create policy "write_commentaires" on commentaires for insert with check (true);
create policy "write_stories" on stories for insert with check (true);
create policy "write_annonces" on annonces for insert with check (true);
create policy "write_evenements" on evenements for insert with check (true);
create policy "write_event_insc" on event_inscriptions for all using (true) with check (true);
create policy "write_groupes" on groupes for insert with check (true);
create policy "write_groupe_membres" on groupe_membres for all using (true) with check (true);
create policy "write_groupe_messages" on groupe_messages for insert with check (true);
create policy "write_page_views" on page_views for insert with check (true);
create policy "write_notifs" on notifications for update using (true);
create policy "write_profils" on profils for all using (true) with check (true);
create policy "update_posts" on posts for update using (true);
create policy "update_annonces" on annonces for update using (true);
create policy "update_evenements" on evenements for update using (true);
