/**
 * The message shown when an Upstream URL field fails the `pattern="https://.*"`
 * check. The API enforces https:// as well
 * (app/api/developer/tools/[id]/endpoint/route.ts). A value that already starts
 * with https:// but isn't a valid URL keeps the browser's own message.
 */
export const UPSTREAM_URL_MESSAGE = 'Upstream URL must start with https://'

export function upstreamUrlValidityMessage(validity: Pick<ValidityState, 'patternMismatch'>): string {
  return validity.patternMismatch ? UPSTREAM_URL_MESSAGE : ''
}
