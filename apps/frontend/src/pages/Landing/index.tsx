import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Globe } from "lucide-react";
import "../../styles/landing.css";

export default function LandingPage() {
  const scrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landingContainer">
      <div className="landingInner">
        <nav className="landingNavbar">
          <Link to="/" className="landingLogo">
            <img src="/cotizapp-favicon.svg" alt="CotizApp Logo" style={{ width: 22, height: 22 }} />
            <span>Cotizapp</span>
          </Link>

          <Link to="/login" className="btn btn--ghost landingNavBtn">
            Iniciar sesión <ArrowRight size={16} />
          </Link>
        </nav>

        <main className="landingContentCentered">
          <div className="landingHeroText">
            <div className="landingPill">Optimizá tu negocio</div>
            <h1 className="landingTitle">
              Gestioná tus ventas de forma <span className="highlight">rápida</span> y <span className="highlight">profesional</span>
            </h1>
            <p className="landingDesc">
              Una nueva plataforma integral que te permite gestionar clientes, catálogo de productos y generar cotizaciones desde cualquier lugar.
            </p>

            <div className="landingHeroActions">
              <Link to="/login" className="btn btn--primary landingHeroBtn">
                Empezar ahora
              </Link>
              <button onClick={scrollToFeatures} className="btn btn--ghost landingHeroBtn">
                Descubrir más
              </button>
            </div>
          </div>

          <div className="landingImageWrapper">
            <img 
              src="/Placeholder-landing.png" 
              alt="CotizApp Dashboard" 
              className="landingImage" 
            />
          </div>

          <section className="landingStatsNew">
            <div className="landingStatsLeft">
              <div className="landingStatsIcon">
                <Globe size={28} color="var(--primary)" />
              </div>
              <p className="landingStatsDesc">
                Infraestructura escalable y accesible para potenciar las ventas de cualquier PyME.
              </p>
            </div>
            <div className="landingStatsRight">
              <div className="statItemNew">
                <h3>&lt; 20 USD</h3>
                <p>Costo operativo mensual</p>
              </div>
              <div className="statItemNew">
                <h3>2</h3>
                <p>Monedas en simultáneo</p>
              </div>
              <div className="statItemNew">
                <h3>3</h3>
                <p>Alertas automáticas</p>
              </div>
            </div>
          </section>

          <section id="features" className="landingFeaturesSection">
            <div className="landingPill" style={{ margin: '0 auto 5px auto' }}>CARACTERÍSTICAS</div>
            <div className="landingSectionHeader">
              <h2>Herramientas para <span className="highlightAccent">potenciar</span> tu visión</h2>
              <p>Maneja tu negocio con herramientas diseñadas para ahorrarte horas de trabajo manual y escalar tus ventas.</p>
            </div>

            <div className="landingGrid">
              <div className="landingFeatureCard landingFeatureCard--note1">
                <div className="cardNoteHeader">
                  <span className="cardNoteNumber">01</span>
                  <ArrowUpRight size={28} />
                </div>
                <h3>Gestión Centralizada</h3>
                <p>Maneja todos tus clientes y catálogo de productos en un solo lugar, sin planillas desordenadas.</p>
              </div>

              <div className="landingFeatureCard landingFeatureCard--note2">
                <div className="cardNoteHeader">
                  <span className="cardNoteNumber">02</span>
                  <ArrowUpRight size={28} />
                </div>
                <h3>Cotizaciones al Instante</h3>
                <p>Genera presupuestos profesionales en múltiples monedas en segundos y envíalos con un clic.</p>
              </div>

              <div className="landingFeatureCard landingFeatureCard--note3">
                <div className="cardNoteHeader">
                  <span className="cardNoteNumber">03</span>
                  <ArrowUpRight size={28} />
                </div>
                <h3>Métricas en Tiempo Real</h3>
                <p>Visualiza el estado de tus ventas, tasas de conversión y próximas renovaciones desde un dashboard.</p>
              </div>
            </div>
          </section>
        </main>
      </div>

        <footer className="landingFooter">
          <div className="landingFooterInner">
            <div className="landingFooterBrand">
              <Link to="/" className="landingLogo">
                <img src="/cotizapp-favicon.svg" alt="CotizApp Logo" style={{ width: 22, height: 22 }} />
                <span>Cotizapp</span>
              </Link>
              <p>Optimizá tu negocio y gestioná tus ventas de forma rápida y profesional.</p>
            </div>
            <div className="landingFooterLinks">
              <div className="landingFooterCol">
                <h4>Plataforma</h4>
                <Link to="/login">Iniciar sesión</Link>
              </div>
              <div className="landingFooterCol">
                <h4>Social</h4>
                <Link to="#">Instagram</Link>
                <Link to="#">LinkedIn</Link>
              </div>
            </div>
          </div>
          <div className="landingFooterBottom">
            © 2026 CotizApp. Todos los derechos reservados.
          </div>
        </footer>
    </div>
  );
}
