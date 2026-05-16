export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
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

export async function GET() {
  const server = process.env.FM_SERVER ?? "";
  const db = process.env.FM_DATABASE ?? "";
  const user = process.env.FM_USER ?? "";
  const pass = process.env.FM_PASS ?? "";

  const token = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/Graficas?$top=1`;

  try {
    const res = await fmFetch(url, token);
    if (res.status !== 200) {
      return NextResponse.json({ error: `FM HTTP ${res.status}`, rawBody: res.body.slice(0, 500) });
    }

    const fixed = res.body.replace(/-\.(\d)/g, "-0.$1");
    const parsed = JSON.parse(fixed);
    const record = parsed.value?.[0] ?? parsed;

    const keyFields = ["Año","Año2","Año3","Año4","Año5","Ventas1","Ventas2","Ventas3","Ventas4","Ventas5","Margen1","Margen2","Margen3","Margen4","Margen5","PorSobre1","PorSobre2","FEE1","FEE2","CV1","CV2","Enero","Febrero","Marzo","Señalización Copia","Retail moda Copia"];
    const values: Record<string, unknown> = {};
    for (const k of keyFields) values[k] = record[k];

    return NextResponse.json({ httpStatus: res.status, url, values, allKeys: Object.keys(record) });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
