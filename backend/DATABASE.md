# Conception de la base de données — Watchlist

> Document d'architecture. Objectif : poser dès le départ un schéma **correct,
> normalisé, maintenable et facile à faire évoluer**, en anticipant les usages
> probables de l'app sans tomber dans la sur-ingénierie (YAGNI).

## 1. Principes directeurs

1. **Migrations d'abord (Alembic).** Aucune modification de schéma « à la main ».
   Chaque changement = une migration versionnée, revue, réversible. C'est *le* levier
   de maintenabilité : on peut faire évoluer la base sans peur et rejouer l'historique.
2. **Clés primaires de substitution (surrogate keys).** Chaque table a un `id BIGINT`
   interne. Les identifiants externes (TVmaze) et les clés naturelles deviennent des
   contraintes `UNIQUE`. → Les relations (FK) restent stables même si une donnée externe change.
3. **Séparer ce qui est public de ce qui est privé.**
   - **Catalogue** (séries, épisodes = métadonnées TVmaze publiques) → **partagé** entre tous les utilisateurs, stocké une seule fois.
   - **Données utilisateur** (suivi, épisodes vus) → **privées**, toujours filtrées par `user_id` au niveau de l'API.
4. **Évolutivité additive.** 90 % des features futures (notes, ratings, favoris, tags,
   stats) s'ajoutent par une **migration additive** (nouvelle colonne / nouvelle table)
   sans toucher l'existant. On conçoit le noyau pour que ce soit le cas.
5. **Intégrité dans la base, validation dans le code.** Les invariants forts (unicité,
   FK, non-null) sont garantis par PostgreSQL. Les règles « métier souples » (valeurs de
   statut autorisées) sont validées par Pydantic côté API + une contrainte `CHECK`
   facile à modifier par migration.
6. **Horodatage systématique.** `created_at` / `updated_at` (`TIMESTAMPTZ`) sur les
   tables mutables → audit, tri chronologique, debug.

## 2. Analyse du domaine

### Entités du cœur (MVP actuel)
- **Utilisateur** : compte (email + mot de passe), provisionné par l'admin.
- **Série** : métadonnées TVmaze (nom, poster, saisons, genres…).
- **Épisode** : appartient à une série (saison + numéro, date de diffusion…).
- **Suivi d'une série par un utilisateur** : statut (à voir / en cours / terminé / abandonné), date d'ajout.
- **Épisode vu par un utilisateur** : horodaté.

