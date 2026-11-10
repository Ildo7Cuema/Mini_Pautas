-- Cor do cabeçalho das tabelas/mapas (pautas, mini-pautas, mapas, etc.)
ALTER TABLE configuracao_cabecalho
    ADD COLUMN IF NOT EXISTS cor_cabecalho_mapa TEXT DEFAULT '#1e40af';

COMMENT ON COLUMN configuracao_cabecalho.cor_cabecalho_mapa IS
    'Cor hexadecimal do cabeçalho das tabelas/mapas nos PDFs e pré-visualizações';
