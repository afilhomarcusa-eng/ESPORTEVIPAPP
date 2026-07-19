# Como Publicar no GitHub

## Pré-requisitos

1. Ter uma conta GitHub (https://github.com)
2. Ter Git instalado (https://git-scm.com)
3. Ter configurado Git globalmente:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@gmail.com"
```

---

## Passo 1: Criar Repositório no GitHub

### 1.1 Acessar GitHub
- Ir para: https://github.com
- Login na sua conta

### 1.2 Criar Novo Repositório
- Clicar em "+" no canto superior direito
- Selecionar "New repository"

### 1.3 Preencher Informações
```
Repository name: ESPORTEVIPAPP
Description: Sistema de Gestão Financeira para Casa de Apostas
Public/Private: Private (você pode mudar depois)
Initialize repository: NÃO (já temos arquivos locais)
```

### 1.4 Copiar URL
Após criar, você verá:
```
HTTPS: https://github.com/seu-usuario/ESPORTEVIPAPP.git
SSH: git@github.com:seu-usuario/ESPORTEVIPAPP.git
```

---

## Passo 2: Fazer Push para GitHub

### 2.1 Adicionar Remote
```bash
git remote add origin https://github.com/seu-usuario/ESPORTEVIPAPP.git
```

### 2.2 Renomear Branch (se necessário)
```bash
git branch -M main
```

### 2.3 Fazer Push
```bash
git push -u origin main
```

---

## Passo 3: Verificar no GitHub

Acesse: https://github.com/seu-usuario/ESPORTEVIPAPP

Você deverá ver:
- ✅ README.md
- ✅ esportevipapp.jsx
- ✅ package.json
- ✅ docs/ (pasta com documentação)
- ✅ APRESENTACAO_CHEFE.md
- ✅ .gitignore
- ✅ Histórico de commits

---

## Passo 4: Configurações Recomendadas no GitHub

### 4.1 Proteger a Branch Main
```
Settings > Branches > Add rule
├─ Branch name pattern: main
├─ Require pull request reviews
└─ Require branches to be up to date
```

### 4.2 Adicionar Colaboradores
```
Settings > Collaborators
├─ Adicionar seu chefe
└─ Selecionar permissão (Read/Write)
```

### 4.3 Habilitar GitHub Pages (opcional)
```
Settings > Pages
├─ Source: main branch
└─ Deploy em: https://seu-usuario.github.io/ESPORTEVIPAPP
```

---

## Passo 5: Atualizações Futuras

### Fazer alterações locais
```bash
# Editar arquivo
vim esportevipapp.jsx

# Adicionar ao staging
git add esportevipapp.jsx

# Fazer commit
git commit -m "feat: melhorar componente X"

# Fazer push
git push origin main
```

### Ver histórico
```bash
git log --oneline
```

### Ver status
```bash
git status
```

---

## Alternativa: SSH (mais seguro)

### 1. Gerar chave SSH
```bash
ssh-keygen -t rsa -b 4096 -C "seu-email@gmail.com"
```

### 2. Adicionar ao SSH Agent
```bash
ssh-add ~/.ssh/id_rsa
```

### 3. Copiar chave pública
```bash
# Windows (PowerShell)
Get-Content ~/.ssh/id_rsa.pub | Set-Clipboard

# ou ver direto
cat ~/.ssh/id_rsa.pub
```

### 4. Adicionar no GitHub
```
Settings > SSH and GPG keys
├─ New SSH key
└─ Colar chave pública
```

### 5. Usar SSH para push
```bash
git remote set-url origin git@github.com:seu-usuario/ESPORTEVIPAPP.git
git push -u origin main
```

---

## Troubleshooting

### Erro: "fatal: unable to access 'https://...'"
**Solução**: Usar token de acesso pessoal
```bash
# Gerar token em: Settings > Developer settings > Personal access tokens
git remote set-url origin https://seu-usuario:seu-token@github.com/seu-usuario/ESPORTEVIPAPP.git
```

### Erro: "branch 'main' set up to track remote 'origin/main' but upstream is gone"
**Solução**:
```bash
git remote prune origin
git branch --set-upstream-to=origin/main main
```

### Erro: "Permission denied (publickey)"
**Solução**: Verificar chave SSH
```bash
ssh -T git@github.com
# Deve retornar: Hi username! You've successfully authenticated.
```

---

## URL do Repositório

Após publicar, compartilhe este link com seu chefe:

```
https://github.com/seu-usuario/ESPORTEVIPAPP
```

---

## Arquivos Importantes para Revisão

Quando seu chefe acessar o repositório, ele deve revisar:

1. **APRESENTACAO_CHEFE.md** - Proposta executiva
2. **README.md** - Documentação geral
3. **esportevipapp.jsx** - Código-fonte (principal)
4. **docs/ARQUITETURA.md** - Detalhes técnicos
5. **docs/PLANILHA.md** - Estrutura Google Sheets
6. **docs/API_WHATSAPP.md** - Integração WhatsApp

---

## Comando Rápido (All-in-One)

Se quiser fazer tudo de uma vez:

```bash
# 1. Ir para pasta do projeto
cd c:\Users\osnav\OneDrive\Desktop\esportevip

# 2. Adicionar remote
git remote add origin https://github.com/seu-usuario/ESPORTEVIPAPP.git

# 3. Renomear branch
git branch -M main

# 4. Fazer push
git push -u origin main

# 5. Verificar
git log --oneline
```

---

**Pronto! Seu projeto está no GitHub!**

**Próximo passo:** Enviar link para seu chefe revisar a proposta.
