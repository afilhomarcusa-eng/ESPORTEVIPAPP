/**
 * ESPORTEVIPAPP — sincroniza o site com a planilha (versão definitiva).
 *
 * REGRAS:
 *  - Mexe SOMENTE na aba COMISSÕES. Nunca cria nem altera outras abas (RESUMO fica intacta).
 *  - Preserva o título e o cabeçalho estilizado: acha o cabeçalho onde ele estiver
 *    e só reescreve as linhas de dados abaixo dele.
 *  - Lançamentos separados por SEMANA (mais recente primeiro), com a data na coluna F.
 *  - Pagamentos entram na coluna PAGAMENTO, em linha própria — NUNCA somem.
 *  - Gastos entram num bloco "GASTOS" no final (coluna A vazia, para o site
 *    nunca confundir gasto com cambista ao sincronizar de volta).
 *
 * INSTALAR: Extensões → Apps Script → apagar tudo → colar este código → Salvar →
 * Implantar → Gerenciar implantações → editar (lápis) → Implantar.
 */

var ABA = "COMISSÕES";
var COLS = 6; // A..F = NOME | MOVIMENTO | PERCENTUAL | RECEBER | PAGAMENTO | DATA

function doGet() {
  return resposta({ ok: true, ping: true }); // abrir o link no navegador testa a implantação
}

function doPost(e) {
  var dados = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);

  var headerRow = acharCabecalho(sh);
  garantirColunaData(sh, headerRow);

  var linhas = montarLinhas(dados);

  // Limpa SÓ as linhas de dados abaixo do cabeçalho (formatação e título ficam)
  var ultima = Math.max(sh.getLastRow(), headerRow);
  if (ultima > headerRow) {
    sh.getRange(headerRow + 1, 1, ultima - headerRow, Math.max(sh.getLastColumn(), COLS)).clearContent();
  }

  if (linhas.length) {
    // Coluna F (DATA) como texto para o Sheets não trocar o formato da data
    sh.getRange(headerRow + 1, COLS, linhas.length, 1).setNumberFormat("@");
    sh.getRange(headerRow + 1, 1, linhas.length, COLS).setValues(linhas);
  }

  return resposta({ ok: true, linhas: linhas.length, atualizadoEm: new Date().toISOString() });
}

/* ---------- montagem das linhas ---------- */

function montarLinhas(dados) {
  var cambistas = dados.cambistas || [];
  var lancs = dados.lancamentos || [];
  var pags = dados.pagamentos || [];
  var gastos = dados.gastos || [];

  // Agrupa lançamentos e pagamentos por semana (segunda a domingo) e por cambista
  var semanas = {}; // chave = time da segunda-feira
  function balde(dataStr) {
    var d = parseData(dataStr) || new Date();
    var seg = segundaDaSemana(d);
    var k = String(seg.getTime());
    if (!semanas[k]) {
      var fim = new Date(seg); fim.setDate(seg.getDate() + 6);
      semanas[k] = { seg: seg, rotulo: "SEMANA " + fmtDia(seg) + " A " + fmtDia(fim), porCambista: {} };
    }
    return semanas[k];
  }
  function slot(sem, nome) {
    if (!sem.porCambista[nome]) sem.porCambista[nome] = { lancs: [], pags: [] };
    return sem.porCambista[nome];
  }

  lancs.forEach(function (l) { slot(balde(l.data), String(l.cambista || "").trim()).lancs.push(l); });
  pags.forEach(function (p) { slot(balde(p.data), String(p.cambista || "").trim()).pags.push(p); });

  var linhas = [];
  var comMovimento = {};

  // Semanas da mais recente para a mais antiga
  Object.keys(semanas).sort(function (a, b) { return Number(b) - Number(a); }).forEach(function (k) {
    var sem = semanas[k];
    linhas.push(["", sem.rotulo, "", "", "", ""]); // rótulo com NOME vazio: o site ignora

    Object.keys(sem.porCambista).sort().forEach(function (nome) {
      if (!nome) return;
      comMovimento[nome.toLowerCase()] = true;
      var s = sem.porCambista[nome];
      s.lancs.forEach(function (l) {
        var pct = Number(l.percentual) || 0;
        var mov = Number(l.positivo) || 0;
        linhas.push([nome, mov, pct, mov - mov * pct, "", l.data || ""]);
      });
      s.pags.forEach(function (p) {
        linhas.push([nome, "", "", "", Number(p.valor) || 0, p.data || ""]);
      });
    });

    linhas.push(["", "", "", "", "", ""]); // linha em branco entre semanas
  });

  // Cambistas sem nenhum movimento: linha simples só com o nome (para não sumirem
  // do site caso alguém clique em Sincronizar)
  var semMovimento = cambistas.filter(function (c) {
    return c.nome && !comMovimento[String(c.nome).trim().toLowerCase()];
  });
  if (semMovimento.length) {
    linhas.push(["", "CAMBISTAS SEM MOVIMENTO NA SEMANA", "", "", "", ""]);
    semMovimento.forEach(function (c) { linhas.push([String(c.nome).trim(), "", "", "", "", ""]); });
    linhas.push(["", "", "", "", "", ""]);
  }

  // Bloco de gastos (coluna A SEMPRE vazia — o site ignora essas linhas ao sincronizar)
  if (gastos.length) {
    linhas.push(["", "GASTOS", "", "", "", ""]);
    linhas.push(["", "DATA", "CATEGORIA", "QUEM GASTOU", "DESCRIÇÃO", "VALOR"]);
    gastos.forEach(function (g) {
      linhas.push(["", g.data || "", g.categoria || "", g.responsavel || "", g.descricao || "", Number(g.valor) || 0]);
    });
  }

  return linhas;
}

/* ---------- utilitários ---------- */

// Acha a linha do cabeçalho (a que tem NOME e MOVIMENTO/POSITIVO), procurando nas 10 primeiras
function acharCabecalho(sh) {
  var n = Math.min(10, Math.max(sh.getLastRow(), 1));
  var valores = sh.getRange(1, 1, n, Math.max(sh.getLastColumn(), COLS)).getDisplayValues();
  for (var i = 0; i < valores.length; i++) {
    var up = valores[i].map(function (c) { return String(c).trim().toUpperCase(); });
    var temNome = up.some(function (c) { return c.slice(-4) === "NOME"; });
    var temMov = up.some(function (c) { return c.indexOf("MOVIMENTO") === 0 || c.indexOf("POSITIVO") === 0; });
    if (temNome && temMov) return i + 1;
  }
  // Não achou: cria um cabeçalho simples na linha 1
  sh.getRange(1, 1, 1, COLS).setValues([["NOME", "MOVIMENTO", "PERCENTUAL", "RECEBER", "PAGAMENTO", "DATA"]]);
  return 1;
}

// Garante o título DATA na coluna F do cabeçalho (o site usa essa coluna ao sincronizar)
function garantirColunaData(sh, headerRow) {
  var cel = sh.getRange(headerRow, COLS);
  if (String(cel.getDisplayValue()).trim() === "") cel.setValue("DATA");
}

function parseData(s) {
  var m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  var ano = m[3].length === 2 ? "20" + m[3] : m[3];
  return new Date(Number(ano), Number(m[2]) - 1, Number(m[1]));
}

function segundaDaSemana(d) {
  var x = new Date(d);
  var g = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - g);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDia(d) {
  return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2);
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
