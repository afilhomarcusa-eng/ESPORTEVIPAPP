/**
 * ESPORTEVIPAPP — sincroniza o site com a planilha (versão estilizada).
 *
 *  - Mexe SOMENTE na aba COMISSÕES.
 *  - Escreve pelos rótulos das colunas (NOME/MOVIMENTO/PERCENTUAL/RECEBER/PAGAMENTO/DATA).
 *  - LockService: envios simultâneos não se atropelam.
 *  - Lançamentos separados por SEMANA (mais recente primeiro), pagamentos preservados,
 *    gastos num bloco próprio no final.
 *  - APLICA O VISUAL sozinho a cada envio: cabeçalho escuro, faixas de semana,
 *    R$ e % formatados, gastos em âmbar, larguras de coluna e linha congelada.
 *
 * INSTALAR ATUALIZAÇÃO: colar → Salvar → Implantar → Gerenciar implantações →
 * lápis na implantação ATIVA → Versão: "Nova versão" → Implantar (o link não muda).
 */

var ABA = "COMISSÕES";

var COR = {
  cabecalhoFundo: "#0f172a", cabecalhoTexto: "#ffffff",
  semanaFundo: "#1e293b", semanaTexto: "#fb923c",
  linhaBorda: "#e2e8f0",
  pagamentoTexto: "#16a34a",
  gastoTituloFundo: "#b45309", gastoTituloTexto: "#ffffff",
  gastoLinhaFundo: "#fffbeb",
  semMovFundo: "#f1f5f9", semMovTexto: "#64748b",
};
var FMT_MOEDA = 'R$ #,##0.00;[RED]-R$ #,##0.00';
var FMT_PCT = "0%";

function doGet() {
  return resposta({ ok: true, ping: true });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var dados = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);

    var mapa = mapearCabecalho(sh);
    var r = montarLinhas(dados, mapa); // { linhas, tipos }

    if (sh.getMaxColumns() < mapa.largura) sh.insertColumnsAfter(sh.getMaxColumns(), mapa.largura - sh.getMaxColumns());
    var precisa = mapa.linha + r.linhas.length + 5;
    if (sh.getMaxRows() < precisa) sh.insertRowsAfter(sh.getMaxRows(), precisa - sh.getMaxRows());

    // Limpa conteúdo E formato das linhas de dados (o visual é reaplicado abaixo)
    var ultima = Math.max(sh.getLastRow(), mapa.linha);
    if (ultima > mapa.linha) {
      sh.getRange(mapa.linha + 1, 1, ultima - mapa.linha, sh.getMaxColumns()).clear({ contentsOnly: false, formatOnly: false });
    }

    if (r.linhas.length) {
      sh.getRange(mapa.linha + 1, mapa.col.data + 1, r.linhas.length, 1).setNumberFormat("@");
      sh.getRange(mapa.linha + 1, 1, r.linhas.length, mapa.largura).setValues(r.linhas);
    }

    estilizar(sh, mapa, r.tipos);

    return resposta({ ok: true, linhas: r.linhas.length, atualizadoEm: new Date().toISOString() });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- cabeçalho ---------- */

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

/* ---------- montagem das linhas (com o tipo de cada uma, para o visual) ---------- */

