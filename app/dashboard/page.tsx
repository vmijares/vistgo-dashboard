"use client";
import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";

const C = { navyD: "#13152e", lime: "#b8c94a", muted: "#6b6f9a", white: "#f0f1ff" };

type GraficasRecord = Record<string, number | string | null>;

function mapGraficasToProps(r: GraficasRecord) {
  const n = (v: unknown) => Number(v) || 0;

  const years = [r["Año"], r["Año2"], r["Año3"], r["Año4"], r["Año5"]].map(String);
  const facturacionMargen = years
    .map((año, i) => {
      const idx = i + 1;
      const ventas = n(r[`Ventas${idx}`]);
      const margen = n(r[`Margen${idx}`]);
      const pct =
        ventas > 0
          ? Number(((margen / ventas) * 100).toFixed(2))
          : n(r[`PorSobre${idx}`]);
      return { año, ventas, margen, pct };
    })
    .filter(d => d.año && d.año !== "0");

  const feeCvData = years
    .map((año, i) => {
      const idx = i + 1;
      return { año, fee: n(r[`FEE${idx}`]), cv: n(r[`CV${idx}`]) };
    })
    .filter(d => d.año && d.año !== "0");

  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const monthlyProjects = MESES.map(m => n(r[m]));

  const sectorFields: [string, string][] = [
    ["Señalización", "Señalización Copia"],
    ["Retail moda", "Retail moda Copia"],
    ["Arq./Deco.", "Arquitectura_Decoración Copia"],
    ["Retail cosm.", "Retail cosmética Copia"],
    ["Pub. exterior", "Publicidad exterior Copia"],
    ["Agencias", "Agencias Copia"],
    ["Retail alim.", "Retail alimentación Copia"],
    ["Seguros", "Seguros Copia"],
    ["Id. corporativa", "Identidad corporativo Copia"],
    ["Adm. pública", "Administración pública Copia"],
    ["Banca", "Banca Copia"],
    ["Transportes", "Transportes Copia"],
    ["Otros", "Otros Copia"],
  ];
  const sectorData = sectorFields
    .map(([sector, field]) => ({ sector, importe: n(r[field]) }))
    .filter(d => d.importe > 0)
    .sort((a, b) => b.importe - a.importe);

  return { facturacionMargen, feeCvData, monthlyProjects, sectorData };
}

export default function DashboardPage() {
  const [data, setData] = useState<GraficasRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("fm_auth");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token !== "__env__") headers["x-fm-auth"] = token;

    fetch("/api/graficas", { headers })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div style={{
      minHeight: "100vh", background: C.navyD, display: "flex",
      alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 16,
      fontFamily: "'DM Sans',sans-serif",
    }}>
      <p style={{ color: "#e05a5a", fontSize: 14 }}>Error: {error}</p>
      <button
        onClick={() => { sessionStorage.removeItem("fm_auth"); window.location.href = "/login"; }}
        style={{
          background: C.lime, color: C.navyD, border: "none",
          borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 700,
        }}
      >
        Volver al login
      </button>
    </div>
  );

  if (!data) return (
    <div style={{
      minHeight: "100vh", background: C.navyD, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans',sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40,
          border: `3px solid ${C.lime}33`,
          borderTop: `3px solid ${C.lime}`,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 16px",
        }} />
        <p style={{ color: C.muted, fontSize: 12 }}>Cargando datos…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  const props = mapGraficasToProps(data);
  return (
    <Dashboard
      {...props}
      onLogout={() => {
        sessionStorage.removeItem("fm_auth");
        window.location.href = "/login";
      }}
    />
  );
}
