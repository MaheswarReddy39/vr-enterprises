import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listPublicBanners } from '../api/account.js';
import { listStoreCategories, listStoreProducts } from '../api/store.js';
import { Seo } from '../components/Seo.jsx';
import { BannerCarousel } from '../components/store/BannerCarousel.jsx';
import { EnquiryForm } from '../components/store/EnquiryForm.jsx';
import { PriceTag, ProductCard, ProductGridSkeleton } from '../components/store/ProductCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { Reveal } from '../components/ui/Reveal.jsx';
import { SafeImage } from '../components/ui/SafeImage.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { isPlaceholder, mailHref, policyLinks, telHref } from '../config/business.js';
import { useBusiness } from '../features/business/useBusiness.js';
import { useAsync } from '../hooks/useAsync.js';

const whyChoose = [
  ['Focused on water purifiers', 'Our range is dedicated to water purifiers, so the whole catalogue is about one thing.'],
  ['Clear product information', 'Every product page lists availability and the specifications we have been able to verify.'],
  ['Book online, we confirm', 'Send a booking request in a few steps. We contact you to confirm the details. No payment is taken on the website.'],
  ['Ask before you book', 'Send an enquiry about any product from its page or from the contact form.'],
];

const steps = [
  ['Choose', 'Browse the range and compare the specifications of each purifier.'],
  ['Book', 'Sign in, pick a product and send your name, mobile number and delivery address. Nothing is paid online.'],
  ['We confirm', 'We contact you to confirm the product, the price, delivery and how payment works.'],
];

