import { settlegrid, newHelper } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'fixture',
  pricing: { defaultCostCents: 1 },
})

const helper = newHelper()
const other = deprecatedFn()

export { sg, helper, other }
