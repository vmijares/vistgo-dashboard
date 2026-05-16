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

async function q(server: string, db: string, token: string, path: string) {
  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/${path}`;
  try {
    const res = await fmFetch(url, token);
    const fixed = res.body.replace(/-\.(\d)/g, "-0.$1");
    if (res.status !== 200) return { status: res.status, error: res.body.slice(0, 300) };
    return { status: res.status, data: JSON.parse(fixed) };
  } catch (e) { return { error: String(e) }; }
}

export async function GET() {
  const server = process.env.FM_SERVER ?? "";
  const db = process.env.FM_DATABASE ?? "";
  const token = `Basic ${Buffer.from(`${process.env.FM_USER}:${process.env.FM_PASS}`).toString("base64")}`;

  const [applyTest, serviceDoc, clientePeek] = await Promise.all([
    // Test $apply aggregation
    q(server, db, token, "Factura?%24apply=groupby((Year),aggregate(BaseListado%20with%20sum%20as%20Ventas,MargenListado%20with%20sum%20as%20Margen))&%24orderby=Year%20asc"),
    // OData service doc — lists all tables
    q(server, db, token, ""),
    // Peek at Cliente table for sector field
    q(server, db, token, "Cliente?%24top=1"),
  ]);

  return NextResponse.json({ applyTest, serviceDoc, clientePeek });
}
