# Como fazer o site salvar as mudanças na planilha do Google

Hoje o site **lê** a planilha (botão Sincronizar), mas o Google não permite
**escrever** na planilha pelo link público — para isso a planilha precisa de um
pequeno script autorizado por você. Leva uns 5 minutos e é grátis:

## Passo a passo (fazer uma única vez)

1. **Abra a sua planilha** no Google Sheets.

2. No menu, clique em **Extensões → Apps Script**. Vai abrir uma aba nova com um
   editor de código.

3. Apague o que estiver lá e **cole todo o conteúdo do arquivo
   `apps-script-planilha.gs`** (está na raiz deste projeto).

4. Clique em **Implantar** (botão azul, canto superior direito) →
   **Nova implantação**.

5. Clique na engrenagem ⚙ ao lado de "Selecionar tipo" e escolha **App da Web**.

6. Preencha assim:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** **Qualquer pessoa**  ← importante!

7. Clique em **Implantar**. O Google vai pedir autorização — clique em
   **Autorizar acesso**, escolha sua conta e em "O Google não verificou este
   app" clique em **Avançado → Acessar (projeto sem nome)** e **Permitir**.
   (É seguro: o script é seu e só mexe na sua própria planilha.)

8. **Copie o link do App da Web** (começa com
   `https://script.google.com/macros/s/...` e termina com `/exec`).

9. No site: aba **Cambistas → Planilha Online** → cole o link no campo
   **"Link do Web App (Apps Script)"** → clique em **Salvar link** e depois em
   **Enviar agora** para testar.

## Como funciona depois de configurado

- **Toda mudança feita no site** (lançamento, pagamento, cambista e **gastos**)
  é enviada automaticamente para a planilha ~3 segundos depois, reescrevendo as
  abas `Cambistas`, `Lancamentos`, `Pagamentos` e `Gastos`.
- Se o envio falhar (sem internet, etc.), a bolinha de status no topo do site
  fica **vermelha** com o aviso "Planilha não atualizada" — os dados continuam
  salvos na nuvem (Supabase) e você pode reenviar depois pelo botão
  **Enviar agora**.
- O caminho contrário continua igual: se você editar a planilha à mão, clique em
  **Sincronizar agora** no site para puxar as mudanças.

## Atenção

- **Não edite a planilha à mão e o site ao mesmo tempo**: o envio automático
  reescreve as abas com o que está no site. Se você editou a planilha à mão,
  primeiro clique em **Sincronizar agora** (planilha → site) antes de fazer
  mudanças no site.
- Se um dia você **reimplantar** o script (Implantar → Gerenciar implantações),
  o link pode mudar — atualize o link novo no site.
