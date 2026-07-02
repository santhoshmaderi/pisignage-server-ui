import { Card } from '@/components/ui/card'
import { Icon } from '@/components/Icon'

const PISIGNAGE_URL = 'https://pisignage.com'

type Feature = { icon: string; title: string; desc: string }

const FEATURES: Feature[] = [
  {
    icon: 'group',
    title: 'Multi-user Management',
    desc: 'Invite team members with role-based access — admins, editors and viewers — and scope each user to specific groups or installations.',
  },
  {
    icon: 'palette',
    title: 'Branding',
    desc: 'Apply your own logo, colors, fonts and login screen so the console matches your organization’s identity.',
  },
  {
    icon: 'dashboard_customize',
    title: 'Templates & Layout Designer',
    desc: 'Template designer allows you to create custom layouts that can then be used in Playlists and groups.',
  },
  {
    icon: 'verified',
    title: 'White-label',
    desc: 'Fully rebrand PiSignage as your own product and build your digital signage business. — ideal for agencies running client fleets.',
  },
  {
    icon: 'badge',
    title: 'SSO Integrations',
    desc: 'Authenticate via SAML 2.0 / OAuth (Google, Microsoft Entra/Azure AD) so users sign in with your existing identity provider.',
  },
  {
    icon: 'apartment',
    title: 'Reseller / Multi-tenant',
    desc: 'Run a reseller business: manage many isolated installations and customers from one server, each with its own players, media, branding and billing.',
  },
  {
    icon: 'api',
    title: 'REST API & Webhooks',
    desc: 'Automate deployments and integrate signage with your own systems through a documented API and event webhooks.',
  },
  {
    icon: 'monitoring',
    title: 'Reports & Audit Logs',
    desc: 'Proof-of-play reports, player health analytics and a full audit trail of who changed what, and when.',
  },
  {
    icon: 'verified_user',
    title: 'Priority Support & SLAs',
    desc: 'Get priority support from our team that built the product. We are here to help you succeed.',
  },
]

export function SelfHosted() {
  return (
    <div className="space-y-8 max-w-container-max">
      {/* Hero */}
      <section className="bg-surface-container rounded-xl border border-border-industrial overflow-hidden">
        <div className="p-8 md:p-10 flex flex-col gap-4">
          <span className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-label-caps uppercase tracking-wider">
            <Icon name="dns" size={16} />
            Self-Hosted Server
          </span>
          <h1 className="text-headline-lg text-text-vibrant">
            piSignage Self-Hosted Server
          </h1>
          <p className="text-body-lg text-text-muted max-w-2xl">
            You're running the open-source server. Upgrade to the self-hosted server for
            enterprise features — multi-user management, SSO, templates, white-labeling and more —
            all running on your own infrastructure with full data ownership.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
               href={`${PISIGNAGE_URL}/partners`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-on-primary font-bold px-5 py-2.5 rounded-lg hover:bg-primary-container transition-colors"
            >
              Learn More
              <Icon name="open_in_new" size={18} />
            </a>
            <a
              href={`${PISIGNAGE_URL}/support`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-border-industrial text-text-vibrant px-5 py-2.5 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              Contact Sales
              <Icon name="mail" size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-5 flex flex-col gap-3 hover:border-outline-variant transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name={f.icon} size={22} />
            </div>
            <h3 className="text-headline-sm text-text-vibrant">{f.title}</h3>
            <p className="text-body-sm text-text-muted leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>

      {/* Footer CTA */}
      <Card className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-headline-sm text-text-vibrant">Ready to scale your signage?</h3>
          <p className="text-body-sm text-text-muted mt-1">
            See full feature comparison, pricing and deployment options on pisignage.com.
          </p>
        </div>
        <a
          href={`${PISIGNAGE_URL}/pricing`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 shrink-0 bg-primary text-on-primary font-bold px-5 py-2.5 rounded-lg hover:bg-primary-container transition-colors"
        >
          Visit pisignage.com
          <Icon name="open_in_new" size={18} />
        </a>
      </Card>
    </div>
  )
}
