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

  escreverAba(ss, "CAMBISTAS",
    [["Nome", "Contato", "Comissao Padrao", "Ativo"]].concat(
      (dados.cambistas || []).map(function (c) {
        return [c.nome, c.contato, c.comissaoPadrao, c.ativo ? "Sim" : "Nao"];
      })
    )
  );

  // Lançamentos separados por semana (com datas) — apenas referência do site
  escreverAba(ss, "Lancamentos",
    [["Semana", "Data", "Cambista", "Positivo (R$)", "Percentual"]].concat(
      (dados.lancamentos || []).map(function (l) {
        var d = new Date(l.data);
        var semanaInicio = new Date(d);
        semanaInicio.setDate(semanaInicio.getDate() - (semanaInicio.getDay() === 0 ? 6 : semanaInicio.getDay() - 1));
        var semanaFim = new Date(semanaInicio);
        semanaFim.setDate(semanaFim.getDate() + 6);
        var fmt = function(dt) { return ("0" + dt.getDate()).slice(-2) + "/" + ("0" + (dt.getMonth() + 1)).slice(-2); };
        var semanaLabel = fmt(semanaInicio) + " a " + fmt(semanaFim);
        return [semanaLabel, l.data, l.cambista, l.positivo, l.percentual];
      })
    )
  );

  // Pagamentos com datas — apenas referência do site
  escreverAba(ss, "Pagamentos",
    [["Data", "Cambista", "Valor (R$)", "Obs"]].concat(
      (dados.pagamentos || []).map(function (p) {
        return [p.data, p.cambista, p.valor, p.obs];
      })
    )
  );

  escreverAba(ss, "GASTOS",
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
