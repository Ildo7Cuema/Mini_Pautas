# Guia do Utilizador — Escola e Professor

**EduGest Angola (Mini-Pautas)**  
Documento orientador para novos utilizadores: administração da escola e professores.

Este guia descreve o uso do sistema **do ponto de vista de quem trabalha na escola**, passo a passo. Não é necessário conhecimento técnico.

---

## 1. O que é o sistema

O EduGest Angola ajuda a escola a:

- Registar professores, secretários, funcionários e alunos  
- Organizar turmas, disciplinas e avaliações  
- Lançar notas (escala angolana **0–20**)  
- Gerar pautas e relatórios (PDF/Excel)  
- Gerir matrículas, propinas e a subscrição da escola  

**Perfis principais neste guia**

| Perfil | Quem é | O que faz no dia a dia |
|--------|--------|-------------------------|
| **Escola (Administrador)** | Direcção / secretariado responsável pela conta | Configura a escola, convida professores, cria turmas e alunos, gera relatórios, gere propinas e subscrição |
| **Professor** | Docente convidado pela escola | Lança notas das suas disciplinas, gera relatórios e pede documentos |

> **Nota:** O professor **não se regista sozinho**. A escola cria o registo e envia um **link de convite**.

---

## 2. Antes de começar

1. Tenha um **email válido** e uma **palavra-passe** (mínimo 6 caracteres).  
2. Use um navegador actualizado (Chrome, Edge, Firefox ou Safari).  
3. Em telemóvel, o sistema funciona; no computador é mais confortável para lançar notas e gerar pautas.  
4. Se esquecer a senha: no ecrã de login use **“Esqueceu a senha?”**.

Tutoriais públicos (sem login): no ecrã de login, clique em **“Ver Tutoriais”**.

---

## Parte A — Guia da Escola (Administrador)

### A1. Registar a escola (primeira vez)

1. Abra o EduGest e, no ecrã de login, escolha **“Cadastrar Escola”**.  
2. **Passo 1 — Informações da Escola**  
   - Nome da escola  
   - Província (o sistema gera um **código da escola** automaticamente; pode regenerar se precisar)  
   - Município, endereço, telefone e email da escola  
3. **Passo 2 — Dados do Responsável**  
   - Nome do responsável  
   - Email do responsável (será o email de login)  
   - Senha e confirmação  
4. Conclua o cadastro. Aparece a mensagem **“Cadastro Realizado!”**.  
5. Vá para o login e entre com o email e a senha do responsável.

> Se o sistema pedir confirmação de email, abra a mensagem recebida e confirme antes de entrar.

---

### A2. Primeiro acesso — ecrã de boas-vindas

No primeiro login, aparece um ecrã de boas-vindas com o resumo da sua escola.  
Clique em **“Começar a usar o sistema”** para desbloquear o painel.

---

### A3. Activar a subscrição (recomendado cedo)

Menu lateral: **Subscrição**

1. Escolha o plano: **trimestral**, **semestral** ou **anual**.  
2. Clique em **“Solicitar Assinatura”**.  
3. Efectue a **transferência** conforme as instruções.  
4. Envie o **comprovativo pelo WhatsApp**, incluindo a **referência** gerada.  
5. Aguarde a confirmação (estado: *Aguardando Confirmação* → *Pagamento Confirmado*).

Sem licença activa, o acesso às funcionalidades pode ficar limitado ou suspenso quando a licença expirar. Renove em **Subscrição**.

---

### A4. Ordem recomendada de configuração

Siga esta ordem na primeira configuração. Evita turmas sem disciplinas ou professores sem acesso.

```
1. Templates  →  2. Professores  →  3. Turmas  →  4. Alunos / Matrículas
        →  5. Notas  →  6. Relatórios  →  7. Pagamentos (opcional)
```

---

### A5. Configurar templates de disciplinas

Menu: **Templates**

Os templates definem, por classe (1ª–13ª), quais disciplinas e componentes de avaliação (ex.: MAC, PP, PT) devem ser criados automaticamente ao abrir uma turma.

1. Entre em **Templates**.  
2. Configure as disciplinas e componentes por classe.  
3. Guarde.

> Se criar uma turma sem templates, o sistema pode avisar e oferecer o link **“Configurar templates agora →”**.

---

### A6. Cadastrar e convidar professores

Menu: **Professores** → **Novo Professor**

Preencha os separadores:

1. **Pessoal** — nome, data de nascimento, género, BI, filiação, nacionalidade…  
2. **Profissional** — **email** (obrigatório para o convite), telefone, nº de agente, categoria, formação, especialidade…  
3. **Endereço / Bancário** — residência, IBAN, banco (se aplicável)  

Depois de gravar:

1. Use a opção para **copiar o link de convite**.  
2. Envie o link ao professor (WhatsApp, email, etc.).  
3. O professor abre o link, cria a senha e passa a conseguir entrar.

