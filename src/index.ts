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
    description: "Get the console output (logs) from a specific build. By default truncates middle of large logs. Use tailLines to get only the last N lines (recommended for debugging failures).",
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
        tailLines: {
          type: "number",
          description: "If set, return only the last N lines of the log. Useful for seeing recent output/errors without middle truncation.",
        },
      },
      required: ["jobName", "buildNumber"],
    },
  },
  {
    name: "jenkins_search_build_console",
    description:
      "Search the console output of a build for a pattern (regex). Returns matching lines with surrounding context. Use this to find specific errors, exceptions, or keywords in large logs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
        buildNumber: {
          type: "number",
          description: "The build number to search",
        },
        pattern: {
          type: "string",
          description: "Regex pattern to search for (e.g., 'ERROR', 'Exception', 'FAILED')",
        },
        contextLines: {
          type: "number",
          description: "Number of lines to show before and after each match (default: 5)",
        },
        maxMatches: {
          type: "number",
          description: "Maximum number of matches to return (default: 50)",
        },
      },
      required: ["jobName", "buildNumber", "pattern"],
    },
  },
  // NEW OPTIMIZED TOOLS
  {
    name: "jenkins_get_failed_jobs",
    description:
      "Get all jobs that have failed within a time window. Use this for questions like 'what jobs failed in the last 24 hours?' - much faster than listing all jobs and checking each one.",
    inputSchema: {
      type: "object" as const,
      properties: {
        hoursAgo: {
          type: "number",
          description: "Time window in hours (default: 24). E.g., 24 for last day, 168 for last week.",
        },
      },
      required: [],
    },
  },
  {
    name: "jenkins_get_recent_failures_summary",
    description:
      "Get a quick, compact summary of recent build failures. Returns total count and list of failed jobs. Ideal for quick status checks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        hoursAgo: {
          type: "number",
          description: "Time window in hours (default: 24)",
        },
      },
      required: [],
    },
  },
  {
    name: "jenkins_list_jobs_summary",
    description:
      "Get a compact list of all jobs with their current status (success/failure/building). Faster and smaller than full job list. Use this for quick overviews.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ADDITIONAL TOOLS
  {
    name: "jenkins_get_test_results",
    description:
      "Get test results summary for a build including pass/fail counts and failed test names. Use this to quickly see what tests failed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
        buildNumber: {
          type: "number",
          description: "The build number to get test results for",
        },
      },
      required: ["jobName", "buildNumber"],
    },
  },
  {
    name: "jenkins_get_pipeline_stages",
    description:
      "Get pipeline stage information for a build, showing which stages passed/failed and their durations. Use this to identify which stage failed in a Pipeline job.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins Pipeline job",
        },
        buildNumber: {
          type: "number",
          description: "The build number",
        },
      },
      required: ["jobName", "buildNumber"],
    },
  },
  {
    name: "jenkins_get_queue_status",
    description:
      "Get the current build queue showing what jobs are waiting to run and why. Use this for 'what's building?' or 'why is my build waiting?' questions.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "jenkins_search_jobs",
    description:
      "Search for jobs matching a pattern. Supports wildcards: * (any chars) and ? (single char). E.g., 'cfg-*' or '*-deploy-*'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Search pattern with wildcards (* for any chars, ? for single char)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "jenkins_get_node_status",
    description:
      "Get status of all Jenkins build agents/nodes showing which are online, offline, or idle. Use for infrastructure health checks.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "jenkins_compare_builds",
    description:
      "Compare two builds of the same job to see what changed (result, duration). Useful for investigating regressions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobName: {
          type: "string",
          description: "The name of the Jenkins job",
        },
        buildNumber1: {
          type: "number",
          description: "First build number to compare",
        },
        buildNumber2: {
          type: "number",
          description: "Second build number to compare",
        },
      },
      required: ["jobName", "buildNumber1", "buildNumber2"],
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
        const { jobName, buildNumber, tailLines } = args as {
          jobName: string;
          buildNumber: number;
          tailLines?: number;
        };
        if (!jobName || buildNumber === undefined) {
          throw new Error("jobName and buildNumber are required");
        }
        const result = await jenkinsClient.getBuildConsoleOutput(
          jobName,
          buildNumber
        );

        const lines = result.split("\n");
        let output: string;

        if (tailLines && tailLines > 0) {
          // Tail mode: return only the last N lines
          const tailOutput = lines.slice(-tailLines).join("\n");
          const skipped = lines.length - tailLines;
          if (skipped > 0) {
            output = `[Showing last ${tailLines} of ${lines.length} lines (${skipped} lines skipped)]\n\n${tailOutput}`;
          } else {
            output = tailOutput;
          }
        } else {
          // Default: truncate middle if too long (keep first and last portions)
          const maxLines = 3000;
          if (lines.length > maxLines) {
            const firstHalf = lines.slice(0, maxLines / 2).join("\n");
            const lastHalf = lines.slice(-maxLines / 2).join("\n");
            output = `${firstHalf}\n\n... [${lines.length - maxLines} lines truncated] ...\n\n${lastHalf}`;
          } else {
            output = result;
          }
        }

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "jenkins_search_build_console": {
        const { jobName, buildNumber, pattern, contextLines = 5, maxMatches = 50 } = args as {
          jobName: string;
          buildNumber: number;
          pattern: string;
          contextLines?: number;
          maxMatches?: number;
        };
        if (!jobName || buildNumber === undefined || !pattern) {
          throw new Error("jobName, buildNumber, and pattern are required");
        }

        const result = await jenkinsClient.getBuildConsoleOutput(jobName, buildNumber);
        const lines = result.split("\n");

        let regex: RegExp;
        try {
          regex = new RegExp(pattern, "i");
        } catch {
          throw new Error(`Invalid regex pattern: ${pattern}`);
        }

        interface Match {
          lineNumber: number;
          matchedLine: string;
          context: string[];
        }

        const matches: Match[] = [];
        const usedLineRanges: Set<number> = new Set();

        for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
          if (regex.test(lines[i])) {
            // Check if this line is already included in a previous match's context
            if (usedLineRanges.has(i)) continue;

            const startLine = Math.max(0, i - contextLines);
            const endLine = Math.min(lines.length - 1, i + contextLines);

            const contextBlock: string[] = [];
            for (let j = startLine; j <= endLine; j++) {
              const prefix = j === i ? ">>> " : "    ";
              contextBlock.push(`${prefix}${j + 1}: ${lines[j]}`);
              usedLineRanges.add(j);
            }

            matches.push({
              lineNumber: i + 1,
              matchedLine: lines[i],
              context: contextBlock,
            });
          }
        }

        const totalLines = lines.length;
        const summary = {
          pattern,
          totalMatches: matches.length,
          totalLines,
          truncated: matches.length >= maxMatches,
          matches: matches.map((m) => ({
            line: m.lineNumber,
            context: m.context.join("\n"),
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
      }

      // NEW OPTIMIZED TOOLS
      case "jenkins_get_failed_jobs": {
        const hoursAgo = (args as { hoursAgo?: number }).hoursAgo ?? 24;
        const result = await jenkinsClient.getFailedJobs(hoursAgo);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_recent_failures_summary": {
        const hoursAgo = (args as { hoursAgo?: number }).hoursAgo ?? 24;
        const result = await jenkinsClient.getRecentFailuresSummary(hoursAgo);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_list_jobs_summary": {
        const result = await jenkinsClient.listJobsSummary();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // ADDITIONAL TOOL HANDLERS
      case "jenkins_get_test_results": {
        const { jobName, buildNumber } = args as {
          jobName: string;
          buildNumber: number;
        };
        if (!jobName || buildNumber === undefined) {
          throw new Error("jobName and buildNumber are required");
        }
        const result = await jenkinsClient.getTestResults(jobName, buildNumber);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_pipeline_stages": {
        const { jobName, buildNumber } = args as {
          jobName: string;
          buildNumber: number;
        };
        if (!jobName || buildNumber === undefined) {
          throw new Error("jobName and buildNumber are required");
        }
        const result = await jenkinsClient.getPipelineStages(jobName, buildNumber);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_queue_status": {
        const result = await jenkinsClient.getBuildQueueStatus();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_search_jobs": {
        const pattern = (args as { pattern: string }).pattern;
        if (!pattern) {
          throw new Error("pattern is required");
        }
        const result = await jenkinsClient.searchJobs(pattern);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_get_node_status": {
        const result = await jenkinsClient.getNodeStatus();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "jenkins_compare_builds": {
        const { jobName, buildNumber1, buildNumber2 } = args as {
          jobName: string;
          buildNumber1: number;
          buildNumber2: number;
        };
        if (!jobName || buildNumber1 === undefined || buildNumber2 === undefined) {
          throw new Error("jobName, buildNumber1, and buildNumber2 are required");
        }
        const result = await jenkinsClient.compareBuilds(
          jobName,
          buildNumber1,
          buildNumber2
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
