import { describe, it, expect } from 'vitest'
import { buttonVariants } from '@/components/ui/button'

describe('buttonVariants', () => {
  describe('variant classes', () => {
    it('applies default variant classes', () => {
      const classes = buttonVariants({ variant: 'default' })
      expect(classes).toContain('bg-brand')
      expect(classes).toContain('text-white')
    })

    it('applies destructive variant classes', () => {
      const classes = buttonVariants({ variant: 'destructive' })
      expect(classes).toContain('bg-red-500')
      expect(classes).toContain('text-white')
    })

    it('applies outline variant classes', () => {
      const classes = buttonVariants({ variant: 'outline' })
      expect(classes).toContain('border')
      expect(classes).toContain('bg-white')
    })

    it('applies secondary variant classes', () => {
      const classes = buttonVariants({ variant: 'secondary' })
      expect(classes).toContain('bg-indigo')
    })

    it('applies ghost variant classes', () => {
      const classes = buttonVariants({ variant: 'ghost' })
      expect(classes).toContain('hover:bg-gray-100')
    })

    it('applies link variant classes', () => {
      const classes = buttonVariants({ variant: 'link' })
      expect(classes).toContain('underline-offset-4')
    })
  })

  describe('size classes', () => {
    it('applies default size', () => {
      const classes = buttonVariants({ size: 'default' })
      expect(classes).toContain('h-10')
      expect(classes).toContain('px-4')
    })

    it('applies sm size', () => {
      const classes = buttonVariants({ size: 'sm' })
      expect(classes).toContain('h-9')
      expect(classes).toContain('px-3')
    })

    it('applies lg size', () => {
      const classes = buttonVariants({ size: 'lg' })
      expect(classes).toContain('h-11')
      expect(classes).toContain('px-8')
    })

    it('applies icon size', () => {
      const classes = buttonVariants({ size: 'icon' })
      expect(classes).toContain('h-10')
      expect(classes).toContain('w-10')
    })
  })

  describe('common classes', () => {
    it('includes disabled styles', () => {
      const classes = buttonVariants({})
      expect(classes).toContain('disabled:pointer-events-none')
      expect(classes).toContain('disabled:opacity-50')
    })

    it('includes focus-visible ring', () => {
      const classes = buttonVariants({})
      expect(classes).toContain('focus-visible:ring-2')
    })

    it('defaults to default variant and default size when no options given', () => {
      const classes = buttonVariants({})
      expect(classes).toContain('bg-brand')
      expect(classes).toContain('h-10')
    })
  })
})
