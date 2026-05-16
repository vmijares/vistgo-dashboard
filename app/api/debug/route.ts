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

async function peek(server: string, db: string, token: string, table: string, extra = "") {
  const encoded = encodeURIComponent(table);
  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/${encoded}?$top=2${extra}`;
  try {
    const res = await fmFetch(url, token);
    const fixed = res.body.replace(/-\.(\d)/g, "-0.$1");
    if (res.status !== 200) return { status: res.status, error: res.body.slice(0, 300) };
    const data = JSON.parse(fixed);
    const records = data.value ?? [data];
    return {
      status: res.status,
      count: records.length,
      keys: records[0] ? Object.keys(records[0]) : [],
      samples: records,
    };
  } catch (e) { return { error: String(e) }; }
}

export async function GET() {
  const server = process.env.FM_SERVER ?? "";
  const db = process.env.FM_DATABASE ?? "";
  const token = `Basic ${Buffer.from(`${process.env.FM_USER}:${process.env.FM_PASS}`).toString("base64")}`;

  const [sectores, clientesGraficos, clientes] = await Promise.all([
    peek(server, db, token, "ProyectosSectoresCliente"),
    peek(server, db, token, "ClientesGraficos"),
    peek(server, db, token, "Clientes", "&%24select=Nombre%2CSector%2CTipo"),
  ]);

  return NextResponse.json({ sectores, clientesGraficos, clientes });
}
