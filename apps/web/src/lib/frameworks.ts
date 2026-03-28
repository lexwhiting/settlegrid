/**
 * Canonical framework definitions for programmatic SEO pages.
 *
 * Used by:
 *   - /tools/[slug]/with/[framework]   (tool × framework integration pages)
 *   - /explore/for/[framework]          (best tools for framework pages)
 *   - sitemap.ts                        (auto-generated sitemap entries)
 */

export interface FrameworkDefinition {
  slug: string
  name: string
  language: string
  description: string
  installCommand: string
  /** Template for generating a code example. Placeholders: {{toolSlug}}, {{toolName}} */
  codeTemplate: string
}

export const FRAMEWORKS: FrameworkDefinition[] = [
  {
    slug: 'langchain',
    name: 'LangChain',
    language: 'Python/TypeScript',
    description:
      'LangChain is the leading framework for building applications powered by language models. It provides modular abstractions for chains, agents, and tool use.',
    installCommand: 'pip install langchain langchain-community',
    codeTemplate: `from langchain.tools import StructuredTool
from langchain.agents import AgentExecutor, create_openai_tools_agent
import requests

def call_{{toolSlug}}_tool(**kwargs) -> str:
    """Call {{toolName}} via SettleGrid."""
    resp = requests.post(
        "https://proxy.settlegrid.ai/v1/{{toolSlug}}",
        headers={
            "x-api-key": "sg_live_your_key_here",
            "Content-Type": "application/json",
        },
        json=kwargs,
    )
    resp.raise_for_status()
    return resp.json()

# Wrap as a LangChain tool
{{toolSlug}}_tool = StructuredTool.from_function(
    func=call_{{toolSlug}}_tool,
    name="{{toolSlug}}",
    description="{{toolName}} — call via SettleGrid",
)

# Use in an agent
agent = create_openai_tools_agent(llm, [{{toolSlug}}_tool], prompt)
executor = AgentExecutor(agent=agent, tools=[{{toolSlug}}_tool])
result = executor.invoke({"input": "your query here"})`,
  },
  {
    slug: 'crewai',
    name: 'CrewAI',
    language: 'Python',
    description:
      'CrewAI is a framework for orchestrating autonomous AI agents that collaborate on complex tasks. It supports role-based agent design with custom tools.',
    installCommand: 'pip install crewai crewai-tools',
    codeTemplate: `from crewai import Agent, Task, Crew
from crewai_tools import BaseTool
import requests

class {{toolName}}Tool(BaseTool):
    name: str = "{{toolSlug}}"
    description: str = "{{toolName}} — call via SettleGrid"

    def _run(self, query: str) -> str:
        resp = requests.post(
            "https://proxy.settlegrid.ai/v1/{{toolSlug}}",
            headers={
                "x-api-key": "sg_live_your_key_here",
                "Content-Type": "application/json",
            },
            json={"query": query},
        )
        resp.raise_for_status()
        return resp.json()

# Create agent with the tool
agent = Agent(
    role="Analyst",
    goal="Use {{toolName}} to accomplish the task",
    tools=[{{toolName}}Tool()],
    verbose=True,
)

task = Task(
    description="Use {{toolName}} to process the input",
    expected_output="Processed result",
    agent=agent,
)

crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()`,
  },
  {
    slug: 'smolagents',
    name: 'smolagents',
    language: 'Python',
    description:
      'smolagents is Hugging Face\'s lightweight framework for building AI agents with minimal boilerplate. It emphasizes simplicity and tool composition.',
    installCommand: 'pip install smolagents',
    codeTemplate: `from smolagents import Tool, CodeAgent, HfApiModel
import requests

class {{toolName}}Tool(Tool):
    name = "{{toolSlug}}"
    description = "{{toolName}} — call via SettleGrid"
    inputs = {"query": {"type": "string", "description": "Input query"}}
    output_type = "string"

    def forward(self, query: str) -> str:
        resp = requests.post(
            "https://proxy.settlegrid.ai/v1/{{toolSlug}}",
            headers={
                "x-api-key": "sg_live_your_key_here",
                "Content-Type": "application/json",
            },
            json={"query": query},
        )
        resp.raise_for_status()
        return str(resp.json())

# Create agent with the tool
model = HfApiModel()
agent = CodeAgent(tools=[{{toolName}}Tool()], model=model)
result = agent.run("Use {{toolName}} to process this input")`,
  },
  {
    slug: 'autogen',
    name: 'AutoGen',
    language: 'Python',
    description:
      'AutoGen is Microsoft\'s framework for building multi-agent conversational systems. Agents can use tools registered as Python functions.',
    installCommand: 'pip install pyautogen',
    codeTemplate: `import autogen
import requests

# Define the tool function
def call_{{toolSlug}}(query: str) -> str:
    """Call {{toolName}} via SettleGrid.

    Args:
        query: Input to send to the tool.

    Returns:
        The tool response as a string.
    """
    resp = requests.post(
        "https://proxy.settlegrid.ai/v1/{{toolSlug}}",
        headers={
            "x-api-key": "sg_live_your_key_here",
            "Content-Type": "application/json",
        },
        json={"query": query},
    )
    resp.raise_for_status()
    return str(resp.json())

# Set up agents
assistant = autogen.AssistantAgent("assistant", llm_config=llm_config)
user_proxy = autogen.UserProxyAgent(
    "user_proxy",
    human_input_mode="NEVER",
    code_execution_config=False,
)

# Register the tool
assistant.register_for_llm(
    name="{{toolSlug}}",
    description="{{toolName}} — call via SettleGrid",
)(call_{{toolSlug}})
user_proxy.register_for_execution(name="{{toolSlug}}")(call_{{toolSlug}})

user_proxy.initiate_chat(assistant, message="Use {{toolName}} for this task")`,
  },
  {
    slug: 'semantic-kernel',
    name: 'Semantic Kernel',
    language: 'C#/Python',
    description:
      'Semantic Kernel is Microsoft\'s SDK for integrating large language models into applications. It provides a plugin architecture for tool registration.',
    installCommand: 'pip install semantic-kernel',
    codeTemplate: `import requests
from semantic_kernel import Kernel
from semantic_kernel.functions import kernel_function

class {{toolName}}Plugin:
    """SettleGrid plugin for {{toolName}}."""

    @kernel_function(
        name="{{toolSlug}}",
        description="{{toolName}} — call via SettleGrid",
    )
    def invoke(self, query: str) -> str:
        resp = requests.post(
            "https://proxy.settlegrid.ai/v1/{{toolSlug}}",
            headers={
                "x-api-key": "sg_live_your_key_here",
                "Content-Type": "application/json",
            },
            json={"query": query},
        )
        resp.raise_for_status()
        return str(resp.json())

# Register the plugin
kernel = Kernel()
kernel.add_plugin({{toolName}}Plugin(), plugin_name="{{toolSlug}}")

# Invoke directly
result = await kernel.invoke(
    plugin_name="{{toolSlug}}",
    function_name="{{toolSlug}}",
    query="your input here",
)`,
  },
  {
    slug: 'mastra',
    name: 'Mastra',
    language: 'TypeScript',
    description:
      'Mastra is a TypeScript-first framework for building AI agents and workflows. It provides type-safe tool definitions and composable agent pipelines.',
    installCommand: 'npm install mastra',
    codeTemplate: `import { Agent, createTool } from "mastra";
import { z } from "zod";

// Define the tool with Zod schema
const {{toolSlug}}Tool = createTool({
  id: "{{toolSlug}}",
  description: "{{toolName}} — call via SettleGrid",
  inputSchema: z.object({
    query: z.string().describe("Input query"),
  }),
  execute: async ({ context }) => {
    const resp = await fetch(
      "https://proxy.settlegrid.ai/v1/{{toolSlug}}",
      {
        method: "POST",
        headers: {
          "x-api-key": "sg_live_your_key_here",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: context.query }),
      }
    );
    if (!resp.ok) throw new Error(\`{{toolName}} failed: \${resp.status}\`);
    return resp.json();
  },
});

// Create an agent with the tool
const agent = new Agent({
  name: "{{toolSlug}}-agent",
  instructions: "Use {{toolName}} to accomplish the task.",
  model: { provider: "OPEN_AI", name: "gpt-4o" },
  tools: { {{toolSlug}}: {{toolSlug}}Tool },
});

const result = await agent.generate("Use {{toolName}} for this input");`,
  },
]

export const FRAMEWORK_SLUGS = FRAMEWORKS.map((f) => f.slug)

export function getFrameworkBySlug(slug: string): FrameworkDefinition | undefined {
  return FRAMEWORKS.find((f) => f.slug === slug)
}

/**
 * Generate a framework-specific code example for a given tool.
 */
export function generateCodeExample(
  framework: FrameworkDefinition,
  toolSlug: string,
  toolName: string,
): string {
  // Sanitize toolSlug to be a valid identifier (replace hyphens with underscores)
  const safeSlug = toolSlug.replace(/-/g, '_')
  // Sanitize toolName to be a valid class/identifier name (remove spaces, hyphens)
  const safeName = toolName.replace(/[^a-zA-Z0-9]/g, '')

  return framework.codeTemplate
    .replace(/\{\{toolSlug\}\}/g, safeSlug)
    .replace(/\{\{toolName\}\}/g, safeName)
}
