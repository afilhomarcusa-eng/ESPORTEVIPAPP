/**
 * ESPORTEVIPAPP — sincroniza o site com a planilha (versão blindada).
 *
 * REGRAS:
 *  - Mexe SOMENTE na aba COMISSÕES. Nunca cria nem altera outras abas.
 *  - Acha o cabeçalho estilizado onde estiver e escreve cada valor NA COLUNA
 *    CERTA pelo rótulo (NOME/MOVIMENTO/PERCENTUAL/RECEBER/PAGAMENTO/DATA),
 *    não por posição fixa — funciona mesmo se as colunas estiverem em outra ordem.
 *  - LockService: dois envios ao mesmo tempo não corrompem a aba.
 *  - Lançamentos separados por SEMANA (mais recente primeiro), com data.
 *  - Pagamentos entram na coluna PAGAMENTO em linha própria — NUNCA somem.
 *  - Gastos entram num bloco "GASTOS" no final (coluna NOME vazia, para o site
 *    nunca confundir gasto com cambista ao sincronizar de volta).
 *
 * INSTALAR: Extensões → Apps Script → apagar tudo → colar este código → Salvar →
 * Implantar → Gerenciar implantações → editar (lápis) → Implantar.
 */

var ABA = "COMISSÕES";

function doGet() {
  return resposta({ ok: true, ping: true }); // abrir o link no navegador testa a implantação
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // envios simultâneos esperam em fila em vez de se atropelar
  try {
    var dados = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);

    var mapa = mapearCabecalho(sh); // { linha, col: {nome, mov, pct, receber, pag, data}, largura }
    var linhas = montarLinhas(dados, mapa);

    // Garante espaço na grade (abas com colunas/linhas excluídas quebravam o getRange)
    if (sh.getMaxColumns() < mapa.largura) sh.insertColumnsAfter(sh.getMaxColumns(), mapa.largura - sh.getMaxColumns());
    var precisa = mapa.linha + linhas.length;
    if (sh.getMaxRows() < precisa) sh.insertRowsAfter(sh.getMaxRows(), precisa - sh.getMaxRows());

    // Limpa SÓ as linhas de dados abaixo do cabeçalho (título e formatação ficam)
    var ultima = Math.max(sh.getLastRow(), mapa.linha);
    if (ultima > mapa.linha) {
      sh.getRange(mapa.linha + 1, 1, ultima - mapa.linha, sh.getMaxColumns()).clearContent();
    }

    if (linhas.length) {
      // Coluna DATA como texto para o Sheets não trocar dd/mm/aaaa de formato
      sh.getRange(mapa.linha + 1, mapa.col.data + 1, linhas.length, 1).setNumberFormat("@");
      sh.getRange(mapa.linha + 1, 1, linhas.length, mapa.largura).setValues(linhas);
    }

    return resposta({ ok: true, linhas: linhas.length, atualizadoEm: new Date().toISOString() });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- cabeçalho ---------- */

// Acha a linha do cabeçalho e o índice (base 0) de cada coluna pelo rótulo.
// Se a aba não tiver cabeçalho reconhecível, cria um simples na linha 1.
function mapearCabecalho(sh) {
  var maxCol = Math.max(sh.getMaxColumns(), 1);
  var n = Math.min(10, Math.max(sh.getLastRow(), 1));
  var valores = sh.getRange(1, 1, n, maxCol).getDisplayValues();

  for (var i = 0; i < valores.length; i++) {
    var up = valores[i].map(function (c) { return String(c).trim().toUpperCase(); });
    var iNome = -1, iMov = -1, iPct = -1, iReceber = -1, iPag = -1, iData = -1;
    for (var j = 0; j < up.length; j++) {
      var c = up[j];
      if (iNome === -1 && c.slice(-4) === "NOME") iNome = j;
      if (iMov === -1 && (c.indexOf("MOVIMENTO") === 0 || c.indexOf("POSITIVO") === 0)) iMov = j;
      if (iPct === -1 && c.indexOf("PERCENTUAL") === 0) iPct = j;
      if (iReceber === -1 && c.indexOf("RECEBER") === 0) iReceber = j;
      if (iPag === -1 && c.indexOf("PAGAMENTO") === 0) iPag = j;
      if (iData === -1 && c.indexOf("DATA") === 0) iData = j;
    }
    if (iNome !== -1 && iMov !== -1) {
      if (iPct === -1) iPct = iMov + 1;
      if (iReceber === -1) iReceber = iPct + 1;
      if (iPag === -1) iPag = iReceber + 1;
      if (iData === -1) {
        // Cria o rótulo DATA na primeira coluna livre depois das mapeadas
        iData = Math.max(iNome, iMov, iPct, iReceber, iPag) + 1;
        if (sh.getMaxColumns() < iData + 1) sh.insertColumnsAfter(sh.getMaxColumns(), iData + 1 - sh.getMaxColumns());
        var cel = sh.getRange(i + 1, iData + 1);
        if (String(cel.getDisplayValue()).trim() === "") cel.setValue("DATA");
      }
      var largura = Math.max(iNome, iMov, iPct, iReceber, iPag, iData) + 1;
      return { linha: i + 1, col: { nome: iNome, mov: iMov, pct: iPct, receber: iReceber, pag: iPag, data: iData }, largura: largura };
    }
  }

  sh.getRange(1, 1, 1, 6).setValues([["NOME", "MOVIMENTO", "PERCENTUAL", "RECEBER", "PAGAMENTO", "DATA"]]);
  return { linha: 1, col: { nome: 0, mov: 1, pct: 2, receber: 3, pag: 4, data: 5 }, largura: 6 };
}

/* ---------- montagem das linhas ---------- */

function montarLinhas(dados, mapa) {
  var cambistas = dados.cambistas || [];
  var lancs = dados.lancamentos || [];
  var pags = dados.pagamentos || [];
  var gastos = dados.gastos || [];

  function linhaVazia() {
    var l = [];
    for (var i = 0; i < mapa.largura; i++) l.push("");
    return l;
  }
  function linhaCom(preenche) { // preenche: função que recebe a linha e coloca valores
    var l = linhaVazia();
    preenche(l);
    return l;
  }

  var semanas = {};
  function balde(dataStr) {
    var d = parseData(dataStr) || new Date();
    var seg = segundaDaSemana(d);
    var k = String(seg.getTime());
    if (!semanas[k]) {
      var fim = new Date(seg); fim.setDate(seg.getDate() + 6);
      semanas[k] = { rotulo: "SEMANA " + fmtDia(seg) + " A " + fmtDia(fim), porCambista: {} };
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

  Object.keys(semanas).sort(function (a, b) { return Number(b) - Number(a); }).forEach(function (k) {
    var sem = semanas[k];
    linhas.push(linhaCom(function (l) { l[mapa.col.mov] = sem.rotulo; })); // NOME vazio: o site ignora

    Object.keys(sem.porCambista).sort().forEach(function (nome) {
      if (!nome) return;
      comMovimento[nome.toLowerCase()] = true;
      var s = sem.porCambista[nome];
      s.lancs.forEach(function (lc) {
        var pct = Number(lc.percentual) || 0;
        var mov = Number(lc.positivo) || 0;
        linhas.push(linhaCom(function (l) {
          l[mapa.col.nome] = nome;
          l[mapa.col.mov] = mov;
          l[mapa.col.pct] = pct;
          l[mapa.col.receber] = mov - mov * pct;
          l[mapa.col.data] = lc.data || "";
        }));
      });
      s.pags.forEach(function (p) {
        linhas.push(linhaCom(function (l) {
          l[mapa.col.nome] = nome;
          l[mapa.col.pag] = Number(p.valor) || 0;
          l[mapa.col.data] = p.data || "";
        }));
      });
    });

    linhas.push(linhaVazia()); // separador entre semanas
  });

  var semMovimento = cambistas.filter(function (c) {
    return c.nome && !comMovimento[String(c.nome).trim().toLowerCase()];
  });
  if (semMovimento.length) {
    linhas.push(linhaCom(function (l) { l[mapa.col.mov] = "CAMBISTAS SEM MOVIMENTO NA SEMANA"; }));
    semMovimento.forEach(function (c) {
      linhas.push(linhaCom(function (l) { l[mapa.col.nome] = String(c.nome).trim(); }));
    });
    linhas.push(linhaVazia());
  }

  // Bloco de gastos: coluna NOME sempre vazia — o site pula essas linhas no Sincronizar
  if (gastos.length) {
    var c1 = mapa.col.nome === 0 ? 1 : 0; // primeira coluna que não é a NOME
    linhas.push(linhaCom(function (l) { l[c1] = "GASTOS"; }));
    linhas.push(linhaCom(function (l) {
      var rot = ["DATA", "CATEGORIA", "QUEM GASTOU", "DESCRIÇÃO", "VALOR"];
      var col = 0;
      for (var i = 0; i < rot.length; i++) {
        while (col === mapa.col.nome) col++;
        if (col < mapa.largura) l[col] = rot[i];
        col++;
      }
    }));
    gastos.forEach(function (g) {
      linhas.push(linhaCom(function (l) {
        var vals = [g.data || "", g.categoria || "", g.responsavel || "", g.descricao || "", Number(g.valor) || 0];
        var col = 0;
        for (var i = 0; i < vals.length; i++) {
          while (col === mapa.col.nome) col++;
          if (col < mapa.largura) l[col] = vals[i];
          col++;
        }
      }));
    });
  }

  return linhas;
}

/* ---------- utilitários ---------- */

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
