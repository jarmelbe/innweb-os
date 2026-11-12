import Link from "next/link";
import BrandExpress from "./brand-express";
import { intelligenceModules, intelligenceStatusLabels } from "@/lib/innweb-intelligence";
import "../dashboard/intelligence/intelligence.css";
import "./public.css";

export const metadata = {
  title: "InnWeb Intelligence · Laboratorio de ideas",
  description: "Explora herramientas para analizar tu web, ordenar tu marca y transformar ideas en un siguiente paso útil.",
  robots: { index: false, follow: false },
};

const publicModules = intelligenceModules.filter((module) => module.audience === "both" || module.audience === "visitor");

export default function PublicIntelligence() {
  return <main className="ix-shell">
    <div className="ix-wrap">
      <nav className="ix-nav" aria-label="Navegación de InnWeb Intelligence">
        <Link href="https://innweb.co/">← InnWeb.co</Link>
        <span>INNWEB / INTELLIGENCE</span>
        <Link href="https://innweb.co/?solicitud=diagnostico">Solicitar diagnóstico</Link>
      </nav>
      <header className="ix-hero">
        <span className="ix-eyebrow">INTELIGENCIA PARA IDEAS REALES</span>
        <h1>Antes de construir más, descubre qué vale la pena construir.</h1>
        <p>Explora herramientas sencillas para entender tu presencia digital, ordenar tu marca y preparar tu siguiente decisión. Una buena experiencia no necesita exagerar lo que puede hacer.</p>
        <div className="ix-heroMeta">Vista de demostración · Sin promesas de posicionamiento o resultados comerciales</div>
      </header>
      <div className="ix-sectionTitle"><span>01 / EXPLORA</span><p>Una herramienta real y un primer ejercicio gratuito. El resto se presenta con su alcance actual.</p></div>
      <div className="ix-grid">
        {publicModules.map((module) => <article className="ix-module ix-publicCard" key={module.id}>
          <span className="ix-category">{module.category}</span>
          <strong>{module.label}</strong>
          <span className="ix-strapline">{module.strapline}</span>
          <span className="ix-description">{module.description}</span>
          <span className="ix-state">{intelligenceStatusLabels[module.status]}</span>
          {module.id === "rankpulse"
            ? <Link className="ix-cardLink" href="/">Abrir auditoría técnica →</Link>
            : module.id === "brandia"
              ? <a className="ix-cardLink" href="#brandia">Probar mapa de marca →</a>
              : <Link className="ix-cardLink" href="https://innweb.co/?solicitud=diagnostico">Consultar este servicio →</Link>}
        </article>)}
      </div>
      <div className="ix-sectionTitle ix-briefTitle"><span>02 / INNWEB BRANDIA</span><p>Ejercicio local, gratuito y sin envío de datos.</p></div>
      <BrandExpress />
      <section className="ix-publicCta">
        <span className="ix-eyebrow">LA TECNOLOGÍA PROPONE. NUESTRO EQUIPO AFINA.</span>
        <h2>Tu idea merece una dirección propia.</h2>
        <p>Si quieres llevar este concepto a una identidad, un sitio o una operación real, comenzamos con una conversación y un alcance claro. Sin métricas inventadas ni compromisos ocultos.</p>
        <Link href="https://innweb.co/?solicitud=diagnostico">Solicitar diagnóstico gratuito →</Link>
      </section>
      <footer className="ix-footer">
        InnWeb Intelligence · Herramientas en desarrollo. El ejercicio BrandIA no genera logos con IA ni guarda información.
        La auditoría técnica de RankPulse conserva su metodología y puntuación actuales.
      </footer>
    </div>
  </main>;
}
