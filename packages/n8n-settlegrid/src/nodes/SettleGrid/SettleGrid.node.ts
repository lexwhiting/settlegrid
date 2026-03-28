import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  IHttpRequestMethods,
  IHttpRequestOptions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export class SettleGrid implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SettleGrid',
    name: 'settleGrid',
    icon: 'file:settlegrid.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Discover, browse, and invoke monetized AI tools via SettleGrid',
    defaults: {
      name: 'SettleGrid',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'settleGridApi',
        required: true,
      },
    ],
    properties: [
      // ------------------------------------------------------------------
      //  Resource
      // ------------------------------------------------------------------
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Tool',
            value: 'tool',
            description: 'Browse and search the SettleGrid tool marketplace',
          },
          {
            name: 'Registry',
            value: 'registry',
            description: 'Query the MCP sub-registry of published servers',
          },
        ],
        default: 'tool',
      },

      // ------------------------------------------------------------------
      //  Tool operations
      // ------------------------------------------------------------------
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['tool'],
          },
        },
        options: [
          {
            name: 'List Tools',
            value: 'listTools',
            description: 'Search and list tools in the marketplace',
            action: 'List tools',
          },
          {
            name: 'Get Tool',
            value: 'getTool',
            description: 'Get detailed information about a specific tool by slug',
            action: 'Get tool',
          },
          {
            name: 'List Categories',
            value: 'listCategories',
            description: 'List all tool categories with their counts',
            action: 'List categories',
          },
        ],
        default: 'listTools',
      },

      // ------------------------------------------------------------------
      //  Registry operations
      // ------------------------------------------------------------------
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['registry'],
          },
        },
        options: [
          {
            name: 'List Servers',
            value: 'listServers',
            description: 'List MCP servers with optional filters',
            action: 'List servers',
          },
          {
            name: 'Get Server',
            value: 'getServer',
            description: 'Get the latest version of a specific MCP server',
            action: 'Get server',
          },
        ],
        default: 'listServers',
      },

      // ------------------------------------------------------------------
      //  Parameters: List Tools
      // ------------------------------------------------------------------
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        description: 'Search tools by name, description, or slug',
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['listTools'],
          },
        },
      },
      {
        displayName: 'Category',
        name: 'category',
        type: 'options',
        default: '',
        description: 'Filter by category slug',
        options: [
          { name: 'All Categories', value: '' },
          { name: 'Data & APIs', value: 'data' },
          { name: 'Natural Language Processing', value: 'nlp' },
          { name: 'Image & Vision', value: 'image' },
          { name: 'Code & Development', value: 'code' },
          { name: 'Search & Discovery', value: 'search' },
          { name: 'Finance & Payments', value: 'finance' },
          { name: 'Productivity', value: 'productivity' },
          { name: 'Analytics & BI', value: 'analytics' },
          { name: 'Security & Compliance', value: 'security' },
          { name: 'Other', value: 'other' },
        ],
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['listTools'],
          },
        },
      },
      {
        displayName: 'Sort By',
        name: 'sort',
        type: 'options',
        default: 'popular',
        description: 'How to sort the results',
        options: [
          { name: 'Most Popular', value: 'popular' },
          { name: 'Newest', value: 'newest' },
          { name: 'Name (A-Z)', value: 'name' },
        ],
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['listTools'],
          },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 100,
        },
        default: 20,
        description: 'Max number of results to return (1-100)',
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['listTools'],
          },
        },
      },
      {
        displayName: 'Offset',
        name: 'offset',
        type: 'number',
        typeOptions: {
          minValue: 0,
        },
        default: 0,
        description: 'Pagination offset',
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['listTools'],
          },
        },
      },

      // ------------------------------------------------------------------
      //  Parameters: Get Tool
      // ------------------------------------------------------------------
      {
        displayName: 'Tool Slug',
        name: 'slug',
        type: 'string',
        default: '',
        required: true,
        description: 'The unique slug identifier of the tool (e.g. "sentiment-analyzer")',
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['getTool'],
          },
        },
      },

      // ------------------------------------------------------------------
      //  Parameters: List Servers
      // ------------------------------------------------------------------
      {
        displayName: 'Search',
        name: 'search',
        type: 'string',
        default: '',
        description: 'Search servers by name, description, or slug',
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['listServers'],
          },
        },
      },
      {
        displayName: 'Category',
        name: 'serverCategory',
        type: 'options',
        default: '',
        description: 'Filter by category slug',
        options: [
          { name: 'All Categories', value: '' },
          { name: 'Data & APIs', value: 'data' },
          { name: 'Natural Language Processing', value: 'nlp' },
          { name: 'Image & Vision', value: 'image' },
          { name: 'Code & Development', value: 'code' },
          { name: 'Search & Discovery', value: 'search' },
          { name: 'Finance & Payments', value: 'finance' },
          { name: 'Productivity', value: 'productivity' },
          { name: 'Analytics & BI', value: 'analytics' },
          { name: 'Security & Compliance', value: 'security' },
          { name: 'Other', value: 'other' },
        ],
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['listServers'],
          },
        },
      },
      {
        displayName: 'Tag',
        name: 'tag',
        type: 'string',
        default: '',
        description: 'Filter by exact tag match',
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['listServers'],
          },
        },
      },
      {
        displayName: 'Verified Only',
        name: 'verified',
        type: 'boolean',
        default: false,
        description: 'Whether to only return verified servers',
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['listServers'],
          },
        },
      },
      {
        displayName: 'Limit',
        name: 'serverLimit',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 100,
        },
        default: 20,
        description: 'Max number of results to return (1-100)',
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['listServers'],
          },
        },
      },
      {
        displayName: 'Cursor',
        name: 'cursor',
        type: 'string',
        default: '',
        description: 'Opaque pagination cursor from a previous response',
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['listServers'],
          },
        },
      },

      // ------------------------------------------------------------------
      //  Parameters: Get Server
      // ------------------------------------------------------------------
      {
        displayName: 'Server Name',
        name: 'serverName',
        type: 'string',
        default: '',
        required: true,
        description: 'The MCP server name, e.g. "ai.settlegrid/my-tool"',
        displayOptions: {
          show: {
            resource: ['registry'],
            operation: ['getServer'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('settleGridApi');
    const baseUrl = ((credentials.baseUrl as string) || 'https://settlegrid.ai').replace(
      /\/$/,
      '',
    );
    const apiKey = credentials.apiKey as string;

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData: IDataObject | IDataObject[];

        // ----------------------------------------------------------------
        //  Tool: List Tools
        // ----------------------------------------------------------------
        if (resource === 'tool' && operation === 'listTools') {
          const query = this.getNodeParameter('query', i, '') as string;
          const category = this.getNodeParameter('category', i, '') as string;
          const sort = this.getNodeParameter('sort', i, 'popular') as string;
          const limit = this.getNodeParameter('limit', i, 20) as number;
          const offset = this.getNodeParameter('offset', i, 0) as number;

          const qs: IDataObject = { limit, offset, sort };
          if (query) qs.q = query;
          if (category) qs.category = category;

          responseData = await settleGridApiRequest.call(
            this,
            'GET',
            `${baseUrl}/api/v1/discover`,
            apiKey,
            qs,
          );
        }

        // ----------------------------------------------------------------
        //  Tool: Get Tool
        // ----------------------------------------------------------------
        else if (resource === 'tool' && operation === 'getTool') {
          const slug = this.getNodeParameter('slug', i) as string;

          responseData = await settleGridApiRequest.call(
            this,
            'GET',
            `${baseUrl}/api/tools/public/${encodeURIComponent(slug)}`,
            apiKey,
          );
        }

        // ----------------------------------------------------------------
        //  Tool: List Categories
        // ----------------------------------------------------------------
        else if (resource === 'tool' && operation === 'listCategories') {
          responseData = await settleGridApiRequest.call(
            this,
            'GET',
            `${baseUrl}/api/v1/discover/categories`,
            apiKey,
          );
        }

        // ----------------------------------------------------------------
        //  Registry: List Servers
        // ----------------------------------------------------------------
        else if (resource === 'registry' && operation === 'listServers') {
          const search = this.getNodeParameter('search', i, '') as string;
          const serverCategory = this.getNodeParameter('serverCategory', i, '') as string;
          const tag = this.getNodeParameter('tag', i, '') as string;
          const verified = this.getNodeParameter('verified', i, false) as boolean;
          const serverLimit = this.getNodeParameter('serverLimit', i, 20) as number;
          const cursor = this.getNodeParameter('cursor', i, '') as string;

          const qs: IDataObject = { limit: serverLimit };
          if (search) qs.search = search;
          if (serverCategory) qs.category = serverCategory;
          if (tag) qs.tag = tag;
          if (verified) qs.verified = 'true';
          if (cursor) qs.cursor = cursor;

          responseData = await settleGridApiRequest.call(
            this,
            'GET',
            `${baseUrl}/api/v0.1/servers`,
            apiKey,
            qs,
          );
        }

        // ----------------------------------------------------------------
        //  Registry: Get Server
        // ----------------------------------------------------------------
        else if (resource === 'registry' && operation === 'getServer') {
          const serverName = this.getNodeParameter('serverName', i) as string;

          responseData = await settleGridApiRequest.call(
            this,
            'GET',
            `${baseUrl}/api/v0.1/servers/${encodeURIComponent(serverName)}/versions/latest`,
            apiKey,
          );
        }

        // ----------------------------------------------------------------
        //  Unknown — should never happen
        // ----------------------------------------------------------------
        else {
          throw new NodeApiError(this.getNode(), {
            message: `Unknown resource/operation: ${resource}/${operation}`,
            description: 'This combination is not supported by the SettleGrid node.',
          });
        }

        // Normalize response — if it's an array, push each item; otherwise push the object
        if (Array.isArray(responseData)) {
          for (const item of responseData) {
            returnData.push({ json: item });
          }
        } else {
          returnData.push({ json: responseData });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

/**
 * Make an authenticated HTTP request to the SettleGrid API.
 */
async function settleGridApiRequest(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  url: string,
  apiKey: string,
  qs?: IDataObject,
  body?: IDataObject,
): Promise<IDataObject> {
  const options: IHttpRequestOptions = {
    method,
    url,
    headers: {
      'x-api-key': apiKey,
      Accept: 'application/json',
    },
    json: true,
  };

  if (qs && Object.keys(qs).length > 0) {
    options.qs = qs;
  }

  if (body && Object.keys(body).length > 0) {
    options.body = body;
  }

  try {
    const response = await this.helpers.httpRequest(options);
    return response as IDataObject;
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject, {
      message: 'SettleGrid API request failed',
    });
  }
}
