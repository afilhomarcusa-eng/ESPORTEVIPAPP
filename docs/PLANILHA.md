# Estrutura Google Sheets - ESPORTEVIPAPP

## Visão Geral

A Google Sheets é a **Single Source of Truth** (SSOT) do sistema. Todos os dados são armazenados aqui e sincronizados com a aplicação React em tempo real.

## Configuração Inicial

### 1. Criar Planilha no Google Drive

```
Nome: ESPORTEVIPAPP - Gestão Financeira
Compartilhado com: App (Service Account)
```

### 2. Criar Abas

1. **Cambistas**
2. **Lançamentos**
3. **Pagamentos**
4. **Gastos**

---

## Aba 1: Cambistas

**Responsável por**: Cadastro e gestão de cambistas

### Estrutura

| Coluna | Nome | Tipo | Obrigatório | Formato | Observação |
|--------|------|------|-------------|---------|------------|
| A | ID | Texto | Sim | UUID | Gerado pela app |
| B | Nome | Texto | Sim | Livre | Identificador |
| C | Contato | Texto | Não | (11) 9XXXX-XXXX | Telefone WhatsApp |
| D | Comissão Padrão | Número | Sim | 0.00 | Percentual (0-1) |
| E | Status Ativo | Texto | Sim | Sim/Não | Binário |
| F | Criado em | Data | Sim | AAAA-MM-DD | Data de cadastro |

### Validações
```
B (Nome): Não vazio, Max 100 caracteres
C (Contato): Válido ou vazio
D (Comissão): 0 <= valor <= 1
E (Status): "Sim" ou "Não"
```

### Exemplo
```
ID          | Nome      | Contato        | Comissão | Ativo | Criado em
abc123xyz   | Ana       | (11) 99999-0001| 0.10     | Sim   | 2026-01-15
def456uvw   | João      | (11) 99999-0002| 0.15     | Sim   | 2026-01-15
ghi789rst   | Flávio    | (11) 99999-0003| 0.20     | Sim   | 2026-02-01
jkl012opq   | Antônio   | (11) 99999-0004| 0.10     | Não   | 2026-03-10
```

---

## Aba 2: Lançamentos

**Responsável por**: Registro de resultados (bruto) e comissões

### Estrutura

| Coluna | Nome | Tipo | Obrigatório | Formato | Observação |
|--------|------|------|-------------|---------|------------|
| A | ID | Texto | Sim | UUID | Gerado pela app |
| B | Data | Data | Sim | AAAA-MM-DD | Dia da operação |
| C | Cambista ID | Texto | Sim | UUID | Link para Cambistas.A |
| D | Resultado Bruto | Número | Sim | Livre | Positivo (ganho) ou negativo (perda) |
| E | Comissão (%) | Número | Não | 0.00 | Percentual ou deixar vazio |
| F | Comissão (R$) | Número | Sim | Calculado | = D * E (ou comissão padrão) |
| G | Líquido | Número | Sim | Calculado | = D - F |
| H | Movimentação | Número | Não | Livre | Total apostado (para cálculo de hold) |
| I | Hold (%) | Número | Não | Calculado | = G / H |
| J | Observação | Texto | Não | Livre | Notas adicionais |

### Fórmulas

```excel
F: =IF(E:E="", D:D*VLOOKUP(C:C, Cambistas!A:D, 4, FALSE), D:D*E:E)
G: =D:D - F:F
I: =IF(H:H=0, "", G:G/H:H)
```

### Validações
```
D (Resultado): Número (positivo ou negativo)
E (Comissão): 0 <= valor <= 1 ou vazio
H (Movimentação): Número > 0 ou vazio
```

### Exemplo
```
ID        | Data      | Cambista ID | Bruto | Comissão % | Comissão R$ | Líquido | Mov   | Hold
lanc001   | 2026-06-01| abc123xyz   | 300   | 0.10       | 30          | 270     | 3000  | 9.0%
lanc002   | 2026-06-01| def456uvw   | -150  | 0.15       | -22.5       | -127.5  | 1500  | -8.5%
lanc003   | 2026-06-02| ghi789rst   | 500   | (vazio)    | 100         | 400     | 5000  | 8.0%
```

---

## Aba 3: Pagamentos

**Responsável por**: Registro de pagamentos aos cambistas

### Estrutura

| Coluna | Nome | Tipo | Obrigatório | Formato | Observação |
|--------|------|------|-------------|---------|------------|
| A | ID | Texto | Sim | UUID | Gerado pela app |
| B | Data | Data | Sim | AAAA-MM-DD | Data do pagamento |
| C | Cambista ID | Texto | Sim | UUID | Link para Cambistas.A |
| D | Valor | Número | Sim | Livre | Montante pago |
| E | Observação | Texto | Não | Livre | PIX, Dinheiro, etc |

### Validações
```
D (Valor): Número > 0
```

### Exemplo
```
ID      | Data      | Cambista ID | Valor | Observação
pag001  | 2026-06-05| abc123xyz   | 300   | PIX
pag002  | 2026-06-10| def456uvw   | 200   | Dinheiro
pag003  | 2026-06-15| ghi789rst   | 500   | PIX
```

---

## Aba 4: Gastos

**Responsável por**: Controle de despesas operacionais

### Estrutura

