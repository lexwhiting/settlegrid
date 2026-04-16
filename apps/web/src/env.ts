/**
 * Environment variable declarations for the web app.
 * Feature flags and configuration read from process.env.
 */

/** Gallery feature flag — default off. Set NEXT_PUBLIC_GALLERY_ENABLED=true to enable. */
export const GALLERY_ENABLED =
  process.env.NEXT_PUBLIC_GALLERY_ENABLED === 'true'
