import type { TemplateManifest } from '@/lib/registry'

interface DeployButtonProps {
  template: TemplateManifest
}

export function DeployButton({ template }: DeployButtonProps) {
  if (template.deployButton) {
    return (
      <a
        href={template.deployButton.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#E5A336] px-5 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
      >
        Deploy to {template.deployButton.provider}
      </a>
    )
  }

  const vercelUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(template.repo.url)}`

  return (
    <a
      href={vercelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-md bg-[#E5A336] px-5 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
    >
      Deploy with Vercel
    </a>
  )
}
