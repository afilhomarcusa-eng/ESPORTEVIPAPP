/**
 * ESPORTEVIPAPP — Web App que sincroniza dados com a planilha.
 * Abas: COMISSÕES (lançamentos + cambistas) e CAMBISTAS (dados dos cambistas).
 * NUNCA apaga dados — apenas reescreve com os dados atuais do site.
 *
 * COMO INSTALAR: abra a planilha → Extensões → Apps Script →
 * cole este código → Implantar → Novo App da Web → executar como "Eu",
 * acesso "Qualquer pessoa" → copie o link e cole no site.
 */

function doPost(e) {
  var dados = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Atualizar aba CAMBISTAS com dados dos cambistas
  escreverAbaSegura(ss, "CAMBISTAS",
    [["Nome", "Contato", "Comissao Padrao", "Ativo"]].concat(
      (dados.cambistas || []).map(function (c) {
        return [c.nome, c.contato, c.comissaoPadrao, c.ativo ? "Sim" : "Nao"];
      })
    )
  );

  // 2. Atualizar aba COMISSÕES com lançamentos (formato original: NOME | MOVIMENTO | PERCENTUAL | RECEBER | PAGAMENTO)
  var comissoesLinhas = [["NOME", "MOVIMENTO", "PERCENTUAL", "RECEBER", "PAGAMENTO"]];
  var cambById = {};
  (dados.cambistas || []).forEach(function (c) { cambById[c.id] = c; });

  // Agrupar lançamentos por cambista
  var lancsPoId = {};
  (dados.lancamentos || []).forEach(function (l) {
    if (!lancsPoId[l.cambistaId]) lancsPoId[l.cambistaId] = [];
    lancsPoId[l.cambistaId].push(l);
  });

  // Montar linhas de comissões (uma linha por cambista com último lançamento)
  (dados.cambistas || []).forEach(function (c) {
    var lancs = lancsPoId[c.id] || [];
    if (lancs.length > 0) {
      var ultimoLanc = lancs[lancs.length - 1];
      var comissao = ultimoLanc.positivo * (ultimoLanc.pct || c.comissaoPadrao || 0);
      var receber = ultimoLanc.positivo - comissao;
      comissoesLinhas.push([c.nome, ultimoLanc.positivo, ultimoLanc.pct || c.comissaoPadrao || 0, receber, ""]);
    }
  });

  escreverAbaSegura(ss, "COMISSÕES", comissoesLinhas);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, atualizadoEm: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Atualiza a aba de forma SEGURA: nunca apaga dados, só reescreve com o novo conteúdo.
// Se a aba não existir, cria; se existir, reescreve SÓ o conteúdo (preserva formato).
function escreverAbaSegura(ss, nome, linhas) {
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
  }

  // Limpar conteúdo (mas preserva formatação de fundo, cores, etc.)
  if (sh.getMaxRows() > 1) {
    sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearContent();
  }

  if (!linhas || linhas.length === 0) return;

  // Escrever cabeçalho e dados
  var range = sh.getRange(1, 1, linhas.length, linhas[0].length);
  sh.getRange(1, 1, linhas.length, 1).setNumberFormat("@");
  range.setValues(linhas);
}
