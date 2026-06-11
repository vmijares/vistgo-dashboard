export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import https from "node:https";

// keepAlive: false — FM no acumula conexiones abiertas entre invocaciones warm
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

// ── Server-side cache (15 min TTL) ───────────────────────────
let _cache: { data: unknown; at: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

function fmFetch(url: string, token: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { agent, headers: { Authorization: token, Accept: "application/json" } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          res.destroy(); // cierra el socket explícitamente tras leer
          resolve({ status: res.statusCode ?? 0, body });
        });
      }
    );
    req.on("error", (err) => { req.destroy(); reject(err); });
    req.end();
  });
}

function fix(s: string) {
  return s
    .replace(/-\.(\d)/g, "-0.$1")               // -.39  → -0.39
    .replace(/:\s*\?(\s*[,}\]])/g, ": null$1");  // : ?   → : null
}

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

  // Return cached response if still fresh
  if (_cache && Date.now() - _cache.at < CACHE_TTL) {
    return NextResponse.json(_cache.data);
  }

  const base = `${server}/fmi/odata/v4/${db}`;
  const currentYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth() + 1; // 1-12
  const minYear = currentYear - 4;

  try {
    // Parallel fetch of all source tables
    // $top=2000 fetches all records in one request instead of paginating 100/page sequentially
    const [facturas, presupuestos, proyectos, clientes, presupuestosMB] = await Promise.all([
      fetchAll(`${base}/Factura?$top=2000&$filter=Year ge ${minYear}`, token),
      // $select works here because year, FEEGraph, CVGraph have no spaces
      fetchAll(`${base}/Presupuesto?$top=2000&$filter=year ge ${minYear}&$select=year,FEEGraph,CVGraph`, token),
      // No $select — field names have spaces
      fetchAll(`${base}/ProyectosEjecutados?$top=2000&$filter=Year ge ${minYear}`, token),
      fetchAll(`${base}/ClientesGraficos?$top=500`, token),
      // All current-year presupuestos: used for both margenBajo and previsionAnual (Venta, En ejecución)
      fetchAll(`${base}/Presupuesto?$top=600&$filter=year eq ${currentYear}`, token),
    ]);

    // Build client lookup map: UUID → { sector, nombre }
    const clientMap = new Map<string, { sector: string; nombre: string }>();
    for (const c of clientes) {
      const id = c["ID"] as string;
      if (id) clientMap.set(id.trim(), {
        sector: ((c["Tipo cliente"] as string) || "Otros").trim(),
        nombre: ((c["Nombre comercial"] as string) || (c["Razón Social"] as string) || "—").trim(),
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

    // ── Proyectos por mes y año (count) ───────────────────────
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

    // ── Facturación por mes y año (€) ─────────────────────────
    const facMesMap = new Map<number, number[]>();
    const marMesMap = new Map<number, number[]>();
    for (const f of facturas) {
      const year = Number(f["Year"]);
      const month = Number(f["Month"]);
      if (!year || !month) continue;
      if (!facMesMap.has(year)) facMesMap.set(year, new Array(12).fill(0));
      if (!marMesMap.has(year)) marMesMap.set(year, new Array(12).fill(0));
      facMesMap.get(year)![month - 1] += Number(f["BaseListado"]) || 0;
      marMesMap.get(year)![month - 1] += Number(f["MargenListado"]) || 0;
    }
    const facturasMes: Record<number, number[]> = {};
    const margenMes:   Record<number, number[]> = {};
    facMesMap.forEach((arr, y) => { facturasMes[y] = arr.map(Math.round); });
    marMesMap.forEach((arr, y) => { margenMes[y]   = arr.map(Math.round); });

    // ── Sectores per year ─────────────────────────────────────
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

    // ── Todos los clientes + top 5 per year ───────────────────
    const topClientByYear = new Map<number, Map<string, number>>();
    for (const f of facturas) {
      const year = Number(f["Year"]);
      const id = ((f["ID Cliente"] as string) || "").trim();
      const amount = Number(f["BaseListado"]) || 0;
      if (!year || !id || amount === 0) continue;
      if (!topClientByYear.has(year)) topClientByYear.set(year, new Map());
      const ym = topClientByYear.get(year)!;
      ym.set(id, (ym.get(id) ?? 0) + amount);
    }

    type ClienteRow = { nombre: string; sector: string; facturacion: number };
    const allClientes: Record<number, ClienteRow[]> = {};
    const topClientes: Record<number, ClienteRow[]> = {};
    topClientByYear.forEach((cm, year) => {
      const sorted = Array.from(cm.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([id, total]) => ({
          nombre: clientMap.get(id)?.nombre ?? "—",
          sector: clientMap.get(id)?.sector ?? "—",
          facturacion: Math.round(total),
        }));
      allClientes[year] = sorted;
      topClientes[year] = sorted.slice(0, 5);
    });

    // ── YTD facturación + margen por cliente vs año anterior ──
    const ytdMap = new Map<string, { actual: number; margenAct: number; anterior: number; margenAnt: number }>();
    for (const f of facturas) {
      const year = Number(f["Year"]);
      const month = Number(f["Month"]);
      const id = ((f["ID Cliente"] as string) || "").trim();
      const base = Number(f["BaseListado"]) || 0;
      const marg = Number(f["MargenListado"]) || 0;
      if (!id || month > todayMonth) continue;
      if (year === currentYear) {
        const cur = ytdMap.get(id) ?? { actual: 0, margenAct: 0, anterior: 0, margenAnt: 0 };
        cur.actual += base; cur.margenAct += marg;
        ytdMap.set(id, cur);
      } else if (year === currentYear - 1) {
        const cur = ytdMap.get(id) ?? { actual: 0, margenAct: 0, anterior: 0, margenAnt: 0 };
        cur.anterior += base; cur.margenAnt += marg;
        ytdMap.set(id, cur);
      }
    }
    const ytdClientes = Array.from(ytdMap.entries())
      .filter(([, d]) => d.actual > 0 || d.anterior > 0)
      .sort(([, a], [, b]) => b.actual - a.actual)
      .slice(0, 10)
      .map(([id, d]) => ({
        nombre: clientMap.get(id)?.nombre ?? "—",
        sector: clientMap.get(id)?.sector ?? "—",
        ytdActual: Math.round(d.actual),
        margenActual: Math.round(d.margenAct),
        ytdAnterior: Math.round(d.anterior),
        margenAnterior: Math.round(d.margenAnt),
      }));

    // ── YTD totales (ventas + margen) — para KPIs comparativa ─
    const ytdTotalsRaw = {
      current: { ventas: 0, margen: 0 },
      prev:    { ventas: 0, margen: 0 },
    };
    for (const f of facturas) {
      const year  = Number(f["Year"]);
      const month = Number(f["Month"]);
      if (!month || month > todayMonth) continue;
      const base = Number(f["BaseListado"])  || 0;
      const marg = Number(f["MargenListado"]) || 0;
      if (year === currentYear)         { ytdTotalsRaw.current.ventas += base; ytdTotalsRaw.current.margen += marg; }
      else if (year === currentYear - 1){ ytdTotalsRaw.prev.ventas    += base; ytdTotalsRaw.prev.margen    += marg; }
    }
    const ytdTotals = {
      current: {
        ventas: Math.round(ytdTotalsRaw.current.ventas),
        margen: Math.round(ytdTotalsRaw.current.margen),
        pct:    ytdTotalsRaw.current.ventas > 0
          ? Number(((ytdTotalsRaw.current.margen / ytdTotalsRaw.current.ventas) * 100).toFixed(2)) : 0,
      },
      prev: {
        ventas: Math.round(ytdTotalsRaw.prev.ventas),
        margen: Math.round(ytdTotalsRaw.prev.margen),
        pct:    ytdTotalsRaw.prev.ventas > 0
          ? Number(((ytdTotalsRaw.prev.margen / ytdTotalsRaw.prev.ventas) * 100).toFixed(2)) : 0,
      },
    };

    // ── Top proyectos per year ────────────────────────────────
    const topProyByYear = new Map<number, { nombre: string; cliente: string; importe: number; estado: string }[]>();
    for (const p of proyectos) {
      const year = Number(p["Year"]);
      if (!year) continue;
      const importe = Number(p["TFactura"]) || 0;
      const clienteId = ((p["ID Cliente"] as string) || "").trim();
      topProyByYear.set(year, [
        ...(topProyByYear.get(year) ?? []),
        {
          nombre: ((p["Nombre proyecto"] as string) || "—").trim(),
          cliente: clientMap.get(clienteId)?.nombre ?? "—",
          importe: Math.round(importe),
          estado: ((p["Estado"] as string) || "—").trim(),
        },
      ]);
    }
    const topProyectos: Record<number, { nombre: string; cliente: string; importe: number; estado: string }[]> = {};
    topProyByYear.forEach((list, year) => {
      topProyectos[year] = list
        .filter(p => p.importe > 0)
        .sort((a, b) => b.importe - a.importe)
        .slice(0, 5);
    });

    // ── Previsión (suma Venta de presupuestos En ejecución, año actual) ──
    // Past years: keep using ProyectosEjecutados TFactura for historical data
    const previsionMap = new Map<number, number>();
    for (const p of proyectos) {
      const year = Number(p["Year"]);
      if (!year || year === currentYear) continue;
      const estado = ((p["Estado"] as string) || "").trim();
      if (estado === "En ejecución") {
        previsionMap.set(year, (previsionMap.get(year) ?? 0) + (Number(p["TFactura"]) || 0));
      }
    }
    // Current year: use Presupuesto.Venta (more accurate than ProyectosEjecutados.TFactura)
    let previsionCurrentYear = 0;
    for (const p of presupuestosMB) {
      if (((p["Estado"] as string) || "").trim() === "En ejecución") {
        previsionCurrentYear += Number(p["Venta"]) || 0;
      }
    }
    previsionMap.set(currentYear, Math.round(previsionCurrentYear));
    const previsionAnual: Record<number, number> = {};
    previsionMap.forEach((v, y) => { previsionAnual[y] = Math.round(v); });

    // ── Presupuestos margen bajo < 25% (año actual, terminados y facturados, sin Área=WEB) ─
    const margenBajoList = presupuestosMB
      .filter(p => {
        const porSobre = Number(p["Por sobre venta"]);
        return (
          p["Estado"] === "Terminado y facturado" &&
          ((p["Área"] as string) || "").trim().toUpperCase() !== "WEB" &&
          porSobre > 0 &&
          porSobre < 25 &&
          Number(p["Venta"]) > 0
        );
      })
      .map(p => ({
        nPresupuesto: ((p["N Presupuesto"] as string) || "—").trim(),
        alias:        ((p["Alias"] as string) || "—").trim(),
        fechaFin:     ((p["Fecha término"] as string) || "—"),
        cliente:      clientMap.get(((p["ID Cliente"] as string) || "").trim())?.nombre ?? "—",
        venta:        Math.round(Number(p["Venta"]) || 0),
        margen:       Number(Number(p["Por sobre venta"]).toFixed(1)),
      }))
      .sort((a, b) => b.venta - a.venta);

    const margenBajo = {
      count: margenBajoList.length,
      total: Math.round(margenBajoList.reduce((s, p) => s + p.venta, 0)),
      proyectos: margenBajoList,
    };

    // ── Años disponibles ──────────────────────────────────────
    const añosSet: number[] = [];
    vmMap.forEach((_, y) => { if (!añosSet.includes(y)) añosSet.push(y); });
    const años = añosSet.sort((a, b) => a - b);

    const result = {
      ventasMargen, feeCv, proyectosMes, facturasMes, margenMes,
      sectores, topClientes, allClientes, ytdClientes, ytdTotals,
      topProyectos, margenBajo, previsionAnual, años, currentYear, todayMonth,
    };

    _cache = { data: result, at: Date.now() };
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
