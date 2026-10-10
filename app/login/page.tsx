"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo iniciar sesión.");
      window.location.assign("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="auth-eyebrow">INNWEB OS · ACCESO</span>
        <h1>Iniciar sesión</h1>
        <p>Accede al espacio CRM de tu agencia.</p>
        <form onSubmit={submit}>
          <label>Correo electrónico<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? "Verificando…" : "Entrar"}</button>
        </form>
        <Link href="/setup">Configurar el primer espacio de trabajo</Link>
      </section>
      <style jsx>{`
        .auth-shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#15151c,#08080a 65%);color:#f5f5f7}
        .auth-card{width:min(100%,440px);padding:36px;border:1px solid #ffffff14;border-radius:22px;background:#101013}
        .auth-eyebrow{font-size:11px;letter-spacing:.15em;color:#92929c}
        h1{font-size:32px;letter-spacing:-.04em;margin:16px 0 8px}
        p{color:#a1a1aa;line-height:1.6}
        form{display:grid;gap:16px;margin:24px 0 18px}
        label{display:grid;gap:8px;color:#c5c5cc;font-size:13px}
        input{background:#08080a;border:1px solid #ffffff20;border-radius:10px;padding:12px;color:#fff;font:inherit}
        .auth-submit{border:0;padding:13px;background:#f5f5f7;color:#08080a;border-radius:10px;font-weight:750;cursor:pointer}
        .auth-submit:disabled{opacity:.55}
        a{color:#b7b7c0;font-size:13px}
        .auth-error{color:#ff9696}
      `}</style>
    </main>
  );
}
