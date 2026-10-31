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
3. **Templates** de disciplinas com componentes **MAC (30%) · PP (30%) · PT (40%)** nos 3 trimestres  
4. **5 professores** com login activo  
5. **5 turmas** com templates aplicados (disciplinas + componentes)  
6. **20 alunos** com dados pessoais, encarregado, morada e dados académicos  

---

## Sugestão rápida de testes

1. Login como `admin.primaria@seed.edugest.test` → ver Dashboard, Turmas, Templates, Professores, Alunos.  
2. Login como `prof.secundaria.1@seed.edugest.test` → **Notas** → lançar MAC/PP/PT.  
3. Login como `admin.complexo@seed.edugest.test` → confirmar turmas de primário e secundário.  
4. Em **Relatórios**, gerar Mini-Pauta / Pauta Geral.  
5. Quando terminar: `npm run seed:test:clean`.

---

## Identificação / limpeza segura

A seed só apaga dados marcados:

- `escolas.codigo_escola` a começar por `SEED-`  
- `escolas.configuracoes.seed_marker = edugest-test-seed`  
- emails `*@seed.edugest.test`  

Não remove escolas ou utilizadores reais fora destes marcadores.
