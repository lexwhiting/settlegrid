'use client'

import { Toaster } from 'sonner'

export function SonnerToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'font-sans',
          success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
          error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
          info: 'bg-white border-gray-200 text-gray-800 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200',
        },
      }}
    />
  )
}
