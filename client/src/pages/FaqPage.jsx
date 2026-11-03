import { ChevronDown } from 'lucide-react';
import { faqs } from '../content/pages.js';
import { Paragraph, PageShell } from './ContentPage.jsx';

export default function FaqPage() {
  return (
    <PageShell
      title="Frequently asked questions"
      description="Answers to common questions about ordering, delivery, installation, warranty and returns."
      notice="Placeholder answers: replace the bracketed prompts with your real information."
    >
      <div className="divide-y divide-line border-y border-line">
        {faqs.map(({ q, a }) => (
          <details key={q} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-xl marker:hidden [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="space-y-3 pb-5 leading-relaxed text-muted">
              {a.map((text, i) => <Paragraph key={i} text={text} />)}
            </div>
          </details>
        ))}
      </div>
    </PageShell>
  );
}