O link tem o formato:  
`…/register-professor?email=email_do_professor`

---

### A7. (Opcional) Secretários e funcionários

| Menu | Para quê |
|------|----------|
| **Secretários** | Criar secretário e enviar convite (`/register-secretary?email=…`). Acesso típico: Dashboard e **Pagamentos**. |
| **Funcionários** | Registo de pessoal não docente (cadastro administrativo). |

---

### A8. Criar turmas

Menu: **Turmas** → **Nova Turma**

Preencha, no mínimo:

- Nome da turma  
- Ano lectivo  
- Trimestre (1º, 2º ou 3º)  
- Nível de ensino: **Ensino Primário** (1ª–6ª) ou **Ensino Secundário** (7ª–13ª)  
- Classe  
- Professor responsável  

Active **“Aplicar”** templates (quando existirem) para criar as disciplinas automaticamente.

**Regime de docência (orientação do sistema)**

- Primário 1ª–4ª → monodocência  
- Primário 5ª–6ª → monodocência coadjuvada  
- Secundário 7ª–13ª → pluridocência  

Abra a turma (detalhes) para:

- Adicionar alunos  
- Ver / ajustar disciplinas  
- Atribuir professores por disciplina  
- Configurar componentes de avaliação e fórmulas  

---

### A9. Alunos e matrículas

**Dentro da turma**

1. Abra a turma.  
2. Clique em **“Adicionar”** aluno (ou equivalente).  
3. Preencha os dados e grave.

**Menu Matrículas — Confirmação de Matrículas**

1. Use **“Gerar Matrículas”** quando fizer sentido no fluxo da escola.  
2. Revise a lista (filtros: Pendentes, Confirmadas, Transita, Não Transita, Condicional).  
3. Clique em **“Confirmar”** por aluno, conforme a regra da escola.

---

### A10. Lançar notas (escola)

Menu: **Notas** — *Lançamento de Notas*

1. Escolha **Turma** → **Disciplina** → **Componente** (ex.: MAC 30%) → **Trimestre**.  
2. Introduza as notas na grelha (escala tipicamente **0–20**).  
3. O sistema faz **salvamento automático** (há aviso se houver alterações por guardar).  
4. Pode importar notas via ficheiro (CSV/Excel), quando a opção estiver disponível.

A escola pode lançar notas de **qualquer** turma/disciplina da sua instituição.

---

### A11. Relatórios e pautas

Menu: **Relatórios** — *Relatórios e Pautas*

Separadores habituais:

1. **Mini-Pauta**  
2. **Pauta Geral**  
3. **Termo de Frequência** (documento oficial por aluno — não é registo diário de faltas)  
4. **Mapa de Aproveitamento**  

Pode configurar cabeçalho e cores, e exportar em **PDF** ou **Excel**.

---

### A12. Pagamentos / propinas

Menu: **Pagamentos**

- Definir valores de propinas  
- Registar pagamentos mensais  
- Emitir recibos  

Útil para a direcção e para secretários com acesso a esta área.

---

### A13. Configurações da conta

Menu: **Configurações**

- Dados do perfil (o email de login normalmente não se edita aqui)  
- Alterar palavra-passe  
- Preferências: escala de notas (padrão angolano 0–20), ano lectivo e trimestre actuais  
- Terminar sessão  

---

### A14. Checklist rápido — Escola pronta a operar

- [ ] Escola registada e primeiro login concluído  
- [ ] Subscrição solicitada / activa  
- [ ] Templates por classe configurados  
- [ ] Professores cadastrados e convites enviados  
- [ ] Pelo menos uma turma criada com disciplinas  
- [ ] Alunos adicionados (e matrículas confirmadas, se usar o módulo)  
- [ ] Componentes de avaliação / fórmulas definidos  
- [ ] Teste de lançamento de notas  
- [ ] Teste de geração de Mini-Pauta ou Pauta Geral  

---

## Parte B — Guia do Professor

### B1. Aceitar o convite e criar senha

1. Receba da escola o **link de convite**.  
2. Abra o link (página **“Bem-vindo Professor”**).  
3. Confirme o email (já vem preenchido) e **crie a senha**.  
4. Conclua o cadastro e vá para o **Login**.  
5. Entre com o seu email e a nova senha.

Se aparecer “Nenhuma disciplina atribuída”, contacte a administração da escola — ainda não foi associado a turmas/disciplinas.

---

### B2. Dashboard do professor

Menu: **Dashboard**

Verá um resumo de:

- Turmas  
- Disciplinas  
- Alunos  
- Lista **“Minhas Disciplinas”**

Este é o ponto de partida do trabalho diário.

---

### B3. Lançar notas (fluxo principal)

Menu: **Notas**

