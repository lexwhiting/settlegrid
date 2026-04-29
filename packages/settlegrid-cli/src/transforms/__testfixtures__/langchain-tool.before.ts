import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

class SearchTool extends StructuredTool {
  name = 'search'
  description = 'Search the web.'
  schema = z.object({ query: z.string() })

  async _call(input: { query: string }): Promise<string> {
    return `result for ${input.query}`
  }
}

export { SearchTool }
