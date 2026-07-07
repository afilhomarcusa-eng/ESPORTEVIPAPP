import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, Users, DollarSign, FileText, TrendingUp, TrendingDown,
  Plus, Trash2, Pencil, X, Check, AlertTriangle, ChevronLeft,
  ChevronRight, Wallet, Percent, Coins, RotateCcw, Search, Circle,
  FileSpreadsheet, Target, Banknote, Clock, CheckCircle2, Trophy, Upload, Printer, Send,
  Calendar, BarChart3, Loader2, Inbox, CheckCircle, XCircle, Info, MoreVertical, Eye, EyeOff, Lock,
  Link2, RefreshCw,
} from "lucide-react";

/* ======================== UTILITÁRIOS ======================== */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const brl = (n) =>
  (n < 0 ? "-" : "") +
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(n || 0));
const numFmt = (n) => Math.abs(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const fmtEixo = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};
const toNum = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtData = (s) => parse(s).toLocaleDateString("pt-BR");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_L = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CORES_LARANJA = ["#f97316","#fb923c","#fed7aa","#0ea5e9","#8b5cf6","#e11d48","#14b8a6","#ec4899","#84cc16","#6366f1"];
const CATEGORIAS_GASTOS = ["Alimentação", "Transporte", "Infraestrutura", "Marketing", "Comissões", "Outros"];

/* ======================== TOKENS DE DESIGN ======================== */
// Cores centralizadas para uso em Recharts (stroke/fill exigem hex, não aceitam classes Tailwind)
const THEME_CHART = {
  positivo: "#16a34a",
  negativo: "#e11d48",
  neutro: "#94a3b8",
  aviso: "#f59e0b",
  primario: "#f97316",
  grid: "#eef2f7",
};
const CHART_TOOLTIP_STYLE = { borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px -2px rgb(15 23 42 / 0.08)" };
const CHART_AXIS_TICK = { fontSize: 11, fill: "#94a3b8" };

/* ======================== VALIDAÇÕES ======================== */
const validarTelefone = (tel) => {
  if (!tel) return true;
  const cleaned = tel.replace(/\D/g, "");
  return cleaned.length === 11 || cleaned.length === 13;
};

const validarComissao = (pct) => {
  const n = toNum(pct);
  return n >= 0 && n <= 1;
};

const validarEmail = (email) => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/* ======================== AUDITORIA ======================== */
const registrarAuditoria = (acao, detalhes) => {
  const timestamp = new Date().toISOString();
  const log = { timestamp, acao, detalhes };
  const logs = JSON.parse(localStorage.getItem("auditoria") || "[]");
  logs.push(log);
  if (logs.length > 1000) logs.shift();
  localStorage.setItem("auditoria", JSON.stringify(logs));
};

/* ======================== PERÍODOS E DATAS ======================== */
function startOfWeek(d) { const x = new Date(d); const g = (x.getDay() + 6) % 7; x.setDate(x.getDate() - g); x.setHours(0,0,0,0); return x; }
function periodRange(gran, ref) {
  const d = new Date(ref);
  if (gran === "semana") { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; }
  if (gran === "quinzena") {
    const primeira = d.getDate() <= 15;
    const s = new Date(d.getFullYear(), d.getMonth(), primeira ? 1 : 16);
    const e = primeira ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return [s, e];
  }
  if (gran === "mes") return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)];
  if (gran === "ano") return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear(), 11, 31)];
  return [new Date(2000,0,1), new Date(2999,0,1)];
}
function shiftRef(gran, ref, dir) {
  const d = new Date(ref);
  if (gran === "semana") d.setDate(d.getDate() + dir * 7);
  else if (gran === "quinzena") d.setDate(d.getDate() + dir * 15);
  else if (gran === "mes") d.setMonth(d.getMonth() + dir);
  else if (gran === "ano") d.setFullYear(d.getFullYear() + dir);
  return d;
}
function rotuloPeriodo(gran, ref) {
  if (gran === "tudo") return "Todo o Período";
  const [s, e] = periodRange(gran, ref);
  if (gran === "ano") return `${ref.getFullYear()}`;
  if (gran === "mes") return `${MESES_L[ref.getMonth()]} de ${ref.getFullYear()}`;
  return `${pad(s.getDate())}/${pad(s.getMonth()+1)} a ${pad(e.getDate())}/${pad(e.getMonth()+1)}`;
}
function isoDatesForPeriod(gran, ref) {
  const [s, e] = periodRange(gran, ref);
  return [iso(s), iso(e)];
}

function rotuloCurto(g, r) {
  if (g === "ano") return `${r.getFullYear()}`;
  if (g === "mes") return `${MESES[r.getMonth()]}/${String(r.getFullYear()).slice(2)}`;
  const [s] = periodRange(g, r); return `${pad(s.getDate())}/${pad(s.getMonth()+1)}`;
}

/* ======================== CÁLCULOS ======================== */
function comissaoDaLanc(l, cambista) { return l.pct != null ? l.pct : (cambista ? cambista.comissaoPadrao : 0); }
function calcLanc(l, cambista) {
  const p = comissaoDaLanc(l, cambista);
  const comissao = l.positivo * p;
  return { pct: p, comissao, receber: l.positivo - comissao };
}
function agrega(lancs, cambById) {
  let bruto = 0, comissao = 0, receber = 0, mov = 0;
  for (const l of lancs) {
    const c = calcLanc(l, cambById[l.cambistaId]);
    bruto += l.positivo; comissao += c.comissao; receber += c.receber;
    if (l.movimentacao) mov += l.movimentacao;
  }
  return { bruto, comissao, receber, n: lancs.length, mov, holdMedio: mov > 0 ? receber / mov : null };
}
const dentro = (l, s, e) => { const d = parse(l.data); return d >= s && d <= e; };

function metaDoPeriodo(metaMensal, gran) {
  if (!metaMensal) return null;
  if (gran === "semana") return metaMensal / 4.345;
  if (gran === "quinzena") return metaMensal / 2;
  if (gran === "mes") return metaMensal;
  if (gran === "ano") return metaMensal * 12;
  return null;
}

/* ======================== ANÁLISE HISTÓRICA ======================== */
const ANALISE_THRESHOLDS = {
  desviosPadrao: 2,
  percentualMinimoVariacao: 0.1,
  toleranciaValorRedondo: 0.01,
  minSemanasParaAnalise: 4,
  maxInatividade: 4,
  alertaCriterioDia: 1,
};

function semanasHistorico(cambista, lancamentos, pagamentos) {
  if (!cambista) return [];
  const semanas = {};
  const todosLancs = lancamentos.filter((l) => l.cambistaId === cambista.id);
  const todosPagtos = pagamentos.filter((p) => p.cambistaId === cambista.id);

  for (const lanc of todosLancs) {
    const data = parse(lanc.data);
    const [s, e] = periodRange("semana", data);
    const chave = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
    if (!semanas[chave]) semanas[chave] = { s, e, lancs: [], pagtos: [], dias: new Set() };
    semanas[chave].lancs.push(lanc);
    semanas[chave].dias.add(data.getDate());
  }

  for (const pagto of todosPagtos) {
    const data = parse(pagto.data);
    const [s, e] = periodRange("semana", data);
    const chave = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
    if (!semanas[chave]) semanas[chave] = { s, e, lancs: [], pagtos: [], dias: new Set() };
    semanas[chave].pagtos.push(pagto);
  }

  return Object.entries(semanas)
    .map(([chave, s]) => ({ chave, ...s, diasAtivos: s.dias.size, agreAgrega: agrega(s.lancs, { [cambista.id]: cambista }) }))
    .sort((a, b) => a.s - b.s);
}

function calcularEstatisticas(valores) {
  if (valores.length === 0) return { media: 0, desvPadrao: 0, min: 0, max: 0 };
  const media = valores.reduce((a, v) => a + v, 0) / valores.length;
  const variancia = valores.reduce((a, v) => a + Math.pow(v - media, 2), 0) / valores.length;
  const desvPadrao = Math.sqrt(variancia);
  return { media, desvPadrao, min: Math.min(...valores), max: Math.max(...valores) };
}

function analiseAnomalias(semanas, cambista) {
  const alertas = [];
  if (semanas.length < ANALISE_THRESHOLDS.minSemanasParaAnalise) {
    return [{ tipo: "aviso", severidade: "baixo", titulo: "Histórico curto", descricao: `Apenas ${semanas.length} semanas de dados. Análise com baixa confiança estatística.` }];
  }

  const brutons = semanas.map((s) => s.agreAgrega.bruto);
  const pagtos = semanas.map((s) => s.agreAgrega.comissao);
  const razaoPagtoComissao = semanas.map((s) => s.agreAgrega.comissao > 0 ? 0 : (s.pagtos.reduce((a, p) => a + p.valor, 0) / Math.max(1, s.agreAgrega.comissao)));

  const estatBruto = calcularEstatisticas(brutons);

  // Detecção de outliers
  for (let i = 0; i < semanas.length; i++) {
    const bruto = brutons[i];
    const zScore = (bruto - estatBruto.media) / Math.max(0.01, estatBruto.desvPadrao);
    if (Math.abs(zScore) > ANALISE_THRESHOLDS.desviosPadrao) {
      alertas.push({
        tipo: "outlier",
        severidade: bruto < estatBruto.media ? "alto" : "medio",
        semana: semanas[i],
        titulo: bruto < estatBruto.media ? "Semana com bruto anormalmente baixo" : "Semana com bruto anormalmente alto",
        descricao: `Semana ${i + 1}: ${brl(bruto)} (${(zScore > 0 ? "+" : "")}${zScore.toFixed(2)} desvios). Esperado: ${brl(estatBruto.media)} ± ${brl(estatBruto.desvPadrao)}`,
        valor: bruto,
      });
    }
  }

  // Valores redondos suspeitos
  const valoresRedondos = semanas.filter((s) => {
    const bruto = s.agreAgrega.bruto;
    return bruto > 0 && Math.abs(bruto - Math.round(bruto / 100) * 100) < ANALISE_THRESHOLDS.toleranciaValorRedondo * 1000;
  });
  if (valoresRedondos.length > 2) {
    alertas.push({
      tipo: "valoresRedondos",
      severidade: "medio",
      titulo: "Padrão de valores redondos detectado",
      descricao: `${valoresRedondos.length} semanas com valores redondos. Semanas: ${valoresRedondos.map((s, i) => `${i + 1}`).join(", ")}`,
      semanas: valoresRedondos,
    });
  }

  // Tendência de declínio
  if (brutons.length >= 4) {
    const primeiraMetade = brutons.slice(0, Math.floor(brutons.length / 2)).reduce((a, v) => a + v, 0) / Math.floor(brutons.length / 2);
    const segundaMetade = brutons.slice(Math.floor(brutons.length / 2)).reduce((a, v) => a + v, 0) / Math.ceil(brutons.length / 2);
    const percentualQueda = ((primeiraMetade - segundaMetade) / Math.max(1, primeiraMetade)) * 100;
    if (percentualQueda > ANALISE_THRESHOLDS.percentualMinimoVariacao * 100) {
      alertas.push({
        tipo: "tendencia",
        severidade: percentualQueda > 30 ? "alto" : "medio",
        titulo: "Tendência de declínio de bruto",
        descricao: `${percentualQueda.toFixed(1)}% de queda do bruto. Primeira metade: ${brl(primeiraMetade)}, segunda metade: ${brl(segundaMetade)}`,
        percentual: percentualQueda,
      });
    }
  }

  // Inatividade
  const sequenciaInatividade = [];
  let atual = 0;
  for (const s of semanas) {
    if (s.agreAgrega.bruto < 0.01) {
      atual++;
      if (atual > ANALISE_THRESHOLDS.maxInatividade) {
        sequenciaInatividade.push({ semana: s, duracao: atual });
      }
    } else atual = 0;
  }
  if (sequenciaInatividade.length > 0) {
    alertas.push({
      tipo: "inatividade",
      severidade: "medio",
      titulo: "Períodos longos de inatividade",
      descricao: `Detectadas ${sequenciaInatividade.length} sequência(s) com mais de ${ANALISE_THRESHOLDS.maxInatividade} semanas inativas`,
      sequencias: sequenciaInatividade,
    });
  }

  // Débito recorrente
  const semanasDevedor = semanas.filter((s) => s.agreAgrega.receber < -0.01);
  if (semanasDevedor.length > semanas.length * 0.3) {
    alertas.push({
      tipo: "devedorRecorrente",
      severidade: "alto",
      titulo: "Cambista frequentemente em débito",
      descricao: `${semanasDevedor.length}/${semanas.length} semanas (${(semanasDevedor.length / semanas.length * 100).toFixed(1)}%) com recebível negativo (cambista em débito com a casa)`,
      semanas: semanasDevedor,
    });
  }

  return alertas;
}

function calcularScoreHistorico(semanas, cambista) {
  if (semanas.length < 1) return 0;

  let score = 50;
  const brutons = semanas.map((s) => s.agreAgrega.bruto);
  const pagtos = semanas.map((s) => s.agreAgrega.comissao > 0 ? 1 : 0);

  // Volume (0-20 pts)
  const volumeTotal = brutons.reduce((a, v) => a + v, 0);
  score += Math.min(20, (volumeTotal / 100000) * 20);

  // Consistência (0-20 pts)
  const estat = calcularEstatisticas(brutons);
  const cv = estat.media > 0 ? (estat.desvPadrao / estat.media) : 0;
  score += Math.max(0, 20 - cv * 10);

  // Pontualidade (0-20 pts)
  const pctPago = pagtos.reduce((a, v) => a + v, 0) / pagtos.length;
  score += pctPago * 20;

  // Tendência (0-20 pts)
  if (semanas.length >= 2) {
    const ultimoTerco = brutons.slice(-Math.ceil(brutons.length / 3));
    const mediaUltimo = ultimoTerco.reduce((a, v) => a + v, 0) / ultimoTerco.length;
    if (mediaUltimo > estat.media) score += 20;
    else if (mediaUltimo < estat.media * 0.8) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function classificarRisco(score) {
  // classeBadge precisa ser o nome completo da classe: Tailwind não gera classes montadas dinamicamente
  if (score >= 75) return { classificacao: "Confiável", cor: "emerald", classeBadge: "bg-emerald-600" };
  if (score >= 50) return { classificacao: "Atenção", cor: "amber", classeBadge: "bg-amber-600" };
  return { classificacao: "Alto Risco", cor: "rose", classeBadge: "bg-rose-600" };
}

/* ======================== ANÁLISE DE GASTOS ======================== */
const GASTOS_THRESHOLDS = {
  desviosPadrao: 2,
  percentualCrescimento: 0.2,
  toleranciaValorRedondo: 0.01,
  minMesesParaAnalise: 3,
  limiteGastoPercent: 80,
};

function agrupamentoPorMes(gastos) {
  const grupos = {};
  for (const g of gastos) {
    const data = parse(g.data);
    const mes = `${data.getFullYear()}-${pad(data.getMonth() + 1)}`;
    if (!grupos[mes]) grupos[mes] = { data: new Date(data.getFullYear(), data.getMonth(), 1), gastos: [] };
    grupos[mes].gastos.push(g);
  }
  return Object.entries(grupos)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, g]) => ({ mes, ...g, total: g.gastos.reduce((a, x) => a + x.valor, 0) }));
}

function analisarGastos(gastos) {
  if (!gastos || gastos.length === 0) return { meses: [], alertas: [] };

  const meses = agrupamentoPorMes(gastos);
  if (meses.length < GASTOS_THRESHOLDS.minMesesParaAnalise) {
    return {
      meses,
      alertas: [{ tipo: "aviso", severidade: "baixo", titulo: "Histórico curto", descricao: `Apenas ${meses.length} meses de dados. Análise com baixa confiança estatística.` }],
    };
  }

  const alertas = [];
  const totais = meses.map((m) => m.total);
  const estat = calcularEstatisticas(totais);

  for (let i = 0; i < meses.length; i++) {
    const zScore = (totais[i] - estat.media) / Math.max(0.01, estat.desvPadrao);
    if (Math.abs(zScore) > GASTOS_THRESHOLDS.desviosPadrao) {
      alertas.push({
        tipo: "outlierMes",
        severidade: totais[i] > estat.media ? "medio" : "alto",
        mes: meses[i],
        titulo: totais[i] > estat.media ? "Mês com gasto anormalmente alto" : "Mês com gasto anormalmente baixo",
        descricao: `Mês ${meses[i].mes}: ${brl(totais[i])} (${(zScore > 0 ? "+" : "")}${zScore.toFixed(2)} desvios). Esperado: ${brl(estat.media)} ± ${brl(estat.desvPadrao)}`,
        valor: totais[i],
      });
    }

    if (i > 0) {
      const variacao = (totais[i] - totais[i - 1]) / Math.max(0.01, totais[i - 1]);
      if (Math.abs(variacao) > GASTOS_THRESHOLDS.percentualCrescimento) {
        alertas.push({
          tipo: "pico",
          severidade: variacao > 0 ? "medio" : "baixo",
          titulo: variacao > 0 ? "Pico abrupto de gastos" : "Queda abrupta de gastos",
          descricao: `${meses[i].mes} vs ${meses[i - 1].mes}: ${variacao > 0 ? "+" : ""}${(variacao * 100).toFixed(1)}% (de ${brl(totais[i - 1])} para ${brl(totais[i])})`,
          mes: meses[i],
          percentual: variacao * 100,
        });
      }
    }
  }

  for (const categoria of CATEGORIAS_GASTOS) {
    const gastosCat = meses.map((m) => m.gastos.filter((g) => g.categoria === categoria).reduce((a, x) => a + x.valor, 0));
    const naoZero = gastosCat.filter((v) => v > 0);
    if (naoZero.length < 2) continue;

    const estatCat = calcularEstatisticas(naoZero);
    for (let i = 0; i < gastosCat.length; i++) {
      if (gastosCat[i] === 0) continue;
      const z = (gastosCat[i] - estatCat.media) / Math.max(0.01, estatCat.desvPadrao);
      if (z > GASTOS_THRESHOLDS.desviosPadrao) {
        alertas.push({
          tipo: "picoCategoria",
          severidade: "medio",
          titulo: `${categoria} com pico anormal`,
          descricao: `${meses[i].mes}: ${brl(gastosCat[i])} (${(z).toFixed(2)} desvios acima da média)`,
          mes: meses[i],
          categoria,
          valor: gastosCat[i],
        });
      }
    }
  }

  const valoresRedondos = meses.flatMap((m) =>
    m.gastos.filter((g) => Math.abs(g.valor - Math.round(g.valor / 100) * 100) < 1).map((g) => ({ ...g, mes: m.mes }))
  );
  if (valoresRedondos.length > gastos.length * 0.3) {
    alertas.push({
      tipo: "valoresRedondos",
      severidade: "baixo",
      titulo: "Padrão anormal de valores redondos",
      descricao: `${valoresRedondos.length} de ${gastos.length} gastos (${(valoresRedondos.length / gastos.length * 100).toFixed(1)}%) com valores redondos`,
      gastos: valoresRedondos.slice(0, 5),
    });
  }

  const gastosSemDesc = gastos.filter((g) => !g.descricao || g.descricao.trim().length < 3);
  if (gastosSemDesc.length > 0) {
    alertas.push({
      tipo: "semDescricao",
      severidade: "baixo",
      titulo: "Gastos sem descrição adequada",
      descricao: `${gastosSemDesc.length} gastos sem descrição ou com descrição muito curta`,
      count: gastosSemDesc.length,
    });
  }

  if (totais.length >= 3) {
    const primeiroTerco = totais.slice(0, Math.floor(totais.length / 3)).reduce((a, v) => a + v, 0) / Math.floor(totais.length / 3);
    const ultimoTerco = totais.slice(-Math.ceil(totais.length / 3)).reduce((a, v) => a + v, 0) / Math.ceil(totais.length / 3);
    const crescimento = (ultimoTerco - primeiroTerco) / Math.max(0.01, primeiroTerco);
    if (crescimento > GASTOS_THRESHOLDS.percentualCrescimento) {
      alertas.push({
        tipo: "tendenciaCrescente",
        severidade: crescimento > 0.5 ? "alto" : "medio",
        titulo: "Tendência sustentada de crescimento de gastos",
        descricao: `Crescimento de ${(crescimento * 100).toFixed(1)}% ao longo do período (primeiro terço: ${brl(primeiroTerco)}, último terço: ${brl(ultimoTerco)})`,
        percentual: crescimento * 100,
      });
    }
  }

  return { meses, alertas };
}

