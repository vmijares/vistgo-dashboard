"use client";
import { useState } from "react";

const C = {
  navy: "#1e2147", navyD: "#13152e", navyM: "#252849",
  lime: "#b8c94a", muted: "#6b6f9a", white: "#f0f1ff", red: "#e05a5a",
};

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      const data = await res.json();
      if (data.ok) {
        const token = `Basic ${btoa(`${user}:${pass}`)}`;
        sessionStorage.setItem("fm_auth", token);
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Credenciales incorrectas");
        setIsPending(false);
      }
    } catch {
      setError("Error de conexión");
      setIsPending(false);
    }
  }

  async function handleEnvLogin() {
    setIsPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("fm_auth", "__env__");
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Error con credenciales de entorno");
        setIsPending(false);
      }
    } catch {
      setError("Error de conexión");
      setIsPending(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${C.muted}44`,
    background: C.navyD,
    color: C.white,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.navyD, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
    }}>
      <div style={{
        background: C.navyM, borderRadius: 20, padding: "40px 36px",
        width: "100%", maxWidth: 400, boxShadow: "0 24px 64px #00000066",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <svg width="140" height="42" viewBox="0 0 120 42" fill="none">
            <circle cx="100" cy="21" r="19" fill={C.navy} />
            <polygon points="108,21 98,13 98,17 86,17 86,25 98,25 98,29" fill={C.lime} />
            <polygon points="96,21 90,16 90,26" fill={C.navy} opacity="0.6" />
            <text x="0" y="29" fontFamily="'DM Sans',sans-serif" fontWeight="800"
              fontSize="22" fill={C.lime} letterSpacing="-0.5">vistgo</text>
          </svg>
          <p style={{ color: C.muted, fontSize: 12, margin: "8px 0 0" }}>
            Panel de Informes · Acceso
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{
              color: C.muted, fontSize: 11, fontWeight: 600,
              letterSpacing: 1, textTransform: "uppercase",
            }}>
              Usuario FileMaker
            </label>
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="usuario"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label style={{
              color: C.muted, fontSize: 11, fontWeight: 600,
              letterSpacing: 1, textTransform: "uppercase",
            }}>
              Contraseña
            </label>
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p style={{
              color: C.red, fontSize: 12, margin: 0,
              padding: "8px 12px", background: `${C.red}11`, borderRadius: 8,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              background: isPending ? `${C.lime}88` : C.lime,
              color: C.navy, border: "none", borderRadius: 10,
              padding: "13px", fontSize: 14, fontWeight: 800,
              cursor: isPending ? "not-allowed" : "pointer", marginTop: 4,
            }}
          >
            {isPending ? "Conectando…" : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <span style={{ color: `${C.muted}88`, fontSize: 11 }}>o</span>
        </div>

        <button
          onClick={handleEnvLogin}
          disabled={isPending}
          style={{
            width: "100%", marginTop: 10, background: "transparent",
            border: `1px solid ${C.muted}44`, borderRadius: 10, padding: "10px",
            color: C.muted, fontSize: 12,
            cursor: isPending ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Usar credenciales del servidor
        </button>
      </div>
    </div>
  );
}
