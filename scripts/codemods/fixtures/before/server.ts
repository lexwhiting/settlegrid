import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

const sg = settlegrid.init({
  toolSlug: 'fixture',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search' },
    },
  },
})

const search = sg.wrap(
  async (args: SearchInput) => ({ q: args.query }),
  { method: 'search' },
)

export { search }
