import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { createRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/** 1 request per email per 30 days */
const stickerLimiter = createRateLimiter(1, '720 h')

const stickerRequestSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  email: z
    .string()
    .email('Valid email is required')
    .max(320, 'Email must be at most 320 characters'),
  street: z
    .string()
    .min(1, 'Street address is required')
    .max(500, 'Street must be at most 500 characters'),
  city: z
    .string()
    .min(1, 'City is required')
    .max(200, 'City must be at most 200 characters'),
  stateProvince: z
    .string()
    .min(1, 'State/province is required')
    .max(200, 'State/province must be at most 200 characters'),
  postalCode: z
    .string()
    .min(1, 'Postal code is required')
    .max(20, 'Postal code must be at most 20 characters'),
  country: z
    .string()
    .min(1, 'Country is required')
    .max(100, 'Country must be at most 100 characters'),
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** POST /api/stickers/request — request a free sticker pack */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request, stickerRequestSchema)

    // Rate limit: 1 request per email per 30 days
    const rl = await checkRateLimit(stickerLimiter, `sticker-request:${body.email.toLowerCase()}`)
    if (!rl.success) {
      return errorResponse(
        'You have already requested a sticker pack recently. Please try again in 30 days.',
        429,
        'RATE_LIMIT_EXCEEDED'
      )
    }

    logger.info('stickers.request', {
      email: body.email,
      city: body.city,
      country: body.country,
    })

    // Send notification email to founder
    const escapedName = escapeHtml(body.name)
    const escapedEmail = escapeHtml(body.email)
    const escapedStreet = escapeHtml(body.street)
    const escapedCity = escapeHtml(body.city)
    const escapedState = escapeHtml(body.stateProvince)
    const escapedPostal = escapeHtml(body.postalCode)
    const escapedCountry = escapeHtml(body.country)

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1A1F3A;">Sticker Pack Request</h2>
        <p>A developer has requested a free sticker pack:</p>
        <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">Name</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">Email</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">Street</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedStreet}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">City</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedCity}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">State/Province</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedState}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">Postal Code</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedPostal}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #555;">Country</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapedCountry}</td>
          </tr>
        </table>
        <p style="margin-top: 16px; color: #999; font-size: 12px;">
          Requested at ${new Date().toISOString()}
        </p>
      </div>
    `

    // Fire-and-forget — don't block the response
    for (const adminEmail of ADMIN_EMAILS) {
      sendEmail({
        to: adminEmail,
        subject: `[SettleGrid] Sticker Request: ${body.name}`,
        html,
      }).catch((err) => {
        logger.error('stickers.email_failed', { adminEmail }, err)
      })
    }

    return successResponse({ ok: true, message: 'Sticker pack requested successfully.' })
  } catch (err) {
    return internalErrorResponse(err)
  }
}
