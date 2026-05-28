"use client";
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";

// ── Brand Colors ──────────────────────────────────────────────
const C = {
  navy:   "#1e2147",
  navyD:  "#13152e",
  navyM:  "#252849",
  lime:   "#b8c94a",
  lime2:  "#cede6a",
  purple: "#4a2d8a",
  lila:   "#8b5cf6",   // violeta vibrante — barras de margen/CV
  muted:  "#6b6f9a",
  white:  "#f0f1ff",
  red:    "#e05a5a",   // badges activos, deltas negativos, alertas
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
  proyectos: { nombre: string; cliente: string; importe: number; margen: number }[];
}

interface DashboardProps {
  ventasMargen:  { año: number; ventas: number; margen: number; pct: number }[];
  feeCv:         { año: number; fee: number; cv: number }[];
  proyectosMes:  Record<number, number[]>;
  facturasMes:   Record<number, number[]>;
  sectores:      Record<number, Record<string, number>>;
  topClientes:   Record<number, TopCliente[]>;
  allClientes:   Record<number, TopCliente[]>;
  ytdClientes:   YtdCliente[];
  topProyectos:  Record<number, TopProyecto[]>;
  margenBajo:    MargenBajo;
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
  ventasMargen, feeCv, proyectosMes, facturasMes,
  sectores, topClientes, allClientes, ytdClientes,
  topProyectos, margenBajo,
  años, currentYear, todayMonth, onLogout,
}: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState<number>(0);

  useEffect(() => {
    if (años.length > 0) setSelectedYear(años[años.length - 1]);
  }, [años]);

  // ── KPI deltas ───────────────────────────────────────────────
  const curVm  = ventasMargen.find(d => d.año === selectedYear);
  const prevVm = ventasMargen.find(d => d.año === selectedYear - 1);

  const deltaV = prevVm && prevVm.ventas > 0 && curVm
    ? (((curVm.ventas - prevVm.ventas) / prevVm.ventas) * 100).toFixed(1) : "—";
  const deltaM = prevVm && curVm
    ? (curVm.pct - prevVm.pct).toFixed(1) : "—";

  const totalEjec = selectedYear ? (proyectosMes[selectedYear] ?? []).reduce((a, b) => a + b, 0) : 0;
  const prevEjec  = selectedYear ? (proyectosMes[selectedYear - 1] ?? []).reduce((a, b) => a + b, 0) : 0;
  const deltaEjec = prevEjec > 0
    ? (((totalEjec - prevEjec) / prevEjec) * 100).toFixed(1) : "—";

  const clientesAño: TopCliente[] = selectedYear ? (topClientes[selectedYear] ?? []) : [];
  const topCliente = clientesAño[0];
  const topClientePrev = selectedYear ? (topClientes[selectedYear - 1] ?? [])[0] : undefined;
  const deltaTopC = topCliente && topClientePrev && topClientePrev.facturacion > 0
    ? (((topCliente.facturacion - topClientePrev.facturacion) / topClientePrev.facturacion) * 100).toFixed(1) : "—";

  const avgMargen = ventasMargen.length > 0
    ? (ventasMargen.reduce((a, d) => a + d.pct, 0) / ventasMargen.length).toFixed(1) : "—";

  // ── Chart data ───────────────────────────────────────────────
  const vmData    = ventasMargen.map(d => ({ ...d, año: String(d.año) }));
  const feeCvData = feeCv.map(d => ({ ...d, año: String(d.año) }));

  const dataEjec = MESES_CORTO.map((mes, i) => ({
    mes, proyectos: selectedYear ? (proyectosMes[selectedYear]?.[i] ?? 0) : 0,
  }));

  const dataFacMes = MESES_CORTO.map((mes, i) => ({
    mes, importe: selectedYear ? (facturasMes[selectedYear]?.[i] ?? 0) : 0,
  }));

  const dataSect = selectedYear && sectores[selectedYear]
    ? Object.entries(sectores[selectedYear])
        .map(([sector, importe]) => ({ sector, importe }))
        .filter(d => d.importe > 0)
        .sort((a, b) => b.importe - a.importe)
        .slice(0, 8)
    : [];

  const allClientesAño: TopCliente[] = selectedYear ? (allClientes[selectedYear] ?? []) : [];
  const topClientesChart = allClientesAño.slice(0, 15);
  const maxClienteAll = Math.max(...topClientesChart.map(c => c.facturacion), 1);

  // suppress unused warning for topProyectos (kept in props for future use)
  void topProyectos;

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

        {/* ── KPIs ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <KPI
            icon="💶"
            label={`Facturación ${selectedYear || currentYear}`}
            value={fmtEur(curVm?.ventas)}
            sub={deltaV !== "—"
              ? `${deltaSign(deltaV)} ${Math.abs(Number(deltaV))}% vs ${selectedYear - 1}`
              : "Primer año"}
            accent={deltaV !== "—" ? deltaColor(deltaV) : C.lime}
          />
          <KPI
            icon="📈"
            label={`Margen bruto ${selectedYear || currentYear}`}
            value={`${curVm?.pct ?? 0}%`}
            sub={deltaM !== "—"
              ? `${deltaSign(deltaM)} ${Math.abs(Number(deltaM))}pp vs ${selectedYear - 1}`
              : "Sin comparativa"}
            accent={deltaM !== "—" ? deltaColor(deltaM) : C.lime}
          />
          <KPI
            icon="🗂"
            label="Proyectos ejecutados"
            value={totalEjec}
            sub={deltaEjec !== "—"
              ? `${deltaSign(deltaEjec)} ${Math.abs(Number(deltaEjec))}% vs ${selectedYear - 1}`
              : selectedYear ? `datos ${selectedYear}` : ""}
            accent={deltaEjec !== "—" ? deltaColor(deltaEjec) : C.lime2}
          />
          <KPI
            icon="🏆"
            label={`Top cliente ${selectedYear || currentYear}`}
            value={topCliente ? topCliente.nombre.split(" ")[0] : "—"}
            sub={topCliente
              ? deltaTopC !== "—"
                ? `${fmtEur(topCliente.facturacion)} · ${deltaSign(deltaTopC)}${Math.abs(Number(deltaTopC))}% vs ${selectedYear - 1}`
                : `${fmtEur(topCliente.facturacion)} · ${topCliente.sector}`
              : "Sin datos"}
            accent={C.red}
          />
          <KPI
            icon="⭐"
            label={`Margen acumulado ${ventasMargen.length}a`}
            value={`~${avgMargen}%`}
            sub="Media histórica"
            accent={C.lime}
          />
        </div>

        {/* ── ROW 1: Facturación histórica + Facturación mensual ── */}
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
            {/* % sparklines */}
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

          {/* Facturación mensual (€) — reemplaza Top 5 Clientes */}
          <Card style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <STitle
                title="Facturación mensual"
                sub={`${selectedYear || "—"} · Importe facturado por mes`}
              />
              <span style={{
                background: `${C.lime}22`, color: C.lime, borderRadius: 20,
                padding: "2px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{fmtEur(dataFacMes.reduce((s, d) => s + d.importe, 0))}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dataFacMes} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="importe" name="Facturación" radius={[4, 4, 0, 0]}>
                  {dataFacMes.map((d, i) => (
                    <Cell key={i} fill={d.importe > 0 ? C.lime : `${C.muted}22`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── ROW 2: Proyectos mes + FEE CV ── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, marginBottom: 18 }}>

          {/* Proyectos ejecutados por mes (count) */}
          <Card style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <STitle
                title="Proyectos ejecutados por mes"
                sub={`${selectedYear || "—"} · Estado: En ejecución o Terminado y facturado`}
              />
              <span style={{
                background: `${C.lime}22`, color: C.lime, borderRadius: 20,
                padding: "2px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{totalEjec} total</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dataEjec} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip isEur={false} />} />
                <Bar dataKey="proyectos" name="Proyectos" radius={[4, 4, 0, 0]}>
                  {dataEjec.map((d, i) => (
                    <Cell key={i} fill={d.proyectos > 0 ? C.lime : `${C.muted}22`} />
                  ))}
                </Bar>
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

        {/* ── ROW 3: Sector + YTD vs año anterior ── */}
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

          {/* YTD facturación + margen vs año anterior — reemplaza Top 5 Proyectos */}
          <Card style={{ margin: 0 }}>
            <STitle
              title={`Facturación hasta ${MESES_NOMBRE[todayMonth - 1]}`}
              sub={`Por cliente · ${currentYear} vs ${currentYear - 1} · mismas fechas`}
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
                            <span style={{ fontSize: 10, color: deltaColor(delta), fontWeight: 700 }}>
                              {deltaSign(delta)}{Math.abs(Number(delta))}% vs {currentYear - 1}
                            </span>
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

        {/* ── ROW 4: Facturación año por cliente ── */}
        <Card>
          <STitle
            title="Facturación anual por cliente"
            sub={`${selectedYear || "—"} · Todos los clientes ordenados por importe`}
          />
          {topClientesChart.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin datos para {selectedYear}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topClientesChart.map((c, i) => (
                <div key={`${c.nombre}-${i}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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
                    <span style={{ color: C.lime, fontWeight: 800, fontSize: 13 }}>{fmtEur(c.facturacion)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: `${C.muted}22`, overflow: "hidden" }}>
                    <div style={{
                      width: `${(c.facturacion / maxClienteAll) * 100}%`, height: "100%",
                      background: i < 3
                        ? `linear-gradient(90deg, ${C.lime}, ${C.lime2})`
                        : `${C.lime}55`,
                      borderRadius: 2, transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              ))}
              {allClientesAño.length > 15 && (
                <p style={{ color: C.muted, fontSize: 11, textAlign: "center", margin: "6px 0 0" }}>
                  +{allClientesAño.length - 15} clientes más
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ── ROW 5: Proyectos margen < 25% ── */}
        <Card style={{ borderTop: `3px solid ${C.red}66` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <STitle
              title={`Proyectos margen bajo · ${currentYear}`}
              sub="Proyectos del año actual con margen inferior al 25%"
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
              ✓ Todos los proyectos del año superan el 25% de margen
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {margenBajo.proyectos.map((p, i) => (
                <div key={i} style={{
                  padding: "10px 14px",
                  background: `${C.red}0d`,
                  borderRadius: 10,
                  border: `1px solid ${C.red}33`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
