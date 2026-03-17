import { SignUp } from '@clerk/nextjs'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cloud dark:bg-[#0F1117]">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg border border-gray-200 dark:border-[#2E3148] dark:bg-[#1A1D2E]',
            headerTitle: 'dark:text-gray-100',
            headerSubtitle: 'dark:text-gray-400',
            socialButtonsBlockButton: 'dark:bg-[#252836] dark:border-[#2E3148] dark:text-gray-200 dark:hover:bg-[#2E3148]',
            formFieldLabel: 'dark:text-gray-300',
            formFieldInput: 'dark:bg-[#252836] dark:border-[#2E3148] dark:text-gray-100 dark:placeholder-gray-500',
            footerActionLink: 'dark:text-brand-light',
            formButtonPrimary: 'bg-brand hover:bg-brand-dark',
            dividerLine: 'dark:bg-[#2E3148]',
            dividerText: 'dark:text-gray-500',
            identityPreviewEditButton: 'dark:text-brand-light',
            formFieldAction: 'dark:text-brand-light',
            footer: 'dark:bg-[#1A1D2E]',
            footerAction: 'dark:bg-[#1A1D2E]',
            footerActionText: 'dark:text-gray-400',
          },
        }}
      />
    </div>
  )
}
