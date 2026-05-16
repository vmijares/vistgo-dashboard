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

export async function GET(req: NextRequest) {
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
