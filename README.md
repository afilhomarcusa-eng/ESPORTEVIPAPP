# ESPORTEVIPAPP

Sistema de Gestão Financeira para Casa de Apostas - Plataforma Corporativa de Controle de Cambistas, Comissões e Despesas.

## Visão Geral

ESPORTEVIPAPP é uma aplicação web moderna construída com React que oferece:

- **Painel de Controle (Dashboard)** com visualização em tempo real de resultados brutos, comissões e líquido
- **Gestão de Cambistas** com histórico completo de movimentações e pagamentos
- **Controle de Gastos** por categorias operacionais (Alimentação, Transporte, Infraestrutura, Marketing, Comissões, Outros)
- **Relatórios Automatizados** com exportação em PDF, PNG e envio via WhatsApp
- **Análise Financeira** com gráficos responsivos (área, barras, pizza)
- **Exportação/Importação Excel** com sincronização bidirecional de dados

## Recursos Principais

### 1. Dashboard Inteligente
- KPIs em tempo real (Resultado Bruto, Comissões, Líquido)
- Gráficos de evolução com período selecionável
- Ranking de cambistas por desempenho
- Alertas de cambistas em prejuízo
- Modal automático de cambistas inativos

### 2. Gestão de Cambistas
- CRUD completo com histórico de lançamentos
- Comissões variáveis por cambista
- Registro de pagamentos
- Filtro por período (Semanal, Quinzenal, Mensal, Anual)
- Import/Export automático

### 3. Controle de Gastos
- Categorização de despesas operacionais
- Dashboard com análise por categoria
- Histórico filtrado por período
- Busca avançada
- Gráficos de distribuição

### 4. Relatórios Profissionais
- Template de fechamento customizável
- Exportação em PNG de alta resolução
- Envio automático via WhatsApp
- Impressão em PDF
- Período selecionável

### 5. Armazenamento de Dados
- **Fonte Única da Verdade (Single Source of Truth)**: Google Sheets
- Sincronização bidirecional em tempo real
- Backup automático
- Histórico completo de operações
- Exportação livre em Excel

## Tecnologias

- **Frontend**: React 18+ com Hooks
- **Styling**: Tailwind CSS (Corporativo, sem emojis)
- **Gráficos**: Recharts
- **Export**: XLSX (Excel)
- **Captura de DOM**: html2canvas
- **Integração**: Google Sheets API, WhatsApp Business API
- **Storage**: localStorage (desenvolvimento) / Google Sheets (produção)

## Estrutura do Projeto

```
esportevip/
├── esportevipapp.jsx       # Aplicação principal (React)
├── package.json            # Dependências do projeto
├── .env.example            # Variáveis de ambiente
├── README.md               # Esta documentação
└── docs/
    ├── ARQUITETURA.md      # Detalhes técnicos
    ├── PLANILHA.md         # Estrutura Google Sheets
    └── API_WHATSAPP.md     # Integração WhatsApp
```

## Paleta de Cores

- **Primária**: Laranja (`#f97316`) - Identidade ESPORTEVIPAPP
- **Variações**: Tons laranja (`#fb923c`, `#fed7aa`)
- **Secundárias**: Slate, Red, Amber, Green (para contraste e alertas)
- **Design**: 100% corporativo, sem emojis

## Filtros de Período

- **Semanal**: Segunda a domingo
- **Quinzenal**: 1-15 / 16-30
- **Mensal**: Mês completo
- **Anual**: Ano completo
- **Tudo**: Período ilimitado

## Categorias de Gastos

1. Alimentação
2. Transporte
3. Infraestrutura
4. Marketing
5. Comissões
6. Outros

## Estrutura Google Sheets (Single Source of Truth)

### Abas da Planilha:
1. **Cambistas** - Nome, Contato, Comissão Padrão, Status Ativo
2. **Lançamentos** - Data, Cambista, Resultado, Comissão, Líquido
3. **Pagamentos** - Data, Cambista, Valor, Observação
4. **Gastos** - Data, Categoria, Descrição, Valor

*Dados crus apenas - zero lógica de gráficos na planilha*

## Sincronização Bidirecional

```
Aplicação → Google Sheets (Push automático)
Google Sheets → Aplicação (Pull automático)

Intervalo: 5 minutos (configurável)
Conflitos: Last-write-wins
```

## Integração WhatsApp

- **API**: WhatsApp Business API
- **Função**: Envio de relatórios em PNG
- **Validação**: Número de telefone formatado
- **Retry**: 3 tentativas automáticas

## Como Usar

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build
```

### Configuração de Ambiente

Criar arquivo `.env`:

```env
VITE_GOOGLE_SHEETS_ID=seu-sheet-id-aqui
VITE_GOOGLE_API_KEY=sua-chave-api-aqui
VITE_WHATSAPP_API_KEY=sua-chave-whatsapp-aqui
VITE_WHATSAPP_PHONE_ID=seu-phone-id-aqui
```

## Fluxo de Dados

```
┌─────────────────┐
│   Aplicação     │
│   (React)       │
└────────┬────────┘
         │
    Sincroniza
         │
    (Bidirecional)
         │
         ▼
┌─────────────────────────┐
│   Google Sheets         │
│   (Single Source)       │
│                         │
│  - Cambistas            │
│  - Lançamentos          │
│  - Pagamentos           │
│  - Gastos               │
└─────────────────────────┘
```

## Responsividade

- **Mobile First**: Design adaptável para todo tamanho
- **Breakpoints**: xs, sm, md, lg, xl
- **Tabelas**: Scroll horizontal em mobile
- **Gráficos**: Escaláveis e responsivos
- **Formulários**: Full-width em mobile

## Segurança

- ✅ Validação de entrada em todos os campos
- ✅ Sanitização de dados antes de enviar
- ✅ CORS configurado para Google Sheets
- ✅ Rate limiting em APIs
- ✅ Variáveis sensíveis em `.env`

## Permissões Necessárias

Para Google Sheets:
- `https://www.googleapis.com/auth/spreadsheets`

Para WhatsApp Business:
- `whatsapp_business_messaging`
- `whatsapp_business_management`

## Roadmap Futuro

- [ ] Autenticação de usuários com OAuth
- [ ] Multi-tenancy (múltiplas casas)
- [ ] Dashboard em tempo real com WebSockets
- [ ] Aplicativo mobile nativo (React Native)
- [ ] Notificações push
- [ ] Analytics avançado
- [ ] API REST pública
- [ ] Integração com bancários (PIX automático)

## Suporte

Para dúvidas ou bugs, abra uma issue no repositório GitHub.

## Licença

Proprietário - ESPORTEVIPAPP © 2026

---

**Versão**: 1.0.0  
**Status**: Pronto para Apresentação ao Chefe  
**Última Atualização**: Julho 2026
