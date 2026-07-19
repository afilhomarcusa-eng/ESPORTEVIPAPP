# Integração WhatsApp Business API - ESPORTEVIPAPP

## Visão Geral

Integração com WhatsApp Business API para envio automático de relatórios de fechamento em formato de imagem (PNG) diretamente para o chat do cambista.

## Funcionalidades

- Gerar relatório de fechamento em formato visual
- Capturar DOM e converter para PNG (html2canvas)
- Enviar imagem diretamente via WhatsApp
- Validação de número de telefone
- Retry automático em caso de falha
- Histórico de envios

## Configuração

### 1. Criar Conta WhatsApp Business

```
1. Acessar: https://www.whatsapp.com/business/
2. Criar conta comercial
3. Obter Phone Number ID
4. Gerar API Key
5. Aprovar domínio
```

### 2. Variáveis de Ambiente

```env
VITE_WHATSAPP_API_KEY=wha_xxxxxxxxxxxx
VITE_WHATSAPP_PHONE_ID=123456789
VITE_WHATSAPP_BUSINESS_ACCOUNT_ID=123456789
```

### 3. Servidor Backend (Node.js + Express)

```javascript
// POST /api/whatsapp/send
app.post('/api/whatsapp/send', async (req, res) => {
  const { file, phone, name } = req.body

  try {
    // 1. Upload de mídia
    const mediaId = await uploadMedia(file)

    // 2. Enviar mensagem com imagem
    const result = await sendImage({
      phoneId: process.env.VITE_WHATSAPP_PHONE_ID,
      recipientPhone: phone,
      mediaId: mediaId,
      caption: `Relatório de Fechamento - ${name}`
    })

    res.json({ success: true, messageId: result.messages[0].id })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

---

## Fluxo de Envio

### Frontend (React)

```
┌─────────────────────────────┐
│  Usuário clica em            │
│  "Enviar WhatsApp"           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Validar número de telefone  │
│  (11) 9XXXX-XXXX             │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Capturar DOM da imagem      │
│  (html2canvas)               │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Converter para Blob (PNG)   │
│  com qualidade máxima        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Enviar FormData para API    │
│  POST /api/whatsapp/send     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Backend recebe e processa   │
│  (validação + rate limit)    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Upload para WhatsApp Media  │
│  Storage                     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Enviar mensagem com imagem  │
│  para número do cambista     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Confirmar entrega           │
│  (Toast de sucesso)          │
└─────────────────────────────┘
```

---

## Código Frontend (React)

```javascript
// Função para enviar relatório via WhatsApp
const enviarWhatsApp = async () => {
  // 1. Validação
  if (!telefone) return alert("Informe o número do WhatsApp")
  if (!window.html2canvas || !ticketRef.current) {
    return alert("Aguarde o gerador de imagem carregar")
  }

  try {
    // 2. Capturar DOM
    const canvas = await window.html2canvas(ticketRef.current, {
      backgroundColor: "#020617",
      scale: 2,
      useCORS: true,
      allowTaint: true
    })

    // 3. Converter para Blob
    const blob = await new Promise(resolve => 
      canvas.toBlob(resolve, "image/png", 0.95)
    )

    // 4. Preparar FormData
    const formData = new FormData()
    formData.append("file", blob, "relatorio.png")
    formData.append("phone", telefone.replace(/\D/g, ""))
    formData.append("name", nome)

    // 5. Enviar para backend
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      body: formData
    })

    const data = await response.json()
    
    if (response.ok) {
      alert("Relatório enviado com sucesso!")
      // Log sucesso
      console.log("WhatsApp ID:", data.messageId)
    } else {
      throw new Error(data.error)
    }
  } catch (error) {
    alert("Erro ao enviar: " + error.message)
    console.error(error)
  }
}
```

---

## Código Backend (Node.js)

```javascript
import express from 'express'
import axios from 'axios'
import FormData from 'form-data'

const app = express()

// Configuração
const WHATSAPP_API_URL = "https://graph.instagram.com/v18.0"
const PHONE_ID = process.env.VITE_WHATSAPP_PHONE_ID
const API_KEY = process.env.VITE_WHATSAPP_API_KEY

// Rate limiting
const rateLimitMap = new Map()

function checkRateLimit(phone) {
  const limit = rateLimitMap.get(phone) || []
  const now = Date.now()
  const recentRequests = limit.filter(t => now - t < 60000) // 1 minuto
  
  if (recentRequests.length >= 5) {
    throw new Error("Limite de envios atingido. Aguarde 1 minuto.")
  }
  
  rateLimitMap.set(phone, [...recentRequests, now])
  return true
}

// Validar telefone
function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, "")
  
  // Formato: país (55) + DDI (11) + número (9XXXX-XXXX)
  if (cleaned.length !== 13 || !cleaned.startsWith("55")) {
    throw new Error("Formato de telefone inválido")
  }
  
  return cleaned
}

// Upload de mídia
async function uploadMedia(buffer, filename) {
  const form = new FormData()
  form.append("file", buffer, filename)
  form.append("type", "image/png")
  form.append("access_token", API_KEY)

  const response = await axios.post(
    `${WHATSAPP_API_URL}/${PHONE_ID}/media`,
    form,
    { headers: form.getHeaders() }
  )

  return response.data.id
}

