CREATE TABLE public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  threshold INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.player_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES public.badge_definitions(key),
  season_id UUID REFERENCES public.seasons(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, badge_key, season_id)
);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badge defs public read" ON public.badge_definitions FOR SELECT USING (true);
CREATE POLICY "Player badges public read" ON public.player_badges FOR SELECT USING (true);
CREATE POLICY "Badge defs admin write" ON public.badge_definitions FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Player badges admin write" ON public.player_badges FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.badge_definitions (key,name,description,emoji,category,threshold,sort_order) VALUES
('captain_popular','Capitano del popolo','Selezionato Capitano da ≥30 utenti','🎖️','Fanta',30,10),
('talisman_popular','Talismano del popolo','Selezionato Talismano da ≥30 utenti','🍀','Fanta',30,11),
('silverback_popular','Silverback del popolo','Selezionato Silverback da ≥30 utenti','🦍','Fanta',30,12),
('metaman','MetaMan','≥10 mete in stagione','🏉','Mete',10,20),
('super_metaman','Super MetaMan','≥15 mete in stagione','🏉🔥','Mete',15,21),
('mega_metaman','Mega MetaMan','≥20 mete in stagione','💥','Mete',20,22),
('motm_1','Man of the Match','≥1 MOTM in stagione','🐐','MOTM',1,30),
('motm_3','Super Man of the Match','≥3 MOTM in stagione','🐐🌟','MOTM',3,31),
('roccia','Roccia','Tutti gli allenamenti per 1 mese','🪨','Presenze',NULL,40),
('muro','Muro','Tutti gli allenamenti per 3 mesi','🧱','Presenze',NULL,41),
('scudo','Scudo','≥95% presenze set-mag','🛡️','Presenze',95,42),
('joker','Joker','≥3 azioni speciali in stagione','🃏','Speciali',3,50),
('bench','Bench','Panchina in ≥5 partite consecutive','🪑','Presenze',5,60),
('bomb_squad','Bomb Squad','Panchina in ≥10 partite consecutive','💣','Presenze',10,61),
('king','King','Titolare in ≥5 partite consecutive','👑','Presenze',5,62),
('super_king','Super King','Titolare in ≥10 partite consecutive','👑⭐','Presenze',10,63),
('cecchino','Cecchino','≥10 calci piazzati/trasformazioni','🎯','Punti',10,70),
('super_cecchino','Super Cecchino','≥20 calci piazzati/trasformazioni','🎯🔥','Punti',20,71),
('due_cuori','2 di cuori','2 mete nella stessa partita','❤️❤️','Partita',2,80),
('hat_trick','Hat Trick','3 mete nella stessa partita','🎩','Partita',3,81),
('poker','Poker','4 mete nella stessa partita','♠️','Partita',4,82),
('ironman','Ironman','Convocato in tutte le partite della stagione','🦾','Presenze',NULL,90)
ON CONFLICT (key) DO NOTHING;