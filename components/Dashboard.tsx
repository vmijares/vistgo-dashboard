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
  muted:  "#6b6f9a",
  white:  "#f0f1ff",
  red:    "#e05a5a",
  green:  "#4ade80",
};

// ── Props interface ───────────────────────────────────────────
interface TopCliente { nombre: string; sector: string; facturacion: number }
interface TopProyecto { nombre: string; cliente: string; importe: number; estado: string }

interface DashboardProps {
  ventasMargen: { año: number; ventas: number; margen: number; pct: number }[];
  feeCv: { año: number; fee: number; cv: number }[];
  proyectosMes: Record<number, number[]>;
  sectores: Record<number, Record<string, number>>;
  topClientes: Record<number, TopCliente[]>;
  topProyectos: Record<number, TopProyecto[]>;
  años: number[];
  currentYear: number;
  onLogout: () => void;
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


const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (v: number | string | undefined) => {
  const n = Number(v);
  if (!n) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${Math.round(n / 1000)}K`;
  return String(n);
};
const fmtEur = (v: number | string | undefined) => `${fmt(v)}€`;

// ── Tooltip ───────────────────────────────────────────────────
interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
}
const CustomTooltip = ({
  active, payload, label, isEur = true,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  isEur?: boolean;
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
    <div style={{ position: "absolute", top: 10, right: 14, fontSize: 20, opacity: 0.15 }}>
      {icon}
    </div>
    <p style={{
      color: C.muted, fontSize: 10, textTransform: "uppercase",
      letterSpacing: 1.2, margin: 0, fontWeight: 600,
    }}>{label}</p>
    <p style={{ color: C.white, fontSize: 26, fontWeight: 800, margin: "6px 0 2px", lineHeight: 1 }}>
      {value}
    </p>
    {sub && (
      <p style={{ color: accent || C.lime, fontSize: 11, margin: 0, fontWeight: 500 }}>{sub}</p>
    )}
  </div>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: C.navyM, borderRadius: 16, padding: "22px 24px", marginBottom: 18, ...style }}>
    {children}
  </div>
);

const STitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div style={{ marginBottom: 18 }}>
    <h2 style={{
      color: C.white, fontSize: 13, fontWeight: 700,
      margin: 0, textTransform: "uppercase", letterSpacing: 0.8,
    }}>{title}</h2>
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

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{
    background: `${color}22`, color, borderRadius: 20,
    padding: "2px 10px", fontSize: 10, fontWeight: 700,
  }}>{text}</span>
);

// ── MAIN ──────────────────────────────────────────────────────
export default function Dashboard({
  ventasMargen,
  feeCv,
  proyectosMes,
  sectores,
  topClientes,
  topProyectos,
  años,
  currentYear,
  onLogout,
}: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState<number>(0);

  useEffect(() => {
    if (años.length > 0) setSelectedYear(años[años.length - 1]);
  }, [años]);

  const last = ventasMargen[ventasMargen.length - 1];
  const prev = ventasMargen[ventasMargen.length - 2];

  const deltaV =
    prev && prev.ventas > 0
      ? (((last.ventas - prev.ventas) / prev.ventas) * 100).toFixed(1)
      : "—";

  const totalEjec = selectedYear ? (proyectosMes[selectedYear] ?? []).reduce((a, b) => a + b, 0) : 0;

  const vmData = ventasMargen.map(d => ({ ...d, año: String(d.año) }));
  const feeCvData = feeCv.map(d => ({ ...d, año: String(d.año) }));

  const dataEjec = MESES_CORTO.map((mes, i) => ({
    mes, proyectos: selectedYear ? (proyectosMes[selectedYear]?.[i] ?? 0) : 0,
  }));

  const dataSect = selectedYear && sectores[selectedYear]
    ? Object.entries(sectores[selectedYear])
        .map(([sector, importe]) => ({ sector, importe }))
        .filter(d => d.importe > 0)
        .sort((a, b) => b.importe - a.importe)
        .slice(0, 8)
    : [];

  const clientesAño: TopCliente[] = selectedYear ? (topClientes[selectedYear] ?? []) : [];
  const proyectosAño: TopProyecto[] = selectedYear ? (topProyectos[selectedYear] ?? []) : [];
  const maxCliente = Math.max(...clientesAño.map(c => c.facturacion), 1);

  const avgMargen =
    ventasMargen.length > 0
      ? (ventasMargen.reduce((a, d) => a + d.pct, 0) / ventasMargen.length).toFixed(1)
      : "—";

  const topCliente = clientesAño[0];

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
          {/* Global year selector */}
          {años.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Año</span>
              <YearPill value={selectedYear} options={años} onChange={setSelectedYear} />
            </div>
          )}
          <div style={{ width: 1, height: 20, background: `${C.muted}33` }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: C.lime, boxShadow: `0 0 6px ${C.lime}`,
            }} />
            <span style={{ color: C.muted, fontSize: 11 }}>
              Live · {new Date().toLocaleDateString("es-ES")}
            </span>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: "transparent", border: `1px solid ${C.muted}44`,
              borderRadius: 8, padding: "5px 12px", color: C.muted,
              fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Salir
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ── KPIs ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <KPI
            icon="💶"
            label={`Facturación ${last?.año ?? currentYear}`}
            value={fmtEur(last?.ventas)}
            sub={deltaV !== "—" ? `${deltaV}% vs ${prev?.año}` : "Primer año"}
            accent={deltaV !== "—" && Number(deltaV) >= 0 ? C.lime : C.red}
          />
          <KPI
            icon="📈"
            label={`Margen bruto ${last?.año ?? currentYear}`}
            value={`${last?.pct ?? 0}%`}
            sub="Margen año actual"
            accent={C.lime}
          />
          <KPI
            icon="🗂"
            label="Proyectos ejecutados"
            value={totalEjec}
            sub={selectedYear ? `datos ${selectedYear}` : "datos del último cierre"}
            accent={C.lime2}
          />
          <KPI
            icon="🏆"
            label={`Top cliente ${selectedYear || currentYear}`}
            value={topCliente ? topCliente.nombre.split(" ")[0] : "—"}
            sub={topCliente ? `${fmtEur(topCliente.facturacion)} · ${topCliente.sector}` : "Sin datos"}
            accent={C.purple}
          />
          <KPI
            icon="⭐"
            label={`Margen acumulado ${ventasMargen.length}a`}
            value={`~${avgMargen}%`}
            sub="Media histórica"
            accent={C.lime}
          />
        </div>

        {/* ── ROW 1: Facturación + Top Clientes ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>

          {/* Facturación y margen */}
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
                <Bar dataKey="ventas" name="Ventas" fill={C.lime} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="margen" name="Margen" fill={C.red} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
            {/* % sparklines */}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {vmData.map(d => (
                <div key={d.año} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, minWidth: 36 }}>{d.año}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: `${C.muted}22`, overflow: "hidden" }}>
                    <div style={{
                      width: `${d.pct}%`, height: "100%", background: C.lime,
                      borderRadius: 2, transition: "width 0.6s ease",
                    }} />
                  </div>
                  <span style={{ color: C.lime, fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: "right" }}>
                    {d.pct}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Clientes — real FM data */}
          <Card style={{ margin: 0 }}>
            <STitle title="Top 5 Clientes" sub={`Facturación ${selectedYear || currentYear} · FileMaker`} />
            {clientesAño.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
                Sin datos de clientes para {selectedYear || currentYear}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {clientesAño.map((c, i) => (
                  <div key={`${c.nombre}-${i}`}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 4,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: i === 0 ? C.lime : `${C.lime}33`,
                          color: i === 0 ? C.navy : C.lime,
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
                    <div style={{ height: 3, borderRadius: 2, background: `${C.muted}22`, overflow: "hidden" }}>
                      <div style={{
                        width: `${(c.facturacion / maxCliente) * 100}%`, height: "100%",
                        background: `linear-gradient(90deg, ${C.lime}, ${C.lime2})`,
                        borderRadius: 2, transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── ROW 2: Proyectos mes + FEE CV ── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, marginBottom: 18 }}>

          {/* Proyectos ejecutados por mes */}
          <Card style={{ margin: 0 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 16,
            }}>
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

          {/* FEE y CV */}
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
                <Bar dataKey="cv" name="CV" fill={C.red} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── ROW 3: Facturación sector + Top Proyectos ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

          {/* Facturación por sector */}
          <Card style={{ margin: 0 }}>
            <div style={{ marginBottom: 16 }}>
              <STitle title="Facturación por sector" sub={`${selectedYear || "—"} · Importe según cliente`} />
            </div>
            {dataSect.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
                Sin datos de sector disponibles
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, dataSect.length * 28)}>
                <BarChart data={dataSect} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${C.muted}22`} horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="sector" tick={{ fill: C.muted, fontSize: 10 }}
                    axisLine={false} tickLine={false} width={90} />
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