function calcularEficiencia(meses, cambistas, lancamentos, pagamentos) {
  const eficiencias = [];

  for (const mes of meses) {
    const gastosMes = mes.total;

    const lancsMes = lancamentos.filter((l) => {
      const dataL = parse(l.data);
      return dataL.getFullYear() === mes.data.getFullYear() && dataL.getMonth() === mes.data.getMonth();
    });

    const pagtosMes = pagamentos.filter((p) => {
      const dataP = parse(p.data);
      return dataP.getFullYear() === mes.data.getFullYear() && dataP.getMonth() === mes.data.getMonth();
    });

    let brutoMes = lancsMes.reduce((a, l) => a + l.positivo, 0);
    let comissaoMes = 0;
    let pagoMes = pagtosMes.reduce((a, p) => a + p.valor, 0);

    for (const l of lancsMes) {
      const c = cambistas.find((x) => x.id === l.cambistaId);
      const p = l.pct != null ? l.pct : (c ? c.comissaoPadrao : 0);
      comissaoMes += l.positivo * p;
    }

    const liquido = brutoMes - comissaoMes;
    const percentualGasto = liquido > 0 ? (gastosMes / liquido) * 100 : 0;

    eficiencias.push({
      mes: mes.mes,
      gastos: gastosMes,
      liquido,
      percentualGasto,
      alerta: percentualGasto > GASTOS_THRESHOLDS.limiteGastoPercent,
    });
  }

  return eficiencias;
}

function calcularProjecao(meses) {
  if (meses.length < 2) return null;
  const totais = meses.map((m) => m.total);
  const n = totais.length;
  const mediaX = (n - 1) / 2;
  const mediaY = totais.reduce((a, v) => a + v, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i - mediaX;
    const y = totais[i] - mediaY;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = sumX2 !== 0 ? sumXY / sumX2 : 0;
  const intercept = mediaY - slope * mediaX;
  const proximoMes = intercept + slope * n;

  return { proximoMes: Math.max(0, proximoMes), slope };
}

function cambistasInativos(cambistas, lancamentos, limite = 7) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return cambistas.filter((c) => c.ativo).map((c) => {
    const ls = lancamentos.filter((l) => l.cambistaId === c.id);
    if (!ls.length) return { cambista: c, dias: Infinity };
    const last = ls.reduce((m, l) => (l.data > m ? l.data : m), ls[0].data);
    const dias = Math.round((hoje - parse(last)) / 86400000);
    return { cambista: c, dias };
  }).filter((x) => x.dias >= limite);
}

/* ======================== DADOS DE EXEMPLO ======================== */
function seed() {
  const cambistas = [
    { id: "c1", nome: "Ana", contato: "(11) 90000-0001", comissaoPadrao: 0.10, ativo: true, criadoEm: iso(new Date()) },
    { id: "c2", nome: "João", contato: "(11) 90000-0002", comissaoPadrao: 0.15, ativo: true, criadoEm: iso(new Date()) },
    { id: "c3", nome: "Flávio", contato: "(11) 90000-0003", comissaoPadrao: 0.20, ativo: true, criadoEm: iso(new Date()) },
    { id: "c4", nome: "Antônio", contato: "(11) 90000-0004", comissaoPadrao: 0.10, ativo: true, criadoEm: iso(new Date()) },
  ];
  const perfil = { c1: 260, c2: 150, c3: -80, c4: 190 };
  const lancamentos = [];
  const hoje = new Date();
  for (let dia = 90; dia >= 0; dia -= 1) {
    const data = new Date(hoje); data.setDate(hoje.getDate() - dia);
    if (data.getDay() === 0) continue;
    for (const c of cambistas) {
      if (c.id === "c4" && dia < 12) continue;
      if (Math.random() < 0.4) continue;
      const base = perfil[c.id];
      const ruido = (Math.random() - 0.45) * 600;
      const positivo = Math.round((base + ruido) / 10) * 10;
      if (positivo === 0) continue;
      const hold = 0.07 + Math.random() * 0.08;
      const movimentacao = Math.round(Math.abs(positivo) / hold / 10) * 10;
      lancamentos.push({ id: uid(), cambistaId: c.id, data: iso(data), positivo, movimentacao, obs: "" });
    }
  }
  const pagamentos = [
    { id: uid(), cambistaId: "c3", data: iso(new Date(Date.now() - 5 * 86400000)), valor: 200, obs: "pix" },
    { id: uid(), cambistaId: "c1", data: iso(new Date(Date.now() - 12 * 86400000)), valor: 300, obs: "dinheiro" },
  ];
  const gastos = [];
  for (let dia = 60; dia >= 0; dia -= 2) {
    const data = new Date(hoje); data.setDate(hoje.getDate() - dia);
    const categorias = ["Alimentação", "Transporte", "Infraestrutura", "Marketing"];
    for (const cat of categorias) {
      if (Math.random() < 0.5) continue;
      const valor = Math.round(Math.random() * 500 + 50);
      gastos.push({ id: uid(), categoria: cat, descricao: `Despesa de ${cat.toLowerCase()}`, valor, data: iso(data) });
    }
  }
  return { cambistas, lancamentos, pagamentos, gastos, metaMensal: 10000, exemplo: true, version: 4 };
}

