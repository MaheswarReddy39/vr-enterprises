import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Container } from '../components/ui/Container.jsx';
import { Input } from '../components/ui/Input.jsx';
import { SectionHeading } from '../components/ui/SectionHeading.jsx';
import { Wordmark } from '../components/ui/Wordmark.jsx';

const scales = [
  { name: 'Brand', tokens: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `bg-brand-${n}`]) },
  { name: 'Accent', tokens: [50, 100, 200, 300, 400, 500, 600, 700].map((n) => [n, `bg-accent-${n}`]) },
];
// Tailwind needs literal class names to generate CSS, so the scale classes are listed here once.
// bg-brand-50 bg-brand-100 bg-brand-200 bg-brand-300 bg-brand-400 bg-brand-500 bg-brand-600 bg-brand-700
// bg-brand-800 bg-brand-900 bg-brand-950 bg-accent-50 bg-accent-100 bg-accent-200 bg-accent-300 bg-accent-400
// bg-accent-500 bg-accent-600 bg-accent-700

function Block({ title, children }) {
  return (
    <section className="border-t border-line py-10">
      <h3 className="mb-6 text-2xl">{title}</h3>
      {children}
    </section>
  );
}

/** Development-only reference page for the design tokens and base components. */
export default function DesignSystemPage() {
  return (
    <Container className="py-14">
      <SectionHeading
        eyebrow="Design system"
        title="VR Enterprises foundation"
        description="Placeholder palette and components. Brand colours and logo will be replaced with the official assets."
      />

      <div className="mt-10">
        <Block title="Wordmark">
          <div className="flex flex-wrap gap-6">
            <div className="rounded-lg border border-line bg-ivory p-6">
              <Wordmark />
            </div>
            <div className="rounded-lg bg-brand-950 p-6">
              <Wordmark inverted />
            </div>
          </div>
        </Block>

        <Block title="Colour">
          {scales.map((scale) => (
            <div key={scale.name} className="mb-6">
              <p className="mb-2 text-sm font-medium text-muted">{scale.name}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
                {scale.tokens.map(([step, cls]) => (
                  <div key={step}>
                    <div className={`h-14 rounded-md border border-black/5 ${cls}`} />
                    <p className="mt-1 text-xs text-muted">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Block>

        <Block title="Typography">
          <h1 className="text-5xl">Display heading</h1>
          <h2 className="mt-3 text-3xl">Section heading</h2>
          <h3 className="mt-3 text-xl">Card heading</h3>
          <p className="mt-4 max-w-xl leading-relaxed text-muted">
            Body copy is set in Inter for clarity, with Fraunces reserved for headings to give the brand an
            editorial, premium voice.
          </p>
        </Block>

        <Block title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </Block>

        <Block title="Form fields">
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <Input label="Full name" placeholder="Enter your name" />
            <Input label="Email" type="email" hint="We never share your email." />
            <Input label="Pincode" error="Enter a valid pincode." defaultValue="12" />
          </div>
        </Block>

        <Block title="Badges and cards">
          <div className="mb-6 flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="brand">Brand</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">In stock</Badge>
            <Badge tone="warning">Low stock</Badge>
            <Badge tone="danger">Out of stock</Badge>
          </div>
          <Card className="max-w-sm">
            <h3 className="text-xl">Card</h3>
            <p className="mt-2 text-sm text-muted">Surfaces use a hairline border and a soft shadow.</p>
          </Card>
        </Block>
      </div>
    </Container>
  );
}
