/**
 * ESPORTEVIPAPP — Web App que recebe as mudanças do site e reescreve as abas
 * da planilha (Cambistas, Lancamentos, Pagamentos e Gastos).
 *
 * COMO INSTALAR: veja o passo a passo em COMO_ATIVAR_ESCRITA_PLANILHA.md
 * (na raiz do projeto). Resumo: abra a planilha → Extensões → Apps Script →
 * cole este código → Implantar → Novo App da Web → executar como "Eu",
 * acesso "Qualquer pessoa" → copie o link e cole no site.
 */

function doPost(e) {
  var dados = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  escreverAba(ss, "Cambistas",
    [["Nome", "Contato", "Comissao Padrao", "Ativo"]].concat(
      (dados.cambistas || []).map(function (c) {
        return [c.nome, c.contato, c.comissaoPadrao, c.ativo ? "Sim" : "Nao"];
      })
    )
  );

  escreverAba(ss, "Lancamentos",
    [["Data", "Cambista", "Positivo (R$)", "Percentual"]].concat(
      (dados.lancamentos || []).map(function (l) {
        return [l.data, l.cambista, l.positivo, l.percentual];
      })
    )
  );

  escreverAba(ss, "Pagamentos",
    [["Data", "Cambista", "Valor (R$)", "Obs"]].concat(
      (dados.pagamentos || []).map(function (p) {
        return [p.data, p.cambista, p.valor, p.obs];
      })
    )
  );

  escreverAba(ss, "Gastos",
    [["DATA", "CATEGORIA", "QUEM GASTOU", "DESCRIÇÃO", "VALOR"]].concat(
      (dados.gastos || []).map(function (g) {
        return [g.data, g.categoria, g.responsavel, g.descricao, g.valor];
      })
    )
  );

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, atualizadoEm: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Limpa o conteúdo da aba (criando-a se não existir) e grava as linhas novas.
// As datas chegam como texto dd/mm/aaaa; o formato @ evita o Sheets convertê-las
// para outro fuso/formato e quebrar a leitura de volta pelo site.
function escreverAba(ss, nome, linhas) {
  var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  sh.clearContents();
  if (!linhas.length) return;
  var range = sh.getRange(1, 1, linhas.length, linhas[0].length);
  sh.getRange(1, 1, linhas.length, 1).setNumberFormat("@");
  range.setValues(linhas);
}
