import { settlegrid, oldHelper, deprecatedFn } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'fixture',
  pricing: { defaultCostCents: 1 },
})

const helper = oldHelper()
const other = deprecatedFn()

export { sg, helper, other }
