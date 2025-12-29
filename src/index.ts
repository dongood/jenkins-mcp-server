#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { JenkinsClient } from "./jenkins-client.js";

// Get configuration from environment variables
const config = {
  baseUrl: process.env.JENKINS_URL || "",
  username: process.env.JENKINS_USERNAME || "",
  apiToken: process.env.JENKINS_API_TOKEN || "",
};

// Validate configuration
if (!config.baseUrl) {
  console.error("Error: JENKINS_URL environment variable is required");
  process.exit(1);
}

if (!config.username || !config.apiToken) {
  console.error(
    "Warning: JENKINS_USERNAME and JENKINS_API_TOKEN not set. Authentication may fail."
  );
}

// Initialize Jenkins client
const jenkinsClient = new JenkinsClient(config);

// Create MCP server
const server = new Server(
  {
    name: "jenkins",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools = [
  {
    name: "jenkins_health_check",
    description: "Test Jenkins server connectivity and authentication",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "jenkins_list_jobs",
    description: "List all Jenkins jobs with their current status",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "jenkins_get_job_status",
    description: "Get detailed status and information about a specific Jenkins job",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
      },
      required: ["jobName"],
    },
  },
  {
    name: "jenkins_get_build_details",
    description: "Get detailed information about a specific build of a Jenkins job",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
        buildNumber: {
          type: "number",
          description: "The build number to retrieve",
        },
      },
      required: ["jobName", "buildNumber"],
    },
  },
  {
    name: "jenkins_get_latest_build",
    description: "Get the most recent build information for a Jenkins job",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
      },
      required: ["jobName"],
    },
  },
  {
    name: "jenkins_get_build_console",
    description: "Get the console output (logs) from a specific build",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
        buildNumber: {
          type: "number",
          description: "The build number to retrieve logs for",
        },
      },
      required: ["jobName", "buildNumber"],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "jenkins_health_check": {
        const result = await jenkinsClient.healthCheck();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_list_jobs": {
        const result = await jenkinsClient.listJobs();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_job_status": {
        const jobName = (args as { jobName: string }).jobName;
        if (!jobName) {
          throw new Error("jobName is required");
        }
        const result = await jenkinsClient.getJobStatus(jobName);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_build_details": {
        const { jobName, buildNumber } = args as {
          jobName: string;
          buildNumber: number;
        };
        if (!jobName || buildNumber === undefined) {
          throw new Error("jobName and buildNumber are required");
        }
        const result = await jenkinsClient.getBuildDetails(jobName, buildNumber);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_latest_build": {
        const jobName = (args as { jobName: string }).jobName;
        if (!jobName) {
          throw new Error("jobName is required");
        }
        const result = await jenkinsClient.getLatestBuild(jobName);
        if (!result) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ message: "No builds found for this job" }),
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_build_console": {
        const { jobName, buildNumber } = args as {
          jobName: string;
          buildNumber: number;
        };
        if (!jobName || buildNumber === undefined) {
          throw new Error("jobName and buildNumber are required");
        }
        const result = await jenkinsClient.getBuildConsoleOutput(
          jobName,
          buildNumber
        );

        // Truncate if too long (keep first and last portions)
        const maxLines = 3000;
        const lines = result.split("\n");

        let output = result;
        if (lines.length > maxLines) {
          const firstHalf = lines.slice(0, maxLines / 2).join("\n");
          const lastHalf = lines.slice(-maxLines / 2).join("\n");
          output = `${firstHalf}\n\n... [${lines.length - maxLines} lines truncated] ...\n\n${lastHalf}`;
        }

        return {
          content: [{ type: "text", text: output }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jenkins MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
