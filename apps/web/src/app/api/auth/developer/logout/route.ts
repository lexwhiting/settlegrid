import { clearSessionCookie } from '@/lib/auth'
import { successResponse, internalErrorResponse } from '@/lib/api'

export async function POST() {
  try {
    const response = successResponse({ message: 'Logged out successfully.' })
    return clearSessionCookie(response)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
