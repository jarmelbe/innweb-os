"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type SetupStatus = { databaseConfigured?: boolean; setupConfigured?: boolean; setupAvailable?: boolean };

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [agencyName, setAgencyName] = useState("InnWeb");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/setup").then(async (response) => {
      setStatus(await response.json());
    }).catch(() => setStatus({}));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agencyName, name, email, token, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo crear el espacio.");
      window.location.assign("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el espacio.");
      setBusy(false);
    }
  }

  const ready = status?.databaseConfigured && status.setupConfigured && status.setupAvailable;
  const unavailable = status && !status.databaseConfigured;
  const completed = status?.databaseConfigured && status.setupConfigured && status.setupAvailable === false;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-logo-wrap"><img src="/innweb-logo.png" alt="InnWeb" /></span><b>OS</b></div>
        <span className="auth-eyebrow">PRIMER ACCESO</span>
        <h1>Configurar el espacio CRM</h1>
        {unavailable && <p>Primero conecta Neon. Configura DATABASE_URL agrupada, DIRECT_URL directa, aplica la migración y define INNWEB_SETUP_TOKEN de forma privada.</p>}
        {status && status.databaseConfigured && !status.setupConfigured && <p>Falta configurar INNWEB_SETUP_TOKEN en el servidor. Usa un secreto aleatorio largo y no lo compartas.</p>}
        {completed && <p>El primer espacio ya fue configurado. Inicia sesión con una cuenta existente.</p>}
        {ready && (
          <form onSubmit={submit}>
            <label>Nombre de la agencia<input required minLength={2} maxLength={100} value={agencyName} onChange={(event) => setAgencyName(event.target.value)} /></label>
            <label>Tu nombre<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Token temporal de configuración<input required minLength={32} maxLength={256} type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label>
            <label>Contraseña (mínimo 12 caracteres)<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={busy}>{busy ? "Creando espacio…" : "Crear agencia y cuenta propietaria"}</button>
          </form>
        )}
        {status === null && <p>Verificando configuración segura…</p>}
        <Link href="/login">Volver al inicio de sesión</Link>
      </section>
    </main>
  );
}
