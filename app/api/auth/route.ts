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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = body.user || process.env.FM_USER || "";
  const pass = body.pass || process.env.FM_PASS || "";
  if (!user || !pass)
    return NextResponse.json({ ok: false, error: "Credenciales vacías" }, { status: 400 });

  const server = process.env.FM_SERVER!;
  const db = process.env.FM_DATABASE!;
  const token = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/Graficas?$top=1`;

  try {
    const res = await fmFetch(url, token);
    if (res.status === 200) return NextResponse.json({ ok: true });
    return NextResponse.json(
      { ok: false, error: `FM devolvió ${res.status}` },
      { status: 401 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