| Coluna | Nome | Tipo | Obrigatório | Formato | Observação |
|--------|------|------|-------------|---------|------------|
| A | ID | Texto | Sim | UUID | Gerado pela app |
| B | Data | Data | Sim | AAAA-MM-DD | Data da despesa |
| C | Categoria | Texto | Sim | Enum | Alimentação, Transporte, etc |
| D | Descrição | Texto | Sim | Livre | Detalhamento |
| E | Valor | Número | Sim | Livre | Montante gasto |

### Categorias Válidas
```
- Alimentação
- Transporte
- Infraestrutura
- Marketing
- Comissões
- Outros
```

### Validações
```
C (Categoria): Deve ser uma das categorias listadas
D (Descrição): Não vazio
E (Valor): Número > 0
```

### Exemplo
```
ID    | Data      | Categoria       | Descrição                    | Valor
gst001| 2026-06-01| Alimentação     | Almoço reunião              | 150
gst002| 2026-06-02| Transporte      | Uber para reunião cliente   | 45.50
gst003| 2026-06-03| Infraestrutura  | Internet mês junho          | 120
gst004| 2026-06-05| Marketing       | Publicidade Instagram       | 500
gst005| 2026-06-10| Comissões       | Extra para Ana (bonus)      | 200
gst006| 2026-06-15| Outros          | Café escritório             | 80
```

---

## Protecciones de Dados

### Recomendações

1. **Validação de Dados**
   - Dados > Validação de dados
   - Aplicar regras nas colunas críticas

2. **Fórmulas Protegidas**
   - Bloquear colunas calculadas (F, G, I)
   - Apenas app pode editar

3. **Histórico de Versões**
   - Arquivo > Histórico de versões
   - Permitir recovery de alterações

4. **Compartilhamento**
   - Apenas usuários autorizados podem editar
   - Aplicação tem acesso via API

---

## Sincronização com App

### Fluxo de Push (App → Sheets)

```
1. Usuário faz alteração na app
   └─ Clica em "Adicionar", "Salvar", "Deletar"

2. Validação local
   └─ Confirma formato e valores

3. Atualizar estado local
   └─ setDb() com nova informação

4. Persistir em localStorage
   └─ Para offline-first

5. Sincronizar com Google Sheets
   └─ API Call POST/PUT/DELETE

6. Confirmar no UI
   └─ Toast: "Tudo salvo"
```

### Fluxo de Pull (Sheets → App)

```
1. Trigger: A cada 5 minutos (configurável)
   └─ Pode ser manual via botão "Sincronizar"

2. Buscar dados da Sheets via API
   └─ Verifica timestamp da última atualização

3. Comparar com versão local
   └─ Last-Write-Wins em caso de conflito

4. Mesclar alterações
   └─ Preserva local updates não sincronizadas

5. Atualizar estado
   └─ setDb() com dados remotos

6. Atualizar componentes
   └─ Rerender automático via React
```

---

## APIs Necessárias

### Google Sheets API

```javascript
// Autenticação
scope: "https://www.googleapis.com/auth/spreadsheets"

// Operações
GET  /v4/spreadsheets/{spreadsheetId}/values/{range}
POST /v4/spreadsheets/{spreadsheetId}/values/{range}
PUT  /v4/spreadsheets/{spreadsheetId}/values/{range}
```

### Exemplo de Request

```bash
# Ler Cambistas
curl -X GET \
  "https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/Cambistas!A:F" \
  -H "Authorization: Bearer {API_KEY}"

# Adicionar Lançamento
curl -X POST \
  "https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/Lançamentos!A:J/append" \
  -H "Authorization: Bearer {API_KEY}" \
  -d '{
    "values": [
      ["id123", "2026-06-01", "cambista456", 300, 0.10, 30, 270, 3000, 0.09, ""]
    ]
  }'
```

---

## Backup e Recuperação

### Backup Automático
```
- Google Drive: Versões automáticas
- Intervalo: A cada 30 minutos
- Retenção: 30 dias
```

### Recuperação Manual
```
1. Arquivo > Histórico de versões
2. Selecionar versão desejada
3. Clicar em "Restaurar"
```

---

## Monitoramento da Integridade

### Verificações Recomendadas

```javascript
// Validar referencial
- Cambista ID em Lançamentos deve existir em Cambistas.A
- Cambista ID em Pagamentos deve existir em Cambistas.A

// Validar totais
- SUM(Lançamentos.F) ≈ SUM(Cambistas.Comissão)
- SUM(Gastos.E) = Total Gasto

// Validar datas
- Lançamentos.Data >= 2020
- Lançamentos.Data <= TODAY()
```

---

## Checklist de Configuração

- [ ] Criar planilha no Google Drive
- [ ] Criar Service Account no Google Cloud
- [ ] Gerar chave API
- [ ] Adicionar permissões de escrita na planilha
- [ ] Configurar variáveis de ambiente (.env)
- [ ] Testar sincronização (Pull)
- [ ] Testar sincronização (Push)
- [ ] Ativar histórico de versões
- [ ] Configurar compartilhamento (leitura)
- [ ] Documentar ID da planilha para equipe

---

**Versão**: 1.0  
**Compatível com**: ESPORTEVIPAPP v1.0+  
**Última atualização**: Julho 2026
