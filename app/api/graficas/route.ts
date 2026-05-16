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

const MOCK_RECORD = {
  "Año": "2022", "Año2": "2023", "Año3": "2024", "Año4": "2025", "Año5": "2026",
  "Ventas1": 1460000, "Ventas2": 2420000, "Ventas3": 2650000, "Ventas4": 1160000, "Ventas5": 380000,
  "Margen1": 681160, "Margen2": 1129320, "Margen3": 1309100, "Margen4": 565804, "Margen5": 197600,
  "PorSobre1": 46.66, "PorSobre2": 46.66, "PorSobre3": 49.4, "PorSobre4": 48.79, "PorSobre5": 52.0,
  "FEE1": 140000, "FEE2": 80000, "FEE3": 120000, "FEE4": 90000, "FEE5": 40000,
  "CV1": 1340000, "CV2": 2260000, "CV3": 2250000, "CV4": 980000, "CV5": 280000,
  "Enero": 10, "Febrero": 14, "Marzo": 22, "Abril": 16, "Mayo": 9, "Junio": 3,
  "Julio": 0, "Agosto": 0, "Septiembre": 0, "Octubre": 0, "Noviembre": 0, "Diciembre": 0,
  "Señalización Copia": 390000, "Retail moda Copia": 290000, "Arquitectura_Decoración Copia": 42000,
  "Retail cosmética Copia": 45000, "Publicidad exterior Copia": 15000, "Agencias Copia": 12000,
  "Retail alimentación Copia": 8000, "Seguros Copia": 5000, "Identidad corporativo Copia": 3000,
  "Administración pública Copia": 2000, "Banca Copia": 1000, "Transportes Copia": 500, "Otros Copia": 200,
};

export async function GET(req: NextRequest) {
  // PREVIEW MOCK: remove this block when FM server is configured
  if (!process.env.FM_USER && !process.env.FM_PASS) {
    return NextResponse.json(MOCK_RECORD);
  }

  const server = process.env.FM_SERVER!;
  const db = process.env.FM_DATABASE!;

  // Auth: prefer request header, fall back to env vars
  let token = req.headers.get("x-fm-auth") || "";
  if (!token) {
    const u = process.env.FM_USER;
    const p = process.env.FM_PASS;
    if (u && p) token = `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
  }
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/Graficas?$top=1`;

  try {
    const res = await fmFetch(url, token);
    if (res.status !== 200)
      return NextResponse.json({ error: `FM ${res.status}` }, { status: res.status });

    // Fix FM invalid JSON: decimals without leading zero e.g. -.39
    const fixed = res.body.replace(/-\.(\d)/g, "-0.$1");
    const data = JSON.parse(fixed);
    const record = data.value?.[0] ?? data;
    return NextResponse.json(record);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