/* ======================== ARMAZENAMENTO ======================== */
const KEY = "esportevipapp:v1";
async function loadDB() {
  let db = null;
  try { const r = await window.storage.get(KEY); if (r && r.value) db = JSON.parse(r.value); } catch (e) {}
  if (!db) { db = seed(); try { await window.storage.set(KEY, JSON.stringify(db)); } catch (e) {} }
  if (!db.pagamentos) db.pagamentos = [];
  if (!db.gastos) db.gastos = [];
  if (db.metaMensal == null) db.metaMensal = 10000;
  if (db.planilhaUrl == null) db.planilhaUrl = "";
  if (db.planilhaUltimaSync == null) db.planilhaUltimaSync = "";
  return db;
}
async function saveDB(db) { try { await window.storage.set(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }

/* ======================== EXPORTAÇÃO EXCEL ======================== */
function exportarExcel({ db, incluirGastos = true }) {
  const wb = XLSX.utils.book_new();
  const MOEDA = 'R$ #,##0.00;[RED]-R$ #,##0.00;"-"';
  const cambById = Object.fromEntries(db.cambistas.map((c) => [c.id, c]));

  const lancs = [...db.lancamentos].sort((a, b) => a.data.localeCompare(b.data));
  const lHead = ["Data", "Cambista", "Positivo (R$)", "Percentual", "Valor Efetivo (R$)", "Receber (R$)"];
  const lRows = lancs.map((l) => {
    const c = cambById[l.cambistaId];
    const p = l.pct != null ? l.pct : (c ? c.comissaoPadrao : 0);
    return [parse(l.data), c?.nome || "", l.positivo, p, null, null];
  });
  const wsL = XLSX.utils.aoa_to_sheet([lHead, ...lRows]);
  lRows.forEach((row, i) => {
    const r = i + 2;
    // SheetJS CE descarta células de fórmula sem valor cacheado (v) ao gravar o .xlsx —
    // o v precisa vir junto, senão as colunas E/F chegam vazias no Excel
    const efetivo = row[2] * row[3];
    wsL[`E${r}`] = { t: "n", v: efetivo, f: `C${r}*D${r}`, z: MOEDA };
    wsL[`F${r}`] = { t: "n", v: row[2] - efetivo, f: `C${r}-E${r}`, z: MOEDA };
    if (wsL[`A${r}`]) wsL[`A${r}`].z = "dd/mm/yyyy";
    if (wsL[`C${r}`]) wsL[`C${r}`].z = MOEDA;
    if (wsL[`D${r}`]) wsL[`D${r}`].z = "0.0%";
  });
  wsL["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 11 }, { wch: 16 }, { wch: 14 }];
  wsL["!ref"] = `A1:F${Math.max(lRows.length + 1, 1)}`;
  XLSX.utils.book_append_sheet(wb, wsL, "Lancamentos");

  const cHead = ["Nome", "Contato", "Comissao Padrao", "Ativo"];
  const cRows = db.cambistas.map((c) => [c.nome, c.contato || "", c.comissaoPadrao, c.ativo ? "Sim" : "Nao"]);
  const wsC = XLSX.utils.aoa_to_sheet([cHead, ...cRows]);
  cRows.forEach((_, i) => { const r = i + 2; if (wsC[`C${r}`]) wsC[`C${r}`].z = "0.0%"; });
  wsC["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsC, "Cambistas");

  const pHead = ["Data", "Cambista", "Valor (R$)", "Obs"];
  const pRows = (db.pagamentos || []).map((p) => [parse(p.data), cambById[p.cambistaId]?.nome || "", p.valor, p.obs || ""]);
  const wsP = XLSX.utils.aoa_to_sheet([pHead, ...pRows]);
  pRows.forEach((_, i) => { const r = i + 2; if (wsP[`A${r}`]) wsP[`A${r}`].z = "dd/mm/yyyy"; if (wsP[`C${r}`]) wsP[`C${r}`].z = MOEDA; });
  wsP["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsP, "Pagamentos");

  if (incluirGastos) {
    const gHead = ["Data", "Categoria", "Responsável", "Descrição", "Valor (R$)"];
    const gRows = (db.gastos || []).map((g) => [parse(g.data), g.categoria || "", g.responsavel || "", g.descricao || "", g.valor]);
    const wsG = XLSX.utils.aoa_to_sheet([gHead, ...gRows]);
    gRows.forEach((_, i) => { const r = i + 2; if (wsG[`A${r}`]) wsG[`A${r}`].z = "dd/mm/yyyy"; if (wsG[`E${r}`]) wsG[`E${r}`].z = MOEDA; });
    wsG["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsG, "Gastos");
  }

  XLSX.writeFile(wb, `esportevipapp-${incluirGastos ? "" : "fechamento-"}${iso(new Date())}.xlsx`);
}

function importarExcel(file, update, aoTerminar) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
      const wsC = wb.Sheets["Cambistas"];
      const wsL = wb.Sheets["Lancamentos"] || wb.Sheets["Lançamentos"];
      if (!wsC || !wsL) { toast('A planilha precisa ter as abas "Cambistas" e "Lancamentos", no mesmo modelo exportado pelo sistema.', "error"); return; }
      const cRows = XLSX.utils.sheet_to_json(wsC, { defval: "" });
      const lRows = XLSX.utils.sheet_to_json(wsL, { defval: "" });
      update((d) => {
        // Reaproveita o id de cambistas com mesmo nome para não orfanar os pagamentos já registrados
        const idAntigoPorNome = Object.fromEntries((d.cambistas || []).map((c) => [c.nome.trim().toLowerCase(), c.id]));
        const idPorNome = {};
        d.cambistas = cRows.map((r) => {
          const nome = String(r["Nome"] || "").trim();
          const id = idAntigoPorNome[nome.toLowerCase()] || uid();
          idPorNome[nome] = id;
          const ativoTxt = String(r["Ativo"] || "Sim").toLowerCase();
          return {
            id, nome,
            contato: String(r["Contato"] || ""),
            comissaoPadrao: Number(r["Comissao Padrao"] ?? r["Comissão Padrão"] ?? 0),
            ativo: ativoTxt !== "nao" && ativoTxt !== "não",
            criadoEm: iso(new Date()),
          };
        });
        d.lancamentos = lRows.map((r) => {
          const nome = String(r["Cambista"] || "").trim();
          const dataRaw = r["Data"];
          const dataObj = dataRaw instanceof Date ? dataRaw : parse(String(dataRaw));
          const pctNum = Number(r["Percentual"]);
          return {
            id: uid(),
            cambistaId: idPorNome[nome] || null,
            data: iso(dataObj),
            positivo: Number(r["Positivo (R$)"] ?? r["Positivo"] ?? 0),
            movimentacao: null,
            pct: r["Percentual"] === "" || isNaN(pctNum) ? null : pctNum,
            obs: "",
          };
        }).filter((l) => l.cambistaId);
        // Descarta pagamentos de cambistas que deixaram de existir na planilha importada
        const idsValidos = new Set(d.cambistas.map((c) => c.id));
        d.pagamentos = (d.pagamentos || []).filter((p) => idsValidos.has(p.cambistaId));
      });
      aoTerminar(true);
    } catch (err) {
      aoTerminar(false);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ======================== PLANILHA ONLINE (Google Sheets) ========================
   O site lê a planilha pelo endpoint CSV público do Google (gviz), sem servidor
   nem chave de API. Requisito: compartilhar como "Qualquer pessoa com o link — Leitor".
   A planilha é a fonte da verdade: sincronizar substitui cambistas, lançamentos e
   pagamentos do site pelos dados dela (mesmo modelo de abas do arquivo exportado). */

function extrairSheetId(url) {
  const m = String(url || "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

// Parser CSV mínimo (RFC 4180): aspas, vírgulas e quebras de linha dentro de campos
function csvParse(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  row.push(cur);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function linhasParaObjetos(rows) {
  if (rows.length < 1) return [];
  const header = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// Aceita "R$ 1.010,00", "1010", "-120,5", "1,010.00", "(50)"
function parseNumeroSheet(v) {
  let s = String(v ?? "").trim().replace(/R\$\s?/g, "").replace(/\s/g, "");
  if (!s) return 0;
  const neg = s.startsWith("-") || s.startsWith("(");
  s = s.replace(/[()]/g, "").replace(/^-/, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : (neg ? -n : n);
}

// Aceita "10%", "10", "0,1" — sempre devolve fração (0.1) ou null
function parsePctSheet(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let n = parseNumeroSheet(s.replace("%", ""));
  if (s.includes("%") || n > 1) n = n / 100;
  return isNaN(n) ? null : n;
}

// Aceita "dd/mm/aaaa", "dd/mm/aa" e "aaaa-mm-dd"
function parseDataSheet(v) {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  return null;
}

async function buscarCsvLinhas(sheetId, nomeAba) {
  const parametroAba = nomeAba ? `&sheet=${encodeURIComponent(nomeAba)}` : "";
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${parametroAba}`);
  if (!res.ok) throw new Error(`Não consegui acessar a planilha (HTTP ${res.status}).`);
  const text = await res.text();
  if (text.trim().startsWith("<")) throw new Error("Sem acesso à planilha. No Google Sheets, use Compartilhar → \"Qualquer pessoa com o link\" → Leitor.");
  return csvParse(text);
}

async function buscarAbaCsv(sheetId, nomeAba) {
  return linhasParaObjetos(await buscarCsvLinhas(sheetId, nomeAba));
}

// Tenta uma lista de nomes de aba (variações de caixa/acento); null se nenhuma existir
async function buscarLinhasPorNomes(sheetId, nomes) {
  for (const nome of nomes) {
    try {
      const bruto = await buscarCsvLinhas(sheetId, nome);
      if (bruto.length) return bruto;
    } catch { /* tenta o próximo nome */ }
  }
  return null;
}

/* Aba GASTOS: CATEGORIA | QUEM GASTOU | DESCRIÇÃO | VALOR | DATA (opcional) */
function montarGastosDaPlanilha(bruto) {
  if (!bruto || !bruto.length) return null;
  const idx = bruto.findIndex((r) => {
    const up = r.map((c) => String(c).trim().toUpperCase());
    return up.some((c) => c.startsWith("CATEGORIA")) && up.some((c) => c.startsWith("VALOR"));
  });
  if (idx === -1) return null;
  const header = bruto[idx].map((c) => String(c).trim().toUpperCase());
  const col = (p) => header.findIndex((h) => h.startsWith(p));
  const iCat = col("CATEGORIA"), iVal = col("VALOR"), iDesc = col("DESCRI"), iData = col("DATA");
  let iResp = col("QUEM"); if (iResp === -1) iResp = col("RESPONS");
  const hoje = iso(new Date());
  const gastos = [];
  for (const r of bruto.slice(idx + 1)) {
    const valBruto = String(r[iVal] ?? "").trim();
    const valor = parseNumeroSheet(valBruto);
    if (valBruto === "" || valor === 0) continue;
    gastos.push({
      id: uid(),
      categoria: String(r[iCat] ?? "").trim() || "Outros",
      responsavel: iResp !== -1 ? String(r[iResp] ?? "").trim() : "",
      descricao: iDesc !== -1 ? String(r[iDesc] ?? "").trim() : "",
      valor: Math.abs(valor),
      data: (iData !== -1 && parseDataSheet(r[iData])) || hoje,
    });
  }
  return gastos;
}

/* Aba CAMBISTAS: NOME | CONTATO | COMISSÃO PADRÃO | ATIVO — enriquece (ou cria) cambistas */
function aplicarCambistasDaPlanilha(bruto, cambistas) {
  if (!bruto || !bruto.length) return;
  const idx = bruto.findIndex((r) => {
    const up = r.map((c) => String(c).trim().toUpperCase());
    return up.includes("NOME") && (up.some((c) => c.startsWith("CONTATO")) || up.some((c) => c.startsWith("COMISS")));
  });
  if (idx === -1) return;
  const header = bruto[idx].map((c) => String(c).trim().toUpperCase());
  const col = (p) => header.findIndex((h) => h.startsWith(p));
  const iNome = col("NOME"), iCont = col("CONTATO"), iPct = col("COMISS"), iAtivo = col("ATIVO");
  const porChave = Object.fromEntries(cambistas.map((c) => [c.nome.trim().toLowerCase(), c]));
  for (const r of bruto.slice(idx + 1)) {
    const nome = String(r[iNome] ?? "").trim();
    if (!nome) continue;
    let c = porChave[nome.toLowerCase()];
    if (!c) {
      c = { id: uid(), nome, contato: "", comissaoPadrao: 0.1, ativo: true, criadoEm: iso(new Date()) };
      porChave[nome.toLowerCase()] = c;
      cambistas.push(c);
    }
    if (iCont !== -1 && String(r[iCont] ?? "").trim()) c.contato = String(r[iCont]).trim();
    if (iPct !== -1) { const p = parsePctSheet(r[iPct]); if (p != null) c.comissaoPadrao = p; }
    if (iAtivo !== -1) { const a = String(r[iAtivo] ?? "").trim().toLowerCase(); if (a) c.ativo = a !== "não" && a !== "nao"; }
  }
}

/* Modo "Planilha de Comissões": aba com as colunas
   NOME | POSITIVO | PERCENTUAL | VALOR EFETIVO | RECEBER | PAGAMENTO
   (título acima do cabeçalho é ignorado; coluna DATA é opcional).      */
function montarDeComissoes(bruto, db) {
  const idxHeader = bruto.findIndex((r) => {
    const up = r.map((c) => String(c).trim().toUpperCase());
    return up.includes("NOME") && up.some((c) => c.startsWith("POSITIVO"));
  });
  if (idxHeader === -1) return null;

  const header = bruto[idxHeader].map((c) => String(c).trim().toUpperCase());
  const col = (prefixo) => header.findIndex((h) => h.startsWith(prefixo));
  const iNome = col("NOME"), iPos = col("POSITIVO"), iPct = col("PERCENTUAL"), iPag = col("PAGAMENTO"), iData = col("DATA");

  const hoje = iso(new Date());
  const idAntigoPorNome = Object.fromEntries((db.cambistas || []).map((c) => [c.nome.trim().toLowerCase(), c.id]));
  const porNome = new Map(); // chave minúscula → cambista
  const lancamentos = [];
  const pagamentos = [];

  for (const r of bruto.slice(idxHeader + 1)) {
    const nome = String(r[iNome] ?? "").trim();
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (!porNome.has(chave)) {
      porNome.set(chave, {
        id: idAntigoPorNome[chave] || uid(),
        nome, contato: "", comissaoPadrao: 0.1, ativo: true, criadoEm: hoje,
      });
    }
    const camb = porNome.get(chave);
    const data = (iData !== -1 && parseDataSheet(r[iData])) || hoje;
    const posBruto = String(r[iPos] ?? "").trim();
    if (posBruto !== "") {
      const pct = iPct !== -1 ? (parsePctSheet(r[iPct]) ?? 0) : 0;
      lancamentos.push({ id: uid(), cambistaId: camb.id, data, positivo: parseNumeroSheet(posBruto), movimentacao: null, pct, obs: "" });
      if (pct > 0) camb.comissaoPadrao = pct; // último percentual usado vira o padrão do cambista
    }
    if (iPag !== -1) {
      const pagBruto = String(r[iPag] ?? "").trim();
      const valorPag = parseNumeroSheet(pagBruto);
      if (pagBruto !== "" && valorPag !== 0) pagamentos.push({ id: uid(), cambistaId: camb.id, data, valor: valorPag, obs: "planilha" });
    }
  }

  const cambistas = [...porNome.values()];
  if (!cambistas.length) return null;
  return { cambistas, lancamentos, pagamentos };
}

async function sincronizarPlanilha(url, db, update) {
  const sheetId = extrairSheetId(url);
  if (!sheetId) throw new Error("Link inválido. Cole o link de compartilhamento do Google Sheets (docs.google.com/spreadsheets/d/...).");

  // 1) Tenta o modelo completo (abas Cambistas / Lancamentos / Pagamentos)
  let cRows = null, lRows = null, pRows = null;
  try {
    cRows = await buscarAbaCsv(sheetId, "Cambistas");
    try { lRows = await buscarAbaCsv(sheetId, "Lancamentos"); }
    catch { lRows = await buscarAbaCsv(sheetId, "Lançamentos"); }
  } catch { /* sem as abas do modelo completo — tenta o modo Planilha de Comissões */ }

  if (!cRows?.length || !("Nome" in cRows[0]) || !lRows?.length || !("Cambista" in lRows[0])) {
    // 2) Modo Gestão Financeira / Planilha de Comissões: procura a aba COMISSÕES
    //    (fallback: primeira aba) e as abas opcionais CAMBISTAS e GASTOS
    const bruto = (await buscarLinhasPorNomes(sheetId, ["COMISSÕES", "COMISSOES", "Comissões", "Comissoes"])) || (await buscarCsvLinhas(sheetId, null));
    const montado = montarDeComissoes(bruto, db);
    if (!montado) throw new Error('A planilha está vazia ou fora do modelo. Use a aba COMISSÕES (colunas NOME, POSITIVO, PERCENTUAL, PAGAMENTO) ou as abas "Cambistas"/"Lancamentos" do arquivo exportado.');

    aplicarCambistasDaPlanilha(await buscarLinhasPorNomes(sheetId, ["CAMBISTAS", "Cambistas"]), montado.cambistas);
    const gastos = montarGastosDaPlanilha(await buscarLinhasPorNomes(sheetId, ["GASTOS", "Gastos"]));

    const agora = new Date().toLocaleString("pt-BR");
    update((d) => {
      d.cambistas = montado.cambistas;
      d.lancamentos = montado.lancamentos;
      d.pagamentos = montado.pagamentos;
      if (gastos !== null) d.gastos = gastos;
      d.planilhaUrl = url;
      d.planilhaUltimaSync = agora;
    });
    return { cambistas: montado.cambistas.length, lancamentos: montado.lancamentos.length, pagamentos: montado.pagamentos.length, gastos: gastos !== null ? gastos.length : null };
  }

  try { pRows = await buscarAbaCsv(sheetId, "Pagamentos"); } catch { /* aba opcional */ }

  // Monta tudo fora do updater do React (o updater roda depois, de forma assíncrona)
  const idAntigoPorNome = Object.fromEntries((db.cambistas || []).map((c) => [c.nome.trim().toLowerCase(), c.id]));
  const idPorNome = {};
  const cambistas = cRows.filter((r) => String(r["Nome"]).trim()).map((r) => {
    const nome = String(r["Nome"]).trim();
    const id = idAntigoPorNome[nome.toLowerCase()] || uid();
    idPorNome[nome.toLowerCase()] = id;
    const ativoTxt = String(r["Ativo"] || "Sim").trim().toLowerCase();
    return {
      id, nome,
      contato: String(r["Contato"] || "").trim(),
      comissaoPadrao: parsePctSheet(r["Comissao Padrao"] ?? r["Comissão Padrão"]) ?? 0,
      ativo: ativoTxt !== "nao" && ativoTxt !== "não",
      criadoEm: iso(new Date()),
    };
  });
  const lancamentos = lRows.map((r) => {
    const nome = String(r["Cambista"] || "").trim().toLowerCase();
    const data = parseDataSheet(r["Data"]);
    if (!idPorNome[nome] || !data) return null;
    return {
      id: uid(),
      cambistaId: idPorNome[nome],
      data,
      positivo: parseNumeroSheet(r["Positivo (R$)"] ?? r["Positivo"]),
      movimentacao: null,
      pct: parsePctSheet(r["Percentual"]),
      obs: "",
    };
  }).filter(Boolean);
  const idsValidos = new Set(cambistas.map((c) => c.id));
  const pagamentos = pRows
    ? pRows.map((r) => {
        const nome = String(r["Cambista"] || "").trim().toLowerCase();
        const data = parseDataSheet(r["Data"]);
        if (!idPorNome[nome] || !data) return null;
        return { id: uid(), cambistaId: idPorNome[nome], data, valor: parseNumeroSheet(r["Valor (R$)"] ?? r["Valor"]), obs: String(r["Obs"] || "") };
      }).filter(Boolean)
    : (db.pagamentos || []).filter((p) => idsValidos.has(p.cambistaId));

  const agora = new Date().toLocaleString("pt-BR");
  update((d) => {
    d.cambistas = cambistas;
    d.lancamentos = lancamentos;
    d.pagamentos = pagamentos;
    d.planilhaUrl = url;
    d.planilhaUltimaSync = agora;
  });
  return { cambistas: cambistas.length, lancamentos: lancamentos.length, pagamentos: pagamentos.length };
}

/* ======================== TELA DE ACESSO (senha) ======================== */
const SENHA_ACESSO = "luan0202";
function LoginScreen({ onUnlock }) {
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState(false);

  const entrar = (ev) => {
    ev.preventDefault();
    if (senha === SENHA_ACESSO) {
      try { localStorage.setItem("esportevipapp:unlocked", "1"); } catch {}
      onUnlock();
    } else {
      setErro(true);
      setSenha("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <form onSubmit={entrar} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-modal animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center text-slate-900 font-black text-lg mx-auto mb-3">
            <Lock size={22} />
          </div>
          <div className="text-xl font-black tracking-tight"><span className="text-white">ESPORTEVIP</span><span className="text-orange-500">APP</span></div>
          <div className="text-xs text-slate-400 mt-1">Acesso restrito — informe a senha</div>
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Senha</label>
        <div className="relative">
          <input
            type={mostrar ? "text" : "password"}
            value={senha}
            onChange={(ev) => { setSenha(ev.target.value); setErro(false); }}
            autoFocus
            className={`w-full h-11 bg-slate-950 border rounded-lg pl-3 pr-10 text-sm text-white outline-none transition focus:ring-2 focus:ring-orange-500/40 ${erro ? "border-rose-500" : "border-slate-700 focus:border-orange-500"}`}
            placeholder="Digite a senha"
          />
          <button type="button" onClick={() => setMostrar((v) => !v)} aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {erro && <p className="text-xs text-rose-400 mt-2">Senha incorreta. Tente novamente.</p>}

        <button type="submit" className="w-full mt-5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg py-2.5 text-sm transition-colors duration-150">
          Entrar
        </button>
      </form>
    </div>
  );
}

/* ======================== COMPONENTE RAIZ ======================== */
export default function App() {
  const [autenticado, setAutenticado] = useState(() => {
    try { return localStorage.getItem("esportevipapp:unlocked") === "1"; } catch { return false; }
  });
  const [db, setDb] = useState(null);
  const [aba, setAba] = useState("dashboard");
  const [gran, setGran] = useState("mes");
  const [ref, setRef] = useState(new Date());
  const [relatorioPre, setRelatorioPre] = useState(null);
  const [abaRelatorios, setAbaRelatorios] = useState("semanal");
  const [salvando, setSalvando] = useState(false);
  const [showInativeModal, setShowInativeModal] = useState(false);
  const [inativos, setInativos] = useState([]);
  const primeira = useRef(true);

  useEffect(() => { loadDB().then(setDb); }, []);
  useEffect(() => {
    if (!db) return;
    const inativosAtual = cambistasInativos(db.cambistas || [], db.lancamentos || []);
    setInativos(inativosAtual);
    if (primeira.current) { primeira.current = false; if (inativosAtual.length > 0) setShowInativeModal(true); return; }
    setSalvando(true);
    saveDB(db).then(() => setTimeout(() => setSalvando(false), 400));
  }, [db]);

  const cambById = useMemo(() => Object.fromEntries((db?.cambistas || []).map((c) => [c.id, c])), [db]);

  const [s, e] = useMemo(() => periodRange(gran, ref), [gran, ref]);
  const [sPrev, ePrev] = useMemo(() => periodRange(gran, shiftRef(gran, ref, -1)), [gran, ref]);

  const lancsPeriodo = useMemo(() => (db?.lancamentos || []).filter((l) => dentro(l, s, e)), [db, s, e]);
  const lancsPrev = useMemo(() => (db?.lancamentos || []).filter((l) => dentro(l, sPrev, ePrev)), [db, sPrev, ePrev]);

  const totais = useMemo(() => agrega(lancsPeriodo, cambById), [lancsPeriodo, cambById]);
  const totaisPrev = useMemo(() => agrega(lancsPrev, cambById), [lancsPrev, cambById]);

  if (!autenticado) return <LoginScreen onUnlock={() => setAutenticado(true)} />;

  if (!db) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-orange-500">
      <div className="animate-pulse text-sm tracking-wide">Carregando o sistema</div>
    </div>
  );

  const update = (fn) => setDb((cur) => { const next = structuredClone(cur); fn(next); next.exemplo = false; return next; });

  const gerarRelatorioSemanal = (cambistaId) => {
    setGran("semana");
    setRelatorioPre(cambistaId);
    setAbaRelatorios("semanal");
    setAba("relatorios");
  };

  const irAba = (id) => {
    if (id === "relatorios" && gran !== "semana" && gran !== "tudo") setGran("semana");
    setAba(id);
  };

  const nav = [
    { id: "dashboard", nome: "Visão Geral", curto: "Início", icon: LayoutDashboard },
    { id: "cambistas", nome: "Cambistas", curto: "Cambistas", icon: Users },
    { id: "gastos", nome: "Controle de Gastos", curto: "Gastos", icon: DollarSign },
    { id: "relatorios", nome: "Relatórios", curto: "Relatórios", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="sticky top-0 z-20">
        <div className="bg-slate-900 border-b-2 border-orange-500">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14">
            <div className="font-black tracking-tight text-base mr-8 shrink-0"><span className="text-white">ESPORTEVIP</span><span className="text-orange-500">APP</span></div>
            <nav className="hidden lg:flex items-stretch self-stretch mr-auto">
              {nav.map((n) => {
                const on = aba === n.id;
                return (
                  <button key={n.id} onClick={() => irAba(n.id)}
                    className={`relative px-4 text-sm font-medium transition-colors duration-150 ${on ? "text-white" : "text-slate-400 hover:text-slate-200"}`}>
                    {n.nome}
                    {on && <span className="absolute left-3 right-3 bottom-0 h-[3px] rounded-t-full bg-orange-500" />}
                  </button>
                );
              })}
            </nav>
            <div className="ml-auto lg:ml-0 flex items-center">
              <span className="hidden sm:flex items-center text-[11px] text-slate-500 mr-4">
                <Circle size={7} className={`mr-1.5 ${salvando ? "text-amber-400 fill-amber-400" : "text-emerald-400 fill-emerald-400"}`} />
                {salvando ? "Salvando..." : "Tudo salvo"}
              </span>
              {db.exemplo && (
                <button onClick={() => { if (confirm("Zerar todos os dados de exemplo e começar do zero?")) setDb({ cambistas: [], lancamentos: [], pagamentos: [], gastos: [], metaMensal: 10000, exemplo: false, version: 4 }); }}
                  title="Limpar dados de exemplo" className="text-[11px] text-slate-400 hover:text-rose-300 border border-slate-700 rounded-lg px-2.5 py-1.5 mr-2 transition-colors inline-flex items-center">
                  <RotateCcw size={12} className="mr-1.5" /> Limpar exemplo
                </button>
              )}
              <button onClick={() => { try { localStorage.removeItem("esportevipapp:unlocked"); } catch {} setAutenticado(false); }}
                title="Bloquear acesso" aria-label="Bloquear acesso" className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <Lock size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 flex-wrap">
            <div className="mr-auto min-w-0">
              <div className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">{nav.find((n) => n.id === aba)?.nome}</div>
              {db.exemplo && <div className="text-[11px] text-amber-600 hidden sm:block mt-0.5">Você está vendo dados de exemplo. Edite ou limpe quando quiser.</div>}
            </div>
            {inativos.length > 0 && (
              <button onClick={() => setShowInativeModal(true)} className="inline-flex items-center gap-2 text-xs bg-amber-100 border border-amber-300 text-amber-800 rounded-lg px-2.5 py-1.5 hover:bg-amber-200 transition">
                <Clock size={14} /> <span className="tabular-nums">{inativos.length}</span> <span className="hidden sm:inline">cambista(s) inativo(s)</span>
              </button>
            )}
            {(aba !== "relatorios" || abaRelatorios === "semanal") && (
              <PeriodPicker gran={gran} setGran={setGran} ref_={ref} setRef={setRef}
                opts={aba === "relatorios" ? [["semana","Semanal"],["tudo","Tudo"]] : undefined} />
            )}
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1400px] mx-auto min-w-0">
        {aba === "dashboard" && (
          <Dashboard db={db} update={update} cambById={cambById} lancs={lancsPeriodo}
            totais={totais} totaisPrev={totaisPrev} gran={gran} ref_={ref} range={[s, e]} />
        )}
        {aba === "cambistas" && (
          <Cambistas db={db} update={update} cambById={cambById} lancs={lancsPeriodo} rotulo={rotuloPeriodo(gran, ref)} range={[s, e]} gerarRelatorio={gerarRelatorioSemanal} />
        )}
        {aba === "gastos" && (
          <GastosControl db={db} update={update} gran={gran} ref_={ref} range={[s, e]} />
        )}
        {aba === "relatorios" && (
          <Relatorios db={db} cambById={cambById} lancs={lancsPeriodo} gran={gran} ref_={ref} preSelecionar={relatorioPre} onConsumir={() => setRelatorioPre(null)}
            abaRelatorios={abaRelatorios} setAbaRelatorios={setAbaRelatorios} />
        )}
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900 border-t border-slate-800 flex shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        {nav.map((n) => {
          const Ic = n.icon; const on = aba === n.id;
          return (
            <button key={n.id} onClick={() => irAba(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors duration-150 relative ${on ? "text-orange-400" : "text-slate-500 hover:text-slate-300"}`}>
              {on && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-orange-400" />}
              <Ic size={20} className={`transition-transform duration-150 ${on ? "scale-110" : ""}`} /> {n.curto}
            </button>
          );
        })}
      </nav>

      {showInativeModal && (
        <ModalInactivos inativos={inativos} onClose={() => setShowInativeModal(false)} />
      )}
      <Toaster />
    </div>
  );
}

/* ======================== MODAL DE INATIVOS ======================== */
function ModalInactivos({ inativos, onClose }) {
  if (inativos.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-900">Cambistas sem Movimento</div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors duration-150"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-4">Os seguintes cambistas não possuem movimento há 7 dias ou mais:</p>
          {inativos.map(({ cambista, dias }) => (
            <div key={cambista.id} className="bg-amber-100 border border-amber-300 rounded-lg p-3">
              <div className="font-medium text-slate-800">{cambista.nome}</div>
              <div className="text-sm text-amber-800 mt-1">
                {dias === Infinity ? "Nunca lançou movimento" : `${dias} dias sem atividade`}
              </div>
              <div className="text-xs text-slate-500 mt-1">{cambista.contato}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors duration-150">Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ======================== SELETOR DE PERÍODO ======================== */
function PeriodPicker({ gran, setGran, ref_, setRef, opts }) {
  const todas = [["semana","Semanal"],["quinzena","Quinzenal"],["mes","Mensal"],["ano","Anual"],["tudo","Tudo"]];
  const lista = opts || todas;
  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <div className="flex rounded-lg border border-slate-200 overflow-hidden overflow-x-auto max-w-full">
        {lista.map(([id, lab]) => (
          <button key={id} onClick={() => setGran(id)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 ${gran === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            {lab}
          </button>
        ))}
      </div>
      {gran !== "tudo" && (
        <div className="flex items-center gap-1">
          <button onClick={() => setRef(shiftRef(gran, ref_, -1))} className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors duration-150"><ChevronLeft size={16} /></button>
          <div className="text-xs font-medium text-slate-700 min-w-[7rem] text-center tabular-nums">{rotuloPeriodo(gran, ref_)}</div>
          <button onClick={() => setRef(shiftRef(gran, ref_, 1))} className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors duration-150"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ======================== ESTATÍSTICAS (painel segmentado) ========================
   Um único painel com divisórias hairline (gap-px sobre fundo cinza) em vez de uma
   grade de cards soltos. Cada célula: ponto de cor + rótulo, número grande, detalhe. */
const STAT_DOT = {
  slate: "bg-slate-400",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
};

function StatPanel({ cols = "grid-cols-2 lg:grid-cols-5", children }) {
  return <div className={`grid ${cols} gap-px rounded-xl overflow-hidden border border-slate-200 bg-slate-200`}>{children}</div>;
}

function Kpi({ titulo, valor, delta, sub, cor = "orange", inverso = false, corValor = "text-slate-900" }) {
  const bom = inverso ? (delta ?? 0) <= 0 : (delta ?? 0) >= 0;
  return (
    <div className="bg-white p-4 sm:p-5 min-w-0">
      <div className="flex items-center min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${STAT_DOT[cor] || STAT_DOT.orange}`} />
        <span className={`${eyebrow} truncate`}>{titulo}</span>
      </div>
      <div title={valor} className={`mt-2 text-lg sm:text-xl lg:text-[26px] leading-tight font-bold tabular-nums tracking-tight truncate ${corValor}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      {delta != null && isFinite(delta) && (
        <div className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${bom ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {bom ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />} {pct(Math.abs(delta))}
        </div>
      )}
    </div>
  );
}

const cardBox = "bg-white rounded-lg border border-slate-200 p-5 min-w-0";
const titSec = "text-sm font-semibold text-slate-800 mb-3";
const eyebrow = "text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const inp = "w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none transition focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 placeholder:text-slate-400";
const lbl = "block text-xs font-medium text-slate-500 mb-1";

function money(v) { return brl(v); }
function delta(a, b) { if (!b) return b === 0 && a === 0 ? 0 : null; return (a - b) / Math.abs(b); }

/* ======================== BADGE (pill de status unificado) ======================== */
function Badge({ tone = "neutral", icon: Ic, children, className = "" }) {
  const tones = {
    success: "bg-emerald-100 text-emerald-800",
    danger: "bg-rose-100 text-rose-700",
    neutral: "bg-slate-100 text-slate-600",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-1 whitespace-nowrap ${tones[tone] || tones.neutral} ${className}`}>
      {Ic && <Ic size={12} />} {children}
    </span>
  );
}

/* ======================== EMPTY STATE ======================== */
function EmptyState({ icon: Ic = Inbox, titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <Ic size={22} />
      </div>
      <div className="text-sm font-semibold text-slate-600">{titulo}</div>
      {descricao && <div className="text-xs text-slate-400 mt-1 max-w-xs">{descricao}</div>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

/* ======================== MENU DE AÇÕES (portal — escapa do clipping de containers com scroll) ======================== */
function ActionMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = (ev) => {
    ev.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (ev) => {
      if (menuRef.current?.contains(ev.target) || btnRef.current?.contains(ev.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (ev) => { if (ev.key === "Escape") setOpen(false); };
    const handleScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={toggle} title="Ações" aria-label="Abrir menu de ações" aria-expanded={open}
        className={`p-1.5 rounded-md transition-colors duration-150 ${open ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100"}`}>
        <MoreVertical size={16} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="w-44 bg-white border border-slate-200 rounded-lg shadow-modal z-[100] py-1 animate-scale-in origin-top-right"
          onClick={() => setOpen(false)}>
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

/* ======================== TOASTS (feedback de sucesso/erro, sem dependência externa) ======================== */
const toastListeners = new Set();
let toastSeq = 0;
function toast(message, type = "success") {
  const id = ++toastSeq;
  const item = { id, message, type };
  toastListeners.forEach((fn) => fn((prev) => [...prev, item]));
  setTimeout(() => {
    toastListeners.forEach((fn) => fn((prev) => prev.filter((t) => t.id !== id)));
  }, 3500);
}
function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    toastListeners.add(setItems);
    return () => toastListeners.delete(setItems);
  }, []);

  const styles = {
    success: { icon: CheckCircle, bg: "bg-emerald-600", text: "text-white" },
    error: { icon: XCircle, bg: "bg-rose-600", text: "text-white" },
    info: { icon: Info, bg: "bg-slate-900", text: "text-white" },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {items.map((t) => {
        const s = styles[t.type] || styles.success;
        const Ic = s.icon;
        return (
          <div key={t.id} className={`animate-toast-in pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-3 shadow-modal text-sm font-medium ${s.bg} ${s.text}`}>
            <Ic size={16} className="shrink-0" />
            <span className="min-w-0">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ======================== DASHBOARD ======================== */
function Dashboard({ db, update, cambById, lancs, totais, totaisPrev, gran, ref_, range }) {
  const [editMeta, setEditMeta] = useState(false);
  const [dtDe, setDtDe] = useState("");
  const [dtAte, setDtAte] = useState("");
  const custom = Boolean(dtDe && dtAte);

  const [s, e] = custom ? [parse(dtDe), parse(dtAte)] : range;
  const lancsEf = useMemo(() => custom ? (db.lancamentos || []).filter((l) => dentro(l, s, e)) : lancs, [custom, db.lancamentos, lancs, s, e]);

  const [sPrevEf, ePrevEf] = useMemo(() => {
    if (!custom) return periodRange(gran, shiftRef(gran, ref_, -1));
    const diasPeriodo = Math.round((e - s) / 86400000) + 1;
    const ePrevCustom = new Date(s); ePrevCustom.setDate(ePrevCustom.getDate() - 1);
    const sPrevCustom = new Date(ePrevCustom); sPrevCustom.setDate(sPrevCustom.getDate() - diasPeriodo + 1);
    return [sPrevCustom, ePrevCustom];
  }, [custom, s, e, gran, ref_]);
  const lancsPrevEf = useMemo(() => (db.lancamentos || []).filter((l) => dentro(l, sPrevEf, ePrevEf)), [db.lancamentos, sPrevEf, ePrevEf]);

  const totaisEf = useMemo(() => custom ? agrega(lancsEf, cambById) : totais, [custom, lancsEf, cambById, totais]);
  const totaisPrevEf = useMemo(() => custom ? agrega(lancsPrevEf, cambById) : totaisPrev, [custom, lancsPrevEf, cambById, totaisPrev]);

  const serie = useMemo(() => {
    const map = new Map();
    const porMes = gran === "ano" || gran === "tudo";
    for (const l of lancsEf) {
      const d = parse(l.data);
      const chave = porMes ? `${d.getFullYear()}-${pad(d.getMonth()+1)}` : iso(d);
      const rot = porMes ? MESES[d.getMonth()] : `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
      const c = calcLanc(l, cambById[l.cambistaId]);
      const cur = map.get(chave) || { rot, chave, bruto: 0, comissao: 0, receber: 0 };
      cur.bruto += l.positivo; cur.comissao += c.comissao; cur.receber += c.receber;
      map.set(chave, cur);
    }
    return [...map.values()].sort((a, b) => a.chave.localeCompare(b.chave));
  }, [lancsEf, gran, cambById]);

  const crescimento = useMemo(() => {
    const g = gran === "tudo" ? "mes" : gran;
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const r = shiftRef(g, ref_, -i);
      const [rs, re] = periodRange(g, r);
      const ls = (db.lancamentos || []).filter((l) => dentro(l, rs, re));
      out.push({ rot: rotuloCurto(g, r), receber: agrega(ls, cambById).receber });
    }
    return out;
  }, [db, gran, ref_, cambById]);

  const porCambista = useMemo(() => {
    const m = {};
    for (const c of db.cambistas) {
      if (c.ativo) m[c.id] = { id: c.id, nome: c.nome, bruto: 0, comissao: 0, receber: 0 };
    }
    for (const l of lancsEf) {
      const c = calcLanc(l, cambById[l.cambistaId]);
      if (!m[l.cambistaId]) m[l.cambistaId] = { id: l.cambistaId, nome: cambById[l.cambistaId]?.nome || "Sem nome", bruto: 0, comissao: 0, receber: 0 };
      m[l.cambistaId].bruto += l.positivo; m[l.cambistaId].comissao += c.comissao; m[l.cambistaId].receber += c.receber;
    }
    return Object.values(m).sort((a, b) => b.receber - a.receber);
  }, [lancsEf, cambById, db.cambistas]);

  const gastosPeriodo = useMemo(() => {
    return (db.gastos || []).filter((g) => dentro({ data: g.data }, s, e)).reduce((a, g) => a + g.valor, 0);
  }, [db.gastos, s, e]);
  const gastosPrev = useMemo(() => {
    return (db.gastos || []).filter((g) => dentro({ data: g.data }, sPrevEf, ePrevEf)).reduce((a, g) => a + g.valor, 0);
  }, [db.gastos, sPrevEf, ePrevEf]);
  const liquidoCasa = totaisEf.receber - gastosPeriodo;
  const liquidoCasaPrev = totaisPrevEf.receber - gastosPrev;

  const cambistasAtivos = db.cambistas.filter((c) => c.ativo).length;
  const emPrejuizo = porCambista.filter((c) => c.receber < 0);
  const metaPeriodo = metaDoPeriodo(db.metaMensal, gran);
  const progresso = metaPeriodo ? totaisEf.receber / metaPeriodo : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-slate-500">Período: <span className="font-medium text-slate-700">{custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotuloPeriodo(gran, ref_)}</span></div>
        <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors duration-150 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
          <span className="text-slate-500">De</span>
          <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
          <span className="text-slate-500">Até</span>
          <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
        </div>
        {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">limpar</button>}
      </div>

      <StatPanel cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi titulo="Resultado Bruto" valor={money(totaisEf.bruto)} delta={delta(totaisEf.bruto, totaisPrevEf.bruto)} cor="slate" corValor={totaisEf.bruto >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Comissões" valor={money(totaisEf.comissao)} delta={delta(totaisEf.comissao, totaisPrevEf.comissao)} cor="amber" inverso corValor={totaisEf.comissao >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Gastos" valor={money(gastosPeriodo)} delta={delta(gastosPeriodo, gastosPrev)} cor="amber" inverso corValor={gastosPeriodo >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Líquido Casa" valor={money(liquidoCasa)} delta={delta(liquidoCasa, liquidoCasaPrev)} cor={liquidoCasa >= 0 ? "emerald" : "rose"} corValor={liquidoCasa >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Cambistas Ativos" valor={`${cambistasAtivos}`} cor="indigo" />
      </StatPanel>

      {metaPeriodo != null && (
        <div className={cardBox}>
          <div className="flex items-center justify-between mb-3">
            <div className={titSec + " mb-0"}>Meta do Período</div>
            <button onClick={() => setEditMeta(true)} className="text-xs text-slate-500 hover:text-orange-600 font-medium transition-colors">editar meta</button>
          </div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl md:text-[28px] font-bold text-slate-900 tabular-nums tracking-tight">{brl(totaisEf.receber)}</span>
            <span className="text-sm text-slate-500">meta {brl(metaPeriodo)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${progresso >= 1 ? "bg-emerald-500" : progresso >= 0.6 ? "bg-amber-400" : "bg-rose-400"}`}
              style={{ width: `${Math.min(100, Math.max(0, (progresso || 0) * 100))}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-1.5">{pct(Math.max(0, progresso || 0))} da meta atingida</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className={`${cardBox} lg:col-span-2`}>
          <div className="flex items-center justify-between mb-3">
            <div className={titSec + " mb-0"}>Evolução no Período</div>
            <div className="text-xs text-slate-500">líquido e comissão</div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THEME_CHART.positivo} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={THEME_CHART.positivo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={THEME_CHART.grid} vertical={false} />
                <XAxis dataKey="rot" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtEixo} width={40} />
                <Tooltip formatter={(v, n) => [brl(v), n === "receber" ? "Líquido" : "Comissão"]} labelStyle={{ fontWeight: 600 }} contentStyle={CHART_TOOLTIP_STYLE} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Area type="monotone" dataKey="receber" stroke={THEME_CHART.positivo} strokeWidth={2.5} fill="url(#gradOrange)" name="receber" dot={{ r: 3, fill: THEME_CHART.positivo, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="comissao" stroke={THEME_CHART.neutro} strokeWidth={1.6} strokeDasharray="4 3" dot={false} name="comissao" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardBox}>
          <div className={titSec}>Crescimento (Últimos Períodos)</div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crescimento} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={THEME_CHART.grid} vertical={false} />
                <XAxis dataKey="rot" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtEixo} width={40} />
                <Tooltip formatter={(v) => [brl(v), "Líquido"]} contentStyle={CHART_TOOLTIP_STYLE} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Bar dataKey="receber" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {crescimento.map((d, i) => <Cell key={i} fill={d.receber >= 0 ? THEME_CHART.positivo : THEME_CHART.negativo} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className={`${cardBox} lg:col-span-2`}>
          <div className={titSec}>Líquido por Cambista</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCambista} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={THEME_CHART.grid} horizontal={false} />
                <XAxis type="number" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtEixo} />
                <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [brl(v), "Líquido"]} contentStyle={CHART_TOOLTIP_STYLE} />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Bar dataKey="receber" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {porCambista.map((d, i) => <Cell key={i} fill={d.receber >= 0 ? THEME_CHART.positivo : THEME_CHART.negativo} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardBox}>
          <div className={titSec}>Comissões por Cambista</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCambista} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={THEME_CHART.grid} horizontal={false} />
                <XAxis type="number" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtEixo} />
                <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [brl(v), "Comissão"]} contentStyle={CHART_TOOLTIP_STYLE} />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Bar dataKey="comissao" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {porCambista.map((d, i) => <Cell key={i} fill={d.comissao >= 0 ? THEME_CHART.aviso : THEME_CHART.negativo} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {emPrejuizo.length > 0 && (
        <div className="bg-rose-100 border border-rose-300 rounded-xl p-4 md:p-5 min-w-0">
          <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
            <span className="w-7 h-7 rounded-lg bg-rose-200 flex items-center justify-center shrink-0"><AlertTriangle size={14} /></span>
            Cambistas em Prejuízo neste Período
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {emPrejuizo.map((c) => (
              <span key={c.id} className="text-xs bg-white border border-rose-200 text-rose-700 rounded-full px-3 py-1.5 tabular-nums font-medium">
                {c.nome}: {brl(c.receber)}
              </span>
            ))}
          </div>
        </div>
      )}

      {editMeta && (
        <ModalMeta valor={db.metaMensal} onClose={() => setEditMeta(false)}
          onSave={(v) => { update((d) => { d.metaMensal = v; }); toast("Meta atualizada.", "success"); setEditMeta(false); }} />
      )}
    </div>
  );
}

function ModalMeta({ valor, onClose, onSave }) {
  const [v, setV] = useState(String(valor || 0));
  const salvar = () => { const n = parseFloat(String(v).replace(",", ".")); if (isNaN(n) || n < 0) return toast("Informe um valor válido.", "error"); onSave(n); };
  return (
    <Modal titulo="Meta Mensal da Casa" onClose={onClose} onSave={salvar}>
      <Campo label="Meta de Líquido por Mês (R$)"><input value={v} onChange={(e) => setV(e.target.value)} className={inp} inputMode="decimal" autoFocus /></Campo>
      <div className="text-xs text-slate-500">As metas de semana, quinzena e ano são calculadas automaticamente a partir desse valor.</div>
    </Modal>
  );
}

/* ======================== CAMBISTAS ======================== */
function Cambistas({ db, update, cambById, lancs, rotulo, range, gerarRelatorio }) {
  const [editar, setEditar] = useState(null);
  const [pagar, setPagar] = useState(null);
  const [lancar, setLancar] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [importando, setImportando] = useState(false);
  const [dtDe, setDtDe] = useState("");
  const [dtAte, setDtAte] = useState("");
  const fileRef = useRef(null);
  const custom = dtDe && dtAte;
  const [s, e] = custom ? [parse(dtDe), parse(dtAte)] : range;
  const lancsEf = useMemo(() => custom ? (db.lancamentos || []).filter((l) => dentro(l, s, e)) : lancs, [custom, db.lancamentos, lancs, s, e]);

  const linhas = useMemo(() => db.cambistas.map((c) => {
    const ls = lancsEf.filter((l) => l.cambistaId === c.id);
    const ag = agrega(ls, cambById);
    const pago = (db.pagamentos || []).filter((p) => p.cambistaId === c.id && dentro(p, s, e)).reduce((a, p) => a + p.valor, 0);
    const saldo = ag.comissao - pago;
    return { c, ...ag, pago, saldo };
  }).sort((a, b) => b.receber - a.receber), [db, lancsEf, cambById, s, e]);

  const aoImportar = (file) => {
    if (!file) return;
    const ok = confirm("Isso vai substituir todos os cambistas e lançamentos atuais pelos dados dessa planilha. Deseja continuar?");
    if (!ok) return;
    setImportando(true);
    importarExcel(file, update, (sucesso) => {
      setImportando(false);
      if (!sucesso) toast("Não consegui ler essa planilha. Confira se ela segue o mesmo modelo exportado pelo sistema.", "error");
      else toast("Planilha importada com sucesso.", "success");
    });
  };

  const [planilhaModal, setPlanilhaModal] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizar = async (url) => {
    if (!confirm("Isso vai substituir cambistas, lançamentos e pagamentos do site pelos dados da planilha online. Continuar?")) return;
    setSincronizando(true);
    try {
      const r = await sincronizarPlanilha(url, db, update);
      toast(`Sincronizado: ${r.cambistas} cambistas, ${r.lancamentos} lançamentos, ${r.pagamentos} pagamentos${r.gastos != null ? `, ${r.gastos} gastos` : ""}.`, "success");
      setPlanilhaModal(false);
    } catch (err) {
      toast(err.message || "Erro ao sincronizar com a planilha.", "error");
    } finally {
      setSincronizando(false);
    }
  };

  const setPeriodDates = (gran) => {
    const [dtInicio, dtFim] = isoDatesForPeriod(gran, new Date());
    setDtDe(dtInicio);
    setDtAte(dtFim);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-slate-500">Período: <span className="font-medium text-slate-700">{custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotulo}</span></div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
            {[["semana","Semanal"],["quinzena","Quinzenal"],["mes","Mensal"],["ano","Anual"]].map(([id, lab]) => (
              <button key={id} onClick={() => setPeriodDates(id)} className="px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 border-r border-slate-200 last:border-0 text-slate-600 transition-colors duration-150">{lab}</button>
            ))}
          </div>
          <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors duration-150 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
            <span className="text-slate-500">De</span>
            <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
            <span className="text-slate-500">Até</span>
            <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
          </div>
          {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">limpar</button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(ev) => { aoImportar(ev.target.files[0]); ev.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={importando}
            className="inline-flex items-center gap-2 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-2 transition-colors duration-150 disabled:opacity-50">
            {importando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {importando ? "Importando" : "Importar Planilha"}
          </button>
          <button onClick={() => { exportarExcel({ db, incluirGastos: false }); toast("Planilha de fechamento gerada (sem gastos).", "success"); }}
            title="Planilha com Lançamentos, Cambistas e Pagamentos — sem a aba de Gastos"
            className="inline-flex items-center gap-2 text-sm border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg px-3 py-2 transition-colors duration-150">
            <FileSpreadsheet size={15} /> Exportar Planilha
          </button>
          {db.planilhaUrl ? (
            <button onClick={() => sincronizar(db.planilhaUrl)} disabled={sincronizando}
              title={`Puxar dados da planilha online${db.planilhaUltimaSync ? ` — última sync: ${db.planilhaUltimaSync}` : ""}`}
              className="inline-flex items-center gap-2 text-sm border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-3 py-2 transition-colors duration-150 disabled:opacity-50">
              <RefreshCw size={15} className={sincronizando ? "animate-spin" : ""} /> {sincronizando ? "Sincronizando..." : "Sincronizar"}
            </button>
          ) : null}
          <button onClick={() => setPlanilhaModal(true)}
            title="Conectar uma planilha do Google Sheets"
            className="inline-flex items-center gap-2 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-2 transition-colors duration-150">
            <Link2 size={15} /> Planilha Online
          </button>
          <button onClick={() => setEditar({ id: null, nome: "", contato: "", comissaoPadrao: 0.1, ativo: true })}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors duration-150">
            <Plus size={16} /> Novo Cambista
          </button>
        </div>
      </div>

      {linhas.length > 0 && (
        <StatPanel cols="grid-cols-1 sm:grid-cols-3">
          <Kpi titulo="Total a Receber" valor={brl(linhas.reduce((a, r) => a + Math.max(0, r.receber), 0))} cor="emerald" corValor="text-emerald-700" sub="cambistas para cobrar" />
          <Kpi titulo="Total Recebido" valor={brl(linhas.reduce((a, r) => a + r.pago, 0))} cor="slate" sub="já quitado no período" />
          <Kpi titulo="Taxa de Inadimplência" valor={`${linhas.length > 0 ? ((linhas.filter((r) => r.receber > 0.01).length / linhas.length) * 100).toFixed(1) : "0"}%`} cor="rose" corValor="text-rose-700" sub={`${linhas.filter((r) => r.receber > 0.01).length} de ${linhas.length} cambistas`} />
        </StatPanel>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50/80">
                <th className="px-4 py-3">Cambista</th>
                <th className="px-4 py-3 text-right">Bruto</th>
                <th className="px-4 py-3 text-right">Comissão</th>
                <th className="px-4 py-3 text-right">Pago</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ c, bruto, comissao, pago, saldo, receber, n }) => (
                <tr key={c.id} onClick={() => setDetalhe(c)} className="group border-b border-slate-100 last:border-0 hover:bg-orange-50/40 cursor-pointer transition-colors duration-150">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 flex items-center gap-2">{c.nome} {!c.ativo && <Badge tone="neutral">inativo</Badge>}</div>
                    <div className="text-xs text-slate-500">{c.contato || "sem contato"}, padrão {pct(c.comissaoPadrao)}</div>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${bruto < 0 ? "text-rose-600" : "text-slate-700"}`}>{brl(bruto)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${comissao < 0 ? "text-rose-600" : "text-slate-900"}`}>{brl(comissao)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{brl(pago)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${receber < 0 ? "text-emerald-600" : receber > 0.01 ? "text-rose-600" : "text-slate-700"}`}>{brl(saldo)}</td>
                  <td className="px-4 py-3 text-center">
                    {receber < 0 ? (
                      <Badge tone="success" icon={CheckCircle2}>Devedor</Badge>
                    ) : saldo <= 0.01 ? (
                      <Badge tone="neutral" icon={CheckCircle2}>Em dia</Badge>
                    ) : (
                      <Badge tone="danger" icon={AlertTriangle}>Pendente</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <ActionMenu>
                        <button onClick={() => setLancar({ cambistaId: c.id, nome: c.nome, comissaoPadrao: c.comissaoPadrao })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors duration-150"><Plus size={14} className="text-orange-600" /> Novo lançamento</button>
                        <button onClick={() => gerarRelatorio && gerarRelatorio(c.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors duration-150"><FileText size={14} className="text-emerald-600" /> Relatório semanal</button>
                        <button onClick={() => setPagar({ cambistaId: c.id, nome: c.nome, valor: saldo > 0 ? saldo.toFixed(2) : "", data: iso(new Date()), obs: "" })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors duration-150"><Banknote size={14} className="text-orange-600" /> Registrar pagamento</button>
                        <button onClick={() => setEditar({ ...c })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors duration-150"><Pencil size={14} /> Editar</button>
                        <div className="border-t border-slate-100 my-1"></div>
                        <button onClick={() => {
                          if (confirm(`CUIDADO: Excluir ${c.nome}?\n\nTodos os lançamentos dele também serão removidos. Esta ação é irreversível.\n\nClique OK para confirmar.`)) {
                            if (confirm(`Tem certeza? Clique OK NOVAMENTE para deletar ${c.nome}.`)) {
                              registrarAuditoria("deletar_cambista", { id: c.id, nome: c.nome });
                              update((d) => {
                                d.cambistas = d.cambistas.filter((x) => x.id !== c.id);
                                d.lancamentos = d.lancamentos.filter((l) => l.cambistaId !== c.id);
                              });
                              toast(`${c.nome} foi removido.`, "success");
                            }
                          }
                        }} className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors duration-150"><Trash2 size={14} /> Deletar</button>
                      </ActionMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={Users} titulo="Nenhum cambista cadastrado" descricao='Clique em "Novo Cambista" para começar a registrar lançamentos.' />
                  </td>
                </tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-semibold text-slate-800">
                  <td className="px-4 py-3">Totais ({linhas.length})</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(linhas.reduce((a, r) => a + r.bruto, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(linhas.reduce((a, r) => a + r.comissao, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{brl(linhas.reduce((a, r) => a + r.pago, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(() => {
                      const totSaldo = linhas.reduce((a, r) => a + r.saldo, 0);
                      return <span className={`${totSaldo > 0.01 ? "text-rose-600" : totSaldo < -0.01 ? "text-emerald-600" : "text-slate-700"}`}>{brl(totSaldo)}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const totReceber = linhas.reduce((a, r) => a + r.receber, 0);
                      return <span className={`text-xs tabular-nums font-bold ${totReceber >= 0 ? "text-emerald-600" : "text-rose-600"}`}>Líquido {brl(totReceber)}</span>;
                    })()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editar && (
        <ModalCambista dados={editar} onClose={() => setEditar(null)}
          onSave={(val) => {
            update((d) => {
              if (val.id) { const i = d.cambistas.findIndex((x) => x.id === val.id); d.cambistas[i] = val; }
              else d.cambistas.push({ ...val, id: uid(), criadoEm: iso(new Date()) });
            });
            toast(val.id ? "Cambista atualizado." : "Cambista criado.", "success");
            setEditar(null);
          }} />
      )}
      {pagar && (
        <ModalPagamento dados={pagar} onClose={() => setPagar(null)}
          onSave={(val) => {
            update((d) => { d.pagamentos = d.pagamentos || []; d.pagamentos.push({ id: uid(), ...val }); });
            toast("Pagamento registrado.", "success");
            setPagar(null);
          }} />
      )}
      {lancar && (
        <ModalLancamento dados={lancar} onClose={() => setLancar(null)}
          onSave={(val) => {
            update((d) => { d.lancamentos.push({ id: uid(), cambistaId: lancar.cambistaId, data: val.data, positivo: val.valor, movimentacao: null, pct: val.pct, obs: "" }); });
            registrarAuditoria("criar_lancamento", { cambista: lancar.nome, valor: val.valor });
            toast("Lançamento registrado.", "success");
            setLancar(null);
          }} />
      )}
      {detalhe && (
        <ModalDetalheCambista cambista={detalhe} lancamentos={db.lancamentos.filter((l) => l.cambistaId === detalhe.id)}
          pagamentos={(db.pagamentos || []).filter((p) => p.cambistaId === detalhe.id)} onClose={() => setDetalhe(null)} />
      )}
      {planilhaModal && (
        <ModalPlanilhaOnline db={db} update={update} sincronizando={sincronizando}
          onSincronizar={sincronizar} onClose={() => setPlanilhaModal(false)} />
      )}
    </div>
  );
}

/* ======================== MODAL: PLANILHA ONLINE ======================== */
function ModalPlanilhaOnline({ db, update, sincronizando, onSincronizar, onClose }) {
  const [url, setUrl] = useState(db.planilhaUrl || "");

  const salvarLink = () => {
    if (url.trim() && !extrairSheetId(url)) return toast("Link inválido. Cole o link do Google Sheets (docs.google.com/spreadsheets/d/...).", "error");
    update((d) => { d.planilhaUrl = url.trim(); });
    toast(url.trim() ? "Link da planilha salvo." : "Link removido.", "success");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-900 flex items-center gap-2"><Link2 size={16} className="text-emerald-600" /> Planilha Online (Google Sheets)</div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors duration-150"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-slate-600">
            Edite os dados direto no Google Sheets e clique em <span className="font-semibold">Sincronizar</span> aqui — o site é atualizado com o que está na planilha.
          </div>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside bg-slate-50 rounded-lg p-3">
            <li>Use a <span className="font-semibold">Planilha de Comissões</span> (colunas NOME, POSITIVO, PERCENTUAL, PAGAMENTO) ou importe o arquivo do botão <span className="font-semibold">Exportar Planilha</span> no Google Sheets.</li>
            <li>No Sheets: <span className="font-semibold">Compartilhar → Acesso geral: "Qualquer pessoa com o link" → Leitor</span> e copie o link.</li>
            <li>Cole o link abaixo, salve e clique em Sincronizar sempre que editar a planilha.</li>
          </ol>
          <div>
            <label className={lbl}>Link da planilha</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={inp} placeholder="https://docs.google.com/spreadsheets/d/..." />
          </div>
          {db.planilhaUltimaSync && <div className="text-xs text-slate-500 flex items-center gap-1.5"><Clock size={12} /> Última sincronização: {db.planilhaUltimaSync}</div>}
          <div className="text-[11px] text-amber-700 bg-amber-100 border border-amber-300 rounded-lg p-2.5">
            A planilha vira a fonte dos dados: sincronizar <span className="font-semibold">substitui</span> cambistas, lançamentos, pagamentos e gastos (se houver aba GASTOS) do site pelos dela. Sem coluna DATA, os registros entram com a data do dia da sincronização.
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={salvarLink} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors duration-150">Salvar link</button>
          <button onClick={() => { if (!extrairSheetId(url)) return toast("Cole um link válido do Google Sheets.", "error"); update((d) => { d.planilhaUrl = url.trim(); }); onSincronizar(url.trim()); }}
            disabled={sincronizando}
            className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors duration-150 disabled:opacity-50 inline-flex items-center gap-2">
            <RefreshCw size={14} className={sincronizando ? "animate-spin" : ""} /> {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCambista({ dados, onClose, onSave }) {
  const [f, setF] = useState({ ...dados, comissaoTxt: String(dados.comissaoPadrao * 100) });
  const [erros, setErros] = useState({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const salvar = () => {
    const novoErros = {};
    if (!f.nome.trim()) novoErros.nome = "Nome obrigatório";
    if (f.contato && !validarTelefone(f.contato)) novoErros.contato = "Telefone inválido. Use (11) 99999-9999 ou 5511999999999";

    const c = parseFloat(String(f.comissaoTxt).replace(",", ".")) / 100;
    if (isNaN(c) || c < 0 || c > 1) novoErros.comissao = "Comissão deve estar entre 0% e 100%";

    if (Object.keys(novoErros).length > 0) {
      setErros(novoErros);
      return;
    }

    registrarAuditoria(f.id ? "editar_cambista" : "criar_cambista", { nome: f.nome, comissao: c });
    onSave({ id: f.id, nome: f.nome.trim(), contato: f.contato, comissaoPadrao: isNaN(c) ? 0 : c, ativo: f.ativo });
  };
  return (
    <Modal titulo={f.id ? "Editar Cambista" : "Novo Cambista"} onClose={onClose} onSave={salvar}>
      <Campo label="Nome">
        <input value={f.nome} onChange={(e) => set("nome", e.target.value)} className={`${inp} ${erros.nome ? "border-red-500 focus:ring-red-500/30" : ""}`} placeholder="Nome do cambista" />
        {erros.nome && <p className="text-xs text-red-600 mt-1">{erros.nome}</p>}
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Contato">
          <input value={f.contato} onChange={(e) => set("contato", e.target.value)} className={`${inp} ${erros.contato ? "border-red-500 focus:ring-red-500/30" : ""}`} placeholder="(11) 99999-9999" />
          {erros.contato && <p className="text-xs text-red-600 mt-1">{erros.contato}</p>}
        </Campo>
        <Campo label="Comissão (%)">
          <input value={f.comissaoTxt} onChange={(e) => set("comissaoTxt", e.target.value)} className={`${inp} ${erros.comissao ? "border-red-500 focus:ring-red-500/30" : ""}`} inputMode="decimal" />
          {erros.comissao && <p className="text-xs text-red-600 mt-1">{erros.comissao}</p>}
        </Campo>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Cambista Ativo</label>
    </Modal>
  );
}

function ModalPagamento({ dados, onClose, onSave }) {
  const [f, setF] = useState({ ...dados });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const salvar = () => {
    const v = parseFloat(String(f.valor).replace(",", "."));
    if (isNaN(v) || v <= 0) return toast("Informe um valor válido.", "error");
    onSave({ cambistaId: f.cambistaId, data: f.data, valor: v, obs: f.obs });
  };
  return (
    <Modal titulo={`Registrar Pagamento de ${dados.nome}`} onClose={onClose} onSave={salvar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Valor (R$)"><input value={f.valor} onChange={(e) => set("valor", e.target.value)} className={inp} inputMode="decimal" autoFocus /></Campo>
        <Campo label="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} /></Campo>
      </div>
      <Campo label="Observação (opcional)"><input value={f.obs} onChange={(e) => set("obs", e.target.value)} className={inp} placeholder="pix, dinheiro..." /></Campo>
    </Modal>
  );
}

function ModalLancamento({ dados, onClose, onSave }) {
  const [f, setF] = useState({ valor: "", data: iso(new Date()), pctTxt: String(Math.round((dados.comissaoPadrao || 0) * 1000) / 10) });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valorNum = toNum(f.valor);
  const pctNum = toNum(f.pctTxt) / 100;
  const comissao = valorNum * pctNum;
  const liquido = valorNum - comissao;
  const salvar = () => {
    if (String(f.valor).trim() === "" || isNaN(parseFloat(String(f.valor).replace(",", ".")))) return toast("Informe o valor movimentado (use negativo se ele perdeu).", "error");
    if (pctNum < 0 || pctNum > 1) return toast("A comissão deve estar entre 0% e 100%.", "error");
    onSave({ valor: valorNum, data: f.data, pct: pctNum });
  };
  return (
    <Modal titulo={`Novo Lançamento — ${dados.nome}`} onClose={onClose} onSave={salvar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Valor Movimentado (R$)">
          <input value={f.valor} onChange={(e) => set("valor", e.target.value)} className={inp} inputMode="decimal" placeholder="ex.: 500 ou -200" autoFocus />
        </Campo>
        <Campo label="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} /></Campo>
      </div>
      <Campo label="Comissão (%)">
        <input value={f.pctTxt} onChange={(e) => set("pctTxt", e.target.value)} className={inp} inputMode="decimal" />
      </Campo>
      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-slate-500">Comissão</span><span className={`font-semibold tabular-nums ${comissao < 0 ? "text-rose-600" : "text-slate-900"}`}>{brl(comissao)}</span></div>
        <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500">{liquido >= 0 ? "Líquido da Casa" : "Saldo Devedor"}</span><span className={`font-bold tabular-nums ${liquido >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{brl(liquido)}</span></div>
      </div>
      <div className="text-xs text-slate-400">Use um valor <span className="font-medium text-rose-500">negativo</span> se o cambista perdeu na conta. Nesse caso o resultado vira saldo devedor (vermelho).</div>
    </Modal>
  );
}

function MiniKpi({ rotulo, v, cor = "text-slate-900", dot = "bg-slate-400" }) {
  return (
    <div className="bg-white p-3 min-w-0">
      <div className="flex items-center min-w-0"><span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${dot}`} /><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">{rotulo}</span></div>
      <div className={`text-lg font-bold tabular-nums truncate mt-1 ${cor}`}>{v}</div>
    </div>
  );
}

function ModalDetalheCambista({ cambista, lancamentos, pagamentos, onClose }) {
  const [gran, setGran] = useState("mes");
  const [ref, setRef] = useState(new Date());
  const [dtDe, setDtDe] = useState("");
  const [dtAte, setDtAte] = useState("");
  const cambById = { [cambista.id]: cambista };
  const custom = dtDe && dtAte;
  const [s, e] = useMemo(() => custom ? [parse(dtDe), parse(dtAte)] : periodRange(gran, ref), [custom, dtDe, dtAte, gran, ref]);
  const ls = useMemo(() => {
    if (custom) return lancamentos.filter((l) => dentro(l, s, e));
    return gran === "tudo" ? lancamentos : lancamentos.filter((l) => dentro(l, s, e));
  }, [lancamentos, custom, gran, s, e]);
  const ag = useMemo(() => agrega(ls, cambById), [ls]);

  const porDia = useMemo(() => {
    const map = new Map();
    for (const l of ls) {
      const cur = map.get(l.data) || { data: l.data, total: 0, n: 0 };
      cur.total += l.positivo; cur.n += 1;
      map.set(l.data, cur);
    }
    return [...map.values()].sort((a, b) => b.data.localeCompare(a.data));
  }, [ls]);

  const pagoNoPeriodo = pagamentos.filter((p) => custom ? dentro(p, s, e) : (gran === "tudo" || dentro(p, s, e))).reduce((a, p) => a + p.valor, 0);
  const saldo = ag.comissao - pagoNoPeriodo;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-orange-600 text-white font-bold text-xl flex items-center justify-center shrink-0">{(cambista.nome || "?").trim()[0]?.toUpperCase() || "?"}</div>
            <div className="min-w-0">
              <div className="font-bold text-lg text-slate-900 truncate flex items-center gap-2">
                {cambista.nome}
                {!cambista.ativo && <Badge tone="neutral">inativo</Badge>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{cambista.contato || "sem contato"} &middot; padrão {pct(cambista.comissaoPadrao)}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0 transition-colors duration-150"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
              {[["semana","Semana"],["mes","Mês"],["tudo","Tudo"]].map(([id, lab]) => (
                <button key={id} onClick={() => { setGran(id); setDtDe(""); setDtAte(""); }} className={`px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${!custom && gran === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{lab}</button>
              ))}
            </div>
            <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors duration-150 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
              <span className="text-slate-500">De</span>
              <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
              <span className="text-slate-500">Até</span>
              <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
            </div>
            {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">limpar</button>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border border-slate-200 bg-slate-200">
            <MiniKpi rotulo="Bruto" v={brl(ag.bruto)} dot="bg-slate-400" />
            <MiniKpi rotulo="Comissão" v={brl(ag.comissao)} cor="text-slate-900" dot="bg-amber-500" />
            <MiniKpi rotulo="Líquido" v={brl(ag.receber)} cor={ag.receber >= 0 ? "text-emerald-600" : "text-rose-600"} dot={ag.receber >= 0 ? "bg-emerald-500" : "bg-rose-500"} />
            <MiniKpi rotulo="Saldo Pendente" v={brl(Math.max(0, saldo))} cor={saldo > 0.01 ? "text-amber-600" : "text-emerald-600"} dot={saldo > 0.01 ? "bg-amber-500" : "bg-emerald-500"} />
          </div>

          <div className={cardBox}>
            <div className="flex items-center justify-between mb-3">
              <div className={titSec + " mb-0"}>Histórico por Dia</div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Saldo Total</div>
                <div className={`text-lg font-bold tabular-nums ${ag.bruto >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{ag.bruto >= 0 ? "+" : ""}{brl(ag.bruto)}</div>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {porDia.map((d) => (
                <div key={d.data} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-600 tabular-nums">
                    {fmtData(d.data)}
                    {d.n > 1 && <span className="text-xs text-slate-500 ml-2">({d.n} lançamentos)</span>}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${d.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{d.total >= 0 ? "+" : ""}{brl(d.total)}</span>
                </div>
              ))}
              {porDia.length === 0 && <EmptyState icon={Inbox} titulo="Nenhum lançamento neste período" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== CONTROLE DE GASTOS ======================== */
function GastosControl({ db, update, gran, ref_, range }) {
  const [categoria, setCategoria] = useState("Alimentação");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(iso(new Date()));
  const [responsavel, setResponsavel] = useState("");
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState("");
  const [paginaGastos, setPaginaGastos] = useState(1);
  const [dtDe, setDtDe] = useState("");
  const [dtAte, setDtAte] = useState("");

  const custom = dtDe && dtAte;
  const [s, e] = custom ? [parse(dtDe), parse(dtAte)] : range;
  const ITENS_POR_PAGINA = 10;

  const gastosPeriodo = useMemo(() => (db.gastos || []).filter((g) => dentro({ data: g.data }, s, e)), [db.gastos, s, e]);

  const agregar = (gastos) => {
    const result = {};
    let total = 0;
    for (const g of gastos) {
      result[g.categoria] = (result[g.categoria] || 0) + g.valor;
      total += g.valor;
    }
    return { por_categoria: result, total };
  };

  const dados_agregados = useMemo(() => agregar(gastosPeriodo), [gastosPeriodo]);

  const nomesResponsaveis = useMemo(() => {
    const nomes = new Set((db.gastos || []).map((g) => (g.responsavel || "").trim()).filter(Boolean));
    return [...nomes].sort();
  }, [db.gastos]);

  const porResponsavel = useMemo(() => {
    const mapa = {};
    for (const g of gastosPeriodo) {
      const nome = (g.responsavel || "").trim() || "Não informado";
      mapa[nome] = (mapa[nome] || 0) + g.valor;
    }
    return Object.entries(mapa)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [gastosPeriodo]);

  const lista_filtrada = useMemo(() => {
    return (db.gastos || [])
      .filter((g) => dentro({ data: g.data }, s, e))
      .filter((g) => !busca || g.descricao.toLowerCase().includes(busca.toLowerCase()) || g.categoria.toLowerCase().includes(busca.toLowerCase()) || (g.responsavel || "").toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [db.gastos, busca, s, e]);

  const lista_paginada = useMemo(() => {
    const inicio = (paginaGastos - 1) * ITENS_POR_PAGINA;
    return lista_filtrada.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [lista_filtrada, paginaGastos]);

  const totalPaginas = Math.ceil(lista_filtrada.length / ITENS_POR_PAGINA);

  const tendenciaGastos = useMemo(() => {
    const g = gran === "tudo" ? "mes" : gran;
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const r = shiftRef(g, ref_, -i);
      const [rs, re] = periodRange(g, r);
      const gs = (db.gastos || []).filter((gst) => dentro({ data: gst.data }, rs, re));
      const totalGasto = gs.reduce((acc, gst) => acc + gst.valor, 0);
      out.push({ rot: rotuloCurto(g, r), total: totalGasto });
    }
    return out;
  }, [db.gastos, gran, ref_]);

  const adicionar = () => {
    const v = parseFloat(String(valor).replace(",", "."));
    if (!categoria.trim()) return toast("Selecione uma categoria.", "error");
    if (!responsavel.trim()) return toast("Informe quem gastou.", "error");
    if (!descricao.trim()) return toast("Informe a descrição.", "error");
    if (isNaN(v) || v <= 0) return toast("Informe um valor válido.", "error");

    update((d) => {
      if (editId) {
        const i = d.gastos.findIndex((x) => x.id === editId);
        d.gastos[i] = { id: editId, categoria, descricao: descricao.trim(), valor: v, data, responsavel: responsavel.trim() };
      } else {
        d.gastos.push({ id: uid(), categoria, descricao: descricao.trim(), valor: v, data, responsavel: responsavel.trim() });
      }
    });
    toast(editId ? "Gasto atualizado." : "Gasto adicionado.", "success");

    setCategoria("Alimentação");
    setDescricao("");
    setValor("");
    setData(iso(new Date()));
    setResponsavel("");
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-slate-500">Período: <span className="font-medium text-slate-700">{custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotuloPeriodo(gran, ref_)}</span></div>
        <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors duration-150 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
          <span className="text-slate-500">De</span>
          <input type="date" value={dtDe} onChange={(ev) => { setDtDe(ev.target.value); setPaginaGastos(1); }} className="outline-none bg-transparent text-slate-700" />
          <span className="text-slate-500">Até</span>
          <input type="date" value={dtAte} onChange={(ev) => { setDtAte(ev.target.value); setPaginaGastos(1); }} className="outline-none bg-transparent text-slate-700" />
        </div>
        {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">limpar</button>}
      </div>

      <div className={cardBox}>
        <div className={titSec}>{editId ? "Editar Gasto" : "Novo Gasto"}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className={lbl}>Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
              {CATEGORIAS_GASTOS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Quem gastou</label>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inp} placeholder="Nome do responsável" list="lista-responsaveis" />
            <datalist id="lista-responsaveis">
              {nomesResponsaveis.map((nome) => <option key={nome} value={nome} />)}
            </datalist>
          </div>
          <div>
            <label className={lbl}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inp} placeholder="Descrição do gasto" />
          </div>
          <div>
            <label className={lbl}>Valor (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} className={inp} placeholder="0,00" inputMode="decimal" />
          </div>
          <div>
            <label className={lbl}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
          </div>
          <button onClick={adicionar} className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg px-3 h-10 w-full transition-colors duration-150"><Check size={16} /> {editId ? "Salvar" : "Adicionar"}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <StatPanel cols="grid-cols-1">
          <Kpi titulo="Total Gasto" valor={brl(dados_agregados.total)} cor="amber" sub={custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotuloPeriodo(gran, ref_)} />
        </StatPanel>

        <div className={`${cardBox} lg:col-span-2`}>
          <div className={titSec}>Gasto por Categoria</div>
          <div className="space-y-2.5">
            {CATEGORIAS_GASTOS.map((cat, idx) => {
              const valor_cat = dados_agregados.por_categoria[cat] || 0;
              const pct_cat = dados_agregados.total > 0 ? (valor_cat / dados_agregados.total) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">{cat}</span>
                    <span className="text-slate-900 font-bold tabular-nums">{brl(valor_cat)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct_cat}%`, backgroundColor: CORES_LARANJA[idx % CORES_LARANJA.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {porResponsavel.length > 0 && (
        <div className={cardBox}>
          <div className="flex items-center justify-between mb-3">
            <div className={titSec + " mb-0"}>Gasto por Responsável</div>
            <div className="text-xs text-slate-500">quem mais gastou no período</div>
          </div>
          <div className="space-y-2.5">
            {porResponsavel.map((r, idx) => {
              const pct_r = dados_agregados.total > 0 ? (r.total / dados_agregados.total) * 100 : 0;
              return (
                <div key={r.nome}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium flex items-center gap-2">
                      {idx === 0 && <Badge tone="warning">Maior gasto</Badge>}
                      {r.nome}
                    </span>
                    <span className="text-slate-900 font-bold tabular-nums">{brl(r.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 bg-orange-500" style={{ width: `${pct_r}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={cardBox}>
        <div className={titSec}>Tendência de Gastos (Últimos Períodos)</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tendenciaGastos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME_CHART.grid} vertical={false} />
              <XAxis dataKey="rot" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtEixo} width={40} />
              <Tooltip formatter={(v) => [brl(v), "Total"]} contentStyle={CHART_TOOLTIP_STYLE} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Line type="monotone" dataKey="total" stroke="#475569" strokeWidth={2.5} dot={{ r: 4, fill: "#475569" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-wrap">
          <Search size={15} className="text-slate-400" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPaginaGastos(1); }} placeholder="Buscar por categoria, responsável ou descrição..." className="text-sm flex-1 outline-none bg-transparent placeholder:text-slate-400" />
          <span className="text-xs text-slate-500 tabular-nums">{lista_filtrada.length} gasto(s)</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/80 backdrop-blur">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Categoria</th>
                <th className="px-4 py-2.5">Responsável</th>
                <th className="px-4 py-2.5">Descrição</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {lista_paginada.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-150">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{fmtData(g.data)}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{g.categoria}</td>
                  <td className="px-4 py-2.5 text-slate-600">{g.responsavel || <span className="text-slate-400">Não informado</span>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{g.descricao}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{brl(g.valor)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditId(g.id); setCategoria(g.categoria); setDescricao(g.descricao); setValor(String(g.valor)); setData(g.data); setResponsavel(g.responsavel || ""); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`Editar gasto ${g.descricao}`} title="Editar" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors duration-150"><Pencil size={14} /></button>
                      <button onClick={() => { update((d) => { d.gastos = d.gastos.filter((x) => x.id !== g.id); }); toast("Gasto removido.", "success"); }} aria-label={`Excluir gasto ${g.descricao}`} title="Excluir" className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500 transition-colors duration-150"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {lista_filtrada.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={DollarSign} titulo="Nenhum gasto registrado" descricao="Nenhum gasto foi encontrado para este período ou filtro." />
                  </td>
                </tr>
              )}
            </tbody>
            {lista_filtrada.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-slate-700">Total {busca ? "filtrado" : "do período"} ({lista_filtrada.length})</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{brl(lista_filtrada.reduce((a, g) => a + g.valor, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-600">
            <span>Página {paginaGastos} de {totalPaginas}</span>
            <div className="flex gap-1">
              <button onClick={() => setPaginaGastos(Math.max(1, paginaGastos - 1))} disabled={paginaGastos === 1} aria-label="Página anterior" className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors duration-150"><ChevronLeft size={16} /></button>
              <button onClick={() => setPaginaGastos(Math.min(totalPaginas, paginaGastos + 1))} disabled={paginaGastos === totalPaginas} aria-label="Próxima página" className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors duration-150"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================== NAVEGAÇÃO DE ABAS PARA RELATÓRIOS ======================== */
function RelatoriosTabs({ abas, ativa, onChange }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <>
      {/* Desktop: Abas horizontais */}
      <div className="hidden sm:flex gap-1 border-b border-slate-200 pb-0">
        {abas.map((aba) => {
          const Icon = aba.icon;
          const isActive = ativa === aba.id;
          return (
            <button
              key={aba.id}
              onClick={() => onChange(aba.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                isActive
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Icon size={16} />
              {aba.label}
            </button>
          );
        })}
      </div>

      {/* Mobile: Dropdown */}
      <div className="sm:hidden relative">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
        >
          <span className="flex items-center gap-2">
            {(() => {
              const Icon = abas.find((a) => a.id === ativa)?.icon;
              return Icon ? <Icon size={16} /> : null;
            })()}
            {abas.find((a) => a.id === ativa)?.label}
          </span>
          <svg className={`w-4 h-4 transition-transform duration-150 ${showMobileMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
        {showMobileMenu && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-modal overflow-hidden animate-scale-in origin-top">
            {abas.map((aba) => {
              const Icon = aba.icon;
              const isActive = ativa === aba.id;
              return (
                <button
                  key={aba.id}
                  onClick={() => {
                    onChange(aba.id);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b last:border-0 transition-colors duration-150 ${
                    isActive ? "bg-orange-50 text-orange-600" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  {aba.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ======================== ABA: FECHAMENTO SEMANAL ======================== */
function FechamentoSemanal({ db, cambById, lancs, gran, ref_, preSelecionar, onConsumir }) {
  const [modo, setModo] = useState("paga");
  const [cambistaSel, setCambistaSel] = useState("");
  const [nome, setNome] = useState("");
  const [periodoTxt, setPeriodoTxt] = useState("");
  const [bruto, setBruto] = useState("");
  const [comissaoPct, setComissaoPct] = useState("10");
  const [auto, setAuto] = useState(true);
  const [comissaoManual, setComissaoManual] = useState("");
  const [totalManual, setTotalManual] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pagamentoAte, setPagamentoAte] = useState("");
  const [html2canvasPronto, setHtml2canvasPronto] = useState(typeof window !== "undefined" && !!window.html2canvas);
  const ticketRef = useRef(null);

  const [s, e] = periodRange(gran, ref_);
  const periodoDefault = gran === "tudo" ? "Todo o Período" : `${pad(s.getDate())}/${pad(s.getMonth() + 1)} a ${pad(e.getDate())}/${pad(e.getMonth() + 1)}`;

  useEffect(() => {
    if (typeof window === "undefined" || window.html2canvas) { setHtml2canvasPronto(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    script.onload = () => setHtml2canvasPronto(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = "@media print { body * { visibility: hidden; } #ticket-print-area, #ticket-print-area * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } #ticket-print-area { position: fixed; left: 50%; top: 24px; transform: translateX(-50%); width: 420px; max-width: 92vw; padding: 24px; background: #020617 !important; border: 4px solid #f97316; border-radius: 24px; } }";
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const aoSelecionarCambista = (id) => {
    setCambistaSel(id);
    if (!id) return;
    const c = cambById[id];
    if (!c) return;
    const ls = lancs.filter((l) => l.cambistaId === id);
    const ag = agrega(ls, cambById);
    setNome(c.nome);
    setTelefone(c.contato || "");
    setComissaoPct(String(Math.round(c.comissaoPadrao * 1000) / 10));
    setBruto(ag.bruto.toFixed(2).replace(".", ","));
    setModo(ag.receber >= 0 ? "paga" : "recebe");
  };

  useEffect(() => {
    if (preSelecionar) {
      aoSelecionarCambista(preSelecionar);
      onConsumir && onConsumir();
    }
  }, [preSelecionar]);

  const brutoNum = toNum(bruto);
  const pctNum = toNum(comissaoPct);
  const comissaoAuto = (brutoNum * pctNum) / 100;
  const totalAuto = brutoNum - comissaoAuto;
  const comissaoNum = auto ? comissaoAuto : toNum(comissaoManual);
  const totalNum = auto ? totalAuto : toNum(totalManual);
  const inicial = (nome || "").trim()[0]?.toUpperCase() || "?";

  const baixarImagem = async () => {
    if (!window.html2canvas || !ticketRef.current) { toast("O gerador de imagem ainda está carregando. Tente novamente em alguns segundos.", "error"); return; }
    try {
      const canvas = await window.html2canvas(ticketRef.current, { backgroundColor: null, scale: 3, useCORS: true });
      const link = document.createElement("a");
      link.download = `relatorio-${(nome || "cambista").toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast("Imagem baixada com sucesso.", "success");
    } catch (err) {
      toast("Não consegui gerar a imagem agora. Use Salvar como PDF como alternativa.", "error");
    }
  };

  const enviarWhatsApp = async () => {
    if (!telefone) return toast("Informe o número do WhatsApp do cambista.", "error");
    if (!window.html2canvas || !ticketRef.current) return toast("Aguarde o gerador de imagem carregar.", "error");

    try {
      const canvas = await window.html2canvas(ticketRef.current, { backgroundColor: null, scale: 3, useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

      const formData = new FormData();
      formData.append("file", blob, "relatorio.png");
      formData.append("phone", telefone.replace(/\D/g, ""));
      formData.append("name", nome);

      const response = await fetch("/api/whatsapp/send", { method: "POST", body: formData });
      if (response.ok) {
        toast("Relatório enviado com sucesso via WhatsApp!", "success");
      } else {
        toast("Erro ao enviar relatório. Verifique a conexão ou o número do telefone.", "error");
      }
    } catch (err) {
      toast("Erro ao enviar relatório: " + err.message, "error");
    }
  };

  const salvarPdf = () => window.print();

  const inpDark = "w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 placeholder:text-slate-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-500">Gerador de Relatório de Fechamento</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-5">
        <div className="bg-slate-950 rounded-2xl p-5 text-white space-y-4 h-fit shadow-card">
          <div>
            <div className="text-lg font-black"><span className="text-white">ESPORTEVIP</span><span className="text-orange-500">APP</span></div>
            <div className="text-xs text-slate-400">Gerador de Relatório</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setModo("paga")} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2 justify-center transition-colors duration-150 ${modo === "paga" ? "border-red-500 bg-red-500/10 text-white" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}>
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Você Paga
            </button>
            <button onClick={() => setModo("recebe")} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2 justify-center transition-colors duration-150 ${modo === "recebe" ? "border-emerald-500 bg-emerald-500/10 text-white" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Você Recebe
            </button>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Cambista (opcional)</label>
            <select value={cambistaSel} onChange={(ev) => aoSelecionarCambista(ev.target.value)} className={inpDark}>
              <option value="">Preencher Manualmente</option>
              {db.cambistas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Nome do Cambista</label>
            <input value={nome} onChange={(ev) => setNome(ev.target.value)} className={inpDark} placeholder="Nome" />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Período</label>
            <input value={periodoTxt || periodoDefault} onChange={(ev) => setPeriodoTxt(ev.target.value)} className={inpDark} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Bruto (R$)</label>
              <input value={bruto} onChange={(ev) => setBruto(ev.target.value)} className={inpDark} inputMode="decimal" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Comissão %</label>
              <input value={comissaoPct} onChange={(ev) => setComissaoPct(ev.target.value)} className={inpDark} inputMode="decimal" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={auto} onChange={(ev) => setAuto(ev.target.checked)} /> Calcular Automaticamente
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Comissão (R$)</label>
              <input value={auto ? numFmt(comissaoNum) : comissaoManual} onChange={(ev) => setComissaoManual(ev.target.value)} disabled={auto} className={`${inpDark} ${auto ? "opacity-60" : ""}`} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Total Geral (R$)</label>
              <input value={auto ? numFmt(totalNum) : totalManual} onChange={(ev) => setTotalManual(ev.target.value)} disabled={auto} className={`${inpDark} ${auto ? "opacity-60" : ""}`} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Telefone (WhatsApp)</label>
            <input value={telefone} onChange={(ev) => setTelefone(ev.target.value)} className={inpDark} placeholder="(00) 0 0000-0000" />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Pagamento Até (dia)</label>
            <input value={pagamentoAte} onChange={(ev) => setPagamentoAte(ev.target.value)} className={inpDark} placeholder="ex.: sexta-feira" />
          </div>

          <div className="space-y-2 pt-2">
            <button onClick={baixarImagem} disabled={!html2canvasPronto} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg py-2.5 text-sm transition-colors duration-150 flex items-center justify-center gap-2">
              {!html2canvasPronto && <Loader2 size={15} className="animate-spin" />} {html2canvasPronto ? "Baixar Imagem (PNG)" : "Carregando..."}
            </button>
            <button onClick={enviarWhatsApp} disabled={!html2canvasPronto} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-colors duration-150">
              {html2canvasPronto ? <Send size={15} /> : <Loader2 size={15} className="animate-spin" />} {html2canvasPronto ? "Enviar WhatsApp" : "Carregando..."}
            </button>
            <button onClick={salvarPdf} className="w-full border border-slate-700 hover:bg-slate-900 text-white rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-colors duration-150">
              <Printer size={15} /> Salvar como PDF
            </button>
          </div>
        </div>

        <div className="min-w-0">
          {/* IMPORTANTE (exportação): html2canvas 1.4.1 não suporta `gap` em flexbox —
              dentro desta área use margens (mr-/ml-) em vez de gap, senão a imagem sai
              com elementos sobrepostos. Largura fixa para o PNG sair como ticket. */}
          <div id="ticket-print-area" ref={ticketRef} className="rounded-3xl border-4 border-orange-500 p-8 w-full max-w-[460px] mx-auto" style={{ background: "#020617" }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-black tracking-tight"><span className="text-white">ESPORTEVIP</span><span className="text-orange-500">APP</span></div>
              {telefone && <div className="text-white text-sm font-semibold mt-1">{telefone}</div>}
              <div className="text-slate-500 text-[11px] tracking-[0.2em] mt-0.5">ESPORTEVIP.APP</div>
              <div className="h-px w-40 bg-slate-700 mx-auto mt-4" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[11px] tracking-[0.3em] text-orange-500 font-bold uppercase">RELATÓRIO</div>
              <div className="text-white font-black uppercase leading-[0.95] mt-1 text-3xl">{rotuloPeriodo(gran, ref_)}</div>
              <div className="inline-block mt-4 bg-slate-800/70 border border-slate-700 rounded-full px-4 py-1.5 text-xs">
                <span className="text-slate-500 mr-2">Período</span><span className="font-semibold text-white">{periodoTxt || periodoDefault}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <div className="flex items-center min-w-0">
                  <div className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center shrink-0 mr-3">{inicial}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Cambista</div>
                    <div className="text-slate-900 font-bold truncate leading-relaxed pb-0.5">{nome || "Sem Nome"}</div>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold shrink-0 ml-3">Fechamento</div>
              </div>
              <div className="relative border-t border-dashed border-slate-200">
                <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full" style={{ background: "#020617" }} />
                <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ background: "#020617" }} />
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Bruto</span>
                <span className="text-slate-900 font-bold text-2xl tabular-nums">{numFmt(brutoNum)}</span>
              </div>
              <div className="px-5 pb-4 pt-4 flex items-center justify-between border-t border-slate-100">
                <span className="text-slate-500 font-medium">Comissão <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded ml-1.5">{pctNum}%</span></span>
                <span className="text-slate-900 font-bold text-2xl tabular-nums">{numFmt(comissaoNum)}</span>
              </div>
              <div className={`px-5 py-4 flex items-center justify-between ${modo === "paga" ? "bg-red-600" : "bg-emerald-600"}`}>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-white/70 font-semibold">Total Geral</div>
                  <div className="text-white font-bold">{modo === "paga" ? "Você Paga" : "Nós Temos que Pagar"}</div>
                </div>
                <div className="text-white text-right ml-3">
                  <span className="text-base font-semibold align-top mr-0.5">R$</span><span className="text-3xl font-black">{numFmt(totalNum)}</span>
                </div>
              </div>
            </div>

            <div className="text-center mt-4 text-xs text-slate-400">
              <span className="whitespace-nowrap mr-5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1.5" />Você Paga</span>
              <span className="whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5" />Nós Temos que Pagar</span>
            </div>

            <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center">
              <div className="bg-green-500 text-slate-950 font-black text-xs rounded-lg px-2.5 py-1.5 shrink-0 mr-3">PIX</div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Forma de Pagamento</div>
                <div className="text-white font-bold text-sm leading-relaxed pb-0.5">Aguarde enviarmos a chave Pix</div>
              </div>
            </div>

            {pagamentoAte && (
              <div className="mt-4 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block mr-2" />
                Realize o pagamento até <span className="font-bold text-white">{pagamentoAte}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== ABA: AUDITORIA DE CAMBISTAS ======================== */
function AuditoriaCambistas({ db }) {
  const [dtDe, setDtDe] = useState("");
  const [dtAte, setDtAte] = useState("");
  const [ultimaGeracao, setUltimaGeracao] = useState(localStorage.getItem("ultimaGeracaoAuditoriaCambistas"));

  if (!db.cambistas || db.cambistas.length === 0) {
    return <EmptyState icon={BarChart3} titulo="Nenhum cambista cadastrado" descricao="Crie cambistas para gerar o relatório de auditoria." />;
  }

  const cambistasAtivos = db.cambistas.filter((c) => c.ativo);
  const filtroAtivo = Boolean(dtDe && dtAte);
  const lancamentosPreview = filtroAtivo ? (db.lancamentos || []).filter((l) => dentro(l, parse(dtDe), parse(dtAte))) : (db.lancamentos || []);
  const pagamentosPreview = filtroAtivo ? (db.pagamentos || []).filter((p) => dentro(p, parse(dtDe), parse(dtAte))) : (db.pagamentos || []);

  const totalSemanas = new Set(lancamentosPreview.map((l) => iso(startOfWeek(parse(l.data))))).size;

  const alertasPreview = (() => {
    let count = 0;
    for (const c of cambistasAtivos) {
      const semanas = semanasHistorico(c, lancamentosPreview, pagamentosPreview);
      const alertas = analiseAnomalias(semanas, c);
      count += alertas.filter((a) => a.tipo !== "aviso").length;
    }
    return count;
  })();

  const gerarPdf = () => {
    window.print();
    const agora = new Date().toLocaleString("pt-BR");
    setUltimaGeracao(agora);
    localStorage.setItem("ultimaGeracaoAuditoriaCambistas", agora);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Auditoria de Cambistas</h2>
        <p className="text-sm text-slate-500">Análise histórica com detecção de fraude, comprometimento e ranking de risco</p>
      </div>

      <div className={cardBox}>
        <div>
          <label className={lbl}>Período (deixe em branco para histórico completo)</label>
          <div className="flex gap-2">
            <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className={inp} placeholder="De" />
            <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className={inp} placeholder="Até" />
            {(dtDe || dtAte) && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="px-3 text-sm text-slate-400 hover:text-rose-500 font-medium shrink-0 transition-colors">Limpar</button>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-slate-200 bg-slate-200">
          <div className="bg-white p-3 sm:p-4">
            <div className="flex items-center min-w-0"><span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2 bg-indigo-500" /><span className={`${eyebrow} truncate`}>Cambistas</span></div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">{cambistasAtivos.length}</div>
          </div>
          <div className="bg-white p-3 sm:p-4">
            <div className="flex items-center min-w-0"><span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2 bg-slate-400" /><span className={`${eyebrow} truncate`}>Semanas</span></div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">{totalSemanas}</div>
          </div>
          <div className={`p-3 sm:p-4 ${alertasPreview > 0 ? "bg-rose-600" : "bg-white"}`}>
            <div className="flex items-center min-w-0"><span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${alertasPreview > 0 ? "bg-white" : "bg-rose-500"}`} /><span className={`text-[11px] font-semibold uppercase tracking-wider truncate ${alertasPreview > 0 ? "text-rose-100" : "text-slate-500"}`}>Alertas</span></div>
            <div className={`text-2xl font-bold tabular-nums mt-1.5 ${alertasPreview > 0 ? "text-white" : "text-slate-900"}`}>{alertasPreview}</div>
          </div>
        </div>

        {ultimaGeracao && <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5"><Clock size={12} /> Última geração: {ultimaGeracao}</div>}

        <button onClick={gerarPdf} className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-colors duration-150">
          <Printer size={16} /> Gerar PDF
        </button>
      </div>

      <RelatorioAuditoria db={db} dtDe={dtDe} dtAte={dtAte} />
    </div>
  );
}

/* ======================== ABA: AUDITORIA DE GASTOS ======================== */
function AuditoriaGastos({ db }) {
  const [dtDe, setDtDe] = useState("");
  const [dtAte, setDtAte] = useState("");
  const [ultimaGeracao, setUltimaGeracao] = useState(localStorage.getItem("ultimaGeracaoAuditoriaGastos"));

  if (!db.gastos || db.gastos.length === 0) {
    return <EmptyState icon={TrendingUp} titulo="Nenhum gasto registrado" descricao="Registre gastos para gerar o relatório de auditoria." />;
  }

  const filtroAtivo = Boolean(dtDe && dtAte);
  const gastosPreview = filtroAtivo ? (db.gastos || []).filter((g) => dentro({ data: g.data }, parse(dtDe), parse(dtAte))) : (db.gastos || []);
  const { meses, alertas } = analisarGastos(gastosPreview);
  const totalGasto = meses.reduce((a, m) => a + m.total, 0);
  const alertasCount = alertas.filter((a) => a.tipo !== "aviso").length;

  const gerarPdf = () => {
    window.print();
    const agora = new Date().toLocaleString("pt-BR");
    setUltimaGeracao(agora);
    localStorage.setItem("ultimaGeracaoAuditoriaGastos", agora);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Auditoria de Gastos</h2>
        <p className="text-sm text-slate-500">Análise completa com anomalias, saúde financeira e projeções</p>
      </div>

      <div className={cardBox}>
        <div>
          <label className={lbl}>Período (deixe em branco para histórico completo)</label>
          <div className="flex gap-2">
            <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className={inp} placeholder="De" />
            <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className={inp} placeholder="Até" />
            {(dtDe || dtAte) && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="px-3 text-sm text-slate-400 hover:text-rose-500 font-medium shrink-0 transition-colors">Limpar</button>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-slate-200 bg-slate-200">
          <div className="bg-white p-3 sm:p-4">
            <div className="flex items-center min-w-0"><span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2 bg-amber-500" /><span className={`${eyebrow} truncate`}>Total Gasto</span></div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5 truncate">{brl(totalGasto)}</div>
          </div>
          <div className="bg-white p-3 sm:p-4">
            <div className="flex items-center min-w-0"><span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2 bg-slate-400" /><span className={`${eyebrow} truncate`}>Meses</span></div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">{meses.length}</div>
          </div>
          <div className={`p-3 sm:p-4 ${alertasCount > 0 ? "bg-rose-600" : "bg-white"}`}>
            <div className="flex items-center min-w-0"><span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${alertasCount > 0 ? "bg-white" : "bg-rose-500"}`} /><span className={`text-[11px] font-semibold uppercase tracking-wider truncate ${alertasCount > 0 ? "text-rose-100" : "text-slate-500"}`}>Alertas</span></div>
            <div className={`text-2xl font-bold tabular-nums mt-1.5 ${alertasCount > 0 ? "text-white" : "text-slate-900"}`}>{alertasCount}</div>
          </div>
        </div>

        {ultimaGeracao && <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5"><Clock size={12} /> Última geração: {ultimaGeracao}</div>}

        <button onClick={gerarPdf} className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-colors duration-150">
          <Printer size={16} /> Gerar PDF
        </button>
      </div>

      <RelatorioAuditoriaGastos db={db} dtDe={dtDe} dtAte={dtAte} />
    </div>
  );
}

/* ======================== CONTAINER: RELATÓRIOS COM NAVEGAÇÃO ======================== */
function RelatoriosContainer({ db, cambById, lancs, gran, ref_, range, preSelecionar, onConsumir, abaRelatorios, setAbaRelatorios }) {
  const abas = [
    { id: "semanal", label: "Fechamento Semanal", icon: Calendar },
    { id: "auditoriaCambistas", label: "Auditoria de Cambistas", icon: BarChart3 },
    { id: "auditoriaGastos", label: "Auditoria de Gastos", icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-500">Relatórios e Análises</div>
        <button onClick={() => exportarExcel({ db })} className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-1.5 transition-colors duration-150">
          <FileSpreadsheet size={13} /> Exportar Dados (.xlsx)
        </button>
      </div>

      <RelatoriosTabs abas={abas} ativa={abaRelatorios} onChange={setAbaRelatorios} />

      {abaRelatorios === "semanal" && (
        <FechamentoSemanal db={db} cambById={cambById} lancs={lancs} gran={gran} ref_={ref_} preSelecionar={preSelecionar} onConsumir={onConsumir} />
      )}

      {abaRelatorios === "auditoriaCambistas" && (
        <AuditoriaCambistas db={db} />
      )}

      {abaRelatorios === "auditoriaGastos" && (
        <AuditoriaGastos db={db} />
      )}
    </div>
  );
}

/* ======================== RELATÓRIOS (FUNÇÃO LEGADA - WRAPPER) ======================== */
function Relatorios({ db, cambById, lancs, gran, ref_, preSelecionar, onConsumir, abaRelatorios, setAbaRelatorios }) {
  // Função mantida como wrapper que delega para RelatoriosContainer
  const [s, e] = periodRange(gran, ref_);
  return <RelatoriosContainer db={db} cambById={cambById} lancs={lancs} gran={gran} ref_={ref_} range={[s, e]} preSelecionar={preSelecionar} onConsumir={onConsumir}
    abaRelatorios={abaRelatorios} setAbaRelatorios={setAbaRelatorios} />;
}

/* ======================== RELATÓRIO DE AUDITORIA DE GASTOS ======================== */
function RelatorioAuditoriaGastos({ db, dtDe, dtAte }) {
  const auditoriaGastosPDFRef = useRef(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = "@media print { body * { visibility: hidden; } #auditoria-gastos-pdf-area, #auditoria-gastos-pdf-area * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } #auditoria-gastos-pdf-area { position: absolute; left: 0; top: 0; width: 100%; min-height: 0 !important; margin: 0; box-shadow: none !important; } .page-break-before { break-before: page; page-break-before: always; } @page { margin: 14mm; } }";
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!db.gastos || db.gastos.length === 0) {
    return (
      <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 text-center text-amber-800 text-sm">
        Nenhum gasto registrado. Registre gastos para gerar o relatório de auditoria.
      </div>
    );
  }

  const filtroAtivo = Boolean(dtDe && dtAte);
  const filtroS = filtroAtivo ? parse(dtDe) : null;
  const filtroE = filtroAtivo ? parse(dtAte) : null;
  const gastosFiltrados = filtroAtivo ? (db.gastos || []).filter((g) => dentro({ data: g.data }, filtroS, filtroE)) : (db.gastos || []);

  if (filtroAtivo && gastosFiltrados.length === 0) {
    return (
      <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 text-center text-amber-800 text-sm">
        Nenhum gasto encontrado no período selecionado ({fmtData(dtDe)} a {fmtData(dtAte)}).
      </div>
    );
  }

  const { meses, alertas } = analisarGastos(gastosFiltrados);
  const eficiencias = calcularEficiencia(meses, db.cambistas || [], db.lancamentos || [], db.pagamentos || []);
  const projecao = calcularProjecao(meses);

  const gerarPdf = async () => {
    if (!auditoriaGastosPDFRef.current) return;
    setGerando(true);
    try {
      const canvas = await window.html2canvas(auditoriaGastosPDFRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `auditoria-gastos-${iso(new Date()).replace(/-/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast("Imagem gerada com sucesso.", "success");
    } catch (err) {
      toast("Erro ao gerar PDF: " + err.message, "error");
    } finally {
      setGerando(false);
    }
  };

  const salvarPdf = () => window.print();

  const totalGasto = meses.reduce((a, m) => a + m.total, 0);
  const mediaGasto = meses.length > 0 ? totalGasto / meses.length : 0;
  const estatGastos = calcularEstatisticas(meses.map((m) => m.total));
  const gastosMesCategoria = {};

  for (const categoria of CATEGORIAS_GASTOS) {
    gastosMesCategoria[categoria] = meses.map((m) => ({
      mes: m.mes,
      valor: m.gastos.filter((g) => g.categoria === categoria).reduce((a, x) => a + x.valor, 0),
    }));
  }

  const categoriasRanking = CATEGORIAS_GASTOS.map((cat) => {
    const gastosCat = gastosFiltrados.filter((g) => g.categoria === cat);
    const totalCat = gastosCat.reduce((a, g) => a + g.valor, 0);
    const naoZeroMeses = meses.filter((m) => gastosMesCategoria[cat].find((x) => x.mes === m.mes && x.valor > 0)).length;
    return { categoria: cat, total: totalCat, pct: (totalCat / totalGasto) * 100, count: gastosCat.length, naoZeroMeses };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-500">Análise Completa de Gastos {filtroAtivo ? `— ${fmtData(dtDe)} a ${fmtData(dtAte)}` : "— Histórico Inteiro"}</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={gerarPdf} disabled={gerando} className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors duration-150">
            {gerando && <Loader2 size={13} className="animate-spin" />} {gerando ? "Gerando..." : "Baixar como Imagem"}
          </button>
          <button onClick={salvarPdf} className="inline-flex items-center gap-2 text-xs border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg px-3 py-1.5 transition-colors duration-150">
            <Printer size={13} /> Salvar como PDF
          </button>
        </div>
      </div>

      <div id="auditoria-gastos-pdf-area" ref={auditoriaGastosPDFRef} className="bg-white p-8 space-y-6" style={{ minHeight: "1400px", fontFamily: "system-ui" }}>
        <div className="text-center border-b pb-6">
          <h1 className="text-4xl font-black text-slate-900">RELATÓRIO DE AUDITORIA DE GASTOS</h1>
          <p className="text-sm text-slate-500 mt-2">Análise Completa do Histórico de Despesas</p>
          <p className="text-xs text-slate-400 mt-1">Período: {meses.length > 0 ? `${fmtData(iso(meses[0].data))} a ${fmtData(iso(new Date(meses[meses.length - 1].data.getFullYear(), meses[meses.length - 1].data.getMonth() + 1, 0)))}` : "Sem dados"} ({meses.length} meses)</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Resumo Executivo</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Gasto Total</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{brl(totalGasto)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Média Mensal</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{brl(mediaGasto)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Desvio Padrão</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{brl(estatGastos.desvPadrao)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Meses Analisados</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{meses.length}</div>
            </div>
          </div>

          {alertas.filter((a) => a.tipo === "aviso").length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-700">{alertas.find((a) => a.tipo === "aviso")?.descricao}</p>
            </div>
          )}

          {alertas.filter((a) => a.severidade === "alto").length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded p-3">
              <h3 className="text-sm font-bold text-rose-800 mb-1 flex items-center gap-1.5"><AlertTriangle size={14} /> Alertas Críticos</h3>
              <ul className="text-xs text-rose-700 space-y-0.5">
                {alertas.filter((a) => a.severidade === "alto").map((alerta, i) => (
                  <li key={i}>• {alerta.titulo}: {alerta.descricao}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4 page-break-before">
          <h2 className="text-2xl font-bold text-slate-900">Histórico Completo de Gastos</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-1 text-left">Mês</th>
                <th className="border p-1 text-right">Total</th>
                <th className="border p-1 text-right">Var %</th>
                <th className="border p-1 text-right">Lançamentos</th>
                {CATEGORIAS_GASTOS.slice(0, 3).map((cat) => (
                  <th key={cat} className="border p-1 text-right">{cat}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="border p-1">{m.mes}</td>
                  <td className="border p-1 text-right tabular-nums font-bold">{brl(m.total)}</td>
                  <td className="border p-1 text-right tabular-nums">
                    {i > 0 ? ((((m.total - meses[i - 1].total) / meses[i - 1].total) * 100).toFixed(1) + "%") : "-"}
                  </td>
                  <td className="border p-1 text-right">{m.gastos.length}</td>
                  {CATEGORIAS_GASTOS.slice(0, 3).map((cat) => {
                    const valor = m.gastos.filter((g) => g.categoria === cat).reduce((a, x) => a + x.valor, 0);
                    return <td key={cat} className="border p-1 text-right tabular-nums">{valor > 0 ? brl(valor) : "-"}</td>;
                  })}
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="border p-1">Total</td>
                <td className="border p-1 text-right tabular-nums">{brl(totalGasto)}</td>
                <td className="border p-1"></td>
                <td className="border p-1 text-right">{gastosFiltrados.length}</td>
                {CATEGORIAS_GASTOS.slice(0, 3).map((cat) => {
                  const valor = gastosFiltrados.filter((g) => g.categoria === cat).reduce((a, x) => a + x.valor, 0);
                  return <td key={cat} className="border p-1 text-right tabular-nums">{valor > 0 ? brl(valor) : "-"}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-4 page-break-before">
          <h2 className="text-2xl font-bold text-slate-900">Análise de Anomalias</h2>
          {alertas.length > 0 ? (
            <div className="space-y-2">
              {alertas.map((alerta, i) => (
                <div key={i} className={`border-l-4 p-3 rounded ${alerta.severidade === "alto" ? "border-l-rose-500 bg-rose-50" : alerta.severidade === "medio" ? "border-l-amber-500 bg-amber-50" : "border-l-blue-500 bg-blue-50"}`}>
                  <div className="text-sm font-bold">{alerta.titulo}</div>
                  <div className="text-xs">{alerta.descricao}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded">Nenhuma anomalia detectada no histórico de gastos.</div>
          )}
        </div>

        {eficiencias.length > 0 && (
          <div className="space-y-4 page-break-before">
            <h2 className="text-2xl font-bold text-slate-900">Eficiência Financeira</h2>
            <div className="text-xs space-y-2">
              {eficiencias.map((ef) => (
                <div key={ef.mes} className={`p-2 border rounded ${ef.alerta ? "bg-rose-50 border-rose-200" : "bg-slate-50"}`}>
                  <div className="font-bold">{ef.mes}</div>
                  <div className="text-slate-600">Gastos: {brl(ef.gastos)} | Líquido: {brl(ef.liquido)} | % do Lucro: {ef.percentualGasto.toFixed(1)}%</div>
                  {ef.alerta && <div className="text-rose-600 font-bold flex items-center gap-1.5"><AlertTriangle size={12} /> Gastos acima de 80% do lucro</div>}
                </div>
              ))}
            </div>

            {projecao && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="text-sm font-bold text-blue-900">Projeção do Próximo Mês</div>
                <div className="text-xs text-blue-700 mt-1">Estimado: {brl(projecao.proximoMes)} {projecao.slope > 0 ? "(tendência crescente)" : "(tendência decrescente)"}</div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 page-break-before">
          <h2 className="text-2xl font-bold text-slate-900">Ranking de Categorias</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-1 text-left">Categoria</th>
                <th className="border p-1 text-right">Total</th>
                <th className="border p-1 text-right">% do Total</th>
                <th className="border p-1 text-right">Lançamentos</th>
                <th className="border p-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {categoriasRanking.map((cat) => {
                let status = "Sob Controle";
                let corStatus = "green";
                if (cat.pct > 50) {
                  status = "Crítica";
                  corStatus = "red";
                } else if (cat.pct > 30) {
                  status = "Atenção";
                  corStatus = "yellow";
                }
                return (
                  <tr key={cat.categoria} className="hover:bg-slate-50">
                    <td className="border p-1 font-medium">{cat.categoria}</td>
                    <td className="border p-1 text-right tabular-nums">{brl(cat.total)}</td>
                    <td className="border p-1 text-right tabular-nums">{cat.pct.toFixed(1)}%</td>
                    <td className="border p-1 text-right">{cat.count}</td>
                    <td className="border p-1 text-center text-[10px] font-bold">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 page-break-before">
          <h2 className="text-2xl font-bold text-slate-900">Conclusão e Recomendações</h2>
          <div className="text-xs space-y-2">
            <div className="p-3 bg-slate-50 rounded">
              <p className="font-bold mb-1">Situação Geral</p>
              <p>
                {totalGasto > 0
                  ? `Gastos totais de ${brl(totalGasto)} distribuídos em ${meses.length} meses (média ${brl(mediaGasto)}/mês). Categoria dominante: ${categoriasRanking[0]?.categoria} com ${categoriasRanking[0]?.pct.toFixed(1)}% do total.`
                  : "Nenhum gasto registrado."}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded">
              <p className="font-bold mb-1">Principais Achados</p>
              <ul className="space-y-1">
                {alertas.length > 0
                  ? alertas.slice(0, 3).map((a, i) => <li key={i}>• {a.titulo}</li>)
                  : <li>• Histórico de gastos estável sem anomalias detectadas</li>}
              </ul>
            </div>

            <div className="p-3 bg-slate-50 rounded">
              <p className="font-bold mb-1">Ações Recomendadas</p>
              <ul className="space-y-1">
                {categoriasRanking[0]?.pct > 50 && <li>• Revisar despesas de {categoriasRanking[0]?.categoria} que consome {categoriasRanking[0]?.pct.toFixed(1)}% do orçamento</li>}
                {alertas.filter((a) => a.tipo === "tendenciaCrescente").length > 0 && <li>• Gastos em crescimento sustentado - investigar causas e implementar controles</li>}
                {eficiencias.filter((e) => e.alerta).length > 0 && <li>• {eficiencias.filter((e) => e.alerta).length} mês(es) com gastos acima de 80% do lucro - priorizar redução</li>}
                {projecao && projecao.slope > 0 && <li>• Tendência de crescimento continua - projeção de {brl(projecao.proximoMes)} para próximo mês</li>}
                <li>• Estabelecer políticas de descrição obrigatória para todos os gastos</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t-2 border-slate-200 text-xs text-slate-500 text-center">
          <p>Relatório gerado em {fmtData(iso(new Date()))} às {new Date().toLocaleTimeString("pt-BR")}</p>
          <p>ESPORTEVIPAPP - Sistema de Análise de Gastos</p>
        </div>
      </div>
    </div>
  );
}

/* ======================== RELATÓRIO DE AUDITORIA ======================== */
function RelatorioAuditoria({ db, dtDe, dtAte }) {
  const auditoriaPDFRef = useRef(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = "@media print { body * { visibility: hidden; } #auditoria-pdf-area, #auditoria-pdf-area * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } #auditoria-pdf-area { position: absolute; left: 0; top: 0; width: 100%; min-height: 0 !important; margin: 0; box-shadow: none !important; } .page-break-before { break-before: page; page-break-before: always; } @page { margin: 14mm; } }";
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!db.cambistas || db.cambistas.length === 0) {
    return (
      <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 text-center text-amber-800 text-sm">
        Nenhum cambista cadastrado. Crie cambistas para gerar o relatório de auditoria.
      </div>
    );
  }

  const filtroAtivo = Boolean(dtDe && dtAte);
  const filtroS = filtroAtivo ? parse(dtDe) : null;
  const filtroE = filtroAtivo ? parse(dtAte) : null;
  const lancamentosFiltrados = filtroAtivo ? (db.lancamentos || []).filter((l) => dentro(l, filtroS, filtroE)) : (db.lancamentos || []);
  const pagamentosFiltrados = filtroAtivo ? (db.pagamentos || []).filter((p) => dentro(p, filtroS, filtroE)) : (db.pagamentos || []);

  const gerarPdf = async () => {
    if (!auditoriaPDFRef.current) return;
    setGerando(true);
    try {
      const canvas = await window.html2canvas(auditoriaPDFRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `auditoria-completa-${iso(new Date()).replace(/-/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast("Imagem gerada com sucesso.", "success");
    } catch (err) {
      toast("Erro ao gerar PDF: " + err.message, "error");
    } finally {
      setGerando(false);
    }
  };

  const salvarPdf = () => window.print();

  const brutonsTotais = {};
  const comissaoTotais = {};
  const pagosTotais = {};
  const recebidosTotais = {};
  let primeiraData = null;
  let ultimaData = null;

  for (const cambista of db.cambistas.filter((c) => c.ativo)) {
    const semanas = semanasHistorico(cambista, lancamentosFiltrados, pagamentosFiltrados);
    if (semanas.length === 0) continue;

    brutonsTotais[cambista.id] = semanas.reduce((a, s) => a + s.agreAgrega.bruto, 0);
    comissaoTotais[cambista.id] = semanas.reduce((a, s) => a + s.agreAgrega.comissao, 0);
    pagosTotais[cambista.id] = semanas.reduce((a, s) => a + s.pagtos.reduce((p, x) => p + x.valor, 0), 0);
    recebidosTotais[cambista.id] = semanas.reduce((a, s) => a + s.agreAgrega.receber, 0);

    if (!primeiraData || semanas[0].s < primeiraData) primeiraData = semanas[0].s;
    if (!ultimaData || semanas[semanas.length - 1].e > ultimaData) ultimaData = semanas[semanas.length - 1].e;
  }

  const totalBruto = Object.values(brutonsTotais).reduce((a, v) => a + v, 0);
  const totalComissao = Object.values(comissaoTotais).reduce((a, v) => a + v, 0);
  const totalPago = Object.values(pagosTotais).reduce((a, v) => a + v, 0);
  const totalRecebido = Object.values(recebidosTotais).reduce((a, v) => a + v, 0);
  const cambistaEmAtraso = db.cambistas.filter((c) => c.ativo && recebidosTotais[c.id] > 0.01).length;
  const taxaInadimplencia = db.cambistas.filter((c) => c.ativo).length > 0 ? (cambistaEmAtraso / db.cambistas.filter((c) => c.ativo).length) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-500">Análise de Fraude e Desempenho {filtroAtivo ? `— ${fmtData(dtDe)} a ${fmtData(dtAte)}` : "— Histórico Completo"}</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={gerarPdf} disabled={gerando} className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors duration-150">
            {gerando && <Loader2 size={13} className="animate-spin" />} {gerando ? "Gerando..." : "Baixar como Imagem"}
          </button>
          <button onClick={salvarPdf} className="inline-flex items-center gap-2 text-xs border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg px-3 py-1.5 transition-colors duration-150">
            <Printer size={13} /> Salvar como PDF
          </button>
        </div>
      </div>

      <div id="auditoria-pdf-area" ref={auditoriaPDFRef} className="bg-white p-8 space-y-6" style={{ minHeight: "1000px", fontFamily: "system-ui" }}>
        <div className="text-center border-b pb-6">
          <h1 className="text-4xl font-black text-slate-900">RELATÓRIO DE AUDITORIA COMPLETA</h1>
          <p className="text-sm text-slate-500 mt-2">Análise de Fraude e Desempenho Histórico</p>
          <p className="text-xs text-slate-400 mt-1">Período: {primeiraData ? `${fmtData(iso(primeiraData))} a ${fmtData(iso(ultimaData))}` : "Sem dados"}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Resumo Executivo Geral</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Bruto Total</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{brl(totalBruto)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Comissão Total</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{brl(totalComissao)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Pago</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{brl(totalPago)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-emerald-50">
              <div className="text-xs text-emerald-600 font-medium">Líquido</div>
              <div className="text-lg font-bold text-emerald-700 tabular-nums">{brl(totalRecebido)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-rose-50">
              <div className="text-xs text-rose-600 font-medium">Inadimplência</div>
              <div className="text-lg font-bold text-rose-700 tabular-nums">{taxaInadimplencia.toFixed(1)}%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-100 p-2 rounded"><span className="text-slate-600">Cambistas Ativos:</span> <span className="font-bold">{db.cambistas.filter((c) => c.ativo).length}</span></div>
            <div className="bg-slate-100 p-2 rounded"><span className="text-slate-600">Semanas Analisadas:</span> <span className="font-bold">{new Set(lancamentosFiltrados.map((l) => iso(startOfWeek(parse(l.data))))).size}</span></div>
            <div className="bg-rose-100 p-2 rounded"><span className="text-rose-600">Em Atraso:</span> <span className="font-bold">{cambistaEmAtraso}</span></div>
            <div className="bg-amber-100 p-2 rounded"><span className="text-amber-600">Risco Médio:</span> <span className="font-bold">Análise Concluída</span></div>
          </div>
        </div>

        {db.cambistas.filter((c) => c.ativo).map((cambista) => {
          const semanas = semanasHistorico(cambista, lancamentosFiltrados, pagamentosFiltrados);
          if (semanas.length === 0) return null;

          const alertas = analiseAnomalias(semanas, cambista);
          const score = calcularScoreHistorico(semanas, cambista);
          const risco = classificarRisco(score);
          const brutons = semanas.map((s) => s.agreAgrega.bruto);
          const estat = calcularEstatisticas(brutons);
          const semanasDevedor = semanas.filter((s) => s.agreAgrega.receber < -0.01);

          return (
            <div key={cambista.id} className="page-break-before pt-6 border-t-2 border-slate-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{cambista.nome}</h3>
                  <p className="text-xs text-slate-500">{cambista.contato || "Sem contato"} | Comissão padrão: {pct(cambista.comissaoPadrao)}</p>
                </div>
                <div className={`px-3 py-1 rounded-lg text-xs font-bold text-white ${risco.classeBadge}`}>
                  {risco.classificacao} (Score: {score.toFixed(0)})
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4 text-xs">
                <div className="bg-slate-50 p-2 rounded"><span className="text-slate-600">Bruto:</span> <span className="font-bold">{brl(brutonsTotais[cambista.id])}</span></div>
                <div className="bg-slate-50 p-2 rounded"><span className="text-slate-600">Comissão:</span> <span className="font-bold">{brl(comissaoTotais[cambista.id])}</span></div>
                <div className="bg-slate-50 p-2 rounded"><span className="text-slate-600">Pago:</span> <span className="font-bold">{brl(pagosTotais[cambista.id])}</span></div>
                <div className={`p-2 rounded ${recebidosTotais[cambista.id] > 0.01 ? "bg-rose-50" : "bg-emerald-50"}`}><span className={`${recebidosTotais[cambista.id] > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>Recebível:</span> <span className="font-bold">{brl(recebidosTotais[cambista.id])}</span></div>
              </div>

              <table className="w-full text-xs mb-4 border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border p-1 text-left">Sem</th>
                    <th className="border p-1 text-left">Período</th>
                    <th className="border p-1 text-right">Bruto</th>
                    <th className="border p-1 text-right">Comissão</th>
                    <th className="border p-1 text-right">Pago</th>
                    <th className="border p-1 text-right">Saldo</th>
                    <th className="border p-1 text-center">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="border p-1">{i + 1}</td>
                      <td className="border p-1 text-xs">{pad(s.s.getDate())}/{pad(s.s.getMonth() + 1)}–{pad(s.e.getDate())}/{pad(s.e.getMonth() + 1)}</td>
                      <td className="border p-1 text-right tabular-nums">{brl(s.agreAgrega.bruto)}</td>
                      <td className="border p-1 text-right tabular-nums">{brl(s.agreAgrega.comissao)}</td>
                      <td className="border p-1 text-right tabular-nums">{brl(s.pagtos.reduce((a, p) => a + p.valor, 0))}</td>
                      <td className={`border p-1 text-right tabular-nums ${s.agreAgrega.receber < -0.01 ? "text-emerald-600 font-bold" : s.agreAgrega.receber > 0.01 ? "text-rose-600 font-bold" : ""}`}>{brl(s.agreAgrega.receber)}</td>
                      <td className="border p-1 text-center">{s.diasAtivos}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td className="border p-1" colSpan="2">Totais / Média</td>
                    <td className="border p-1 text-right tabular-nums">{brl(brutonsTotais[cambista.id])} / {brl(estat.media)}</td>
                    <td className="border p-1 text-right tabular-nums">{brl(comissaoTotais[cambista.id])}</td>
                    <td className="border p-1 text-right tabular-nums">{brl(pagosTotais[cambista.id])}</td>
                    <td className="border p-1 text-right tabular-nums">{brl(recebidosTotais[cambista.id])}</td>
                    <td className="border p-1 text-center">-</td>
                  </tr>
                </tbody>
              </table>

              <div className="mb-4">
                <h4 className="font-bold text-sm mb-2">Estatísticas</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded"><span className="text-blue-600">Desvio Padrão:</span> <span className="font-bold">{brl(estat.desvPadrao)}</span></div>
                  <div className="bg-blue-50 p-2 rounded"><span className="text-blue-600">Min:</span> <span className="font-bold">{brl(estat.min)}</span></div>
                  <div className="bg-blue-50 p-2 rounded"><span className="text-blue-600">Max:</span> <span className="font-bold">{brl(estat.max)}</span></div>
                </div>
              </div>

              {alertas.length > 0 && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <h4 className="font-bold text-sm mb-2 text-yellow-800">Alertas Detectados</h4>
                  <ul className="text-xs space-y-1">
                    {alertas.map((alerta, i) => (
                      <li key={i} className="text-yellow-700">• [{alerta.severidade.toUpperCase()}] {alerta.titulo}: {alerta.descricao}</li>
                    ))}
                  </ul>
                </div>
              )}

              {semanasDevedor.length > 0 && (
                <div className="mb-4 bg-rose-50 border border-rose-200 rounded p-3">
                  <h4 className="font-bold text-sm mb-2 text-rose-800">Semanas em Débito ({semanasDevedor.length})</h4>
                  <p className="text-xs text-rose-700">Cambista estava em débito com a casa em {semanasDevedor.length} semanas ({(semanasDevedor.length / semanas.length * 100).toFixed(1)}% do histórico)</p>
                </div>
              )}

              <div className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
                <strong>Recomendação:</strong> {risco.classificacao === "Confiável" ? "Cambista com desempenho consistente. Manter monitoramento regular." : risco.classificacao === "Atenção" ? "Investigar padrões detectados. Aumentar frequência de checagem." : "Revisão imediata recomendada. Considerar restrição de crédito ou auditoria aprofundada."}
              </div>
            </div>
          );
        })}

        <div className="mt-8 pt-6 border-t-2 border-slate-200 text-xs text-slate-500 text-center">
          <p>Relatório gerado em {fmtData(iso(new Date()))} às {new Date().toLocaleTimeString("pt-BR")}</p>
          <p>ESPORTEVIPAPP - Sistema de Análise de Cambistas</p>
        </div>
      </div>
    </div>
  );
}

/* ======================== MODAIS ======================== */
function Campo({ label, children }) { return <div><label className={lbl}>{label}</label>{children}</div>; }
function Modal({ titulo, children, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-900">{titulo}</div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors duration-150"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors duration-150">Cancelar</button>
          <button onClick={onSave} className="text-sm px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors duration-150">Salvar</button>
        </div>
      </div>
    </div>
  );
}
