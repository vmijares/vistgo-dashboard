"use client";
import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";

type TopCliente  = { nombre: string; sector: string; facturacion: number };
type TopProyecto = { nombre: string; cliente: string; importe: number; estado: string };
type YtdCliente  = {
  nombre: string; sector: string;
  ytdActual: number; margenActual: number;
  ytdAnterior: number; margenAnterior: number;
};
type MargenBajo  = {
  count: number; total: number;
  proyectos: { nPresupuesto: string; alias: string; fechaFin: string; cliente: string; venta: number; margen: number }[];
};

type YtdTotals = {
  current: { ventas: number; margen: number; pct: number };
  prev:    { ventas: number; margen: number; pct: number };
};

type AppData = {
  ventasMargen: { año: number; ventas: number; margen: number; pct: number }[];
  feeCv:        { año: number; fee: number; cv: number }[];
  proyectosMes: Record<number, number[]>;
  facturasMes:  Record<number, number[]>;
  margenMes:    Record<number, number[]>;
  sectores:     Record<number, Record<string, number>>;
  topClientes:  Record<number, TopCliente[]>;
  allClientes:  Record<number, TopCliente[]>;
  ytdClientes:  YtdCliente[];
  ytdTotals:    YtdTotals;
  topProyectos: Record<number, TopProyecto[]>;
  margenBajoByYear: Record<number, MargenBajo>;
  previsionAnual: Record<number, number>;
  años:         number[];
  currentYear:  number;
  todayMonth:   number;
};

const C = { navyD: "#13152e", lime: "#b8c94a", muted: "#6b6f9a" };

export default function DashboardPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("fm_auth");
    if (!token) { window.location.href = "/login"; return; }

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token !== "__env__") headers["x-fm-auth"] = token;

    fetch("/api/data", { headers })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div style={{ minHeight:"100vh", background:C.navyD, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, fontFamily:"'DM Sans',sans-serif" }}>
      <p style={{ color: "#e05a5a", fontSize: 14, maxWidth: 400, textAlign: "center" }}>Error: {error}</p>
      <button onClick={() => { sessionStorage.removeItem("fm_auth"); window.location.href = "/login"; }}
        style={{ background:C.lime, color:C.navyD, border:"none", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
        Volver al login
      </button>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight:"100vh", background:C.navyD, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:`3px solid ${C.lime}33`, borderTop:`3px solid ${C.lime}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ color:C.muted, fontSize:12 }}>Cargando datos en tiempo real…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <Dashboard
      ventasMargen={data.ventasMargen}
      feeCv={data.feeCv}
      proyectosMes={data.proyectosMes}
      facturasMes={data.facturasMes}
      margenMes={data.margenMes}
      sectores={data.sectores}
      topClientes={data.topClientes}
      allClientes={data.allClientes}
      ytdClientes={data.ytdClientes}
      ytdTotals={data.ytdTotals}
      topProyectos={data.topProyectos}
      margenBajoByYear={data.margenBajoByYear}
      previsionAnual={data.previsionAnual}
      años={data.años}
      currentYear={data.currentYear}
      todayMonth={data.todayMonth}
      onLogout={() => { sessionStorage.removeItem("fm_auth"); window.location.href = "/login"; }}
    />
  );
}
