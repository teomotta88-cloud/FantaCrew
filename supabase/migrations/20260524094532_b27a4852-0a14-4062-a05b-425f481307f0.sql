UPDATE public.badge_definitions SET description = CASE key
  WHEN 'captain_popular'    THEN 'Sei stato scelto come Capitano da almeno 30 utenti nella stessa stagione. Il capitano raddoppia i punti!'
  WHEN 'talisman_popular'   THEN 'Sei stato scelto come Talismano da almeno 30 utenti nella stessa stagione. Il Talismano quadruplica i punti!'
  WHEN 'silverback_popular' THEN 'Sei stato scelto come Silverback da almeno 30 utenti nella stessa stagione.'
  WHEN 'metaman'            THEN 'Hai segnato almeno 10 mete in questa stagione. Sei una macchina da mete!'
  WHEN 'super_metaman'      THEN 'Hai segnato almeno 15 mete in questa stagione. Quasi inarrestabile!'
  WHEN 'mega_metaman'       THEN 'Hai segnato almeno 20 mete in questa stagione. Sei una leggenda!'
  WHEN 'motm_1'             THEN 'Sei stato eletto Man of the Match almeno una volta questa stagione. 🐐'
  WHEN 'motm_3'             THEN 'Sei stato eletto Man of the Match almeno 3 volte questa stagione. Dominante!'
  WHEN 'roccia'             THEN 'Presente a tutti gli allenamenti per un intero mese di fila. Affidabilità totale.'
  WHEN 'muro'               THEN 'Presente a tutti gli allenamenti per 3 mesi consecutivi nella stessa stagione.'
  WHEN 'scudo'              THEN 'Presente ad almeno il 95% degli allenamenti da settembre a maggio. Pilastro del club.'
  WHEN 'joker'              THEN 'Hai completato almeno 3 azioni speciali nella stessa stagione. Imprevedibile!'
  WHEN 'bench'              THEN 'Sei stato convocato in panchina in almeno 5 partite consecutive. Il sesto uomo!'
  WHEN 'bomb_squad'         THEN 'Sei stato convocato in panchina in almeno 10 partite consecutive. Re della panchina!'
  WHEN 'king'               THEN 'Sei partito titolare in almeno 5 partite consecutive. Intoccabile!'
  WHEN 'super_king'         THEN 'Sei partito titolare in almeno 10 partite consecutive. Il re indiscusso dell''undici!'
  WHEN 'cecchino'           THEN 'Hai segnato almeno 10 calci piazzati o trasformazioni nella stessa stagione.'
  WHEN 'super_cecchino'     THEN 'Hai segnato almeno 20 calci piazzati o trasformazioni. Precisione millimetrica!'
  WHEN 'due_cuori'          THEN 'Hai segnato 2 mete nella stessa partita. Doppietta!'
  WHEN 'hat_trick'          THEN 'Hai segnato 3 mete nella stessa partita. Hat Trick leggendario!'
  WHEN 'poker'              THEN 'Hai segnato 4 mete nella stessa partita. Poker di mete, storico!'
  WHEN 'ironman'            THEN 'Sei stato convocato in ogni singola partita della stagione. Instancabile!'
END
WHERE key IN (
  'captain_popular','talisman_popular','silverback_popular',
  'metaman','super_metaman','mega_metaman','motm_1','motm_3',
  'roccia','muro','scudo','joker','bench','bomb_squad',
  'king','super_king','cecchino','super_cecchino',
  'due_cuori','hat_trick','poker','ironman'
);