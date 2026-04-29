import { StructuredTool } from '@langchain/core/tools'

class SearchTool extends StructuredTool {
  name = 'search'
  description = 'Search the web.'
  schema = {} as never
  async _call(): Promise<string> {
    return 'ok'
  }
}

export { SearchTool }
