# FantaCrew — Multi-tenant refactor

Trasformo l'app da single-team (Lambro) a multi-team. Lambro diventa il primo team della piattaforma "FantaCrew".

## 1. Database

### Nuove tabelle
- **`sports`** — `id`, `name` (es. "Rugby"), `slug`, `icon`, `is_active`
- **`teams_platform`** (rinomino concettuale per non collidere col `teams` esistente, che sono le squadre dei manager): la nuova tabella si chiama **`crews`** = "team della piattaforma" (es. Lambro). Campi: `id`, `name`, `slug` (es. "lambro"), `sport_id`, `logo_url`, `primary_color`, `is_active`, `created_at`, `owner_user_id`.
- Seed: `Rugby` in `sports`, `Lambro` in `crews` con slug `lambro`.

### Colonna `crew_id` aggiunta a TUTTE le tabelle di dominio
`players`, `player_categories`, `teams`, `team_players`, `team_coaches`, `team_player_history`, `coaches`, `coach_events`, `matches`, `match_call_ups`, `weekly_events`, `special_actions`, `special_action_completions`, `mandatory_slots`, `team_penalties`, `seasons`, `scoring_rules`, `trainings`, `training_schedules`, `training_absences`, `training_absence_reads`, `leagues`, `league_members`, `league_teams`, `challenges`, `leaderboard_snapshots`, `season_results`, `season_player_results`, `transfer_sessions`, `role_assignment_history`, `team_config`, `team_manager_assignments`, `admin_permissions`, `badge_definitions`, `player_badges`, `notification_templates`, `notification_log`, `notification_history`.

Backfill: tutte le righe esistenti → `crew_id = <id Lambro>`. Poi `NOT NULL`.

### Ruolo `super_admin` già esiste
Aggiungo funzione `is_super_admin()` e `current_crew_id()` (definita via header o sottodominio, vedi sezione routing).

### RLS riscritte
Ogni policy esistente viene estesa con `AND crew_id = current_crew_id()`. Super admin bypassa tutto. Admin di crew vede solo la sua crew.

## 2. Routing

- **`/`** → landing FantaCrew con elenco team pubblici (o redirect al team se utente loggato ha una crew predefinita).
- **`/superadmin`** → login dedicato Super Admin.
- **`/superadmin/dashboard`** → gestione sport, gestione crew (creazione/edit), assegnazione admin per crew.
- **`/$crewSlug/*`** → tutta l'app attuale spostata sotto `_crew/$crewSlug/`:
  - `/lambro/` (landing crew)
  - `/lambro/dashboard`, `/lambro/players`, `/lambro/team`, `/lambro/weekly`, `/lambro/azioni`, `/lambro/leaderboard`, `/lambro/black-market`, `/lambro/profile`, `/lambro/tm`, `/lambro/admin`, ecc.
- Layout `src/routes/_crew/$crewSlug/route.tsx` carica la crew dallo slug, la mette in un `CrewContext`, gestisce 404 se crew non esiste, applica branding (logo/colore). Tutti i fetch interni filtrano per `crewId` del contesto.
- Header e MobileBottomNav prendono `crewSlug` dal contesto per costruire i link.

## 3. Super Admin

- **Login `/superadmin`**: form email/password separato. Se l'utente non ha ruolo `super_admin`, mostra errore.
- **Bootstrap**: aggiorno `bootstrap_first_admin` per supportare seeding manuale del primo super admin via email `teo.motta88@gmail.com`. La password viene impostata dall'utente al primo accesso (signup standard) e poi il sistema gli assegna il ruolo `super_admin` se l'email corrisponde a quella whitelisted in una tabella `super_admin_seeds`. Alternativa più semplice: creo io l'utente via SQL admin con quella password.
- **Dashboard SA**: CRUD sport, CRUD crew (nome, slug, sport, logo), assegnazione owner della crew. Pulsante "entra come admin di crew X".

## 4. Componenti / Codice

Tutti i file in `src/routes/` (escluso `index`, `login`, `superadmin*`, `__root`) vengono **spostati** sotto `src/routes/_crew/$crewSlug/`. Tutti i `supabase.from(...)` nelle query vengono filtrati con `.eq("crew_id", crewId)` dove `crewId` arriva dal `CrewContext`. Le mutation includono `crew_id` nell'insert.

`AuthContext` resta uguale. Aggiungo `CrewContext` che carica la crew corrente dallo slug.

## 5. Black Market e altre feature globali

Anche queste finiscono sotto `/$crewSlug/` perché i dati (giocatori in vendita) sono per crew.

## 6. Note tecniche / rischi

- **Migrazione enorme**: ~40 tabelle alterate, 60+ policy riscritte, 30+ file route spostati, ogni query del progetto rivista. Tempo di esecuzione lungo, alta probabilità di regressioni puntuali da fixare iterativamente.
- **Tabella `teams` ambigua**: nel codice attuale `teams` sono le squadre fantasy del manager, non i team della piattaforma. Per evitare confusione introduco `crews` come nome della nuova entità piattaforma.
- **Slug `lambro`**: tutti i link interni esistenti (hardcoded come `to="/dashboard"`) diventano `to="/$crewSlug/dashboard"` con `params`. Centinaia di occorrenze.
- **Edge functions** (`weekly-snapshot`, `apply-mandatory-penalties`, ecc.) vanno rese crew-aware (iterare su tutte le crew attive).
- **Super admin password**: per creare `teo.motta88@gmail.com / IndieRoad88` userò la API admin di Supabase via SQL o un seed; la password sarà cambiabile dopo il primo login.

## Ordine di esecuzione

1. Migration DB: `sports`, `crews`, seed Lambro+Rugby, aggiunta `crew_id` ovunque con backfill, nuove RLS.
2. Creazione utente super admin + ruolo.
3. `CrewContext` + layout `_crew/$crewSlug`.
4. Spostamento di tutte le route sotto `_crew/$crewSlug/`.
5. Refactor di ogni query/insert per includere `crew_id`.
6. Pagine `/superadmin` (login + dashboard CRUD).
7. Landing `/` di FantaCrew.
8. Aggiornamento edge functions.
9. QA manuale: login Lambro, navigazione, creazione team manager, ecc.

**Stima**: questa è una conversione di scala enorme. Anche in un singolo turno toccherò decine di file. Mi aspetto che dopo il primo round emergano errori di compilazione e logica da iterare insieme.

Confermi questo approccio? In particolare conferma:
- Nome `crews` per i team della piattaforma (per non collidere con il `teams` esistente).
- Procedo a impostare password `IndieRoad88` per `teo.motta88@gmail.com` direttamente nel DB.
