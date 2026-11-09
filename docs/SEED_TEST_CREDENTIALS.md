# Credenciais da Seed de Testes — EduGest Angola

Dados criados pelos scripts `npm run seed:test` / `npm run seed:test:clean`.  
**Apenas para ambiente de desenvolvimento/testes.** Não use em produção.

---

## Como executar

```bash
# Criar a seed (3 escolas + notas + direções)
npm run seed:test

# Apagar a seed
npm run seed:test:clean

# Recriar do zero
npm run seed:test -- --force

# Retomar após falha de rede (completa escolas/notas/direções em falta)
npm run seed:test -- --resume

# Só (re)lançar notas nas escolas seed já existentes
npm run seed:test -- --notas-only

# Sem lançar notas (mais rápido)
npm run seed:test -- --force --skip-notas
```

Requisitos: ficheiro `.env` com `SUPABASE_URL` (ou `VITE_SUPABASE_URL`) e `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`).

---

## Palavra-passe comum

| Campo | Valor |
|--------|--------|
| **Password de todas as contas seed** | `SeedTest@2026!` |
| Domínio de email | `@seed.edugest.test` |
| Prefixo códigos de escola | `SEED-` |
| Ano lectivo das turmas | `2026` |
| Alunos por turma | **12** (≥10) |

---

## O que a seed cria (visão geral)

Em cada escola:

1. Utilizador auth + perfil **ESCOLA** (administrador)  
2. Licença **anual activa**  
3. **Templates** MAC / NPT / MT (3 trimestres) + **MF anual**  
4. Professores com login activo  
5. Turmas com templates aplicados (disciplinas + componentes)  
6. **12 alunos por turma** com dados pessoais, encarregado, morada e académicos  
7. **Notas lançadas** até ao 3.º trimestre (MAC, NPT, MT) + **MF**  
8. **notas_finais** preenchidas (Mini-Pauta / supervisão pedagógica)

Documentos prontos para demonstração sem cadastro manual:

- Mini-Pauta  
- Pauta-Geral  
- Termo de Frequência  
- Boletim de Notas  
- Mapa de Aproveitamento  

---

## 1. Escola Primária Seed Luanda

| Campo | Valor |
|--------|--------|
| Nome | Escola Primária Seed Luanda |
| Código | `SEED-PRI-2026` |
| Tipo | Ensino Primário |
| Província / Município | Luanda / Belas |
| Templates | 1ª–6ª Classe |
| Turmas | 1ª–6ª Classe A (6 turmas) |
| Alunos | 72 (12 × 6) |
| Natureza | Pública (escala RAA Primário **1–10**) |
| Licença | Anual (activa) |

### Conta administrador

| Email | Password | Perfil |
|--------|----------|--------|
| `admin.primaria@seed.edugest.test` | `SeedTest@2026!` | ESCOLA |

### Professores

| Email | Password | Especialidade |
|--------|----------|----------------|
| `prof.primaria.1@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.primaria.2@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.primaria.3@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.primaria.4@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.primaria.5@seed.edugest.test` | `SeedTest@2026!` | Matemática / Ciências |
| `prof.primaria.6@seed.edugest.test` | `SeedTest@2026!` | Língua Portuguesa |

---

## 2. Escola Secundária Seed Benguela

| Campo | Valor |
|--------|--------|
| Nome | Escola Secundária Seed Benguela |
| Código | `SEED-SEC-2026` |
| Tipo | Ensino Secundário |
| Natureza | Pública (escala RAA Secundário **0–20**) |
| Província / Município | Benguela / Benguela |
| Templates | 7ª–9ª + Ciências + Humanidades |
| Turmas | 7ª A, 8ª A, 9ª A, 10ª Ciências A, 11ª Ciências A, 12ª Humanidades A |
| Alunos | 72 (12 × 6) |
| Cursos / áreas | Ciências e Humanidades (II ciclo) |
| Licença | Anual (activa) |

### Conta administrador

| Email | Password | Perfil |
|--------|----------|--------|
| `admin.secundaria@seed.edugest.test` | `SeedTest@2026!` | ESCOLA |

### Professores

| Email | Password | Especialidade |
|--------|----------|----------------|
| `prof.secundaria.1@seed.edugest.test` | `SeedTest@2026!` | Matemática |
| `prof.secundaria.2@seed.edugest.test` | `SeedTest@2026!` | Física |
| `prof.secundaria.3@seed.edugest.test` | `SeedTest@2026!` | Química |
| `prof.secundaria.4@seed.edugest.test` | `SeedTest@2026!` | Língua Portuguesa |
| `prof.secundaria.5@seed.edugest.test` | `SeedTest@2026!` | Biologia |
| `prof.secundaria.6@seed.edugest.test` | `SeedTest@2026!` | História / Geografia |

---

## 3. Complexo Escolar Seed Huambo

