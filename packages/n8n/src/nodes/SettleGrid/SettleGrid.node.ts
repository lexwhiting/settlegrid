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
          {
            name: 'Invoke Tool',
            value: 'invokeTool',
            description:
              'Invoke a monetized tool by slug via the SettleGrid billing proxy',
            action: 'Invoke tool',
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
      //  Parameters: Get Tool / Invoke Tool (shared `slug`)
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
            operation: ['getTool', 'invokeTool'],
          },
        },
      },

      // ------------------------------------------------------------------
      //  Parameters: Invoke Tool
      // ------------------------------------------------------------------
      {
        displayName: 'Method',
        name: 'invokeMethod',
        type: 'string',
        default: '',
        description:
          'Optional method / sub-operation name passed to the tool (e.g. "search", "summarize"). Leave blank if the tool has a single entry point.',
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['invokeTool'],
          },
        },
      },
      {
        displayName: 'Arguments (JSON)',
        name: 'invokeArgs',
        type: 'json',
        default: '{}',
        description:
          'JSON object of arguments to pass to the tool. Use expressions to thread data from prior nodes.',
        displayOptions: {
          show: {
            resource: ['tool'],
            operation: ['invokeTool'],
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
        //  Tool: Invoke Tool (P2.FMT4)
        //
        //  POSTs to the SettleGrid billing proxy at /api/proxy/{slug}.
        //  The proxy validates the key, meters the invocation, forwards
        //  to the upstream tool, and returns the response.
        // ----------------------------------------------------------------
        else if (resource === 'tool' && operation === 'invokeTool') {
          const slug = this.getNodeParameter('slug', i) as string;
          if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
            throw new NodeApiError(this.getNode(), {
              message: 'Tool Slug is required for Invoke Tool.',
            });
          }
          const invokeMethod = this.getNodeParameter('invokeMethod', i, '') as string;
          const rawArgs = this.getNodeParameter('invokeArgs', i, '{}');
          const body = parseInvokeArgs.call(this, rawArgs);
          if (invokeMethod) body.method = invokeMethod;

          responseData = await settleGridApiRequest.call(
            this,
            'POST',
            `${baseUrl}/api/proxy/${encodeURIComponent(slug)}`,
            apiKey,
            undefined,
            body,
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
    const status = extractHttpStatus(error);
    const { message, description } = mapSettleGridError(status, error);
    throw new NodeApiError(this.getNode(), error as JsonObject, {
      message,
      description,
      httpCode: status ? String(status) : undefined,
    });
  }
}

/**
 * Pull the HTTP status off whichever shape n8n's httpRequest surfaced.
 * n8n wraps axios-style errors — it may expose `httpCode`, `statusCode`,
 * or `response.status`. Returns undefined if the error is not HTTP-shaped
 * (network failures, DNS, timeouts, etc.).
 */
function extractHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as {
    httpCode?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown; statusCode?: unknown };
  };
  const candidates = [
    e.httpCode,
    e.statusCode,
    e.response?.status,
    e.response?.statusCode,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string') {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

/**
 * Map SettleGrid-specific HTTP status codes to actionable n8n error
 * messages. The spec (P2.FMT4) calls out 402 / 401 explicitly.
 */
function mapSettleGridError(
  status: number | undefined,
  _err: unknown,
): { message: string; description?: string } {
  if (status === 401) {
    return {
      message: 'Invalid or missing SettleGrid API key',
      description:
        'The API key on the SettleGrid credential was rejected. Check the key in n8n Credentials > SettleGrid API, or generate a new one at settlegrid.ai/dashboard.',
    };
  }
  if (status === 402) {
    return {
      message: 'Insufficient SettleGrid credits',
      description:
        'The consumer balance is too low to cover this invocation. Top up at settlegrid.ai/dashboard or enable auto-reload.',
    };
  }
  if (status === 404) {
    return {
      message: 'SettleGrid tool not found',
      description:
        'The tool slug does not match a published marketplace tool. Check the slug or run List Tools to find the right one.',
    };
  }
  if (status === 429) {
    return {
      message: 'SettleGrid rate limit exceeded',
      description:
        'Slow down, retry after the Retry-After header elapses, or contact support for a limit increase.',
    };
  }
  if (typeof status === 'number' && status >= 500) {
    return {
      message: `SettleGrid upstream error (${status})`,
      description:
        'The SettleGrid proxy or the underlying tool returned a server error. Retry; if it persists, report the request ID to support@settlegrid.ai.',
    };
  }
  return { message: 'SettleGrid API request failed' };
}

/**
 * Coerce the node's `Arguments (JSON)` parameter — which may arrive as
 * a JSON string (user-typed) or an object (expression evaluation) —
 * into a plain IDataObject. Rejects arrays, primitives, and malformed
 * JSON with a NodeApiError at parse time (fail fast; don't let the
 * tool receive garbage).
 */
function parseInvokeArgs(
  this: IExecuteFunctions,
  raw: unknown,
): IDataObject {
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as IDataObject;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new NodeApiError(this.getNode(), {
          message: 'Arguments (JSON) must be a JSON object, not an array or primitive.',
        });
      }
      return parsed as IDataObject;
    } catch (err) {
      if (err instanceof NodeApiError) throw err;
      throw new NodeApiError(this.getNode(), {
        message: 'Arguments (JSON) is not valid JSON.',
        description: (err as Error).message,
      });
    }
  }
  throw new NodeApiError(this.getNode(), {
    message: 'Arguments (JSON) must be an object or a JSON string.',
  });
}
