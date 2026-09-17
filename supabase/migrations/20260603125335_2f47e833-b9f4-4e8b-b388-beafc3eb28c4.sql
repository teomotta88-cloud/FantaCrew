
CREATE POLICY "Super admins upload crew logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update crew logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete crew logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'super_admin'::app_role));