### Usages futurs probables (anticipés, non implémentés maintenant)
| Usage envisagé | Impact schéma | Coût d'ajout plus tard |
| --- | --- | --- |
| Noter une série (1–10) | colonne `rating` sur `user_shows` | **Trivial** (additif) |
| Noter / commenter un épisode | colonnes sur `episode_watches` ou table `episode_notes` | **Trivial** |
| Note / avis sur une série | colonne `note TEXT` sur `user_shows` | **Trivial** |
| Favoris / épingler | colonne `is_favorite` sur `user_shows` | **Trivial** |
| Listes/collections perso, tags | tables `lists` + `list_items` (N-N) | **Trivial** (nouvelles tables) |
| Timeline / historique d'activité | requête sur `episode_watches.watched_at`, ou table `watch_events` | **Facile** |
| Re-visionnages (rewatch) | table `watch_events` (1 série vue plusieurs fois) | **Facile** (sans casser l'existant) |
| Page statistiques | requêtes d'agrégation (rien à stocker) | **Trivial** |
| « Prochain épisode à voir » | déduit de `episodes` + `episode_watches` | **Déjà permis** par le catalogue |
| Notifications « nouvel épisode » | `episodes.airdate` + rafraîchissement TVmaze | **Déjà permis** (épisodes stockés) |
| Filtre par genre | `shows.genres` (index GIN) | **Déjà permis** |

### Ce qui est coûteux à changer (donc à trancher MAINTENANT)
Ajouter une colonne ou une table plus tard est indolore. Ce qui fait mal rétroactivement :
1. **Catalogue partagé vs dupliqué par utilisateur.** Migrer d'un schéma « chaque user
   duplique nom/poster/totaux » vers un catalogue global (dédoublonnage + re-câblage des FK)
   est pénible. → **On choisit le catalogue global dès le départ.**
2. **Stocker les épisodes, ou pas.** Sans table `episodes`, impossible de faire
   « prochain épisode », notifications, stats fiables — et les rajouter oblige à
   re-câbler le suivi de progression. → **On stocke les épisodes dès le départ.**
3. **Le suivi de progression référence un épisode du catalogue** (`episode_id`) plutôt
   que des entiers `(saison, numéro)` libres. → Intégrité référentielle + jointures propres.

## 3. Décision d'architecture : catalogue global normalisé

```
shows (catalogue)          ← 1 ligne par série TVmaze, partagée
  └─ episodes (catalogue)  ← 1 ligne par épisode, partagée
users
  ├─ user_shows            ← suivi privé d'une série (statut, date) — N-N user×show
  └─ episode_watches       ← épisodes vus (privé) — N-N user×episode
```

L'ancien schéma Supabase dupliquait les métadonnées de série **par utilisateur** et ne
stockait **pas** les épisodes. Le nouveau schéma normalise : les métadonnées publiques
vivent une fois dans le catalogue, les tables de jointure ne portent que l'état privé.

## 4. Schéma détaillé

> Types PostgreSQL. PK = `BIGINT GENERATED ALWAYS AS IDENTITY`.
> Horodatages = `TIMESTAMPTZ NOT NULL DEFAULT now()`.

### `users`
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | bigint | PK |
| email | text | **UNIQUE**, NOT NULL (normalisé en minuscules par l'API) |
| password_hash | text | NOT NULL |
| is_admin | boolean | NOT NULL DEFAULT false |
| display_name | text | NULL *(réservé usage futur)* |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

### `shows` — catalogue (partagé)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | bigint | PK |
| tvmaze_id | integer | **UNIQUE**, NOT NULL |
| name | text | NOT NULL |
| poster_url | text | NULL |
| premiered | date | NULL |
| ended | date | NULL |
| tvmaze_status | text | NULL *(Running / Ended — statut TVmaze, ≠ statut utilisateur)* |
| genres | text[] | NOT NULL DEFAULT '{}' *(index GIN pour filtre par genre)* |
| total_seasons | smallint | NULL *(cache pratique ; source canonique = `episodes`)* |
| total_episodes | smallint | NULL |
| summary | text | NULL *(réservé usage futur)* |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() *(= dernier rafraîchissement TVmaze)* |

### `episodes` — catalogue (partagé)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | bigint | PK |
| show_id | bigint | FK → shows(id) **ON DELETE CASCADE**, NOT NULL |
| tvmaze_episode_id | integer | UNIQUE, NULL |
| season | smallint | NOT NULL |
| number | smallint | NOT NULL |
| name | text | NULL |
| airdate | date | NULL |
| runtime | smallint | NULL |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |
| | | **UNIQUE(show_id, season, number)** |

### `user_shows` — suivi privé (jointure user × show)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK → users(id) **ON DELETE CASCADE**, NOT NULL |
| show_id | bigint | FK → shows(id) **ON DELETE CASCADE**, NOT NULL |
| status | text | NOT NULL DEFAULT 'plan_to_watch' — **CHECK** ∈ (watching, completed, dropped, plan_to_watch) |
| added_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |
| | | **UNIQUE(user_id, show_id)** |

*Emplacement naturel des futurs `rating`, `note`, `is_favorite` (colonnes additives).*

### `episode_watches` — épisodes vus (privé)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK → users(id) **ON DELETE CASCADE**, NOT NULL |
| episode_id | bigint | FK → episodes(id) **ON DELETE CASCADE**, NOT NULL |
| watched_at | timestamptz | NOT NULL DEFAULT now() |
| | | **UNIQUE(user_id, episode_id)** *(idempotence du « cocher »)* |

### Index (au-delà des PK / UNIQUE)
- `episode_watches (user_id)` — lister la progression d'un utilisateur.
- `user_shows (user_id, status)` — la liste filtrée par statut (écran « Ma liste »).
- `episodes (show_id)` — charger la grille d'épisodes d'une série.
- `shows USING GIN (genres)` — filtre par genre.

## 5. Évolutivité : comment les features futures s'ajoutent

- **Rating / note / favori d'une série** → `ALTER TABLE user_shows ADD COLUMN rating smallint …`.
- **Notes par épisode** → colonnes sur `episode_watches`, ou table `episode_notes(user_id, episode_id, body)`.
- **Listes/collections + tags** → `lists(id, user_id, name)` + `list_items(list_id, show_id)`.
- **Historique / rewatch** → `watch_events(id, user_id, episode_id, watched_at)` en plus du
  booléen `episode_watches` ; ce dernier reste la vérité « vu/pas vu ».
- **Rafraîchissement métadonnées / notifications** → tâche qui ré-interroge TVmaze et met à
  jour `shows`/`episodes` (`updated_at`), puis lit `airdate` pour les épisodes à venir.

Aucune de ces évolutions ne casse le noyau : ce sont des migrations **additives**.

## 6. Conventions (maintenabilité)

- **Nommage** : tables au pluriel `snake_case` ; FK `<table>_id` ; horodatages `_at`.
- **Convention de nommage des contraintes** (cruciale pour qu'Alembic
  `--autogenerate` produise des noms déterministes et des migrations réversibles) — appliquée
  sur la `MetaData` SQLAlchemy :
  ```python
  NAMING_CONVENTION = {
      "ix": "ix_%(column_0_label)s",
      "uq": "uq_%(table_name)s_%(column_0_name)s",
      "ck": "ck_%(table_name)s_%(constraint_name)s",
      "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
      "pk": "pk_%(table_name)s",
  }
  ```
- **Statut** stocké en `text` + `CHECK` : modifier les valeurs autorisées = une migration
  d'une ligne (vs un type `ENUM` natif Postgres, pénible à altérer).
- **Suppressions** : `ON DELETE CASCADE` sur les lignes *possédées* par un parent
  (les données d'un user partent avec le user ; les épisodes partent avec la série).

## 7. Organisation du code backend (séparation des responsabilités)

```
app/
├── models.py          tables ORM SQLAlchemy (structure)
├── schemas.py         schémas Pydantic d'E/S (validation / sérialisation)
├── repository/        accès données (requêtes), SANS logique HTTP
│   ├── shows.py
│   └── watches.py
├── services/          logique métier (ex. enrichissement TVmaze, agrégats)
└── routers/           endpoints FastAPI (HTTP), appellent repository/services
```

→ La logique de données est isolée du transport HTTP : on peut modifier une requête
sans toucher aux routes, et tester le repository indépendamment.

## 8. Question ouverte (à trancher en 11.4, pas bloquant pour le schéma)

Qui **remplit le catalogue** (`shows` + `episodes`) à l'ajout d'une série ?
- **(A) Le serveur interroge TVmaze** (httpx) et upsert le catalogue — *source autoritaire,
  prérequis des notifications/rafraîchissement futurs.* **Recommandé.**
- **(B) Le front envoie les métadonnées** déjà récupérées — *moins de code serveur, mais
  données fournies par le client.*

Le **schéma est identique** dans les deux cas ; seul le code de remplissage (11.4) diffère.
```
