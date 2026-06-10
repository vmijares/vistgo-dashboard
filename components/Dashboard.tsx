"use client";
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
  ComposedChart, Line,
} from "recharts";

// ── Brand Colors ──────────────────────────────────────────────
const C = {
  navy:   "#1e2147",
  navyD:  "#13152e",
  navyM:  "#252849",
  lime:   "#b8c94a",
  lime2:  "#cede6a",
  purple: "#4a2d8a",
  lila:   "#8b5cf6",
  muted:  "#6b6f9a",
  white:  "#f0f1ff",
  red:    "#e05a5a",
  green:  "#4ade80",
};

// ── Types ─────────────────────────────────────────────────────
interface TopCliente  { nombre: string; sector: string; facturacion: number }
interface TopProyecto { nombre: string; cliente: string; importe: number; estado: string }
interface YtdCliente  {
  nombre: string; sector: string;
  ytdActual: number; margenActual: number;
  ytdAnterior: number; margenAnterior: number;
}
interface MargenBajo  {
  count: number; total: number;
  proyectos: { nombre: string; codigo: string; fechaFin: string; cliente: string; importe: number; margen: number }[];
}
interface YtdTotals {
  current: { ventas: number; margen: number; pct: number };
  prev:    { ventas: number; margen: number; pct: number };
}

interface DashboardProps {
  ventasMargen:  { año: number; ventas: number; margen: number; pct: number }[];
  feeCv:         { año: number; fee: number; cv: number }[];
  proyectosMes:  Record<number, number[]>;
  facturasMes:   Record<number, number[]>;
  margenMes:     Record<number, number[]>;
  sectores:      Record<number, Record<string, number>>;
  topClientes:   Record<number, TopCliente[]>;
  allClientes:   Record<number, TopCliente[]>;
  ytdClientes:   YtdCliente[];
  ytdTotals:     YtdTotals;
  topProyectos:  Record<number, TopProyecto[]>;
  margenBajo:    MargenBajo;
  previsionAnual: Record<number, number>;
  años:          number[];
  currentYear:   number;
  todayMonth:    number;
  onLogout:      () => void;
}

// ── Logo SVG ──────────────────────────────────────────────────
const VistgoLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size * 2.8} height={size} viewBox="0 0 120 42" fill="none">
    <circle cx="100" cy="21" r="19" fill={C.navy} />
    <polygon points="108,21 98,13 98,17 86,17 86,25 98,25 98,29" fill={C.lime} />
    <polygon points="96,21 90,16 90,26" fill={C.navy} opacity="0.6" />
    <text x="0" y="29" fontFamily="'DM Sans',sans-serif" fontWeight="800"
      fontSize="22" fill={C.lime} letterSpacing="-0.5">vistgo</text>
  </svg>
);

