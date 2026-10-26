"use client";

import { useState, type FormEvent } from "react";

export default function AiClient() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/crm/ai", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        cache: "no-store",
      });
      const data: { answer?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed.");
      setAnswer(data.answer || "No answer received.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setWorking(false);
    }
  }

  return <section style={{ marginTop: 24, padding: 24, border: "1px solid #343b2a", borderRadius: 20, background: "rgba(27,28,23,.9)" }}>
    <form onSubmit={submit}>
      <label htmlFor="gemini-prompt" style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>Tu solicitud</label>
      <textarea id="gemini-prompt" rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)}
        maxLength={4000} minLength={2} required placeholder="Ejemplo: escribe 3 propuestas de valor para una web B2B"
        style={{ width: "100%", background: "#12150f", color: "#f5f5ed", border: "1px solid #505a41", borderRadius: 12, padding: 14, resize: "vertical" }} />
      <button type="submit" disabled={working || prompt.trim().length < 2}
        style={{ marginTop: 12, padding: "12px 22px", borderRadius: 999, border: 0, background: "#9cdf3e", color: "#10110d", cursor: "pointer", fontWeight: 700 }}>
        {working ? "Consultando…" : "Generar con Gemini"}
      </button>
    </form>
    {error && <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p>}
    {answer && <div aria-live="polite" style={{ marginTop: 22, borderTop: "1px solid #41483c", paddingTop: 20 }}>
      <h2 style={{ fontSize: 18 }}>Respuesta</h2>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, overflowWrap: "anywhere" }}>{answer}</div>
      <button type="button" onClick={() => void navigator.clipboard.writeText(answer)}
        style={{ marginTop: 16, border: "1px solid #545a4a", background: "transparent", color: "inherit", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Copiar</button>
    </div>}
  </section>;
}
