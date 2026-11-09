/**
 * The message shown when an Upstream URL field fails the browser's check
 * (`type="url" pattern="https://.*"`). The API enforces https:// as well
 * (app/api/developer/tools/[id]/endpoint/route.ts).
 */
export const UPSTREAM_URL_MESSAGE = 'Upstream URL must start with https://'

export function upstreamUrlValidityMessage(validity: Pick<ValidityState, 'patternMismatch' | 'typeMismatch'>): string {
  return validity.patternMismatch || validity.typeMismatch ? UPSTREAM_URL_MESSAGE : ''
}
