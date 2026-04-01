import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { AcademicSignupForm } from './academic-signup-form'

export const metadata: Metadata = {
  title: 'Academic Program | SettleGrid — Free AI Tools for Researchers & Students',
  description:
    'Free access to SettleGrid for academic researchers and students. $500 in credits, Scale-tier features, and 500K operations per month with .edu email verification.',
  alternates: { canonical: 'https://settlegrid.ai/academic' },
  keywords: [
    'SettleGrid academic',
    'free AI tools students',
    'academic API access',
    'AI research tools',
    'student developer program',
    'edu email free credits',
  ],
  openGraph: {
    title: 'Academic Program | SettleGrid',
    description:
      'Free access to 1,400+ AI tools for academic researchers and students. $500 in credits included.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Academic Program | SettleGrid',
    description: 'Free access to 1,400+ AI tools for academic researchers and students.',
  },
}

const BENEFITS = [
  {
    title: '$500 in Free Credits',
    description: 'Access any tool on the SettleGrid marketplace with $500 in credits that never expire.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: 'Scale-Tier Features',
    description: 'Advanced analytics, consumer insights, anomaly detection, data export, audit logs, and more.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
      </svg>
    ),
  },
  {
    title: '500K Operations/Month',
    description: '10x the free tier limit. Run experiments, build prototypes, and power research at scale.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: '90-Day Log Retention',
    description: 'Full audit trail for reproducible research. Export logs for your methodology sections.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    title: '1,400+ AI Tools',
    description: 'Access the full marketplace: data, NLP, image, code, search, finance, and more categories.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
  {
    title: 'MCP + REST + 15 Protocols',
    description: 'Use tools via MCP, REST, x402, or any of 15 supported payment protocols.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
  },
]

export default function AcademicPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white dark:bg-[#0C0E14]">
        {/* Hero */}
        <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-transparent to-indigo-50/30 dark:from-amber-900/10 dark:via-transparent dark:to-indigo-900/10" />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-300 mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
              Academic Program
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-indigo dark:text-gray-100">
              Free AI Tools for
              <span className="text-amber-500"> Researchers & Students</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Access 1,400+ monetized AI tools with $500 in free credits, Scale-tier features,
              and 500K operations per month. Just verify your academic email.
            </p>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="py-16 px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-center text-indigo dark:text-gray-100 mb-12">
              What You Get
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-xl border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] p-6"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4">
                    {benefit.icon}
                  </div>
                  <h3 className="text-base font-semibold text-indigo dark:text-gray-100 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup Form */}
        <section className="py-16 px-6 bg-gray-50 dark:bg-[#111320]">
          <div className="mx-auto max-w-lg">
            <h2 className="text-2xl font-bold text-center text-indigo dark:text-gray-100 mb-2">
              Get Started
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              Use your .edu or institutional email to activate your academic account.
            </p>
            <AcademicSignupForm />
          </div>
        </section>

        {/* Eligibility */}
        <section className="py-16 px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-center text-indigo dark:text-gray-100 mb-8">
              Eligibility
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <p className="text-sm">Students, faculty, and researchers at accredited institutions with a .edu email address</p>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <p className="text-sm">International academic institutions with .ac.uk, .edu.au, .ac.jp, and similar domains</p>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <p className="text-sm">Personal and commercial use are both permitted during your enrollment</p>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm">Credits are non-transferable and intended for academic use. Abuse will result in account suspension.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
