import { useSearchParams } from 'react-router-dom';
import { getStoreProduct } from '../api/store.js';
import { Seo } from '../components/Seo.jsx';
import { EnquiryForm } from '../components/store/EnquiryForm.jsx';
import { Container } from '../components/ui/Container.jsx';
import { isPlaceholder, mailHref, telHref } from '../config/business.js';
import { useBusiness } from '../features/business/useBusiness.js';
import { useAsync } from '../hooks/useAsync.js';

export default function ContactPage() {
  const business = useBusiness();
  const [params] = useSearchParams();
  const slug = params.get('product');
  // Optional: pre-fill "Enquiring about" when arriving from a product page. A bad slug is simply ignored.
  const linked = useAsync(async (signal) => (slug ? (await getStoreProduct(slug, signal).catch(() => null))?.product ?? null : null), [slug]);
  const product = linked.data ? { id: linked.data.id, name: linked.data.name } : undefined;

  const { contact } = business;
  const rows = [
    ['Phone', contact.phone, telHref(contact.phone)],
    ['Email', contact.email, mailHref(contact.email)],
    ['Address', contact.address],
    ['Hours', contact.hours],
  ];

  return (
    <>
      <Seo title="Contact us" description={`Contact ${business.name} or send an enquiry about a water purifier.`} />
      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <p className="eyebrow-line mb-4 text-xs font-bold uppercase tracking-[0.22em] text-accent-600">Contact</p>
          <h1 className="text-4xl sm:text-5xl">Contact us</h1>
          <p className="mt-4 max-w-xl text-muted">Send an enquiry about a product or your requirements and we will get back to you.</p>
        </Container>
      </section>

      <Container className="grid gap-12 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-16">
        <div>
          <h2 className="text-2xl">Our details</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {rows.filter(([, value]) => value).map(([label, value, href]) => (
              <div key={label} className="grid grid-cols-[5.5rem_1fr] gap-4 py-4 text-sm">
                <dt className="text-muted">{label}</dt>
                <dd className={isPlaceholder(value) ? 'italic text-accent-700' : 'text-ink'}>
                  {href ? <a href={href} className="underline underline-offset-4">{value}</a> : value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted">Details in [brackets] are placeholders until the business information is added.</p>
        </div>

        <div>
          <h2 className="text-2xl">Send an enquiry</h2>
          <div className="mt-6">
            <EnquiryForm idPrefix="contact-enq" product={product} />
          </div>
        </div>
      </Container>
    </>
  );
}