1. Seleccione **Turma**.  
2. Seleccione **Disciplina** (só aparecem as suas).  
3. Seleccione o **Componente** (ex.: MAC, PP, PT).  
4. Seleccione o **Trimestre** (1º, 2º ou 3º).  
5. Introduza as notas por aluno (pode pesquisar e ordenar).  
6. Aguarde o **salvamento automático** ou confirme se o ecrã pedir.

**Dicas**

- Se não houver disciplinas: a escola ainda não atribuiu / não criou disciplinas na turma.  
- Se não houver componentes: a escola (ou a configuração da turma) precisa de definir MAC, PP, PT, etc.  
- A escola define a fórmula da nota final; o sistema calcula com base nos componentes lançados.

---

### B4. Relatórios do professor

Menu: **Relatórios**

Gere Mini-Pauta, Pauta Geral, Termo de Frequência ou Mapa de Aproveitamento das turmas a que tem acesso. Exporte PDF/Excel conforme necessário para a direcção ou arquivo pessoal.

---

### B5. Solicitações de documentos

Menu: **Solicitações**

1. Clique em **“Nova Solicitação”**.  
2. Escolha o destino: **Escola** ou **Direção Municipal**.  
3. Escolha o **tipo de documento** (há indicação de prazo em dias úteis).  
4. Escreva observações; se for urgente, marque **“Urgente”**.  
5. Envie o pedido.  
6. Acompanhe o estado e a resposta em **“Ver Histórico”**.

---

### B6. O que o professor pode e não pode fazer

| Pode | Não pode (em geral) |
|------|---------------------|
| Lançar e alterar notas das suas disciplinas | Criar turmas ou cadastrar professores |
| Ver alunos das suas turmas | Gerir matrículas, propinas ou subscrição |
| Gerar relatórios das suas turmas | Ver dados de outras escolas |
| Pedir documentos em Solicitações | Editar a estrutura completa da escola (templates, etc.) |
| Alterar a própria palavra-passe | Adicionar/remover alunos na turma (botões de gestão ficam para a escola) |

---

### B7. Checklist rápido — Professor a trabalhar

- [ ] Convite aceite e login feito  
- [ ] Disciplinas visíveis no Dashboard  
- [ ] Componentes de avaliação disponíveis em Notas  
- [ ] Notas de teste lançadas e gravadas  
- [ ] Mini-pauta gerada com sucesso  

---

## Parte C — Conceitos úteis para ambos

### Escala e classificação (0–20)

| Intervalo | Classificação |
|-----------|----------------|
| 17–20 | Excelente |
| 14–16 | Bom |
| 10–13 | Suficiente |
| 0–9 | Insuficiente |

Aprovação habitual: **nota ≥ 10**.

### Trimestres

O ano lectivo trabalha com **1º, 2º e 3º trimestre**. Ao lançar notas e criar turmas, escolha sempre o trimestre correcto.

### Componentes e fórmula (exemplo)

Componentes comuns: **MAC**, **PP**, **PT** (pesos em percentagem).  
Exemplo de lógica de nota final:

`Nota Final = (MAC × 0,30) + (PP × 0,30) + (PT × 0,40)`

A escola configura os pesos e a fórmula na turma/disciplina; o professor lança os valores de cada componente.

### Segurança e privacidade

- Cada escola só vê os seus dados.  
- Se a escola estiver **bloqueada**, **inactiva** ou **eliminada**, o login é recusado com mensagem explicativa.  
- Não partilhe a sua senha. Use **“Esqueceu a senha?”** em caso de perda.

---

## Parte D — Problemas frequentes

| Situação | O que fazer |
|----------|-------------|
| Não consigo entrar após registar a escola | Confirme o email (se pedido) e use exactamente o email do responsável |
| Professor não vê turmas | A escola deve atribuí-lo às disciplinas em **Turmas** → detalhes da turma |
| “Nenhum componente de avaliação” | Configurar componentes (ou templates) na turma/disciplina |
| Licença expirada | Escola: menu **Subscrição** → renovar e enviar comprovativo |
| Esqueci a senha | Login → **“Esqueceu a senha?”** → siga o email até `/reset-password` |
| Preciso de ajuda visual | Login → **“Ver Tutoriais”** |

Suporte (referência do sistema): **support@edugest.ao**

---

## Resumo em uma página

### Escola — do zero à primeira pauta

1. Cadastrar escola → login → “Começar a usar”  
2. Subscrição  
3. Templates  
4. Professores + link de convite  
5. Turmas (com templates) + alunos  
6. Notas / Relatórios  

### Professor — do convite à primeira nota

1. Abrir link de convite → criar senha → login  
2. Confirmar disciplinas no Dashboard  
3. Notas: Turma → Disciplina → Componente → Trimestre  
4. Relatórios quando precisar  
5. Solicitações para documentos oficiais  

---

*Documento orientador para utilizadores finais. Actualizado com base nas funcionalidades disponíveis na aplicação EduGest Angola (menus Escola e Professor).*