          {/* Top Proyectos — real FM data */}
          <Card style={{ margin: 0 }}>
            <STitle title="Top 5 Proyectos" sub={`Por importe facturado · ${selectedYear || currentYear}`} />
            {proyectosAño.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
                Sin proyectos con importe para {selectedYear || currentYear}
              </p>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {proyectosAño.map((p, i) => (
                <div key={p.nombre} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 14px",
                  background: i === 0 ? `${C.lime}11` : `${C.muted}11`,
                  borderRadius: 10,
                  border: i === 0 ? `1px solid ${C.lime}33` : `1px solid ${C.muted}22`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: i === 0 ? C.lime : `${C.muted}33`,
                      color: i === 0 ? C.navy : C.muted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}>{i + 1}</span>
                    <div>
                      <p style={{
                        margin: 0, fontSize: 12, fontWeight: 700, color: C.white,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: 160,
                      }}>{p.nombre}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{p.cliente}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, color: C.lime, fontWeight: 800, fontSize: 13 }}>
                      {fmtEur(p.importe)}
                    </p>
                    <Badge
                      text={p.estado}
                      color={p.estado === "Terminado y facturado" || p.estado === "Terminado" ? C.lime : C.purple}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8,
        }}>
          <VistgoLogo size={16} />
          <span style={{ color: `${C.muted}66`, fontSize: 10 }}>
            Panel interno · Datos FileMaker OData en tiempo real · {new Date().toLocaleString("es-ES")}
          </span>
        </div>
      </div>
    </div>
  );
}