// Enviar imagem via WhatsApp
async function sendImage(phoneNumber, mediaId, caption) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber,
    type: "image",
    image: {
      id: mediaId,
      caption: caption
    }
  }

  const response = await axios.post(
    `${WHATSAPP_API_URL}/${PHONE_ID}/messages`,
    payload,
    {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  )

  return response.data
}

// Endpoint principal
app.post("/api/whatsapp/send", async (req, res) => {
  try {
    const { file, phone, name } = req.body

    if (!file || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: "Arquivo e telefone são obrigatórios" 
      })
    }

    // Validação de telefone
    const validPhone = validatePhone(phone)

    // Rate limiting
    checkRateLimit(validPhone)

    // Converter buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload de mídia com retry
    let mediaId
    for (let i = 0; i < 3; i++) {
      try {
        mediaId = await uploadMedia(buffer, "relatorio.png")
        break
      } catch (err) {
        if (i === 2) throw err
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }

    // Enviar imagem com retry
    let result
    for (let i = 0; i < 3; i++) {
      try {
        result = await sendImage(
          validPhone,
          mediaId,
          `Relatório de Fechamento - ${name}`
        )
        break
      } catch (err) {
        if (i === 2) throw err
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }

    res.json({
      success: true,
      messageId: result.messages[0].id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("WhatsApp Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Webhook para confirmação de entrega
app.post("/api/whatsapp/webhook", (req, res) => {
  const { object, entry } = req.body

  if (object === "whatsapp_business_account") {
    for (const change of entry[0].changes) {
      const { value } = change
      
      if (value.statuses) {
        for (const status of value.statuses) {
          console.log(`Mensagem ${status.id}: ${status.status}`)
          
          // Atualizar DB com status
          // updateMessageStatus(status.id, status.status)
        }
      }
    }
  }

  res.sendStatus(200)
})

export default app
```

---

## Tratamento de Erros

### Erros Comuns

```
1. "Invalid phone number"
   └─ Solução: Validar formato (55 + DDI + número)

2. "Rate limit exceeded"
   └─ Solução: Aguardar antes de enviar novamente

3. "Media upload failed"
   └─ Solução: Validar tamanho da imagem (<16MB)

4. "Invalid message format"
   └─ Solução: Garantir que mediaId é válido

5. "Account not approved"
   └─ Solução: Aprovar conta no Meta Business Manager
```

### Retry Strategy

```javascript
// Exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === maxRetries - 1) throw err
      
      const delay = 1000 * Math.pow(2, i) // 1s, 2s, 4s
      console.log(`Retry ${i + 1}/${maxRetries} em ${delay}ms...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

---

## Limitações e Quotas

### WhatsApp Business API

| Métrica | Limite | Observação |
|---------|--------|-----------|
| Requisições | 80/segundo | Por conta comercial |
| Media Upload | 16MB máximo | Arquivo PNG |
| Templates | 256 caracteres | Não aplicável para nós |
| Entrega | 24h window | Primeira resposta |
| Histórico | 90 dias | Retenção de mensagens |

---

## Segurança

### Boas Práticas

1. **Nunca expor API Key no frontend**
   ```javascript
   // ❌ ERRADO
   const API_KEY = "wha_xxxxxxx"

   // ✅ CORRETO
   // Variável de ambiente no backend
   const API_KEY = process.env.VITE_WHATSAPP_API_KEY
   ```

2. **Validar sempre o número de telefone**
   ```javascript
   const phoneRegex = /^55\d{11}$/
   if (!phoneRegex.test(phone)) throw new Error("Invalid phone")
   ```

3. **Sanitizar dados da imagem**
   ```javascript
   // Remover informações sensíveis antes de capturar
   // (ex: IPs, tokens, credenciais)
   ```

4. **Rate limiting por usuário**
   ```javascript
   // Máximo 5 envios por minuto por número
   checkRateLimit(phone)
   ```

5. **Logging de envios**
   ```javascript
   console.log(`[WHATSAPP] ${timestamp} ${phone} ${status}`)
   ```

---

## Testando Localmente

### 1. Usar Postman

```
POST http://localhost:3000/api/whatsapp/send

Body (form-data):
- file: [selecionar imagem PNG]
- phone: 5511999999999
- name: João Silva
```

### 2. Usar cURL

```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -F "file=@relatorio.png" \
  -F "phone=5511999999999" \
  -F "name=João Silva"
```

### 3. Validar Webhook

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "statuses": [{
            "id": "wamid.xxx",
            "status": "delivered"
          }]
        }
      }]
    }]
  }'
```

---

## Checklist de Implementação

- [ ] Criar conta WhatsApp Business
- [ ] Gerar API Key
- [ ] Obter Phone Number ID
- [ ] Configurar variáveis de ambiente
- [ ] Implementar upload de mídia
- [ ] Implementar envio de mensagem
- [ ] Implementar webhook de confirmação
- [ ] Adicionar rate limiting
- [ ] Testar localmente
- [ ] Documentar para equipe
- [ ] Configurar em produção

---

**Versão**: 1.0  
**API WhatsApp**: v18.0+  
**Última atualização**: Julho 2026
