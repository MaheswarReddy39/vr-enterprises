import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo.jsx';
import { Container } from '../components/ui/Container.jsx';
import { isPlaceholder, policyLinks } from '../config/business.js';
import { useBusiness } from '../features/business/useBusiness.js';
import { pages } from '../content/pages.js';

/** Renders a paragraph, visually flagging [bracketed] placeholder prompts so nobody mistakes them for real policy text. */
export function Paragraph({ text }) {
  return isPlaceholder(text) ? (
    <p className="rounded-lg border border-dashed border-accent-300 bg-accent-50 px-3 py-2 text-sm italic text-accent-700">{text}</p>
  ) : (
    <p>{text}</p>
  );
}

export function PageShell({ title, description, notice, children }) {
  const business = useBusiness();
  return (
    <>
      <Seo title={title} description={description} />
      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link to="/" className="hover:text-ink hover:underline">Home</Link> <span aria-hidden="true">/</span> <span className="text-ink">{title}</span>
          </nav>
          <h1 className="mt-3 text-4xl sm:text-5xl">{title}</h1>
        </Container>
      </section>
      <Container className="grid gap-12 py-12 lg:grid-cols-[1fr_16rem] lg:gap-20 lg:py-16">
        <div className="max-w-3xl">
          {notice && (
            <p role="note" className="mb-10 flex gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </p>
          )}
          {children}
        </div>
        <aside aria-label="Related pages" className="lg:pt-2">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">Policies</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {policyLinks.map(({ to, label }) => (
              <li key={to}><Link to={to} className="text-brand-800 underline-offset-4 hover:underline">{label}</Link></li>
            ))}
            <li><Link to="/faq" className="text-brand-800 underline-offset-4 hover:underline">FAQ</Link></li>
            <li><Link to="/contact" className="text-brand-800 underline-offset-4 hover:underline">Contact {business.name}</Link></li>
          </ul>
        </aside>
      </Container>
    </>
  );
}

/** Generic editable page driven by content/pages.js. */
export default function ContentPage({ pageKey }) {
  const page = pages[pageKey];
  return (
    <PageShell title={page.title} description={page.description} notice={page.notice}>
      <div className="space-y-10">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl">{section.heading}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-muted">
              {section.body.map((text, i) => <Paragraph key={i} text={text} />)}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
