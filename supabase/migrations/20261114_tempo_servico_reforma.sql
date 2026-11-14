-- Tempo de serviço / previsão de reforma (DP n.º 299/20 — Protecção Social na Velhice)
-- Campos necessários: nascimento, início de serviço, género e nº de filhos (redução de idade para mães).

-- Professores e funcionários de escola
ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS numero_filhos INTEGER DEFAULT 0
    CHECK (numero_filhos IS NULL OR (numero_filhos >= 0 AND numero_filhos <= 20));

ALTER TABLE funcionarios_escola
    ADD COLUMN IF NOT EXISTS numero_filhos INTEGER DEFAULT 0
    CHECK (numero_filhos IS NULL OR (numero_filhos >= 0 AND numero_filhos <= 20));

COMMENT ON COLUMN professores.numero_filhos IS
    'N.º de filhos a que a mãe deu à luz (Art. 4.º n.º 2 DP 299/20 — redução de idade de reforma, máx. 5)';
COMMENT ON COLUMN funcionarios_escola.numero_filhos IS
    'N.º de filhos a que a mãe deu à luz (Art. 4.º n.º 2 DP 299/20 — redução de idade de reforma, máx. 5)';

-- Pessoal das Direcções Municipais
ALTER TABLE pessoal_direcao_municipal
    ADD COLUMN IF NOT EXISTS data_nascimento DATE,
    ADD COLUMN IF NOT EXISTS data_admissao DATE,
    ADD COLUMN IF NOT EXISTS genero TEXT CHECK (genero IS NULL OR genero IN ('M', 'F')),
    ADD COLUMN IF NOT EXISTS numero_filhos INTEGER DEFAULT 0
        CHECK (numero_filhos IS NULL OR (numero_filhos >= 0 AND numero_filhos <= 20));

COMMENT ON COLUMN pessoal_direcao_municipal.data_admissao IS
    'Data de início de funções / admissão para contagem de tempo de serviço (DP 299/20 Art. 9.º)';
COMMENT ON COLUMN pessoal_direcao_municipal.numero_filhos IS
    'N.º de filhos (redução de idade de reforma para mães — DP 299/20 Art. 4.º n.º 2)';

-- Pessoal das Direcções Provinciais
ALTER TABLE pessoal_direcao_provincial
    ADD COLUMN IF NOT EXISTS data_nascimento DATE,
    ADD COLUMN IF NOT EXISTS data_admissao DATE,
    ADD COLUMN IF NOT EXISTS genero TEXT CHECK (genero IS NULL OR genero IN ('M', 'F')),
    ADD COLUMN IF NOT EXISTS numero_filhos INTEGER DEFAULT 0
        CHECK (numero_filhos IS NULL OR (numero_filhos >= 0 AND numero_filhos <= 20));

COMMENT ON COLUMN pessoal_direcao_provincial.data_admissao IS
    'Data de início de funções / admissão para contagem de tempo de serviço (DP 299/20 Art. 9.º)';
COMMENT ON COLUMN pessoal_direcao_provincial.numero_filhos IS
    'N.º de filhos (redução de idade de reforma para mães — DP 299/20 Art. 4.º n.º 2)';
