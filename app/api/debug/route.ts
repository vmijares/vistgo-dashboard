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

async function peekTable(server: string, db: string, token: string, table: string) {
  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/${encodeURIComponent(table)}?$top=1`;
  try {
    const res = await fmFetch(url, token);
    if (res.status !== 200) return { error: `HTTP ${res.status}`, body: res.body.slice(0, 300) };
    const fixed = res.body.replace(/-\.(\d)/g, "-0.$1");
    const parsed = JSON.parse(fixed);
    const record = parsed.value?.[0] ?? parsed;
    return { keys: Object.keys(record), sample: record };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET() {
  const server = process.env.FM_SERVER ?? "";
  const db = process.env.FM_DATABASE ?? "";
  const user = process.env.FM_USER ?? "";
  const pass = process.env.FM_PASS ?? "";
  const token = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

  const [factura, presupuesto, proyEjec] = await Promise.all([
    peekTable(server, db, token, "Factura"),
    peekTable(server, db, token, "Presupuesto"),
    peekTable(server, db, token, "ProyectosEjecutados"),
  ]);

  return NextResponse.json({ factura, presupuesto, proyEjec });
}