| Campo | Valor |
|--------|--------|
| Nome | Complexo Escolar Seed Huambo |
| Código | `SEED-CMP-2026` |
| Tipo | Primário + Secundário |
| Natureza | Pública (escalas RAA por nível da turma) |
| Província / Município | Huambo / Huambo |
| Turmas | 2ª B, 4ª B, 6ª B, 8ª B, 10ª Ciências B, 12ª Humanidades B |
| Alunos | 72 (12 × 6) |
| Licença | Anual (activa) |

### Conta administrador

| Email | Password | Perfil |
|--------|----------|--------|
| `admin.complexo@seed.edugest.test` | `SeedTest@2026!` | ESCOLA |

### Professores

| Email | Password | Especialidade |
|--------|----------|----------------|
| `prof.complexo.1@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.complexo.2@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.complexo.3@seed.edugest.test` | `SeedTest@2026!` | Ensino Primário |
| `prof.complexo.4@seed.edugest.test` | `SeedTest@2026!` | Matemática |
| `prof.complexo.5@seed.edugest.test` | `SeedTest@2026!` | Física / Química |
| `prof.complexo.6@seed.edugest.test` | `SeedTest@2026!` | História / Inglês |

---

## 4. Direções Provinciais

Password comum: `SeedTest@2026!`

| Email | Província | Estado | Para testar |
|--------|-----------|--------|-------------|
| `dp.luanda@seed.edugest.test` | Luanda | Activa | Dashboard provincial, DMs Belas/Cacuaco/Viana, escola SEED-PRI |
| `dp.benguela@seed.edugest.test` | Benguela | Activa | DMs Benguela/Lobito, escola SEED-SEC |
| `dp.huambo@seed.edugest.test` | Huambo | Activa | DMs Huambo/Caála (bloqueada), escola SEED-CMP |
| `dp.cabinda.pendente@seed.edugest.test` | Cabinda | Pendente | Fluxo de aprovação SUPERADMIN |

### Dados provinciais gerados

- **4 circulares** por província activa (circular, aviso urgente, rascunho, despacho)  
- Leituras parciais por Direção Municipal  
- Histórico administrativo (ex.: bloqueio da DM Caála)  

---

## 5. Direções Municipais

| Email | Município / Província | Estado | Escola seed ligada |
|--------|----------------------|--------|---------------------|
| `dm.belas@seed.edugest.test` | Belas / Luanda | Activa | `SEED-PRI-2026` |
| `dm.cacuaco@seed.edugest.test` | Cacuaco / Luanda | Activa | *(sem escolas — estado vazio)* |
| `dm.viana.pendente@seed.edugest.test` | Viana / Luanda | Pendente | — |
| `dm.benguela@seed.edugest.test` | Benguela / Benguela | Activa | `SEED-SEC-2026` |
| `dm.lobito@seed.edugest.test` | Lobito / Benguela | Activa | *(sem escolas)* |
| `dm.huambo@seed.edugest.test` | Huambo / Huambo | Activa | `SEED-CMP-2026` |
| `dm.caala.bloqueada@seed.edugest.test` | Caála / Huambo | Bloqueada | — |

### Dados municipais gerados

- **3 circulares** por DM activa não bloqueada (publicada, urgente, rascunho)  
- **6 solicitações de documentos** com estados variados  
- Histórico administrativo das escolas seed  

---

## Sugestão rápida de demonstração

1. Login `admin.primaria@seed.edugest.test` → Turmas → abrir **1ª Classe A** (12 alunos).  
2. **Relatórios** → Mini-Pauta / Pauta-Geral / Mapa (trimestres 1–3).  
3. Escolher um aluno → **Boletim** e **Termo de Frequência**.  
4. Login `prof.secundaria.1@seed.edugest.test` → **Notas** já preenchidas (MAC/NPT).  
5. Login `admin.secundaria@…` → turmas de **Ciências** e **Humanidades**.  
6. Login `dm.belas@…` / `dp.luanda@…` → supervisão e estatísticas com notas.  
7. Quando terminar: `npm run seed:test:clean`.

Só direções (se as escolas seed já existirem):

```bash
node scripts/seed-test-data.mjs --direcoes-only
# ou com limpeza prévia:
npm run seed:test -- --force
```

---

## Identificação / limpeza segura

A seed só apaga dados marcados:

- `escolas.codigo_escola` a começar por `SEED-`  
- `escolas.configuracoes.seed_marker = edugest-test-seed`  
- `direcoes_municipais` / `direcoes_provinciais` com `numero_funcionario` `SEED-*` ou email `@seed.edugest.test`  
- circulares com `numero_circular` `SEED-*`  
- solicitações com assunto `Seed —…` ou `seed_marker`  
- emails `*@seed.edugest.test`  

Não remove escolas, direções ou utilizadores reais fora destes marcadores.

---

## SUPERADMIN (conta de sistema)

Criada pela migração `supabase/migrations/20251216_seed_superadmin.sql` (não faz parte do `npm run seed:test`).

| Campo | Valor |
|--------|--------|
| Email | `superadmin@edugest.ao` |
| Password | `EduGest@2024!ChangeMe` |
| Perfil | SUPERADMIN |

> Em produção, altere esta password assim que possível.
