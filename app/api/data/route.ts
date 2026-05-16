export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import https from "node:https";

const agent = new https.Agent({ rejectUnauthorized: false });

function fmFetch(url: string, token: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { agent, headers: { Authorization: token, Accept: "application/json" } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function fix(s: string) { return s.replace(/-\.(\d)/g, "-0.$1"); }

async function fetchAll(baseUrl: string, token: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let nextUrl: string | null = baseUrl;
  while (nextUrl) {
    const res = await fmFetch(nextUrl, token);
    if (res.status !== 200) throw new Error(`FM HTTP ${res.status}: ${res.body.slice(0, 300)}`);
    const data = JSON.parse(fix(res.body));
    results.push(...(data.value ?? []));
    nextUrl = (data["@odata.nextLink"] as string) || null;
  }
  return results;
}

export async function GET(req: NextRequest) {
  const server = process.env.FM_SERVER!;
  const db = encodeURIComponent(process.env.FM_DATABASE!);

  let token = req.headers.get("x-fm-auth") || "";
  if (!token) {
    const u = process.env.FM_USER, p = process.env.FM_PASS;
    if (u && p) token = `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
  }
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const base = `${server}/fmi/odata/v4/${db}`;
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 4;

  try {
    // Parallel fetch of all source tables
    const [facturas, presupuestos, proyectos, clientes] = await Promise.all([
      fetchAll(`${base}/Factura?$filter=Year ge ${minYear}`, token),
      // Note: $select works here because year, FEEGraph, CVGraph have no spaces
      fetchAll(`${base}/Presupuesto?$filter=year ge ${minYear}&$select=year,FEEGraph,CVGraph`, token),
      // $select works here too - all month field names have no spaces
      fetchAll(`${base}/ProyectosEjecutados?$filter=Year ge ${minYear}&$select=Year,Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre`, token),
      // Can't $select here - "Tipo cliente", "Razón Social" have spaces
      fetchAll(`${base}/ClientesGraficos`, token),
    ]);

    // Build client lookup map: UUID → { sector, nombre }
    const clientMap = new Map<string, { sector: string; nombre: string }>();
    for (const c of clientes) {
      const id = c["ID"] as string;
      if (id) clientMap.set(id.trim(), {
        sector: ((c["Tipo cliente"] as string) || "Otros").trim(),
        nombre: ((c["Razón Social"] as string) || (c["Nombre comercial"] as string) || "—").trim(),
      });
    }

    // ── Ventas / Margen per year ──────────────────────────────
    const vmMap = new Map<number, { ventas: number; margen: number }>();
    for (const f of facturas) {
      const year = Number(f["Year"]);
      if (!year) continue;
      const cur = vmMap.get(year) ?? { ventas: 0, margen: 0 };
      cur.ventas += Number(f["BaseListado"]) || 0;
      cur.margen += Number(f["MargenListado"]) || 0;
      vmMap.set(year, cur);
    }
    const ventasMargen = Array.from(vmMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([año, d]) => ({
        año,
        ventas: Math.round(d.ventas),
        margen: Math.round(d.margen),
        pct: d.ventas > 0 ? Number(((d.margen / d.ventas) * 100).toFixed(2)) : 0,
      }));

    // ── FEE / CV per year ─────────────────────────────────────
    const feeCvMap = new Map<number, { fee: number; cv: number }>();
    for (const p of presupuestos) {
      const year = Number(p["year"]);
      if (!year) continue;
      const cur = feeCvMap.get(year) ?? { fee: 0, cv: 0 };
      cur.fee += Number(p["FEEGraph"]) || 0;
      cur.cv += Number(p["CVGraph"]) || 0;
      feeCvMap.set(year, cur);
    }
    const feeCv = Array.from(feeCvMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([año, d]) => ({ año, fee: Math.round(d.fee), cv: Math.round(d.cv) }));

    // ── Proyectos por mes y año ───────────────────────────────
    const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"] as const;
    const mesMap = new Map<number, number[]>();
    for (const p of proyectos) {
      const year = Number(p["Year"]);
      if (!year) continue;
      if (!mesMap.has(year)) mesMap.set(year, new Array(12).fill(0));
      const cur = mesMap.get(year)!;
      MESES.forEach((m, i) => { cur[i] += Number(p[m]) || 0; });
    }
    const proyectosMes: Record<number, number[]> = {};
    mesMap.forEach((arr, y) => { proyectosMes[y] = arr; });

    // ── Sectores per year (Factura + clientMap) ───────────────
    const sectorMapYear = new Map<number, Map<string, number>>();
    for (const f of facturas) {
      const year = Number(f["Year"]);
      const clienteId = ((f["ID Cliente"] as string) || "").trim();
      const amount = Number(f["BaseListado"]) || 0;
      if (!year || !clienteId || amount === 0) continue;
      const sector = clientMap.get(clienteId)?.sector ?? "Otros";
      if (!sectorMapYear.has(year)) sectorMapYear.set(year, new Map());
      const ym = sectorMapYear.get(year)!;
      ym.set(sector, (ym.get(sector) ?? 0) + amount);
    }
    const sectores: Record<number, Record<string, number>> = {};
    sectorMapYear.forEach((sm, y) => {
      sectores[y] = {};
      sm.forEach((a, s) => { sectores[y][s] = Math.round(a); });
    });

    // ── Top clientes (current year) ───────────────────────────
    const topClientMap = new Map<string, number>();
    for (const f of facturas) {
      if (Number(f["Year"]) !== currentYear) continue;
      const id = ((f["ID Cliente"] as string) || "").trim();
      if (!id) continue;
      topClientMap.set(id, (topClientMap.get(id) ?? 0) + (Number(f["BaseListado"]) || 0));
    }
    const topClientes = Array.from(topClientMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, total]) => ({
        nombre: clientMap.get(id)?.nombre ?? "—",
        sector: clientMap.get(id)?.sector ?? "—",
        facturacion: Math.round(total),
      }));

    const añosSet: number[] = [];
    vmMap.forEach((_, y) => { if (!añosSet.includes(y)) añosSet.push(y); });
    const años = añosSet.sort((a, b) => a - b);

    return NextResponse.json({ ventasMargen, feeCv, proyectosMes, sectores, topClientes, años, currentYear });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
