-- Foto tipo passe do aluno (Quadro de Honra / ficha)
-- Dec. Ext. 76/24 — apresentação visual do Prémio de Mérito / Quadro de Honra

ALTER TABLE public.alunos
    ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN public.alunos.foto_url IS
    'URL pública da fotografia tipo passe do aluno (Supabase Storage mini-pauta-assets/fotos-alunos)';

-- Storage: pasta fotos-alunos no bucket mini-pauta-assets
DROP POLICY IF EXISTS "Authenticated users can upload aluno fotos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own aluno fotos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own aluno fotos" ON storage.objects;

CREATE POLICY "Authenticated users can upload aluno fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'mini-pauta-assets'
    AND (storage.foldername(name))[1] = 'fotos-alunos'
    AND name LIKE 'fotos-alunos/' || auth.uid()::text || '/%'
);

CREATE POLICY "Users can update their own aluno fotos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'mini-pauta-assets'
    AND (storage.foldername(name))[1] = 'fotos-alunos'
    AND (
        owner = auth.uid()
        OR name LIKE 'fotos-alunos/' || auth.uid()::text || '/%'
    )
);

CREATE POLICY "Users can delete their own aluno fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'mini-pauta-assets'
    AND (storage.foldername(name))[1] = 'fotos-alunos'
    AND (
        owner = auth.uid()
        OR name LIKE 'fotos-alunos/' || auth.uid()::text || '/%'
    )
);