const MESES_CORTO  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_NOMBRE = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MESES_CORTO_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (v: number | string | undefined) => {
  const n = Number(v);
  if (!n) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${Math.round(n / 1000)}K`;
  return String(n);
};
const fmtEur = (v: number | string | undefined) => `${fmt(v)}€`;
const deltaColor = (d: string | number) => Number(d) >= 0 ? C.lime : C.red;
const deltaSign  = (d: string | number) => Number(d) >= 0 ? "▲" : "▼";

// ── Tooltip ───────────────────────────────────────────────────
interface TooltipPayloadItem { color: string; name: string; value: number }
const CustomTooltip = ({
  active, payload, label, isEur = true,
}: {
  active?: boolean; payload?: TooltipPayloadItem[]; label?: string; isEur?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.navyD, border: `1px solid ${C.lime}44`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.white,
      boxShadow: "0 8px 32px #00000066",
    }}>
      <p style={{ color: C.lime, fontWeight: 700, margin: "0 0 6px" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <strong>{isEur ? fmtEur(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────
const KPI = ({
  label, value, sub, accent, icon,
}: {
  label: string; value: string | number; sub?: string; accent?: string; icon: string;
}) => (
  <div style={{
    background: C.navyM, borderRadius: 14, padding: "18px 20px",
    borderTop: `3px solid ${accent || C.lime}`,
    flex: "1 1 160px", minWidth: 140, position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: 10, right: 14, fontSize: 20, opacity: 0.15 }}>{icon}</div>
    <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, margin: 0, fontWeight: 600 }}>
      {label}
    </p>
    <p style={{ color: C.white, fontSize: 26, fontWeight: 800, margin: "6px 0 2px", lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ color: accent || C.lime, fontSize: 11, margin: 0, fontWeight: 500 }}>{sub}</p>}
  </div>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: C.navyM, borderRadius: 16, padding: "22px 24px", marginBottom: 18, ...style }}>
    {children}
  </div>
);

const STitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div style={{ marginBottom: 18 }}>
    <h2 style={{ color: C.white, fontSize: 13, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>
      {title}
    </h2>
    {sub && <p style={{ color: C.muted, fontSize: 11, margin: "3px 0 0" }}>{sub}</p>}
  </div>
);

const YearPill = ({
  value, options, onChange,
}: {
  value: number; options: number[]; onChange: (y: number) => void;
}) => (
  <div style={{ display: "flex", gap: 4 }}>
    {options.map(y => (
      <button key={y} onClick={() => onChange(y)} style={{
        background: value === y ? C.lime : "transparent",
        color: value === y ? C.navy : C.muted,
        border: `1px solid ${value === y ? C.lime : C.muted + "55"}`,
        borderRadius: 20, padding: "3px 12px", fontSize: 12,
        fontWeight: 700, cursor: "pointer",
      }}>{y}</button>
    ))}
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────
export default function Dashboard({
  ventasMargen, feeCv, proyectosMes, facturasMes, margenMes,
  sectores, topClientes, allClientes, ytdClientes, ytdTotals,
  topProyectos, margenBajo, previsionAnual,
  años, currentYear, todayMonth, onLogout,
}: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [objetivos, setObjetivos] = useState<Record<number, number>>({});
  const [editingObj, setEditingObj] = useState(false);
  const [objInput, setObjInput] = useState("");

  // suppress unused
  void ytdTotals;
  void topProyectos;

  useEffect(() => {
    if (años.length > 0) setSelectedYear(años[años.length - 1]);
  }, [años]);

  // Load objectives from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vistgo_objetivo_margen");
      if (saved) setObjetivos(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveObjetivo = (val: string) => {
    const num = Number(val.replace(/[^\d]/g, ""));
    if (num >= 0) {
      const updated = { ...objetivos, [selectedYear]: num };
      setObjetivos(updated);
      localStorage.setItem("vistgo_objetivo_margen", JSON.stringify(updated));
    }
    setEditingObj(false);
  };

  // ── KPIs — recalculated from facturasMes/margenMes for selectedYear ──
  const year = selectedYear || currentYear;
  const ytdV  = (facturasMes[year]   ?? []).slice(0, todayMonth).reduce((a, b) => a + b, 0);
  const ytdVp = (facturasMes[year-1] ?? []).slice(0, todayMonth).reduce((a, b) => a + b, 0);
  const ytdM  = (margenMes[year]     ?? []).slice(0, todayMonth).reduce((a, b) => a + b, 0);
  const ytdMp = (margenMes[year-1]   ?? []).slice(0, todayMonth).reduce((a, b) => a + b, 0);
  const ytdMpct  = ytdV  > 0 ? ytdM  / ytdV  * 100 : 0;
  const ytdMpctP = ytdVp > 0 ? ytdMp / ytdVp * 100 : 0;

  const ytdDeltaV = ytdVp > 0
    ? (((ytdV - ytdVp) / ytdVp) * 100).toFixed(1) : "—";
  const ytdDeltaM = ytdVp > 0
    ? (ytdMpct - ytdMpctP).toFixed(1) : "—";

  // YTD project count
  const ytdEjecActual = (proyectosMes[year]   ?? []).slice(0, todayMonth).reduce((a, b) => a + b, 0);
  const ytdEjecPrev   = (proyectosMes[year-1] ?? []).slice(0, todayMonth).reduce((a, b) => a + b, 0);
  const ytdDeltaEjec  = ytdEjecPrev > 0
    ? (((ytdEjecActual - ytdEjecPrev) / ytdEjecPrev) * 100).toFixed(1) : "—";

  const mesRangeLabel = `${MESES_CORTO_ES[0]}–${MESES_CORTO_ES[todayMonth - 1]}`;

  // Previsión hasta 31/12
  const prevision = previsionAnual[year] ?? 0;

  // Objetivo margen
  const objetivo = objetivos[year] ?? 0;
  const pctObj   = objetivo > 0 ? (ytdM / objetivo) * 100 : 0;

  const avgMargen = ventasMargen.length > 0
    ? (ventasMargen.reduce((a, d) => a + d.pct, 0) / ventasMargen.length).toFixed(1) : "—";

  // ── Chart data ───────────────────────────────────────────────
  const vmData    = ventasMargen.map(d => ({ ...d, año: String(d.año) }));
  const feeCvData = feeCv.map(d => ({ ...d, año: String(d.año) }));

  // Facturación mensual + margen % — con comparativa año anterior
  const dataFacMes = MESES_CORTO.map((mes, i) => {
    const facActual  = selectedYear ? (facturasMes[selectedYear]?.[i]     ?? 0) : 0;
    const facPrev    = selectedYear ? (facturasMes[selectedYear - 1]?.[i] ?? 0) : 0;
    const marActual  = selectedYear ? (margenMes[selectedYear]?.[i]       ?? 0) : 0;
    const margenPct  = facActual > 0 ? Number(((marActual / facActual) * 100).toFixed(1)) : null;
    return { mes, actual: facActual, anterior: facPrev, margenPct };
  });

  // Facturación por trimestres
  const dataTrimes = ["Q1", "Q2", "Q3", "Q4"].map((q, qi) => {
    const ms = [0, 1, 2].map(m => qi * 3 + m);
    const actual   = ms.reduce((s, m) => s + (facturasMes[selectedYear]?.[m]   ?? 0), 0);
    const anterior = ms.reduce((s, m) => s + (facturasMes[selectedYear - 1]?.[m] ?? 0), 0);
    const margenA  = ms.reduce((s, m) => s + (margenMes[selectedYear]?.[m]     ?? 0), 0);
    return {
      q, actual, anterior,
      margenPct: actual > 0 ? Number((margenA / actual * 100).toFixed(1)) : null,
    };
  });

  // Proyectos por mes — agrupado actual + anterior
  const dataEjec = MESES_CORTO.map((mes, i) => ({
    mes,
    actual:   selectedYear ? (proyectosMes[selectedYear]?.[i]     ?? 0) : 0,
    anterior: selectedYear ? (proyectosMes[selectedYear - 1]?.[i] ?? 0) : 0,
  }));
  const totalEjec = dataEjec.reduce((s, d) => s + d.actual, 0);
  const totalEjecPrev = dataEjec.reduce((s, d) => s + d.anterior, 0);

  const dataSect = selectedYear && sectores[selectedYear]
    ? Object.entries(sectores[selectedYear])
        .map(([sector, importe]) => ({ sector, importe }))
        .filter(d => d.importe > 0)
        .sort((a, b) => b.importe - a.importe)
        .slice(0, 8)
    : [];

  // Clientes anuales: top 15 con sparkbars 3 años
  const allClientesAño: TopCliente[] = selectedYear ? (allClientes[selectedYear] ?? []) : [];
  const topClientesChart = allClientesAño.slice(0, 15);

  // Max referencia para sparkbars (mayor importe en cualquiera de los 3 años)
  const maxRef3y = topClientesChart.reduce((mx, c) => {
    const y0 = c.facturacion;
    const y1 = (allClientes[selectedYear - 1] ?? []).find(x => x.nombre === c.nombre)?.facturacion ?? 0;
    const y2 = (allClientes[selectedYear - 2] ?? []).find(x => x.nombre === c.nombre)?.facturacion ?? 0;
    return Math.max(mx, y0, y1, y2);
  }, 1);

  return (
    <div style={{
      background: C.navyD, minHeight: "100vh",
      fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
      color: C.white,
    }}>
      {/* ── HEADER ── */}
      <div style={{
        background: C.navy,
        borderBottom: `1px solid ${C.lime}22`,
        padding: "14px 24px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 24px #00000044",
      }}>
        <VistgoLogo size={28} />
        <div style={{ width: 1, height: 28, background: `${C.muted}44`, margin: "0 4px" }} />
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.white }}>Panel de Informes</p>
          <p style={{ margin: 0, fontSize: 10, color: C.muted }}>brand implementation experts</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {años.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Año</span>
              <YearPill value={selectedYear} options={años} onChange={setSelectedYear} />
            </div>
          )}
          <div style={{ width: 1, height: 20, background: `${C.muted}33` }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.lime, boxShadow: `0 0 6px ${C.lime}` }} />
            <span style={{ color: C.muted, fontSize: 11 }}>Live · {new Date().toLocaleDateString("es-ES")}</span>
          </div>
          <button onClick={onLogout} style={{
            background: "transparent", border: `1px solid ${C.muted}44`,
            borderRadius: 8, padding: "5px 12px", color: C.muted,
            fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }}>Salir</button>
        </div>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ── KPIs — comparativa YTD por año seleccionado ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <KPI
            icon="💶"
            label={`Facturación ${mesRangeLabel} ${year}`}
            value={fmtEur(ytdV)}
            sub={ytdDeltaV !== "—"
              ? `${deltaSign(ytdDeltaV)} ${Math.abs(Number(ytdDeltaV))}% vs ${year - 1} (${mesRangeLabel})`
              : "Sin comparativa"}
            accent={ytdDeltaV !== "—" ? deltaColor(ytdDeltaV) : C.lime}
          />
          <KPI
            icon="📈"
            label={`Margen ${mesRangeLabel} ${year}`}
            value={`${ytdMpct.toFixed(1)}%`}
            sub={ytdDeltaM !== "—"
              ? `${deltaSign(ytdDeltaM)} ${Math.abs(Number(ytdDeltaM))}pp vs ${year - 1} (${mesRangeLabel})`
              : "Sin comparativa"}
            accent={ytdDeltaM !== "—" ? deltaColor(ytdDeltaM) : C.lime}
          />
          <KPI
            icon="🗂"
            label={`Proyectos ${mesRangeLabel} ${year}`}
            value={ytdEjecActual}
            sub={ytdDeltaEjec !== "—"
              ? `${deltaSign(ytdDeltaEjec)} ${Math.abs(Number(ytdDeltaEjec))}% vs ${year - 1} (${mesRangeLabel})`
              : `${ytdEjecActual} proyectos ejecutados`}
            accent={ytdDeltaEjec !== "—" ? deltaColor(ytdDeltaEjec) : C.lime2}
          />
          <KPI
            icon="📋"
            label={`En previsión hasta 31/12 · ${year}`}
            value={prevision > 0 ? fmtEur(prevision) : "—"}
            sub="Proyectos en ejecución"
            accent={C.lila}
          />
          {/* Objetivo de margen — editable */}
          <div style={{
            background: C.navyM, borderRadius: 14, padding: "18px 20px",
            borderTop: `3px solid ${objetivo > 0 ? (pctObj >= 100 ? C.lime : pctObj >= 75 ? C.lime2 : C.red) : C.muted}`,
            flex: "1 1 160px", minWidth: 140, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 10, right: 14, fontSize: 20, opacity: 0.15 }}>🎯</div>
            <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, margin: 0, fontWeight: 600 }}>
              Objetivo margen {year}
            </p>
            <p style={{ color: C.white, fontSize: 26, fontWeight: 800, margin: "6px 0 2px", lineHeight: 1 }}>
              {objetivo > 0 ? `${pctObj.toFixed(1)}%` : "—"}
            </p>
            {objetivo > 0 && (
              <p style={{ color: pctObj >= 100 ? C.lime : pctObj >= 75 ? C.lime2 : C.red, fontSize: 11, margin: "0 0 6px", fontWeight: 500 }}>
                {fmtEur(ytdM)} de {fmtEur(objetivo)}
              </p>
            )}
            {editingObj ? (
              <input
                autoFocus
                type="number"
                defaultValue={objetivo || ""}
                placeholder="Ej: 650000"
                onBlur={e => saveObjetivo(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveObjetivo((e.target as HTMLInputElement).value); if (e.key === "Escape") setEditingObj(false); }}
                style={{
                  background: `${C.navy}`, border: `1px solid ${C.lime}55`,
                  borderRadius: 6, padding: "4px 8px", color: C.white,
                  fontSize: 12, width: "100%", fontFamily: "'DM Sans',sans-serif", marginTop: 4,
                }}
              />
            ) : (
              <button onClick={() => { setObjInput(String(objetivo || "")); setEditingObj(true); }} style={{
                background: "transparent", border: `1px solid ${C.muted}33`,
                borderRadius: 6, padding: "3px 8px", color: C.muted,
                fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}>
                {objetivo > 0 ? `Objetivo: ${fmtEur(objetivo)}` : "Configura objetivo"}
              </button>
            )}
          </div>
          <KPI
            icon="⭐"
            label={`Margen acumulado ${ventasMargen.length}a`}
            value={`~${avgMargen}%`}
            sub="Media histórica"
            accent={C.lime}
          />
        </div>

        {/* ── ROW 1: Facturación histórica + Facturación mensual con margen ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>

          {/* Facturación y margen histórico */}
          <Card style={{ margin: 0 }}>
            <STitle
              title={`Facturación y margen · ${ventasMargen.length} años`}
              sub="Ventas totales vs margen bruto"
            />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vmData} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
                <XAxis dataKey="año" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                <Bar dataKey="ventas" name="Ventas" fill={C.lime}  radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="margen" name="Margen" fill={C.lila}  radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {vmData.map(d => (
                <div key={d.año} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, minWidth: 36 }}>{d.año}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: `${C.muted}22`, overflow: "hidden" }}>
                    <div style={{ width: `${d.pct}%`, height: "100%", background: C.lime, borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                  <span style={{ color: C.lime, fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: "right" }}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Facturación mensual + margen % + año anterior */}
          <Card style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <STitle
                title="Facturación mensual con margen"
                sub={`${selectedYear || "—"} vs ${selectedYear ? selectedYear - 1 : "—"} · línea = % margen ${selectedYear}`}
              />
              <span style={{
                background: `${C.lime}22`, color: C.lime, borderRadius: 20,
                padding: "2px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{fmtEur(dataFacMes.reduce((s, d) => s + d.actual, 0))}</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={dataFacMes} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="eur" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v}%`} tick={{ fill: C.lila, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                <Bar yAxisId="eur" dataKey="actual"   name={`Fact. ${selectedYear}`}     fill={C.white}        radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="eur" dataKey="anterior" name={`Fact. ${selectedYear ? selectedYear - 1 : "ant."}`} fill={`${C.muted}55`} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line yAxisId="pct" dataKey="margenPct" name="Margen %" stroke={C.lila} strokeWidth={2} dot={{ fill: C.lila, r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── ROW 1b: Facturación por trimestres ── */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <STitle
              title="Facturación por trimestres"
              sub={`${selectedYear || "—"} vs ${selectedYear ? selectedYear - 1 : "—"} · línea = % margen ${selectedYear}`}
            />
            <span style={{
              background: `${C.lila}22`, color: C.lila, borderRadius: 20,
              padding: "2px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{fmtEur(dataTrimes.reduce((s, d) => s + d.actual, 0))}</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={dataTrimes} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
              <XAxis dataKey="q" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="eur" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v}%`} tick={{ fill: C.lila, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
              <Bar yAxisId="eur" dataKey="actual"    name={`Fact. ${selectedYear}`}     fill={C.white}        radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar yAxisId="eur" dataKey="anterior"  name={`Fact. ${selectedYear ? selectedYear - 1 : "ant."}`} fill={`${C.muted}55`} radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Line yAxisId="pct" dataKey="margenPct" name="Margen %" stroke={C.lila} strokeWidth={2} dot={{ fill: C.lila, r: 5 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* ── ROW 2: Proyectos mes (con YoY) + FEE CV ── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, marginBottom: 18 }}>

          {/* Proyectos ejecutados por mes — agrupado actual + anterior */}
          <Card style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <STitle
                title="Proyectos ejecutados por mes"
                sub={`${selectedYear || "—"} vs ${selectedYear ? selectedYear - 1 : "—"}`}
              />
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <span style={{ background: `${C.lime}22`, color: C.lime, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                  {totalEjec} en {selectedYear}
                </span>
                {totalEjecPrev > 0 && (
                  <span style={{ background: `${C.muted}22`, color: C.muted, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                    {totalEjecPrev} en {selectedYear ? selectedYear - 1 : "—"}
                  </span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dataEjec} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip isEur={false} />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                <Bar dataKey="actual"   name={`${selectedYear}`}             fill={C.white}        radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="anterior" name={`${selectedYear ? selectedYear - 1 : "ant."}`} fill={`${C.muted}55`} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* FEE y CV histórico */}
          <Card style={{ margin: 0 }}>
            <STitle title="FEE y CV · histórico" sub="Presupuestos facturados" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={feeCvData} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
                <XAxis dataKey="año" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                <Bar dataKey="fee" name="FEE" fill={C.lime} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="cv"  name="CV"  fill={C.lila} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── ROW 3: Sector + YTD por cliente ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>

          {/* Facturación por sector */}
          <Card style={{ margin: 0 }}>
            <STitle title="Facturación por sector" sub={`${selectedYear || "—"} · Importe según cliente`} />
            {dataSect.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
                Sin datos de sector disponibles
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, dataSect.length * 28)}>
                <BarChart data={dataSect} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="sector" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="importe" name="Facturación" radius={[0, 4, 4, 0]}>
                    {dataSect.map((d, i) => (
                      <Cell key={`${d.sector}-${i}`} fill={i === 0 ? C.lime : i === 1 ? C.lime2 : `${C.lime}88`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* YTD facturación + margen vs año anterior */}
          <Card style={{ margin: 0 }}>
            <STitle
              title={`Facturación hasta ${MESES_NOMBRE[todayMonth - 1]}`}
              sub={`Por cliente · ${year} vs ${year - 1} · mismas fechas`}
            />
            {ytdClientes.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
                Sin datos YTD disponibles
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
                {ytdClientes.map((c, i) => {
                  const delta = c.ytdAnterior > 0
                    ? (((c.ytdActual - c.ytdAnterior) / c.ytdAnterior) * 100).toFixed(1)
                    : c.ytdActual > 0 ? "new" : "—";
                  const margenPct = c.ytdActual > 0
                    ? ((c.margenActual / c.ytdActual) * 100).toFixed(1) : "—";
                  return (
                    <div key={i} style={{
                      padding: "10px 12px",
                      background: i === 0 ? `${C.lime}0d` : `${C.muted}0a`,
                      borderRadius: 10,
                      border: `1px solid ${i === 0 ? C.lime + "33" : C.muted + "22"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.white }}>{c.nombre}</p>
                          <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{c.sector}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ margin: 0, color: C.lime, fontWeight: 800, fontSize: 13 }}>{fmtEur(c.ytdActual)}</p>
                          {delta !== "—" && delta !== "new" && (
                            <div>
                              <span style={{ fontSize: 10, color: deltaColor(delta), fontWeight: 700 }}>
                                {deltaSign(delta)}{Math.abs(Number(delta))}% vs {currentYear - 1}
                              </span>
                              <br />
                              <span style={{ fontSize: 10, color: C.muted }}>
                                vs {fmtEur(c.ytdAnterior)} en {currentYear - 1}
                              </span>
                            </div>
                          )}
                          {delta === "new" && (
                            <span style={{ fontSize: 10, color: C.lime2, fontWeight: 700 }}>Nuevo cliente</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0 0 3px", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{currentYear}</p>
                          <div style={{ height: 4, borderRadius: 2, background: `${C.muted}22` }}>
                            <div style={{
                              width: `${Math.min(100, (c.ytdActual / (ytdClientes[0]?.ytdActual || 1)) * 100)}%`,
                              height: "100%", background: `linear-gradient(90deg,${C.lime},${C.lime2})`, borderRadius: 2,
                            }} />
                          </div>
                        </div>
                        {c.ytdAnterior > 0 && (
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: "0 0 3px", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{currentYear - 1}</p>
                            <div style={{ height: 4, borderRadius: 2, background: `${C.muted}22` }}>
                              <div style={{
                                width: `${Math.min(100, (c.ytdAnterior / (ytdClientes[0]?.ytdActual || 1)) * 100)}%`,
                                height: "100%", background: `${C.muted}66`, borderRadius: 2,
                              }} />
                            </div>
                          </div>
                        )}
                        {margenPct !== "—" && (
                          <div style={{ flexShrink: 0, textAlign: "right" }}>
                            <p style={{ margin: "0 0 3px", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Margen</p>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: Number(margenPct) >= 25 ? C.lime : C.red }}>
                              {margenPct}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── ROW 4: Facturación anual por cliente (3 años) ── */}
        <Card>
          <STitle
            title="Facturación anual por cliente"
            sub={`Últimos 3 años · ${selectedYear ? selectedYear - 2 : "—"}–${selectedYear || "—"} · ordenado por ${selectedYear || "año actual"}`}
          />
          {/* Leyenda de colores */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            {[
              { year: selectedYear,     color: C.lime  },
              { year: selectedYear - 1, color: C.lila  },
              { year: selectedYear - 2, color: C.muted },
            ].map(({ year: y, color }) => y > 0 && (
              <div key={y} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ color: C.muted, fontSize: 11 }}>{y}</span>
              </div>
            ))}
          </div>
          {topClientesChart.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin datos para {selectedYear}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {topClientesChart.map((c, i) => {
                const y0 = c.facturacion;
                const y1 = (allClientes[selectedYear - 1] ?? []).find(x => x.nombre === c.nombre)?.facturacion ?? 0;
                const y2 = (allClientes[selectedYear - 2] ?? []).find(x => x.nombre === c.nombre)?.facturacion ?? 0;
                const years = [
                  { year: selectedYear,     val: y0, color: C.lime  },
                  { year: selectedYear - 1, val: y1, color: C.lila  },
                  { year: selectedYear - 2, val: y2, color: C.muted },
                ];
                return (
                  <div key={`${c.nombre}-${i}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: i < 3 ? C.lime : `${C.lime}22`,
                          color: i < 3 ? C.navy : C.lime,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 800, flexShrink: 0,
                        }}>{i + 1}</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.white }}>{c.nombre}</p>
                          <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{c.sector}</p>
                        </div>
                      </div>
                      <span style={{ color: C.lime, fontWeight: 800, fontSize: 13 }}>{fmtEur(y0)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {years.map(({ year: y, val, color }) => val > 0 || y === selectedYear ? (
                        <div key={y} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: C.muted, fontSize: 10, fontWeight: 600, minWidth: 32, textAlign: "right" }}>{y}</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: `${C.muted}18`, overflow: "hidden" }}>
                            <div style={{
                              width: `${(val / maxRef3y) * 100}%`, height: "100%",
                              background: color, borderRadius: 3, transition: "width 0.6s ease",
                              minWidth: val > 0 ? 4 : 0,
                            }} />
                          </div>
                          <span style={{ color, fontSize: 10, fontWeight: 700, minWidth: 46, textAlign: "right" }}>
                            {val > 0 ? fmtEur(val) : "—"}
                          </span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                );
              })}
              {allClientesAño.length > 15 && (
                <p style={{ color: C.muted, fontSize: 11, textAlign: "center", margin: "4px 0 0" }}>
                  +{allClientesAño.length - 15} clientes más
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ── ROW 5: Presupuestos margen < 25% (solo terminados) ── */}
        <Card style={{ borderTop: `3px solid ${C.red}66` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <STitle
              title={`Presupuestos margen bajo · ${currentYear}`}
              sub="Terminados y facturados con margen final inferior al 25%"
            />
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <div style={{
                background: `${C.red}18`, border: `1px solid ${C.red}44`,
                borderRadius: 10, padding: "8px 16px", textAlign: "center",
              }}>
                <p style={{ margin: 0, color: C.red, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {margenBajo.count}
                </p>
                <p style={{ margin: "2px 0 0", color: C.muted, fontSize: 10 }}>proyectos</p>
              </div>
              <div style={{
                background: `${C.red}18`, border: `1px solid ${C.red}44`,
                borderRadius: 10, padding: "8px 16px", textAlign: "center",
              }}>
                <p style={{ margin: 0, color: C.red, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {fmtEur(margenBajo.total)}
                </p>
                <p style={{ margin: "2px 0 0", color: C.muted, fontSize: 10 }}>facturado</p>
              </div>
            </div>
          </div>
          {margenBajo.count === 0 ? (
            <p style={{ color: C.lime, fontSize: 13, textAlign: "center", padding: "20px 0", fontWeight: 600 }}>
              ✓ Todos los proyectos terminados en {currentYear} superan el 25% de margen
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {margenBajo.proyectos.map((p, i) => (
                <div key={i} style={{
                  padding: "10px 14px",
                  background: `${C.red}0d`,
                  borderRadius: 10,
                  border: `1px solid ${C.red}33`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 12, fontWeight: 700, color: C.white,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{p.nombre}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>{p.cliente}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                      <p style={{ margin: 0, color: C.white, fontWeight: 700, fontSize: 12 }}>{fmtEur(p.importe)}</p>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: C.red,
                        background: `${C.red}22`, borderRadius: 20, padding: "1px 8px",
                      }}>{p.margen}%</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span style={{
                      fontSize: 10, color: C.muted,
                      background: `${C.muted}18`, borderRadius: 4, padding: "1px 6px",
                    }}>{p.codigo}</span>
                    {p.fechaFin !== "—" && (
                      <span style={{
                        fontSize: 10, color: C.muted,
                        background: `${C.muted}18`, borderRadius: 4, padding: "1px 6px",
                      }}>Fin: {p.fechaFin}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Footer */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <VistgoLogo size={16} />
          <span style={{ color: `${C.muted}66`, fontSize: 10 }}>
            Panel interno · Datos FileMaker OData en tiempo real · {new Date().toLocaleString("es-ES")}
          </span>
        </div>
      </div>
    </div>
  );
}