/** Opening statement when no banner has been set up in the admin. */
function Hero() {
  const business = useBusiness();
  return (
    <section className="relative overflow-hidden border-b border-line">
      <Container className="py-20 sm:py-28 lg:py-32">
        <p className="eyebrow-line mb-7 text-xs font-bold uppercase tracking-[0.24em] text-accent-500">{business.category}</p>
        <Reveal variant="lines">
          <h1 aria-label="Find the right water purifier for your needs." className="max-w-4xl text-[3rem] sm:text-7xl lg:text-[5.6rem]">
            <span className="line" style={{ '--i': 0 }}><span>Find the right </span></span>
            <span className="line" style={{ '--i': 1 }}><span><em className="not-italic text-brand-600">water purifier</em> for </span></span>
            <span className="line" style={{ '--i': 2 }}><span>your needs.</span></span>
          </h1>
        </Reveal>
        <Reveal delay={300}>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">
            Browse the {business.name} range, compare specifications, book online, or send us an enquiry whenever you have a question.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button as={Link} to="/shop" size="lg">
              Shop purifiers <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <Button as={Link} to="/contact" size="lg" variant="secondary">
              Make an enquiry
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/** One featured purifier shown large: picture on one side, the essentials and the two actions on the other. */
function Spotlight({ product }) {
  if (!product) return null;
  const image = product.primaryImage;
  return (
    <section aria-label="Spotlight" className="border-b border-line bg-sand">
      <Container className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20">
        <Reveal variant="image" className="overflow-hidden rounded-xl bg-white">
          <Link to={`/product/${product.slug}`} className="block aspect-[4/5] sm:aspect-square" aria-label={product.name}>
            <SafeImage src={image?.url} alt={image?.alt || product.name} loading="eager" fetchPriority="high" className="size-full object-contain p-8 transition-transform duration-[1200ms] ease-out hover:scale-[1.03]" />
          </Link>
        </Reveal>
        <Reveal>
          <p className="eyebrow-line mb-5 text-xs font-bold uppercase tracking-[0.24em] text-accent-500">Spotlight</p>
          <h2 className="text-4xl sm:text-5xl">{product.name}</h2>
          {product.shortDescription && <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{product.shortDescription}</p>}
          <div className="mt-6"><PriceTag product={product} size="lg" /></div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button as={Link} to={`/product/${product.slug}`} size="lg">View details <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" /></Button>
            <Button as={Link} to={`/book?product=${product.slug}&quantity=1`} size="lg" variant="accent">Book now</Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function SectionTitle({ eyebrow, title, action, light = false }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className={`eyebrow-line mb-5 text-xs font-bold uppercase tracking-[0.24em] ${light ? 'text-accent-300' : 'text-accent-500'}`}>{eyebrow}</p>
        <h2 className={`text-4xl sm:text-5xl ${light ? 'text-white' : ''}`}>{title}</h2>
      </div>
      {action}
    </Reveal>
  );
}

function FeaturedSection({ state }) {
  const { data, loading, error, reload } = state;
  const items = data?.items ?? [];
  const [lead, ...rest] = items;

  return (
    <section aria-labelledby="featured-heading" className="py-20 sm:py-28">
      <Container>
        <SectionTitle
          eyebrow="Featured"
          title={<span id="featured-heading">Featured purifiers</span>}
          action={
            <Link to="/shop" className="group inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="link-draw">View all products</span> <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          }
        />
        <div className="mt-14">
          {loading && !data ? (
            <ProductGridSkeleton count={3} />
          ) : error ? (
            <ErrorState message="We could not load the featured products." onRetry={reload} />
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
              Featured products will appear here once they are chosen in the admin dashboard.{' '}
              <Link to="/shop" className="text-brand-700 underline">Browse all products.</Link>
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              <ProductCard product={lead} priority />
              {rest.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="steps-heading" className="border-y border-line bg-white py-20 sm:py-28">
      <Container>
        <SectionTitle eyebrow="How booking works" title={<span id="steps-heading">Three simple steps</span>} />
        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map(([title, text], i) => (
            <Reveal as="li" key={title} delay={i * 120} className="relative border-t border-ink pt-6">
              <span className="font-display text-6xl font-bold leading-none text-brand-500" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-6 text-2xl">{title}</h3>
              <p className="mt-3 max-w-xs leading-relaxed text-muted">{text}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function CategoriesSection({ state }) {
  const { data, loading, error, reload } = state;
  const items = (data?.items ?? []).filter((c) => !c.parent);

  return (
    <section aria-labelledby="categories-heading" className="py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.7fr] lg:gap-20">
        <Reveal>
          <p className="eyebrow-line mb-5 text-xs font-bold uppercase tracking-[0.24em] text-accent-500">Categories</p>
          <h2 id="categories-heading" className="text-4xl sm:text-5xl">Shop by category</h2>
          <p className="mt-5 max-w-sm leading-relaxed text-muted">Start with the type of purifier you need.</p>
        </Reveal>
        <div>
          {loading && !data ? (
            <div role="status" aria-label="Loading categories" className="space-y-px">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse border-b border-line bg-sand/50" />)}
            </div>
          ) : error ? (
            <ErrorState message="We could not load the categories." onRetry={reload} />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">Categories will appear here once products are published.</p>
          ) : (
            <ul className="border-t border-ink">
              {items.map((c, i) => (
                <Reveal as="li" key={c.id} delay={i * 80} className="border-b border-line">
                  <Link to={`/shop?category=${c.slug}`} className="group flex items-center justify-between gap-4 py-7 transition-[padding] duration-500 hover:pl-3 focus-visible:outline-offset-2">
                    <span className="flex items-center gap-5">
                      {c.image && <SafeImage src={c.image.thumbUrl} alt="" className="size-14 rounded-lg object-cover" />}
                      <span className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{c.name}</span>
                    </span>
                    <span className="flex items-center gap-4 text-sm text-muted">
                      {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                      <span className="grid size-11 place-items-center rounded-full border border-ink/20 transition-colors duration-300 group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                        <ArrowRight size={18} aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}

function WhyChooseSection() {
  const business = useBusiness();
  return (
    <section aria-labelledby="why-heading" className="bg-ink py-20 text-white sm:py-28">
      <Container>
        <Reveal>
          <p className="eyebrow-line mb-5 text-xs font-bold uppercase tracking-[0.24em] text-accent-300">Why {business.name}</p>
          <h2 id="why-heading" className="max-w-3xl text-4xl text-white sm:text-6xl">Why choose {business.name}</h2>
        </Reveal>
        <ol className="mt-16 divide-y divide-white/15 border-y border-white/15">
          {whyChoose.map(([title, text], i) => (
            <Reveal as="li" key={title} delay={i * 80} className="group grid gap-3 py-8 md:grid-cols-[6rem_1fr_1.4fr] md:items-baseline md:gap-8">
              <span className="font-display text-2xl font-bold text-accent-400" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-2xl font-bold tracking-tight transition-transform duration-500 group-hover:translate-x-2">{title}</h3>
              <p className="max-w-xl leading-relaxed text-white/65">{text}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function TrustSection() {
  const business = useBusiness();
  const { contact } = business;
  return (
    <section aria-labelledby="trust-heading" className="py-20 sm:py-28">
      <Container className="grid gap-14 lg:grid-cols-2 lg:gap-24">
        <Reveal>
          <p className="eyebrow-line mb-5 text-xs font-bold uppercase tracking-[0.24em] text-accent-500">Trust and service</p>
          <h2 id="trust-heading" className="text-4xl sm:text-5xl">Read the details before you buy</h2>
          <p className="mt-5 max-w-md leading-relaxed text-muted">Our policies are published on the website so you know what to expect.</p>
          <ul className="mt-10 border-t border-ink">
            {policyLinks.map(({ to, label }) => (
              <li key={to} className="border-b border-line">
                <Link to={to} className="group flex items-center justify-between py-5 text-lg font-medium">
                  <span className="link-draw">{label}</span>
                  <ArrowRight size={18} aria-hidden="true" className="text-muted transition-transform duration-300 group-hover:translate-x-1.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={150} className="space-y-10 lg:pt-24">
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-muted">After-sales service and warranty</h3>
            <p className="mt-3 max-w-md leading-relaxed">
              Installation, servicing and warranty details differ by product. We confirm them with you when we contact you about your booking.
            </p>
          </div>
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-muted">Talk to us</h3>
            <p className="mt-3 text-lg leading-relaxed">
              {isPlaceholder(contact.phone) ? <span className="italic">{contact.phone}</span> : <a className="link-draw" href={telHref(contact.phone)}>{contact.phone}</a>}
              {' · '}
              {isPlaceholder(contact.email) ? <span className="italic">{contact.email}</span> : <a className="link-draw" href={mailHref(contact.email)}>{contact.email}</a>}
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function EnquirySection() {
  const business = useBusiness();
  const { contact } = business;
  const rows = [['Phone', contact.phone], ['Email', contact.email], ['Address', contact.address], ['Hours', contact.hours]].filter(([, value]) => value);
  return (
    <section id="enquiry" aria-labelledby="enquiry-heading" className="border-t border-line bg-sand py-20 sm:py-28">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
        <Reveal>
          <p className="eyebrow-line mb-5 text-xs font-bold uppercase tracking-[0.24em] text-accent-500">Contact</p>
          <h2 id="enquiry-heading" className="text-4xl sm:text-5xl">Have a question? Send an enquiry.</h2>
          <p className="mt-5 max-w-md leading-relaxed text-muted">Tell us what you are looking for and we will get back to you.</p>
          <dl className="mt-10 divide-y divide-ink/10 border-y border-ink/10 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex gap-6 py-4">
                <dt className="w-20 shrink-0 text-muted">{label}</dt>
                <dd className={isPlaceholder(value) ? 'italic text-muted' : 'font-medium text-ink'}>{value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal delay={150} className="rounded-xl bg-white p-6 sm:p-10">
          <EnquiryForm idPrefix="home-enq" />
        </Reveal>
      </Container>
    </section>
  );
}

export default function HomePage() {
  const business = useBusiness();
  const featured = useAsync((signal) => listStoreProducts({ featured: 'true', limit: 4 }, signal), []);
  const categories = useAsync((signal) => listStoreCategories(signal), []);
  // Banners are optional: if they fail to load the page simply opens with the built-in introduction.
  const banners = useAsync((signal) => listPublicBanners(signal), []);
  const hasBanners = banners.data?.items?.length > 0;

  return (
    <>
      <Seo description={`${business.name} sells water purifiers. Browse the range, compare specifications and send us an enquiry.`} />
      <BannerCarousel banners={banners.data?.items} asH1 />
      {banners.loading && !banners.data ? <div aria-hidden="true" className="min-h-[30rem] border-b border-line" /> : !hasBanners && <Hero />}
      <Spotlight product={featured.data?.items?.[0]} />
      <FeaturedSection state={featured} />
      <HowItWorks />
      <CategoriesSection state={categories} />
      <WhyChooseSection />
      <TrustSection />
      <EnquirySection />
    </>
  );
}
