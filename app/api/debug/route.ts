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
  const server = process.env.FM_SERVER ?? "(no FM_SERVER)";
  const db = process.env.FM_DATABASE ?? "(no FM_DATABASE)";
  const user = process.env.FM_USER ?? "(no FM_USER)";
  const hasPass = !!process.env.FM_PASS;

  const token = `Basic ${Buffer.from(`${process.env.FM_USER}:${process.env.FM_PASS}`).toString("base64")}`;
  const url = `${server}/fmi/odata/v4/${encodeURIComponent(db)}/Graficas?$top=1`;

  let rawBody = "";
  let httpStatus = 0;
  let parseError = "";
  let parsedKeys: string[] = [];

  try {
    const res = await fmFetch(url, token);
    httpStatus = res.status;
    rawBody = res.body.slice(0, 2000); // first 2000 chars
    try {
      const fixed = res.body.replace(/-\.(\d)/g, "-0.$1");
      const parsed = JSON.parse(fixed);
      const record = parsed.value?.[0] ?? parsed;
      parsedKeys = Object.keys(record);
    } catch (e) {
      parseError = String(e);
    }
  } catch (e) {
    rawBody = `Fetch error: ${String(e)}`;
  }

  return NextResponse.json({
    env: { server, db, user, hasPass },
    url,
    httpStatus,
    parsedKeys,
    parseError,
    rawBody,
  });
}
