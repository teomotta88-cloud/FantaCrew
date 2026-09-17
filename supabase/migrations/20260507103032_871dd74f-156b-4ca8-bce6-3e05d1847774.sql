ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

CREATE POLICY "User claims matching player"
ON public.players
FOR UPDATE
TO authenticated
USING (
  user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(trim(p.display_name)) = lower(trim(players.full_name))
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(trim(p.display_name)) = lower(trim(players.full_name))
  )
);

CREATE POLICY "User releases own player claim"
ON public.players
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
