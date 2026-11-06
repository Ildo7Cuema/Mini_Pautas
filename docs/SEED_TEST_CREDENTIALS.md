# Credenciais da Seed de Testes — EduGest Angola

Dados criados pelos scripts `npm run seed:test` / `npm run seed:test:clean`.  
**Apenas para ambiente de desenvolvimento/testes.** Não use em produção.

---

## Como executar

```bash
# Criar a seed (3 escolas + dados)
npm run seed:test

# Apagar a seed
npm run seed:test:clean

# Recriar do zero
npm run seed:test -- --force
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

---

## 1. Escola Primária Seed Luanda

| Campo | Valor |
|--------|--------|
| Nome | Escola Primária Seed Luanda |
| Código | `SEED-PRI-2026` |
| Tipo | Ensino Primário |
| Província / Município | Luanda / Belas |
| Templates | 1ª–6ª Classe |
| Turmas | 1ª A, 2ª A, 3ª A, 5ª A, 6ª A |
| Alunos | 20 |
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
| `prof.primaria.4@seed.edugest.test` | `SeedTest@2026!` | Matemática / Ciências |
| `prof.primaria.5@seed.edugest.test` | `SeedTest@2026!` | Língua Portuguesa |

---

## 2. Escola Secundária Seed Benguela

| Campo | Valor |
|--------|--------|
| Nome | Escola Secundária Seed Benguela |
| Código | `SEED-SEC-2026` |
| Tipo | Ensino Secundário |
| Província / Município | Benguela / Benguela |
| Templates | 7ª–12ª Classe |
| Turmas | 7ª A, 8ª A, 9ª A, 10ª A, 11ª A |
| Alunos | 20 |
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

---

## 3. Complexo Escolar Seed Huambo

| Campo | Valor |
|--------|--------|
| Nome | Complexo Escolar Seed Huambo |
| Código | `SEED-CMP-2026` |
| Tipo | Primário + Secundário |
| Província / Município | Huambo / Huambo |
| Templates | 1ª–12ª Classe |
| Turmas | 4ª B, 6ª B, 7ª B, 9ª B, 12ª B |
| Alunos | 20 |
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
| `prof.complexo.3@seed.edugest.test` | `SeedTest@2026!` | Matemática |
| `prof.complexo.4@seed.edugest.test` | `SeedTest@2026!` | História / Geografia |
| `prof.complexo.5@seed.edugest.test` | `SeedTest@2026!` | Inglês |

---

## O que a seed cria em cada escola

1. Utilizador auth + perfil **ESCOLA** (administrador)  
2. Licença **anual activa**  
3. **Templates** de disciplinas com componentes **MAC (100%) · NPT (100%) · MT (100%)** nos 3 trimestres  
4. **5 professores** com login activo  
5. **5 turmas** com templates aplicados (disciplinas + componentes)  
6. **20 alunos** com dados pessoais, encarregado, morada e dados académicos  

---

## 4. Direções Provinciais

Password comum: `SeedTest@2026!`

| Email | Província | Estado | Para testar |
|--------|-----------|--------|-------------|
| `dp.luanda@seed.edugest.test` | Luanda | Activa | Dashboard provincial, DMs Belas/Cacuaco/Viana, escola SEED-PRI; menu Pessoal / Planeamento / Estatísticas / Contratação / Projectos (após `npm run db:apply-pessoal-dp` ou SQL `20261105_pessoal_direcao_provincial.sql`) |
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
| `dm.belas@seed.edugest.test` | Belas / Luanda | Activa | `SEED-PRI-2026`; menu **Pessoal** (secções Dec. 35/23) após `npm run db:apply-pessoal-dm` ou SQL `20261105_pessoal_direcao_municipal.sql` |
| `dm.cacuaco@seed.edugest.test` | Cacuaco / Luanda | Activa | *(sem escolas — estado vazio)* |
| `dm.viana.pendente@seed.edugest.test` | Viana / Luanda | Pendente | — |
| `dm.benguela@seed.edugest.test` | Benguela / Benguela | Activa | `SEED-SEC-2026` |
| `dm.lobito@seed.edugest.test` | Lobito / Benguela | Activa | *(sem escolas)* |
| `dm.huambo@seed.edugest.test` | Huambo / Huambo | Activa | `SEED-CMP-2026` |
| `dm.caala.bloqueada@seed.edugest.test` | Caála / Huambo | Bloqueada | — |

### Dados municipais gerados

- **3 circulares** por DM activa não bloqueada (publicada, urgente, rascunho)  
- **6 solicitações de documentos** com estados variados: `pendente`, `em_analise`, `aprovado`, `rejeitado`, `concluido`, `pendente_info`  
- Histórico administrativo das escolas seed  

---

## Sugestão rápida de testes

1. Login como `admin.primaria@seed.edugest.test` → ver Dashboard, Turmas, Templates, Professores, Alunos.  
2. Login como `prof.secundaria.1@seed.edugest.test` → **Notas** → lançar MAC/PP/PT.  
3. Login como `admin.complexo@seed.edugest.test` → confirmar turmas de primário e secundário.  
4. Em **Relatórios**, gerar Mini-Pauta / Pauta Geral.  
5. Login como `dm.belas@seed.edugest.test` → escolas do município, circulares, solicitações, supervisão pedagógica.  
6. Login como `dm.cacuaco@seed.edugest.test` → estado vazio (sem escolas).  
7. Login como `dp.luanda@seed.edugest.test` → DMs da província, circulares provinciais, visão agregada.  
8. Login como `dp.huambo@seed.edugest.test` → ver DM Caála bloqueada + histórico.  
9. Como SUPERADMIN → aprovar `dm.viana.pendente` / `dp.cabinda.pendente`.  
10. Quando terminar: `npm run seed:test:clean`.

Só direções (se as escolas seed já existirem):

```bash
node scripts/seed-test-data.mjs --direcoes-only
# ou com limpeza prévia das direções/escolas:
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

`sueper admin: superadmin@edugest.ao
