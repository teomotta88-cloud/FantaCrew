-- Normalize existing roles to canonical Italian names then add CHECK constraint
UPDATE public.players SET role = 'Pilone' WHERE lower(role) LIKE 'pilone%';
UPDATE public.players SET role = 'Tallonatore' WHERE lower(role) LIKE 'tallonatore%';
UPDATE public.players SET role = 'Seconda linea' WHERE lower(role) LIKE 'seconda%';
UPDATE public.players SET role = 'Terza linea' WHERE lower(role) LIKE 'terza%';
UPDATE public.players SET role = 'Mediano di mischia' WHERE lower(role) IN ('mediano di mischia','mediano mischia','mischia');
UPDATE public.players SET role = 'Mediano di apertura' WHERE lower(role) IN ('mediano di apertura','mediano apertura','apertura');
UPDATE public.players SET role = 'Centro' WHERE lower(role) LIKE 'centro%';
UPDATE public.players SET role = 'Ala' WHERE lower(role) = 'ala' OR lower(role) LIKE 'ala %';
UPDATE public.players SET role = 'Estremo' WHERE lower(role) LIKE 'estremo%';

ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_role_check;
ALTER TABLE public.players ADD CONSTRAINT players_role_check CHECK (role IN (
  'Pilone','Tallonatore','Seconda linea','Terza linea',
  'Mediano di mischia','Mediano di apertura',
  'Centro','Ala','Estremo'
));