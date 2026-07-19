# Arquitetura ESPORTEVIPAPP

## Visão Geral da Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  - Dashboard                                           │  │
│  │  - Gestão de Cambistas                                │  │
│  │  - Controle de Gastos                                 │  │
│  │  - Relatórios com WhatsApp                            │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────┬─────────────────────────────────────────────┘
                 │ API Calls
                 │ (Sincronização)
┌────────────────▼─────────────────────────────────────────────┐
│              Backend / Serviços de Terceiros                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Google Sheets API (Single Source of Truth)           │  │
│  │  - Cambistas                                          │  │
│  │  - Lançamentos                                        │  │
│  │  - Pagamentos                                         │  │
│  │  - Gastos                                             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  WhatsApp Business API                                │  │
│  │  - Envio de Relatórios                                │  │
│  │  - Notificações                                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. **Frontend (React)**

#### Estado Global
```javascript
const [db, setDb] = useState({
  cambistas: [],
  lancamentos: [],
  pagamentos: [],
  gastos: [],
  metaMensal: 10000,
  version: 4
})
```

#### Hooks Customizados
- `useSync()` - Sincroniza com Google Sheets
- `useExport()` - Exporta para Excel
- `useWhatsApp()` - Envia relatórios

### 2. **Camada de Dados**

#### localStorage (Desenvolvimento)
```javascript
const KEY = "esportevipapp:v1"
async function loadDB() { /* ... */ }
async function saveDB(db) { /* ... */ }
```

#### Google Sheets (Produção)
```
Planilha Structure:
├── Cambistas (Aba 1)
│   ├── A: ID
│   ├── B: Nome
│   ├── C: Contato
│   ├── D: Comissão Padrão
│   └── E: Status Ativo
│
├── Lançamentos (Aba 2)
│   ├── A: Data
│   ├── B: Cambista ID
│   ├── C: Resultado (Positivo)
│   ├── D: Comissão Calculada
│   ├── E: Líquido
│   └── F: Movimentação
│
├── Pagamentos (Aba 3)
│   ├── A: Data
│   ├── B: Cambista ID
│   ├── C: Valor
│   └── D: Observação
│
└── Gastos (Aba 4)
    ├── A: Data
    ├── B: Categoria
    ├── C: Descrição
    └── D: Valor
```

### 3. **Sincronização Bidirecional**

#### Push (App → Google Sheets)
```
Evento: Usuário faz alteração
├─ Validar dados
├─ Preparar payload
├─ Enviar para API
├─ Confirmar recebimento
└─ Atualizar UI
```

#### Pull (Google Sheets → App)
```
Intervalo: A cada 5 minutos
├─ Verificar última sincronização
├─ Buscar dados da planilha
├─ Comparar versões
├─ Mesclar alterações (Last-Write-Wins)
└─ Atualizar estado local
```

### 4. **Fluxo de Dados**

#### Criar Lançamento
```
User Input
    ↓
Validação (Cambista, Valor, Data)
    ↓
Calcular Comissão
    ↓
Atualizar State Local
    ↓
Persistir (localStorage)
    ↓
Sincronizar com Google Sheets
    ↓
Atualizar Dashboard em Tempo Real
```

#### Gerar Relatório
```
Selecionar Cambista
    ↓
Buscar Dados do Período
    ↓
Renderizar Template
    ↓
Capturar DOM (html2canvas)
    ↓
Enviar para WhatsApp
    ↓
Salvar em PDF
```

## Padrões de Código

### Utilitários
```javascript
// Formatação de valores
brl(260.50) → "R$ 260,50"
pct(0.15) → "15%"
numFmt(1000.50) → "1.000,50"

// Manipulação de datas
iso(new Date()) → "2026-07-01"
parse("2026-07-01") → Date object
fmtData("2026-07-01") → "01/07/2026"

// Período
periodRange("mes", ref) → [start, end]
rotuloPeriodo("mes", ref) → "Julho de 2026"
```

### Cálculos Financeiros
```javascript
// Comissão por lançamento
calcLanc(lancamento, cambista) → {
  pct: 0.10,
  comissao: 26.00,
  receber: 234.00
}

// Agregação por período
agrega(lancamentos, cambById) → {
  bruto: 10000,
  comissao: 1000,
  receber: 9000,
  holdMedio: 0.08
}
```

## Segurança

### Validações
```javascript
// Entrada de Usuário
if (!nome.trim()) throw new Error("Nome obrigatório")
if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido")
if (!data.match(/^\d{4}-\d{2}-\d{2}$/)) throw new Error("Data inválida")
```

### CORS
```javascript
// Google Sheets API
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
}
```

### Rate Limiting
```javascript
// WhatsApp API: 80 requisições por segundo
// Google Sheets: 500 requisições por 100 segundos
```

## Performance

### Otimizações
- `useMemo` para cálculos pesados (agregações, gráficos)
- `useCallback` para callbacks em listas
- Lazy loading de componentes pesados
- Debounce em busca e filtros

### Caching
```javascript
// Cache de Google Sheets
const cache = {
  cambistas: { data, timestamp },
  lancamentos: { data, timestamp },
  gastos: { data, timestamp }
}

// Validar se deve sincronizar
if (Date.now() - cache.timestamp > 5000) {
  // Sincronizar
}
```

## Tratamento de Erros

### Estratégia de Retry
```javascript
async function syncWithRetry(data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sync(data)
    } catch (err) {
      if (i === maxRetries - 1) throw err
      await delay(1000 * (i + 1)) // Exponential backoff
    }
  }
}
```

### Feedback ao Usuário
```
Status de Salvamento:
├─ Salvando... (amber)
├─ Tudo salvo (orange)
└─ Erro (red)
```

## Monitoramento

### Métricas
- Tempo de sincronização
- Taxa de sucesso de envios
- Quantidade de erros por período
- Latência da API Google Sheets

### Logs
```javascript
// Formato: [TIMESTAMP] [LEVEL] [MODULE] Message
[2026-07-01 14:30:45] [INFO] [SYNC] Sincronizando cambistas
[2026-07-01 14:30:46] [SUCCESS] [SYNC] 4 cambistas sincronizados
```

## Escalabilidade

### Próximas Fases
1. **Multi-tenancy**: Suportar múltiplas casas
2. **Sharding**: Dividir dados por casa
3. **API REST**: Endpoints públicos
4. **WebSockets**: Sincronização real-time
5. **Microserviços**: Separar domínios

## Testes

### Cobertura Recomendada
- ✅ Utilitários: 100%
- ✅ Cálculos: 100%
- ✅ Componentes: 80%
- ✅ Integração: 70%

### Exemplo de Teste
```javascript
test('calcLanc deve calcular comissão corretamente', () => {
  const result = calcLanc(
    { positivo: 260 },
    { comissaoPadrao: 0.10 }
  )
  expect(result.comissao).toBe(26)
  expect(result.receber).toBe(234)
})
```

## Deployment

### Ambiente de Desenvolvimento
```bash
npm run dev
→ http://localhost:5173
```

### Ambiente de Produção
```bash
npm run build
→ dist/
→ Deploy para Vercel/Netlify
```

### Variáveis de Ambiente Necessárias
```
VITE_GOOGLE_SHEETS_ID
VITE_GOOGLE_API_KEY
VITE_WHATSAPP_API_KEY
VITE_WHATSAPP_PHONE_ID
```

---

**Versão**: 1.0  
**Mantido por**: Equipe de Desenvolvimento  
**Última atualização**: Julho 2026
