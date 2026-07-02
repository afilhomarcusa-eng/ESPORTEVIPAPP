import { useState, useEffect, useMemo, useRef } from "react";
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
  return db;
}
async function saveDB(db) { try { await window.storage.set(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }

/* ======================== EXPORTAÇÃO EXCEL ======================== */
function exportarExcel({ db }) {
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
  lRows.forEach((_, i) => {
    const r = i + 2;
    wsL[`E${r}`] = { t: "n", f: `C${r}*D${r}`, z: MOEDA };
    wsL[`F${r}`] = { t: "n", f: `C${r}-E${r}`, z: MOEDA };
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

  const gHead = ["Data", "Categoria", "Descrição", "Valor (R$)"];
  const gRows = (db.gastos || []).map((g) => [parse(g.data), g.categoria || "", g.descricao || "", g.valor]);
  const wsG = XLSX.utils.aoa_to_sheet([gHead, ...gRows]);
  gRows.forEach((_, i) => { const r = i + 2; if (wsG[`A${r}`]) wsG[`A${r}`].z = "dd/mm/yyyy"; if (wsG[`D${r}`]) wsG[`D${r}`].z = MOEDA; });
  wsG["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 25 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsG, "Gastos");

  XLSX.writeFile(wb, `esportevipapp-${iso(new Date())}.xlsx`);
}

function importarExcel(file, update, aoTerminar) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
      const wsC = wb.Sheets["Cambistas"];
      const wsL = wb.Sheets["Lancamentos"] || wb.Sheets["Lançamentos"];
      if (!wsC || !wsL) { alert('A planilha precisa ter as abas "Cambistas" e "Lancamentos", no mesmo modelo exportado pelo sistema.'); return; }
      const cRows = XLSX.utils.sheet_to_json(wsC, { defval: "" });
      const lRows = XLSX.utils.sheet_to_json(wsL, { defval: "" });
      update((d) => {
        const idPorNome = {};
        d.cambistas = cRows.map((r) => {
          const nome = String(r["Nome"] || "").trim();
          const id = uid();
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
          return {
            id: uid(),
            cambistaId: idPorNome[nome] || null,
            data: iso(dataObj),
            positivo: Number(r["Positivo (R$)"] ?? r["Positivo"] ?? 0),
            movimentacao: null,
            pct: null,
            obs: "",
          };
        }).filter((l) => l.cambistaId);
      });
      aoTerminar(true);
    } catch (err) {
      aoTerminar(false);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ======================== COMPONENTE RAIZ ======================== */
export default function App() {
  const [db, setDb] = useState(null);
  const [aba, setAba] = useState("dashboard");
  const [gran, setGran] = useState("mes");
  const [ref, setRef] = useState(new Date());
  const [relatorioPre, setRelatorioPre] = useState(null);
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

  if (!db) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-orange-500">
      <div className="animate-pulse text-sm tracking-wide">Carregando o sistema</div>
    </div>
  );

  const update = (fn) => setDb((cur) => { const next = structuredClone(cur); fn(next); next.exemplo = false; return next; });

  const gerarRelatorioSemanal = (cambistaId) => {
    setGran("semana");
    setRelatorioPre(cambistaId);
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
    <div className="min-h-screen bg-slate-100 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div className="h-1 bg-orange-600" />
      <div className="flex">
        <aside className="hidden lg:flex w-56 shrink-0 bg-slate-900 text-slate-300 flex-col sticky top-0 h-screen border-r border-slate-800">
          <div className="px-5 py-5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-slate-900 font-black text-xs">EA</div>
              <div>
                <div className="text-white font-semibold leading-tight">ESPORTEVIPAPP</div>
                <div className="text-[11px] text-orange-400">gestão de negócios</div>
              </div>
            </div>
          </div>
          <nav className="p-3 flex-1 space-y-1">
            {nav.map((n) => {
              const Ic = n.icon; const on = aba === n.id;
              return (
                <button key={n.id} onClick={() => irAba(n.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 border-l-2 rounded-r-lg text-sm transition ${on ? "bg-orange-500/15 text-orange-300 font-medium border-orange-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"}`}>
                  <Ic size={18} /> {n.nome}
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 px-2">
              <Circle size={8} className={salvando ? "text-amber-400 fill-amber-400" : "text-orange-400 fill-orange-400"} />
              {salvando ? "Salvando" : "Tudo salvo"}
            </div>
            {db.exemplo && (
              <button onClick={() => { if (confirm("Zerar todos os dados de exemplo e começar do zero?")) setDb({ cambistas: [], lancamentos: [], pagamentos: [], gastos: [], metaMensal: 10000, exemplo: false, version: 4 }); }}
                className="mt-2 w-full flex items-center justify-center gap-2 text-[11px] text-slate-400 hover:text-rose-300 border border-slate-800 rounded-lg py-2">
                <RotateCcw size={12} /> Limpar exemplo
              </button>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="lg:hidden w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-slate-900 font-black text-[11px] shrink-0">EA</div>
            <div className="mr-auto min-w-0">
              <div className="text-base sm:text-lg font-semibold text-slate-900 capitalize truncate">{nav.find((n) => n.id === aba)?.nome}</div>
              {db.exemplo && <div className="text-[11px] text-amber-600 hidden sm:block">Você está vendo dados de exemplo. Edite ou limpe quando quiser.</div>}
            </div>
            {inativos.length > 0 && (
              <button onClick={() => setShowInativeModal(true)} className="inline-flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition">
                <Clock size={14} /> <span className="tabular-nums">{inativos.length}</span> <span className="hidden sm:inline">cambista(s) inativo(s)</span>
              </button>
            )}
            <PeriodPicker gran={gran} setGran={setGran} ref_={ref} setRef={setRef}
              opts={aba === "relatorios" ? [["semana","Semanal"],["tudo","Tudo"]] : undefined} />
          </header>

          <main className="p-4 sm:p-6 pb-24 lg:pb-6 max-w-[1200px] mx-auto min-w-0">
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
              <Relatorios db={db} cambById={cambById} lancs={lancsPeriodo} gran={gran} ref_={ref} preSelecionar={relatorioPre} onConsumir={() => setRelatorioPre(null)} />
            )}
          </main>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900 border-t border-slate-800 flex shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        {nav.map((n) => {
          const Ic = n.icon; const on = aba === n.id;
          return (
            <button key={n.id} onClick={() => irAba(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${on ? "text-orange-400" : "text-slate-500 hover:text-slate-300"}`}>
              <Ic size={20} className={on ? "scale-110 transition-transform" : "transition-transform"} /> {n.curto}
            </button>
          );
        })}
      </nav>

      {showInativeModal && (
        <ModalInactivos inativos={inativos} onClose={() => setShowInativeModal(false)} />
      )}
    </div>
  );
}

/* ======================== MODAL DE INATIVOS ======================== */
function ModalInactivos({ inativos, onClose }) {
  if (inativos.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-900">Cambistas sem Movimento</div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-4">Os seguintes cambistas não possuem movimento há 7 dias ou mais:</p>
          {inativos.map(({ cambista, dias }) => (
            <div key={cambista.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="font-medium text-slate-800">{cambista.nome}</div>
              <div className="text-sm text-amber-700 mt-1">
                {dias === Infinity ? "Nunca lançou movimento" : `${dias} dias sem atividade`}
              </div>
              <div className="text-xs text-slate-500 mt-1">{cambista.contato}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium">Fechar</button>
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
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${gran === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            {lab}
          </button>
        ))}
      </div>
      {gran !== "tudo" && (
        <div className="flex items-center gap-1">
          <button onClick={() => setRef(shiftRef(gran, ref_, -1))} className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition"><ChevronLeft size={16} /></button>
          <div className="text-xs font-medium text-slate-700 min-w-[7rem] text-center tabular-nums">{rotuloPeriodo(gran, ref_)}</div>
          <button onClick={() => setRef(shiftRef(gran, ref_, 1))} className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ======================== CARD KPI ======================== */
const KPI_CORES = {
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-50 text-amber-600",
  orange: "bg-orange-50 text-orange-600",
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
};

function Kpi({ titulo, valor, delta, icon: Ic, cor = "orange", inverso = false, corValor = "text-slate-900" }) {
  const bom = inverso ? (delta ?? 0) <= 0 : (delta ?? 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-w-0 transition hover:shadow-md hover:border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${KPI_CORES[cor] || KPI_CORES.orange}`}><Ic size={16} /></span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight truncate ${corValor}`}>{valor}</div>
      {delta != null && isFinite(delta) && (
        <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${bom ? "text-emerald-600" : "text-rose-600"}`}>
          {bom ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {pct(Math.abs(delta))} vs. período anterior
        </div>
      )}
    </div>
  );
}

const cardBox = "bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-w-0";
const titSec = "text-sm font-semibold text-slate-700 mb-3";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500";
const lbl = "block text-xs font-medium text-slate-500 mb-1";

function money(v) { return brl(v); }
function delta(a, b) { if (!b) return b === 0 && a === 0 ? 0 : null; return (a - b) / Math.abs(b); }

/* ======================== DASHBOARD ======================== */
function Dashboard({ db, update, cambById, lancs, totais, totaisPrev, gran, ref_, range }) {
  const [editMeta, setEditMeta] = useState(false);

  const serie = useMemo(() => {
    const map = new Map();
    const porMes = gran === "ano" || gran === "tudo";
    for (const l of lancs) {
      const d = parse(l.data);
      const chave = porMes ? `${d.getFullYear()}-${pad(d.getMonth()+1)}` : iso(d);
      const rot = porMes ? MESES[d.getMonth()] : `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
      const c = calcLanc(l, cambById[l.cambistaId]);
      const cur = map.get(chave) || { rot, chave, bruto: 0, comissao: 0, receber: 0 };
      cur.bruto += l.positivo; cur.comissao += c.comissao; cur.receber += c.receber;
      map.set(chave, cur);
    }
    return [...map.values()].sort((a, b) => a.chave.localeCompare(b.chave));
  }, [lancs, gran, cambById]);

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
    for (const l of lancs) {
      const c = calcLanc(l, cambById[l.cambistaId]);
      if (!m[l.cambistaId]) m[l.cambistaId] = { id: l.cambistaId, nome: cambById[l.cambistaId]?.nome || "Sem nome", bruto: 0, comissao: 0, receber: 0 };
      m[l.cambistaId].bruto += l.positivo; m[l.cambistaId].comissao += c.comissao; m[l.cambistaId].receber += c.receber;
    }
    return Object.values(m).sort((a, b) => b.receber - a.receber);
  }, [lancs, cambById, db.cambistas]);

  const gastosPeriodo = useMemo(() => {
    const [gs, ge] = range;
    return (db.gastos || []).filter((g) => dentro({ data: g.data }, gs, ge)).reduce((a, g) => a + g.valor, 0);
  }, [db.gastos, range]);
  const gastosPrev = useMemo(() => {
    const [ps, pe] = periodRange(gran, shiftRef(gran, ref_, -1));
    return (db.gastos || []).filter((g) => dentro({ data: g.data }, ps, pe)).reduce((a, g) => a + g.valor, 0);
  }, [db.gastos, gran, ref_]);
  const liquidoCasa = totais.receber - gastosPeriodo;
  const liquidoCasaPrev = totaisPrev.receber - gastosPrev;

  const cambistasAtivos = db.cambistas.filter((c) => c.ativo).length;
  const emPrejuizo = porCambista.filter((c) => c.receber < 0);
  const metaPeriodo = metaDoPeriodo(db.metaMensal, gran);
  const progresso = metaPeriodo ? totais.receber / metaPeriodo : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi titulo="Resultado Bruto" valor={money(totais.bruto)} delta={delta(totais.bruto, totaisPrev.bruto)} icon={Coins} cor="slate" corValor={totais.bruto >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Comissões" valor={money(totais.comissao)} delta={delta(totais.comissao, totaisPrev.comissao)} icon={Percent} cor="amber" inverso corValor={totais.comissao >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Gastos" valor={money(gastosPeriodo)} delta={delta(gastosPeriodo, gastosPrev)} icon={DollarSign} cor="amber" inverso corValor={gastosPeriodo >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Líquido Casa" valor={money(liquidoCasa)} delta={delta(liquidoCasa, liquidoCasaPrev)} icon={Wallet} cor={liquidoCasa >= 0 ? "emerald" : "rose"} corValor={liquidoCasa >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi titulo="Cambistas Ativos" valor={`${cambistasAtivos}`} icon={Users} cor="indigo" />
        {totais.holdMedio != null && <Kpi titulo="Hold Médio" valor={pct(totais.holdMedio)} icon={Percent} cor="orange" />}
      </div>

      {metaPeriodo != null && (
        <div className={cardBox}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-700">Meta do Período</div>
            <button onClick={() => setEditMeta(true)} className="text-xs text-slate-400 hover:text-orange-600 font-medium">editar meta</button>
          </div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{brl(totais.receber)}</span>
            <span className="text-sm text-slate-400">meta {brl(metaPeriodo)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${progresso >= 1 ? "bg-emerald-500" : progresso >= 0.6 ? "bg-amber-400" : "bg-rose-400"}`}
              style={{ width: `${Math.min(100, Math.max(0, (progresso || 0) * 100))}%` }} />
          </div>
          <div className="text-xs text-slate-400 mt-1">{pct(Math.max(0, progresso || 0))} da meta atingida</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardBox} lg:col-span-2`}>
          <div className="flex items-center justify-between mb-3">
            <div className={titSec + " mb-0"}>Evolução no Período</div>
            <div className="text-xs text-slate-400">líquido e comissão</div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="rot" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtEixo} width={40} />
                <Tooltip formatter={(v, n) => [brl(v), n === "receber" ? "Líquido" : "Comissão"]} labelStyle={{ fontWeight: 600 }} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Area type="monotone" dataKey="receber" stroke="#16a34a" strokeWidth={2.5} fill="url(#gradOrange)" name="receber" dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="comissao" stroke="#94a3b8" strokeWidth={1.6} strokeDasharray="4 3" dot={false} name="comissao" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardBox}>
          <div className={titSec}>Crescimento (Últimos Períodos)</div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crescimento} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="rot" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtEixo} width={40} />
                <Tooltip formatter={(v) => [brl(v), "Líquido"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Bar dataKey="receber" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {crescimento.map((d, i) => <Cell key={i} fill={d.receber >= 0 ? "#16a34a" : "#e11d48"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardBox} lg:col-span-2`}>
          <div className={titSec}>Líquido por Cambista</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCambista} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtEixo} />
                <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [brl(v), "Líquido"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Bar dataKey="receber" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {porCambista.map((d, i) => <Cell key={i} fill={d.receber >= 0 ? "#16a34a" : "#e11d48"} />)}
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
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtEixo} />
                <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [brl(v), "Comissão"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Bar dataKey="comissao" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {porCambista.map((d, i) => <Cell key={i} fill={d.comissao >= 0 ? "#f59e0b" : "#e11d48"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {emPrejuizo.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 min-w-0">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm"><AlertTriangle size={16} /> Cambistas em Prejuízo neste Período</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {emPrejuizo.map((c) => (
              <span key={c.id} className="text-xs bg-white border border-rose-200 text-rose-700 rounded-full px-3 py-1 tabular-nums">
                {c.nome}: {brl(c.receber)}
              </span>
            ))}
          </div>
        </div>
      )}

      {editMeta && (
        <ModalMeta valor={db.metaMensal} onClose={() => setEditMeta(false)}
          onSave={(v) => { update((d) => { d.metaMensal = v; }); setEditMeta(false); }} />
      )}
    </div>
  );
}

function ModalMeta({ valor, onClose, onSave }) {
  const [v, setV] = useState(String(valor || 0));
  const salvar = () => { const n = parseFloat(String(v).replace(",", ".")); if (isNaN(n) || n < 0) return alert("Informe um valor válido."); onSave(n); };
  return (
    <Modal titulo="Meta Mensal da Casa" onClose={onClose} onSave={salvar}>
      <Campo label="Meta de Líquido por Mês (R$)"><input value={v} onChange={(e) => setV(e.target.value)} className={inp} inputMode="decimal" autoFocus /></Campo>
      <div className="text-xs text-slate-400">As metas de semana, quinzena e ano são calculadas automaticamente a partir desse valor.</div>
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

  const ranking = linhas.slice(0, 3).filter((r) => r.n > 0);

  const rankStyles = [
    { badge: "bg-orange-400 text-slate-900", card: "border-orange-300 bg-orange-50" },
    { badge: "bg-slate-300 text-slate-800", card: "border-slate-300 bg-slate-50" },
    { badge: "bg-amber-300 text-amber-900", card: "border-amber-300 bg-amber-50" },
  ];

  const aoImportar = (file) => {
    if (!file) return;
    const ok = confirm("Isso vai substituir todos os cambistas e lançamentos atuais pelos dados dessa planilha. Deseja continuar?");
    if (!ok) return;
    setImportando(true);
    importarExcel(file, update, (sucesso) => {
      setImportando(false);
      if (!sucesso) alert("Não consegui ler essa planilha. Confira se ela segue o mesmo modelo exportado pelo sistema.");
    });
  };

  const setPeriodDates = (gran) => {
    const [dtInicio, dtFim] = isoDatesForPeriod(gran, new Date());
    setDtDe(dtInicio);
    setDtAte(dtFim);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-slate-500">Período: <span className="font-medium text-slate-700">{custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotulo}</span></div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
            {[["semana","Semanal"],["quinzena","Quinzenal"],["mes","Mensal"],["ano","Anual"]].map(([id, lab]) => (
              <button key={id} onClick={() => setPeriodDates(id)} className="px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 border-r border-slate-200 last:border-0 text-slate-600 transition">{lab}</button>
            ))}
          </div>
          <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
            <span className="text-slate-400">De</span>
            <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
            <span className="text-slate-400">Até</span>
            <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
          </div>
          {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500">limpar</button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(ev) => { aoImportar(ev.target.files[0]); ev.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={importando}
            className="inline-flex items-center gap-2 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-2">
            <Upload size={15} /> {importando ? "Importando" : "Importar Planilha"}
          </button>
          <button onClick={() => exportarExcel({ db })}
            className="inline-flex items-center gap-2 text-sm border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg px-3 py-2">
            <FileSpreadsheet size={15} /> Exportar Planilha
          </button>
          <button onClick={() => setEditar({ id: null, nome: "", contato: "", comissaoPadrao: 0.1, ativo: true })}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg px-3 py-2 shadow-sm transition">
            <Plus size={16} /> Novo Cambista
          </button>
        </div>
      </div>

      {linhas.length > 0 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-medium text-emerald-700 mb-1">Total a Receber</div>
              <div className="text-2xl font-bold text-emerald-900 tabular-nums">{brl(linhas.reduce((a, r) => a + Math.max(0, r.receber), 0))}</div>
              <div className="text-[11px] text-emerald-600 mt-1">cambistas para cobrar</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-700 mb-1">Total Recebido</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{brl(linhas.reduce((a, r) => a + r.pago, 0))}</div>
              <div className="text-[11px] text-slate-600 mt-1">já quitado no período</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-medium text-rose-700 mb-1">Taxa de Inadimplência</div>
              <div className="text-2xl font-bold text-rose-900 tabular-nums">{linhas.length > 0 ? ((linhas.filter((r) => r.receber > 0.01).length / linhas.length) * 100).toFixed(1) : "0"}%</div>
              <div className="text-[11px] text-rose-600 mt-1">{linhas.filter((r) => r.receber > 0.01).length} de {linhas.length} cambistas</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium">Cambista</th>
                <th className="px-4 py-3 font-medium text-right">Bruto</th>
                <th className="px-4 py-3 font-medium text-right">Comissão</th>
                <th className="px-4 py-3 font-medium text-right">Pago</th>
                <th className="px-4 py-3 font-medium text-right">Saldo</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ c, bruto, comissao, pago, saldo, receber, n }) => (
                <tr key={c.id} onClick={() => setDetalhe(c)} className="group border-b border-slate-100 last:border-0 hover:bg-orange-50/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 flex items-center gap-2">{c.nome} {!c.ativo && <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">inativo</span>}</div>
                    <div className="text-xs text-slate-400">{c.contato || "sem contato"}, padrão {pct(c.comissaoPadrao)}</div>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${bruto < 0 ? "text-rose-600" : "text-slate-700"}`}>{brl(bruto)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${comissao < 0 ? "text-rose-600" : "text-slate-900"}`}>{brl(comissao)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{brl(pago)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${receber < 0 ? "text-emerald-600" : receber > 0.01 ? "text-rose-600" : "text-slate-700"}`}>{brl(saldo)}</td>
                  <td className="px-4 py-3 text-center">
                    {receber < 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-1"><CheckCircle2 size={12} /> Devedor</span>
                    ) : saldo <= 0.01 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 rounded-full px-2 py-1"><CheckCircle2 size={12} /> Em dia</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-700 rounded-full px-2 py-1"><AlertTriangle size={12} /> Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <div className="relative group/menu">
                        <button title="Ações" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>
                        <div className="hidden group-hover/menu:block absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                          <button onClick={() => setLancar({ cambistaId: c.id, nome: c.nome, comissaoPadrao: c.comissaoPadrao })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} className="text-orange-600" /> Novo lançamento</button>
                          <button onClick={() => gerarRelatorio && gerarRelatorio(c.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FileText size={14} className="text-emerald-600" /> Relatório semanal</button>
                          <button onClick={() => setPagar({ cambistaId: c.id, nome: c.nome, valor: saldo > 0 ? saldo.toFixed(2) : "", data: iso(new Date()), obs: "" })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Banknote size={14} className="text-orange-600" /> Registrar pagamento</button>
                          <button onClick={() => setEditar({ ...c })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Pencil size={14} /> Editar</button>
                          <div className="border-t border-slate-100"></div>
                          <button onClick={() => {
                            if (confirm(`CUIDADO: Excluir ${c.nome}?\n\nTodos os lançamentos dele também serão removidos. Esta ação é irreversível.\n\nClique OK para confirmar.`)) {
                              if (confirm(`Tem certeza? Clique OK NOVAMENTE para deletar ${c.nome}.`)) {
                                registrarAuditoria("deletar_cambista", { id: c.id, nome: c.nome });
                                update((d) => {
                                  d.cambistas = d.cambistas.filter((x) => x.id !== c.id);
                                  d.lancamentos = d.lancamentos.filter((l) => l.cambistaId !== c.id);
                                });
                              }
                            }
                          }} className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Deletar</button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">Nenhum cambista cadastrado. Clique em "Novo Cambista".</td></tr>}
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
            setEditar(null);
          }} />
      )}
      {pagar && (
        <ModalPagamento dados={pagar} onClose={() => setPagar(null)}
          onSave={(val) => {
            update((d) => { d.pagamentos = d.pagamentos || []; d.pagamentos.push({ id: uid(), ...val }); });
            setPagar(null);
          }} />
      )}
      {lancar && (
        <ModalLancamento dados={lancar} onClose={() => setLancar(null)}
          onSave={(val) => {
            update((d) => { d.lancamentos.push({ id: uid(), cambistaId: lancar.cambistaId, data: val.data, positivo: val.valor, movimentacao: null, pct: val.pct, obs: "" }); });
            registrarAuditoria("criar_lancamento", { cambista: lancar.nome, valor: val.valor });
            setLancar(null);
          }} />
      )}
      {detalhe && (
        <ModalDetalheCambista cambista={detalhe} lancamentos={db.lancamentos.filter((l) => l.cambistaId === detalhe.id)}
          pagamentos={(db.pagamentos || []).filter((p) => p.cambistaId === detalhe.id)} onClose={() => setDetalhe(null)} />
      )}
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
    if (isNaN(v) || v <= 0) return alert("Informe um valor válido.");
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
    if (String(f.valor).trim() === "" || isNaN(parseFloat(String(f.valor).replace(",", ".")))) return alert("Informe o valor movimentado (use negativo se ele perdeu).");
    if (pctNum < 0 || pctNum > 1) return alert("A comissão deve estar entre 0% e 100%.");
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

function MiniKpi({ rotulo, v, cor = "text-slate-900" }) {
  return <div className="bg-slate-50 rounded-lg p-3 min-w-0"><div className="text-[10px] uppercase tracking-wide text-slate-400">{rotulo}</div><div className={`text-lg font-bold tabular-nums truncate ${cor}`}>{v}</div></div>;
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center shrink-0">{(cambista.nome || "?").trim()[0]?.toUpperCase() || "?"}</div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">{cambista.nome}</div>
              <div className="text-xs text-slate-400">{cambista.contato || "sem contato"}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 shrink-0"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
              {[["semana","Semana"],["mes","Mês"],["tudo","Tudo"]].map(([id, lab]) => (
                <button key={id} onClick={() => { setGran(id); setDtDe(""); setDtAte(""); }} className={`px-3 py-1.5 text-xs font-medium ${!custom && gran === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{lab}</button>
              ))}
            </div>
            <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
              <span className="text-slate-400">De</span>
              <input type="date" value={dtDe} onChange={(ev) => setDtDe(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
              <span className="text-slate-400">Até</span>
              <input type="date" value={dtAte} onChange={(ev) => setDtAte(ev.target.value)} className="outline-none bg-transparent text-slate-700" />
            </div>
            {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500">limpar</button>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKpi rotulo="Bruto" v={brl(ag.bruto)} />
            <MiniKpi rotulo="Comissão" v={brl(ag.comissao)} cor="text-slate-900" />
            <MiniKpi rotulo="Líquido" v={brl(ag.receber)} cor={ag.receber >= 0 ? "text-emerald-600" : "text-rose-600"} />
            <MiniKpi rotulo="Saldo Pendente" v={brl(Math.max(0, saldo))} cor={saldo > 0.01 ? "text-amber-600" : "text-emerald-600"} />
          </div>

          <div className={cardBox}>
            <div className="flex items-center justify-between mb-3">
              <div className={titSec + " mb-0"}>Histórico por Dia</div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Saldo Total</div>
                <div className={`text-lg font-bold tabular-nums ${ag.bruto >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{ag.bruto >= 0 ? "+" : ""}{brl(ag.bruto)}</div>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {porDia.map((d) => (
                <div key={d.data} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-600 tabular-nums">
                    {fmtData(d.data)}
                    {d.n > 1 && <span className="text-xs text-slate-400 ml-2">({d.n} lançamentos)</span>}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${d.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{d.total >= 0 ? "+" : ""}{brl(d.total)}</span>
                </div>
              ))}
              {porDia.length === 0 && <div className="py-8 text-center text-slate-400 text-sm">Nenhum lançamento neste período.</div>}
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

  const lista_filtrada = useMemo(() => {
    return (db.gastos || [])
      .filter((g) => dentro({ data: g.data }, s, e))
      .filter((g) => !busca || g.descricao.toLowerCase().includes(busca.toLowerCase()) || g.categoria.toLowerCase().includes(busca.toLowerCase()))
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
    if (!categoria.trim()) return alert("Selecione uma categoria.");
    if (!descricao.trim()) return alert("Informe a descrição.");
    if (isNaN(v) || v <= 0) return alert("Informe um valor válido.");

    update((d) => {
      if (editId) {
        const i = d.gastos.findIndex((x) => x.id === editId);
        d.gastos[i] = { id: editId, categoria, descricao: descricao.trim(), valor: v, data };
      } else {
        d.gastos.push({ id: uid(), categoria, descricao: descricao.trim(), valor: v, data });
      }
    });

    setCategoria("Alimentação");
    setDescricao("");
    setValor("");
    setData(iso(new Date()));
    setEditId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-slate-500">Período: <span className="font-medium text-slate-700">{custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotuloPeriodo(gran, ref_)}</span></div>
        <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 ${custom ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
          <span className="text-slate-400">De</span>
          <input type="date" value={dtDe} onChange={(ev) => { setDtDe(ev.target.value); setPaginaGastos(1); }} className="outline-none bg-transparent text-slate-700" />
          <span className="text-slate-400">Até</span>
          <input type="date" value={dtAte} onChange={(ev) => { setDtAte(ev.target.value); setPaginaGastos(1); }} className="outline-none bg-transparent text-slate-700" />
        </div>
        {custom && <button onClick={() => { setDtDe(""); setDtAte(""); }} className="text-xs text-slate-400 hover:text-rose-500">limpar</button>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-700 mb-3">{editId ? "Editar Gasto" : "Novo Gasto"}</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className={lbl}>Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
              {CATEGORIAS_GASTOS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
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
          <button onClick={adicionar} className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg px-3 py-2 h-10 w-full"><Check size={16} /> {editId ? "Salvar" : "Adicionar"}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cardBox}>
          <div className={titSec}>Total Gasto</div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{brl(dados_agregados.total)}</div>
          <div className="text-xs text-slate-500 mt-2">Período: {custom ? `${fmtData(dtDe)} a ${fmtData(dtAte)}` : rotuloPeriodo(gran, ref_)}</div>
        </div>

        <div className={`${cardBox} lg:col-span-2`}>
          <div className={titSec}>Gasto por Categoria</div>
          <div className="space-y-2">
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
                    <div className="h-full rounded-full" style={{ width: `${pct_cat}%`, backgroundColor: CORES_LARANJA[idx % CORES_LARANJA.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={cardBox}>
        <div className={titSec}>Tendência de Gastos (Últimos Períodos)</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tendenciaGastos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="rot" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtEixo} width={40} />
              <Tooltip formatter={(v) => [brl(v), "Total"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Line type="monotone" dataKey="total" stroke="#475569" strokeWidth={2.5} dot={{ r: 4, fill: "#475569" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-wrap">
          <Search size={15} className="text-slate-400" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPaginaGastos(1); }} placeholder="Buscar por categoria ou descrição..." className="text-sm flex-1 outline-none bg-transparent" />
          <span className="text-xs text-slate-400 tabular-nums">{lista_filtrada.length} gasto(s)</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {lista_paginada.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{fmtData(g.data)}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{g.categoria}</td>
                  <td className="px-4 py-2.5 text-slate-600">{g.descricao}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{brl(g.valor)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditId(g.id); setCategoria(g.categoria); setDescricao(g.descricao); setValor(String(g.valor)); setData(g.data); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                      <button onClick={() => update((d) => { d.gastos = d.gastos.filter((x) => x.id !== g.id); })} className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {lista_filtrada.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">Nenhum gasto registrado neste período.</td></tr>}
            </tbody>
            {lista_filtrada.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-semibold text-slate-700">Total {busca ? "filtrado" : "do período"} ({lista_filtrada.length})</td>
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
              <button onClick={() => setPaginaGastos(Math.max(1, paginaGastos - 1))} disabled={paginaGastos === 1} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
              <button onClick={() => setPaginaGastos(Math.min(totalPaginas, paginaGastos + 1))} disabled={paginaGastos === totalPaginas} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================== RELATÓRIOS ======================== */
function Relatorios({ db, cambById, lancs, gran, ref_, preSelecionar, onConsumir }) {
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
  const periodoDefault = `${pad(s.getDate())}/${pad(s.getMonth() + 1)} a ${pad(e.getDate())}/${pad(e.getMonth() + 1)}`;

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
    if (!window.html2canvas || !ticketRef.current) { alert("O gerador de imagem ainda está carregando. Tente novamente em alguns segundos."); return; }
    try {
      const canvas = await window.html2canvas(ticketRef.current, { backgroundColor: null, scale: 3, useCORS: true });
      const link = document.createElement("a");
      link.download = `relatorio-${(nome || "cambista").toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      alert("Não consegui gerar a imagem agora. Use Salvar como PDF como alternativa.");
    }
  };

  const enviarWhatsApp = async () => {
    if (!telefone) return alert("Informe o número do WhatsApp do cambista.");
    if (!window.html2canvas || !ticketRef.current) return alert("Aguarde o gerador de imagem carregar.");

    try {
      const canvas = await window.html2canvas(ticketRef.current, { backgroundColor: null, scale: 3, useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

      const formData = new FormData();
      formData.append("file", blob, "relatorio.png");
      formData.append("phone", telefone.replace(/\D/g, ""));
      formData.append("name", nome);

      const response = await fetch("/api/whatsapp/send", { method: "POST", body: formData });
      if (response.ok) {
        alert("Relatório enviado com sucesso via WhatsApp!");
      } else {
        alert("Erro ao enviar relatório. Verifique a conexão ou o número do telefone.");
      }
    } catch (err) {
      alert("Erro ao enviar relatório: " + err.message);
    }
  };

  const salvarPdf = () => window.print();

  const inpDark = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 placeholder:text-slate-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-500">Gerador de Relatório de Fechamento</div>
        <button onClick={() => exportarExcel({ db })} className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-1.5">
          <FileSpreadsheet size={13} /> Exportar Dados (.xlsx)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-5">
        <div className="bg-slate-950 rounded-2xl p-5 text-white space-y-4 h-fit">
          <div>
            <div className="text-lg font-black"><span className="text-white">ESPORTEVIP</span><span className="text-orange-500">APP</span></div>
            <div className="text-xs text-slate-400">Gerador de Relatório</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setModo("paga")} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2 justify-center ${modo === "paga" ? "border-red-500 bg-red-500/10 text-white" : "border-slate-700 text-slate-400"}`}>
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Você Paga
            </button>
            <button onClick={() => setModo("recebe")} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2 justify-center ${modo === "recebe" ? "border-emerald-500 bg-emerald-500/10 text-white" : "border-slate-700 text-slate-400"}`}>
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
            <button onClick={baixarImagem} disabled={!html2canvasPronto} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg py-2.5 text-sm">
              {html2canvasPronto ? "Baixar Imagem (PNG)" : "Carregando..."}
            </button>
            <button onClick={enviarWhatsApp} disabled={!html2canvasPronto} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2">
              <Send size={15} /> {html2canvasPronto ? "Enviar WhatsApp" : "Carregando..."}
            </button>
            <button onClick={salvarPdf} className="w-full border border-slate-700 hover:bg-slate-900 text-white rounded-lg py-2.5 text-sm flex items-center justify-center gap-2">
              <Printer size={15} /> Salvar como PDF
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <div id="ticket-print-area" ref={ticketRef} className="rounded-3xl border-4 border-orange-500 p-8" style={{ background: "#020617" }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-black tracking-tight"><span className="text-white">ESPORTEVIP</span><span className="text-orange-500">APP</span></div>
              {telefone && <div className="text-white text-sm font-semibold mt-1">{telefone}</div>}
              <div className="text-slate-500 text-[11px] tracking-[0.2em] mt-0.5">ESPORTEVIP.APP</div>
              <div className="h-px w-40 bg-slate-700 mx-auto mt-4" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[11px] tracking-[0.3em] text-orange-500 font-bold uppercase">RELATÓRIO</div>
              <div className="text-white font-black uppercase leading-[0.95] mt-1 text-4xl">{rotuloPeriodo(gran, ref_)}</div>
              <div className="inline-flex items-center gap-2 mt-4 bg-slate-800/70 border border-slate-700 rounded-full px-4 py-1.5 text-xs text-slate-300">
                <span className="text-slate-500">Período</span><span className="font-semibold text-white">{periodoTxt || periodoDefault}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center shrink-0">{inicial}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Cambista</div>
                    <div className="text-slate-900 font-bold truncate leading-relaxed pb-0.5">{nome || "Sem Nome"}</div>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold shrink-0">Fechamento</div>
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
                <span className="text-slate-500 font-medium flex items-center gap-2">Comissão <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded">{pctNum}%</span></span>
                <span className="text-slate-900 font-bold text-2xl tabular-nums">{numFmt(comissaoNum)}</span>
              </div>
              <div className={`px-5 py-4 flex items-center justify-between ${modo === "paga" ? "bg-red-600" : "bg-emerald-600"}`}>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-white/70 font-semibold">Total Geral</div>
                  <div className="text-white font-bold">{modo === "paga" ? "Você Paga" : "Nós Temos que Pagar"}</div>
                </div>
                <div className="text-white text-right">
                  <span className="text-base font-semibold align-top mr-0.5">R$</span><span className="text-3xl font-black">{numFmt(totalNum)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-5 mt-4 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Você Paga</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Nós Temos que Pagar</span>
            </div>

            <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
              <div className="bg-green-500 text-slate-950 font-black text-xs rounded-lg px-2.5 py-1.5 shrink-0">PIX</div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Forma de Pagamento</div>
                <div className="text-white font-bold text-sm leading-relaxed pb-0.5">Aguarde enviarmos a chave Pix</div>
              </div>
            </div>

            {pagamentoAte && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block shrink-0" />
                Realize o pagamento até <span className="font-bold text-white">{pagamentoAte}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== MODAIS ======================== */
function Campo({ label, children }) { return <div><label className={lbl}>{label}</label>{children}</div>; }
function Modal({ titulo, children, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-900">{titulo}</div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Cancelar</button>
          <button onClick={onSave} className="text-sm px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium">Salvar</button>
        </div>
      </div>
    </div>
  );
}
