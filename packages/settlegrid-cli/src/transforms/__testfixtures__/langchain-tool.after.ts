import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { settlegrid } from '@settlegrid/mcp';

const sg = settlegrid.init({
  toolSlug: 'langchain-tool',

  pricing: {
    defaultCostCents: 1
  }
});

class SearchTool extends StructuredTool {
  name = 'search'
  description = 'Search the web.'
  schema = z.object({ query: z.string() })

  async _call(input: { query: string }): Promise<string> {
    return await sg.wrap(async () => {
      return `result for ${input.query}`
    }, {
      method: this.name
    })();
  }
}

export { SearchTool }