function montarLinhas(dados, mapa) {
  var cambistas = dados.cambistas || [];
  var lancs = dados.lancamentos || [];
  var pags = dados.pagamentos || [];
  var gastos = dados.gastos || [];

  var linhas = [];
  var tipos = []; // paralelo a linhas: semana | lanc | pag | vazio | semMovTitulo | semMov | gastoTitulo | gastoCab | gasto

  function linhaVazia() { var l = []; for (var i = 0; i < mapa.largura; i++) l.push(""); return l; }
  function add(tipo, preenche) {
    var l = linhaVazia();
    if (preenche) preenche(l);
    linhas.push(l); tipos.push(tipo);
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

  var comMovimento = {};

  Object.keys(semanas).sort(function (a, b) { return Number(b) - Number(a); }).forEach(function (k) {
    var sem = semanas[k];
    add("semana", function (l) { l[mapa.col.mov] = sem.rotulo; });

    Object.keys(sem.porCambista).sort().forEach(function (nome) {
      if (!nome) return;
      comMovimento[nome.toLowerCase()] = true;
      var s = sem.porCambista[nome];
      s.lancs.forEach(function (lc) {
        var pct = Number(lc.percentual) || 0;
        var mov = Number(lc.positivo) || 0;
        add("lanc", function (l) {
          l[mapa.col.nome] = nome;
          l[mapa.col.mov] = mov;
          l[mapa.col.pct] = pct;
          l[mapa.col.receber] = mov - mov * pct;
          l[mapa.col.data] = lc.data || "";
        });
      });
      s.pags.forEach(function (p) {
        add("pag", function (l) {
          l[mapa.col.nome] = nome;
          l[mapa.col.pag] = Number(p.valor) || 0;
          l[mapa.col.data] = p.data || "";
        });
      });
    });

    add("vazio");
  });

  var semMovimento = cambistas.filter(function (c) {
    return c.nome && !comMovimento[String(c.nome).trim().toLowerCase()];
  });
  if (semMovimento.length) {
    add("semMovTitulo", function (l) { l[mapa.col.mov] = "CAMBISTAS SEM MOVIMENTO NA SEMANA"; });
    semMovimento.forEach(function (c) {
      add("semMov", function (l) { l[mapa.col.nome] = String(c.nome).trim(); });
    });
    add("vazio");
  }

  if (gastos.length) {
    var c1 = mapa.col.nome === 0 ? 1 : 0;
    add("gastoTitulo", function (l) { l[c1] = "GASTOS"; });
    add("gastoCab", function (l) {
      var rot = ["DATA", "CATEGORIA", "QUEM GASTOU", "DESCRIÇÃO", "VALOR"];
      var col = 0;
      for (var i = 0; i < rot.length; i++) {
        while (col === mapa.col.nome) col++;
        if (col < mapa.largura) l[col] = rot[i];
        col++;
      }
    });
    gastos.forEach(function (g) {
      add("gasto", function (l) {
        var vals = [g.data || "", g.categoria || "", g.responsavel || "", g.descricao || "", Number(g.valor) || 0];
        var col = 0;
        for (var i = 0; i < vals.length; i++) {
          while (col === mapa.col.nome) col++;
          if (col < mapa.largura) l[col] = vals[i];
          col++;
        }
      });
    });
  }

  return { linhas: linhas, tipos: tipos };
}

/* ---------- visual ---------- */

function estilizar(sh, mapa, tipos) {
  var h = mapa.linha;
  var larg = mapa.largura;

  // Cabeçalho: fundo escuro, texto branco, centralizado, congelado
  var cab = sh.getRange(h, 1, 1, larg);
  cab.setBackground(COR.cabecalhoFundo).setFontColor(COR.cabecalhoTexto)
     .setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.setRowHeight(h, 34);
  sh.setFrozenRows(h);

  if (!tipos.length) return;

  // Junta os números de linha por tipo para formatar em lote (rápido)
  var porTipo = {};
  for (var i = 0; i < tipos.length; i++) {
    var t = tipos[i];
    if (!porTipo[t]) porTipo[t] = [];
    porTipo[t].push(h + 1 + i); // número real da linha na planilha
  }
  function faixas(tipo) {
    if (!porTipo[tipo]) return null;
    var a1 = porTipo[tipo].map(function (r) { return "A" + r + ":" + colLetra(larg) + r; });
    return sh.getRangeList(a1);
  }

  var dados_ = sh.getRange(h + 1, 1, tipos.length, larg);
  dados_.setVerticalAlignment("middle").setFontSize(10);

  // Faixa de semana: banda escura com texto laranja em negrito
  var fSem = faixas("semana");
  if (fSem) fSem.setBackground(COR.semanaFundo).setFontColor(COR.semanaTexto).setFontWeight("bold");

  // Lançamentos e pagamentos: R$ / % e borda inferior sutil
  var idx = { mov: mapa.col.mov + 1, pct: mapa.col.pct + 1, receber: mapa.col.receber + 1, pag: mapa.col.pag + 1 };
  (porTipo["lanc"] || []).forEach(function (r) {
    sh.getRange(r, idx.mov).setNumberFormat(FMT_MOEDA);
    sh.getRange(r, idx.receber).setNumberFormat(FMT_MOEDA);
    sh.getRange(r, idx.pct).setNumberFormat(FMT_PCT);
  });
  (porTipo["pag"] || []).forEach(function (r) {
    sh.getRange(r, idx.pag).setNumberFormat(FMT_MOEDA).setFontColor(COR.pagamentoTexto).setFontWeight("bold");
  });
  var fLinhas = faixas("lanc");
  if (fLinhas) fLinhas.setBorder(null, null, true, null, null, null, COR.linhaBorda, SpreadsheetApp.BorderStyle.SOLID);
  var fPag = faixas("pag");
  if (fPag) fPag.setBorder(null, null, true, null, null, null, COR.linhaBorda, SpreadsheetApp.BorderStyle.SOLID);

  // Nome em negrito nas linhas de dados
  var nomes = (porTipo["lanc"] || []).concat(porTipo["pag"] || []);
  nomes.forEach(function (r) { sh.getRange(r, mapa.col.nome + 1).setFontWeight("bold"); });

  // Cambistas sem movimento: cinza discreto em itálico
  var fSemMovT = faixas("semMovTitulo");
  if (fSemMovT) fSemMovT.setBackground(COR.semMovFundo).setFontColor(COR.semMovTexto).setFontStyle("italic").setFontWeight("bold");
  var fSemMov = faixas("semMov");
  if (fSemMov) fSemMov.setFontColor(COR.semMovTexto).setFontStyle("italic");

  // Gastos: título âmbar, cabeçalho em negrito, linhas com fundo creme e VALOR em R$
  var fGT = faixas("gastoTitulo");
  if (fGT) fGT.setBackground(COR.gastoTituloFundo).setFontColor(COR.gastoTituloTexto).setFontWeight("bold");
  var fGC = faixas("gastoCab");
  if (fGC) fGC.setBackground(COR.gastoLinhaFundo).setFontWeight("bold");
  var fG = faixas("gasto");
  if (fG) fG.setBackground(COR.gastoLinhaFundo);
  (porTipo["gasto"] || []).forEach(function (r) {
    sh.getRange(r, larg).setNumberFormat(FMT_MOEDA); // VALOR fica na última coluna do bloco
  });

  // Larguras das colunas
  sh.setColumnWidth(mapa.col.nome + 1, 150);
  sh.setColumnWidth(mapa.col.mov + 1, 170);
  sh.setColumnWidth(mapa.col.pct + 1, 100);
  sh.setColumnWidth(mapa.col.receber + 1, 130);
  sh.setColumnWidth(mapa.col.pag + 1, 130);
  sh.setColumnWidth(mapa.col.data + 1, 110);
}

function colLetra(n) {
  var s = "";
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
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
