/* -------------------------------------------------------------------------- */
/*  Integration Guide Data                                                     */
/*  Static content for the /learn/integrations guide series.                   */
/* -------------------------------------------------------------------------- */

export interface IntegrationGuide {
  slug: string
  title: string
  description: string
  framework: string
  language: 'typescript' | 'python' | 'both'
  steps: { heading: string; content: string }[]
  codeExamples: { title: string; language: string; code: string }[]
  keywords: string[]
  icon: string // SVG path (stroke, 24x24 viewBox)
}

export const INTEGRATION_GUIDES: IntegrationGuide[] = [
  /* ── 1. smolagents ──────────────────────────────────────────────────────── */
  {
    slug: 'smolagents',
    title: 'Use SettleGrid Tools with Hugging Face smolagents',
    description:
      'smolagents natively supports MCP via ToolCollection.from_mcp(). This guide shows how to point smolagents at SettleGrid\'s discovery server to discover, purchase, and use paid AI tools directly from your Python agents.',
    framework: 'smolagents',
    language: 'python',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    keywords: [
      'smolagents SettleGrid',
      'Hugging Face MCP',
      'smolagents MCP tools',
      'smolagents paid tools',
      'Python AI agent MCP',
      'smolagents tool collection',
      'Hugging Face agent marketplace',
    ],
    steps: [
      {
        heading: 'Install smolagents',
        content: `Install the smolagents package with MCP support. smolagents is Hugging Face's lightweight agent framework that supports MCP tool collections natively. Run \`pip install smolagents[mcp]\` to install the package with all MCP dependencies. You also need Python 3.10 or later.

If you do not have a SettleGrid account yet, sign up at settlegrid.ai/register to get your API key. You will need a consumer API key (starts with \`sg_\`) for the tools you want to use. Each tool on SettleGrid has its own API key, which you can generate from the tool's page in your dashboard.

Verify your installation by running \`python -c "from smolagents import ToolCollection; print('OK')"\`. If this succeeds, you are ready to connect smolagents to SettleGrid.`,
      },
      {
        heading: 'Configure MCP Connection to SettleGrid',
        content: `smolagents connects to MCP servers using the \`ToolCollection.from_mcp()\` method. SettleGrid's Discovery Server exposes tools via the MCP protocol, so you can point smolagents directly at it. The connection uses Server-Sent Events (SSE) transport, which smolagents supports out of the box.

Set up the connection with your SettleGrid API key. The Discovery Server URL is \`https://settlegrid.ai/api/mcp/sse\` and your API key goes in the headers. smolagents passes these headers automatically on every tool call, so SettleGrid can authenticate your requests and track billing.

You can optionally filter which tools smolagents discovers by passing query parameters to the SSE URL. For example, \`https://settlegrid.ai/api/mcp/sse?category=data\` only discovers data tools. This keeps your agent focused and prevents it from seeing irrelevant tools.`,
      },
      {
        heading: 'Run Your Agent',
        content: `Create a smolagents \`CodeAgent\` or \`ToolCallingAgent\` with your SettleGrid tools. The agent will see the tool descriptions surfaced by SettleGrid and can call any tool it needs. Each tool call is routed through the SettleGrid proxy, which handles authentication, metering, and billing automatically.

The agent works exactly like it does with any other MCP tool collection. You do not need to handle billing, authentication, or error retries — SettleGrid manages all of that. Your agent simply calls tools and gets results. If a tool call fails due to insufficient balance, SettleGrid returns a clear error message that the agent can interpret.

For production use, set up error handling around your agent runs. If your SettleGrid balance runs out, tool calls will return 402 errors. Your application should catch these and either top up the balance automatically (via the SettleGrid API) or notify the user that more funds are needed.`,
      },
      {
        heading: 'View Billing in Your Dashboard',
        content: `After your agent runs, visit the SettleGrid dashboard at settlegrid.ai/dashboard to see every tool call, its cost, and the response time. The dashboard shows real-time usage metrics, daily spend, and per-tool breakdowns. You can set spending alerts to get notified when your usage exceeds a threshold.

Each invocation is logged with the tool name, input (redacted for privacy), cost in cents, latency, and status. You can export this data as CSV for accounting or integrate it with your observability stack via the SettleGrid API.

smolagents does not need any special configuration for billing — it is handled entirely by the SettleGrid proxy. The per-call cost is determined by the tool's pricing configuration, and you only pay for successful calls. Failed calls (upstream errors, timeouts) are not charged.`,
      },
    ],
    codeExamples: [
      {
        title: 'Connect smolagents to SettleGrid',
        language: 'python',
        code: `from smolagents import ToolCollection, CodeAgent, HfApiModel

# Connect to SettleGrid's MCP discovery server
tools = ToolCollection.from_mcp(
    "https://settlegrid.ai/api/mcp/sse",
    headers={"x-api-key": "sg_your_api_key_here"}
)

# Create an agent with discovered tools
model = HfApiModel("Qwen/Qwen2.5-Coder-32B-Instruct")
agent = CodeAgent(tools=tools, model=model)

# Run the agent — tool calls are billed automatically
result = agent.run("What is the current weather in Tokyo?")
print(result)`,
      },
      {
        title: 'Filter tools by category',
        language: 'python',
        code: `from smolagents import ToolCollection, ToolCallingAgent, HfApiModel

# Only discover data tools
tools = ToolCollection.from_mcp(
    "https://settlegrid.ai/api/mcp/sse?category=data",
    headers={"x-api-key": "sg_your_api_key_here"}
)

# List available tools
for tool in tools:
    print(f"{tool.name}: {tool.description}")

# Create agent and run queries
model = HfApiModel("Qwen/Qwen2.5-Coder-32B-Instruct")
agent = ToolCallingAgent(tools=tools, model=model)
result = agent.run("Enrich the company domain example.com")
print(result)`,
      },
    ],
  },

  /* ── 2. LangChain ───────────────────────────────────────────────────────── */
  {
    slug: 'langchain',
    title: 'Use SettleGrid Tools in LangChain Agents',
    description:
      'Install the langchain-settlegrid package, discover monetized tools from the SettleGrid marketplace, and pass them to any LangChain agent. Full TypeScript and Python examples included.',
    framework: 'LangChain',
    language: 'both',
    icon: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
    keywords: [
      'LangChain SettleGrid',
      'LangChain MCP tools',
      'LangChain paid tools',
      'langchain-settlegrid',
      'LangChain tool marketplace',
      'LangChain agent billing',
      'TypeScript AI agent tools',
    ],
    steps: [
      {
        heading: 'Install the Package',
        content: `Install the \`langchain-settlegrid\` package alongside LangChain core. Run \`npm install langchain-settlegrid @langchain/core\` for TypeScript or \`pip install langchain-settlegrid langchain-core\` for Python. The package has a single peer dependency on \`@langchain/core\` version 0.1.0 or later.

If you do not have a SettleGrid account, sign up at settlegrid.ai/register. You need a consumer API key (starts with \`sg_\`) for each tool you want to use. Generate keys from the tool's page in your SettleGrid dashboard — each key is scoped to a single tool for security.

The package exports two main classes: \`SettleGridToolkit\` for discovering tools, and \`SettleGridTool\` for wrapping individual tools. Both integrate natively with LangChain's tool interface, so discovered tools work with any LangChain agent, chain, or executor.`,
      },
      {
        heading: 'Initialize the Toolkit and Discover Tools',
        content: `Create a \`SettleGridToolkit\` instance with your API key. The toolkit provides a \`discoverTools()\` method that queries the SettleGrid Discovery API and returns an array of LangChain \`Tool\` objects. Each tool is ready to use — its name, description, and call method are all wired up.

You can discover tools by keyword (e.g., "weather", "sentiment"), by category (e.g., "data", "nlp"), or both. The Discovery API returns tool metadata including pricing, ratings, and developer information. The toolkit converts this metadata into LangChain tools with descriptions that help the LLM choose the right tool.

If you already know which tool you want, skip discovery and use \`toolkit.createTool(slug, description)\` to create a tool directly. This is useful for hardcoded integrations where you always want a specific tool.`,
      },
      {
        heading: 'Create an Agent with SettleGrid Tools',
        content: `Pass the discovered tools to any LangChain agent. The tools work with \`createToolCallingAgent\`, \`createReactAgent\`, \`AgentExecutor\`, and any other LangChain agent type. The LLM sees the tool descriptions from SettleGrid and decides when to call each tool based on the user's query.

When the agent calls a tool, the \`SettleGridTool._call()\` method sends the request to SettleGrid's proxy at \`/api/proxy/{slug}\`. The proxy authenticates the request, checks your balance, forwards to the upstream tool, records the invocation, and deducts the cost from your balance. All of this happens transparently — the agent just gets the tool's response.

For multi-tool workflows, discover tools from multiple categories and pass them all to the agent. The agent will select the appropriate tool based on the query. SettleGrid handles billing for each tool independently, so you can mix tools from different developers with different pricing models in the same agent.`,
      },
      {
        heading: 'Run Queries and Handle Billing',
        content: `Run your agent with any query and the tools will be called as needed. After each tool call, you can access billing metadata on the tool instance via \`tool.lastInvocationMeta\`. This includes the cost in cents and the round-trip latency in milliseconds.

For production applications, implement balance monitoring. The SettleGrid API provides endpoints to check your current balance, set up auto-reload (via Stripe), and configure spending alerts. You can also set hard spending limits per tool to prevent runaway costs in agent loops.

Handle billing errors gracefully. If your balance is insufficient, the proxy returns a 402 status with a clear error message including the required and available amounts. Your application should catch this error and either top up the balance or inform the user. The \`SettleGridTool\` throws an \`Error\` with the upstream status and message, which LangChain's error handling can catch and retry.`,
      },
      {
        heading: 'View Usage in the Dashboard',
        content: `Every tool call made by your LangChain agent is logged in the SettleGrid dashboard at settlegrid.ai/dashboard. The dashboard shows invocation history, cost per call, latency percentiles, error rates, and daily spend trends. You can filter by tool, date range, and status.

Export your usage data via the SettleGrid API for integration with your analytics stack. The \`GET /api/v1/invocations\` endpoint returns detailed records for each call, including the tool slug, cost, latency, status, and timestamp. This data is useful for cost attribution in multi-tenant applications.

Set up webhook notifications for billing events. SettleGrid can notify your application when your balance drops below a threshold, when a payment fails, or when a tool's pricing changes. Configure webhooks in your dashboard settings to automate balance management and alerting.`,
      },
    ],
    codeExamples: [
      {
        title: 'TypeScript: Discover and use tools',
        language: 'typescript',
        code: `import { SettleGridToolkit } from 'langchain-settlegrid'
import { ChatOpenAI } from '@langchain/openai'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { ChatPromptTemplate } from '@langchain/core/prompts'

// Initialize toolkit
const toolkit = new SettleGridToolkit({
  apiKey: process.env.SETTLEGRID_API_KEY!,
})

// Discover tools by keyword
const tools = await toolkit.discoverTools('weather')

// Create a LangChain agent with discovered tools
const llm = new ChatOpenAI({ model: 'gpt-4o' })
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant with access to real-time tools.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
])

const agent = createToolCallingAgent({ llm, tools, prompt })
const executor = new AgentExecutor({ agent, tools })

const result = await executor.invoke({
  input: 'What is the weather in Tokyo right now?',
})
console.log(result.output)

// Check billing metadata for the last tool call
for (const tool of tools) {
  if (tool.lastInvocationMeta) {
    console.log(\`\${tool.name}: \${tool.lastInvocationMeta.costCents}c\`)
  }
}`,
      },
      {
        title: 'TypeScript: Direct tool creation',
        language: 'typescript',
        code: `import { SettleGridToolkit } from 'langchain-settlegrid'

const toolkit = new SettleGridToolkit({
  apiKey: process.env.SETTLEGRID_API_KEY!,
})

// Create a tool directly when you know the slug
const weatherTool = toolkit.createTool(
  'weather-lookup',
  'Get current weather conditions for any city worldwide',
  5 // 5 cents per call
)

// Use the tool directly
const result = await weatherTool.invoke('{"city": "New York"}')
console.log(result)
console.log('Cost:', weatherTool.lastInvocationMeta?.costCents, 'cents')`,
      },
      {
        title: 'Python: LangChain with SettleGrid',
        language: 'python',
        code: `from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
import requests

# Discover tools from SettleGrid
def discover_settlegrid_tools(api_key: str, query: str = ""):
    resp = requests.get(
        "https://settlegrid.ai/api/v1/discover",
        params={"q": query, "limit": "10"},
    )
    data = resp.json()["data"]["tools"]

    tools = []
    for t in data:
        def make_call(slug, key):
            def call(input_str: str) -> str:
                r = requests.post(
                    f"https://settlegrid.ai/api/proxy/{slug}",
                    json={"input": input_str},
                    headers={"x-api-key": key},
                )
                return r.text
            return call

        tools.append(Tool(
            name=t["slug"],
            description=t["description"],
            func=make_call(t["slug"], api_key),
        ))
    return tools

# Discover and create agent
tools = discover_settlegrid_tools("sg_your_api_key", "weather")
llm = ChatOpenAI(model="gpt-4o")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools)

result = executor.invoke({"input": "Weather in London?"})
print(result["output"])`,
      },
    ],
  },

  /* ── 3. CrewAI ──────────────────────────────────────────────────────────── */
  {
    slug: 'crewai',
    title: 'Use SettleGrid Tools with CrewAI',
    description:
      'CrewAI natively supports MCP tool providers. Configure a CrewAI agent with SettleGrid as its MCP tool source to give your crew access to paid, production-grade AI tools with automatic billing.',
    framework: 'CrewAI',
    language: 'python',
    icon: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
    keywords: [
      'CrewAI SettleGrid',
      'CrewAI MCP tools',
      'CrewAI paid tools',
      'CrewAI tool provider',
      'CrewAI agent marketplace',
      'CrewAI billing',
      'multi-agent MCP tools',
    ],
    steps: [
      {
        heading: 'Install CrewAI',
        content: `Install CrewAI with its tools extension. Run \`pip install crewai crewai-tools\` to get the full package with MCP support. CrewAI requires Python 3.10 or later. The \`crewai-tools\` package includes the MCP client that connects to SettleGrid.

Sign up for a SettleGrid account at settlegrid.ai/register if you do not have one. You need a consumer API key (starts with \`sg_\`) for each tool your crew will use. Generate keys from your dashboard — each key is scoped to a single tool for security and billing isolation.

Verify your installation by running \`python -c "from crewai import Agent, Task, Crew; print('OK')"\`. CrewAI's MCP support is built into the core framework, so no additional plugins are needed.`,
      },
      {
        heading: 'Configure MCP Connection',
        content: `CrewAI connects to MCP tool providers via its tool configuration. Create an MCP server configuration that points to SettleGrid's discovery server. The server URL is \`https://settlegrid.ai/api/mcp/sse\` and your API key is passed as a header.

The MCP configuration tells CrewAI where to discover tools, how to authenticate, and which transport to use. SettleGrid uses SSE (Server-Sent Events) transport, which CrewAI supports natively. Once configured, CrewAI discovers all available tools at startup and makes them available to your agents.

You can scope the discovery to specific categories by adding query parameters to the SSE URL. For example, \`https://settlegrid.ai/api/mcp/sse?category=code\` only discovers code analysis tools. This is useful for focused crews where you want agents to only see relevant tools.`,
      },
      {
        heading: 'Create Agents with SettleGrid Tools',
        content: `Define your CrewAI agents and assign SettleGrid tools to them. Each agent gets a role, goal, and backstory that guide its behavior. The tools are passed directly to the agent, and the agent uses them based on its goal and the task it is assigned.

CrewAI's multi-agent architecture works well with SettleGrid because different agents can use different tools. A research agent might use data enrichment tools, while an analysis agent uses NLP tools. Each tool is billed independently through SettleGrid, so you get granular cost tracking per agent and per task.

For crews with multiple agents sharing the same tools, assign the tools at the crew level rather than the agent level. This is more efficient because CrewAI only discovers the tools once and shares them across all agents in the crew.`,
      },
      {
        heading: 'Create Tasks and Run the Crew',
        content: `Define tasks for your crew and kick off execution. Each task has a description, expected output format, and an assigned agent. When the agent works on a task, it calls SettleGrid tools as needed. The billing is handled automatically — you do not need to manage API keys, balances, or metering in your task code.

CrewAI supports sequential, parallel, and hierarchical task execution. All modes work with SettleGrid tools. In sequential mode, agents execute tasks one at a time. In parallel mode, multiple agents can call SettleGrid tools simultaneously — the proxy handles concurrent requests without issues.

For long-running crews, monitor your SettleGrid balance. If an agent's tool call fails with a 402 (insufficient balance), CrewAI's error handling will surface the error in the task result. Set up auto-reload in your SettleGrid dashboard to prevent balance interruptions during crew runs.`,
      },
      {
        heading: 'View Billing and Optimize',
        content: `After your crew finishes, visit the SettleGrid dashboard at settlegrid.ai/dashboard to review all tool calls. The dashboard shows each invocation with its cost, latency, and the tool that was called. You can filter by date range to see costs for a specific crew run.

Use the dashboard data to optimize your crew's tool usage. If one agent is making redundant tool calls, refine its role description or add explicit instructions to cache results. If a tool is consistently slow, consider switching to a faster alternative from the marketplace. If costs are higher than expected, check whether agents are calling tools unnecessarily.

Export your usage data via the API for cost attribution. If you run crews for multiple clients, the invocation records include metadata that lets you attribute costs to specific runs. This is useful for billing your own customers for the AI tool costs incurred on their behalf.`,
      },
    ],
    codeExamples: [
      {
        title: 'CrewAI with SettleGrid MCP tools',
        language: 'python',
        code: `from crewai import Agent, Task, Crew
from crewai_tools import MCPServerAdapter

# Connect to SettleGrid's MCP discovery server
mcp_server = MCPServerAdapter(
    server_url="https://settlegrid.ai/api/mcp/sse",
    headers={"x-api-key": "sg_your_api_key_here"},
)
settlegrid_tools = mcp_server.tools

# Create agents with SettleGrid tools
researcher = Agent(
    role="Research Analyst",
    goal="Gather accurate real-time data using available tools",
    backstory="You are an expert research analyst with access to "
              "premium data tools via SettleGrid.",
    tools=settlegrid_tools,
    verbose=True,
)

writer = Agent(
    role="Content Writer",
    goal="Create clear, well-structured reports from research data",
    backstory="You are a skilled writer who turns raw data into "
              "actionable insights.",
    verbose=True,
)

# Define tasks
research_task = Task(
    description="Research the current weather conditions and "
                "air quality in Tokyo, Japan.",
    expected_output="A structured summary of weather and air quality data.",
    agent=researcher,
)

report_task = Task(
    description="Write a brief report based on the research findings.",
    expected_output="A 200-word report with key findings and recommendations.",
    agent=writer,
)

# Run the crew
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, report_task],
    verbose=True,
)
result = crew.kickoff()
print(result)`,
      },
      {
        title: 'Category-filtered tool discovery',
        language: 'python',
        code: `from crewai import Agent, Task, Crew
from crewai_tools import MCPServerAdapter

# Only discover NLP tools
nlp_server = MCPServerAdapter(
    server_url="https://settlegrid.ai/api/mcp/sse?category=nlp",
    headers={"x-api-key": "sg_your_api_key_here"},
)

# Only discover data tools
data_server = MCPServerAdapter(
    server_url="https://settlegrid.ai/api/mcp/sse?category=data",
    headers={"x-api-key": "sg_your_data_key_here"},
)

# Assign different tool sets to different agents
nlp_agent = Agent(
    role="NLP Specialist",
    goal="Analyze text sentiment and extract entities",
    backstory="Expert in natural language processing.",
    tools=nlp_server.tools,
)

data_agent = Agent(
    role="Data Analyst",
    goal="Enrich and validate data from external sources",
    backstory="Expert in data enrichment and validation.",
    tools=data_server.tools,
)

# Create tasks and run the crew
analysis = Task(
    description="Analyze the sentiment of this review: "
                "'The product exceeded my expectations.'",
    expected_output="Sentiment score and key entities.",
    agent=nlp_agent,
)

crew = Crew(agents=[nlp_agent, data_agent], tasks=[analysis])
result = crew.kickoff()
print(result)`,
      },
    ],
  },
  /* ── 4. n8n ─────────────────────────────────────────────────────────────── */
  {
    slug: 'n8n',
    title: 'Use SettleGrid Tools in n8n Workflows',
    description:
      'Install the n8n-nodes-settlegrid community node to discover, browse, and invoke SettleGrid tools directly from your n8n visual automations. No code required.',
    framework: 'n8n',
    language: 'typescript',
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
    keywords: [
      'n8n SettleGrid',
      'n8n MCP tools',
      'n8n community node',
      'n8n AI tools',
      'n8n-nodes-settlegrid',
      'n8n automation billing',
      'no-code AI tools',
    ],
    steps: [
      {
        heading: 'Install the Community Node',
        content: `Install the n8n-nodes-settlegrid community node in your n8n instance. Go to Settings > Community Nodes and search for "settlegrid", or install manually via \`npm install n8n-nodes-settlegrid\` in your n8n installation directory.

If you are using n8n Cloud, community nodes can be installed from the Settings panel. For self-hosted n8n, restart your instance after installation for the node to appear in the node palette.

The SettleGrid node appears under the "AI" category in the n8n node palette. You will need a SettleGrid API key to use it — sign up at settlegrid.ai/register if you do not have one.`,
      },
      {
        heading: 'Configure Credentials',
        content: `Add your SettleGrid API key as a credential in n8n. Go to Credentials > New Credential > SettleGrid API and enter your consumer API key (starts with \`sg_\`). This key will be used for all SettleGrid node operations in your workflows.

The credential is stored securely in n8n and passed automatically to every SettleGrid node in your workflows. You only need to configure it once.`,
      },
      {
        heading: 'Add SettleGrid Nodes to Your Workflow',
        content: `Drag the SettleGrid node from the palette into your workflow canvas. The node supports five operations:

- **List Tools** — Browse all available SettleGrid tools with optional category filtering
- **Get Tool** — Retrieve full details for a specific tool by its slug
- **List Categories** — Get all tool categories with tool counts
- **List Servers** — Browse MCP server listings from the registry
- **Get Server** — Get detailed MCP server information with pricing extensions

Connect the SettleGrid node to other nodes in your workflow to build AI-powered automations. For example, use List Tools to discover tools, then pass the results to an HTTP Request node to invoke them.`,
      },
      {
        heading: 'Build AI Automation Workflows',
        content: `Combine SettleGrid nodes with n8n's 400+ other integrations to build powerful AI workflows. Common patterns include:

- **Scheduled discovery**: Use a Cron node to periodically check for new tools in a category, then notify your team via Slack when new tools appear.
- **Tool invocation pipelines**: Use the Get Tool node to fetch tool details, then an HTTP Request node to call the tool via SettleGrid's proxy endpoint.
- **Cost monitoring**: Query your SettleGrid usage data and send alerts when spending exceeds thresholds.

All tool invocations through the SettleGrid proxy are metered and billed automatically. View your usage in the SettleGrid dashboard at settlegrid.ai/dashboard.`,
      },
    ],
    codeExamples: [
      {
        title: 'Install via npm',
        language: 'bash',
        code: `npm install n8n-nodes-settlegrid`,
      },
      {
        title: 'n8n workflow JSON (List Tools)',
        language: 'json',
        code: `{
  "nodes": [
    {
      "name": "SettleGrid",
      "type": "n8n-nodes-settlegrid.settlegrid",
      "parameters": {
        "operation": "listTools",
        "category": "data",
        "limit": 10
      }
    }
  ]
}`,
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const INTEGRATION_SLUGS = INTEGRATION_GUIDES.map((g) => g.slug)

export function getIntegrationGuideBySlug(
  slug: string
): IntegrationGuide | undefined {
  return INTEGRATION_GUIDES.find((g) => g.slug === slug)
}
