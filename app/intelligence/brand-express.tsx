"use client";

import { useMemo, useState } from "react";

const audiences = ["Clientes particulares", "Empresas", "Profesionales", "Comunidades"] as const;
const tones = ["Claro y cercano", "Sobrio y premium", "Audaz y contemporáneo", "Técnico y confiable"] as const;
const objectives = ["Explicar mejor mi servicio", "Captar consultas", "Lanzar una marca", "Renovar mi presencia digital"] as const;

const toneWords: Record<string, string> = {
  "Claro y cercano": "directa, humana y accesible",
  "Sobrio y premium": "precisa, elegante y sin exceso",
  "Audaz y contemporáneo": "expresiva, actual y decidida",
  "Técnico y confiable": "rigurosa, comprensible y transparente",
};

const objectiveWords: Record<string, string> = {
  "Explicar mejor mi servicio": "explicar qué ofreces y para quién tiene sentido",
  "Captar consultas": "convertir el interés inicial en una conversación concreta",
  "Lanzar una marca": "presentar una identidad con intención desde el primer contacto",
  "Renovar mi presencia digital": "alinear lo que ya haces con una presencia más clara",
};

export default function BrandExpress() {
  const [brand, setBrand] = useState("");
  const [sector, setSector] = useState("");
  const [audience, setAudience] = useState<string>(audiences[0]);
  const [tone, setTone] = useState<string>(tones[0]);
  const [objective, setObjective] = useState<string>(objectives[0]);
  const [copied, setCopied] = useState(false);
  const preview = useMemo(() => {
    const name = brand.trim() || "Tu marca";
    const field = sector.trim() || "tu sector";
    return [
      `CONCEPTO PRELIMINAR · INNWEB BRANDIA`,
      `Marca: ${name}`,
      `Dirección: ${name} puede contar lo que hace en ${field} con una voz ${toneWords[tone]}.`,
      `Para quién: ${audience.toLowerCase()} que necesitan una propuesta fácil de entender.`,
      `Meta de comunicación: ${objectiveWords[objective]}.`,
      `Primer mensaje de trabajo: «${name}: una forma más clara de elegir lo que necesitas».`,
      `Próximo paso: validar diferenciadores reales, referencias visuales, tono definitivo y posibles conflictos de marca con un diseñador.`,
    ].join("\n\n");
  }, [brand, sector, audience, tone, objective]);

  return <div className="ix-editor" id="brandia">
    <section className="ix-editorLeft">
      <span className="ix-category">LABORATORIO ABIERTO · SIN REGISTRO</span>
      <h2>Tu marca, en palabras más claras.</h2>
      <p>Antes de pedir un logo, define qué quieres transmitir. Completa cinco datos y explora una primera dirección editorial.</p>
      <form onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="brandia-name">Nombre de la marca</label>
        <input className="ix-publicInput" id="brandia-name" maxLength={80} placeholder="Tu negocio o proyecto" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <label htmlFor="brandia-sector">¿A qué se dedica?</label>
        <input className="ix-publicInput" id="brandia-sector" maxLength={100} placeholder="Ej. consultoría, turismo, tecnología" value={sector} onChange={(e) => setSector(e.target.value)} />
        <label htmlFor="brandia-audience">Audiencia principal</label>
        <select id="brandia-audience" className="ix-publicInput" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {audiences.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label htmlFor="brandia-tone">Personalidad de marca</label>
        <select id="brandia-tone" className="ix-publicInput" value={tone} onChange={(e) => setTone(e.target.value)}>
          {tones.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label htmlFor="brandia-goal">¿Qué quieres conseguir?</label>
        <select id="brandia-goal" className="ix-publicInput" value={objective} onChange={(e) => setObjective(e.target.value)}>
          {objectives.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </form>
      <p className="ix-note">Este ejercicio funciona en tu navegador: no se envía ni guarda información. No utiliza IA y no verifica disponibilidad de marcas.</p>
    </section>
    <section className="ix-editorRight">
      <span className="ix-category">TU PRIMERA DIRECCIÓN</span>
      <h3>Una idea con estructura. No una identidad terminada.</h3>
      <div className="ix-result">{preview}</div>
      <button className="ix-secondary" type="button" onClick={() => {
        void navigator.clipboard.writeText(preview).then(() => setCopied(true)).catch(() => setCopied(false));
      }}>{copied ? "Copiado" : "Copiar mi mapa de marca"}</button>
      <p className="ix-note">CONCEPTO DE DEMOSTRACIÓN · INNWEB BRANDIA. Una identidad final requiere estrategia, verificación y diseño humano.</p>
    </section>
  </div>;
}
