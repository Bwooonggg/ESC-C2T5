import { Link } from "react-router-dom";
import { DasLogo } from "../components/DasLogo";
import { AccessibilityControls } from "../components/AccessibilityControls";

const services = [
    { path: "/screening", number: "01", eyebrow: "Public", title: "Screening", description: "Explore a guided, non-diagnostic dyslexia screening for adults or children." },
    { path: "/worksheet", number: "02", eyebrow: "For teachers", title: "Worksheet Builder", description: "Create accessible, level-appropriate literacy worksheets with an AI assistant." },
    { path: "/insights", number: "03", eyebrow: "For parents", title: "Parent Insight", description: "Follow your child's progress, recommendations, and email update preferences." },
];

export function HomePage() {
    return (
        <div className="home-page">
            <header className="home-header">
                <Link className="home-brand" to="/" aria-label="D.I.A.L home">
                    <DasLogo className="home-brand-logo" />
                    <span><strong>D.I.A.L</strong><small>Dyslexia Association of Singapore</small></span>
                </Link>
                <div className="home-actions"><a className="all-services-link" href="#services">All services</a><AccessibilityControls /><a className="home-contact" href="https://das.org.sg/contact-us/">DAS website <span aria-hidden="true">↗</span></a></div>
            </header>
            <main>
                <section className="home-hero">
                    <div className="home-hero-copy">
                        <p className="home-kicker">Support for learners, teachers and families</p>
                        <h1>Every learner deserves a way forward.</h1>
                        <p>D.I.A.L brings screening, teacher tools and parent insights together in one clear, supportive experience.</p>
                        <a className="hero-action" href="#services">Explore our services <span aria-hidden="true">→</span></a>
                    </div>
                    <div className="learning-art" aria-hidden="true">
                        <span className="art-disc art-disc-one" />
                        <span className="art-disc art-disc-two" />
                        <div className="art-card art-card-a">A<span>sound</span></div>
                        <div className="art-card art-card-b">b<span>build</span></div>
                        <div className="art-card art-card-c">C<span>connect</span></div>
                        <div className="art-pencil">✦</div>
                    </div>
                </section>
                <section className="services-section" id="services">
                    <div className="section-heading">
                        <div><p className="home-kicker">D.I.A.L services</p><h2>Support at every step</h2></div>
                        <p>Simple tools designed around learners, educators and families.</p>
                    </div>
                    <div className="service-grid" aria-label="D.I.A.L services">
                        {services.map((service) => (
                            <Link className="service-card" to={service.path} key={service.path}>
                                <span className="service-number">{service.number}</span>
                                <span className="service-eyebrow">{service.eyebrow}</span>
                                <h3>{service.title}</h3>
                                <p>{service.description}</p>
                                <strong>Open service <span aria-hidden="true">→</span></strong>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
            <footer className="home-footer">
                <div className="footer-brand"><DasLogo className="footer-logo" /><span><strong>D.I.A.L</strong><small>Built to support different ways of learning.</small></span></div>
                <nav className="footer-links" aria-label="DAS social and contact links">
                    <a href="https://www.instagram.com/dyslexiasg/" target="_blank" rel="noreferrer">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle className="icon-fill" cx="17.4" cy="6.7" r="1" /></svg>
                        <span>Instagram</span>
                    </a>
                    <a href="mailto:info@das.org.sg">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
                        <span>info@das.org.sg</span>
                    </a>
                </nav>
            </footer>
        </div>
    );
}
