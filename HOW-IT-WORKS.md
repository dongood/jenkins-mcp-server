# How the Jenkins MCP Server Works

This document explains the technical architecture and implementation details of the Jenkins MCP server.

## Table of Contents

- [How the Jenkins MCP Server Works](#how-the-jenkins-mcp-server-works)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Architecture](#architecture)
    - [Communication Layers](#communication-layers)
  - [Model Context Protocol (MCP)](#model-context-protocol-mcp)
    - [Server Capabilities](#server-capabilities)
    - [Request Types](#request-types)
    - [Message Format](#message-format)
  - [Core Components](#core-components)
    - [1. Server Initialization (`index.ts`)](#1-server-initialization-indexts)
      - [Phase 1: Configuration](#phase-1-configuration)
      - [Phase 2: MCP Server Setup](#phase-2-mcp-server-setup)
      - [Phase 3: Tool Registration](#phase-3-tool-registration)
    - [2. JenkinsClient (`jenkins-client.ts`)](#2-jenkinsclient-jenkins-clientts)
      - [Authentication](#authentication)
      - [API Abstraction](#api-abstraction)
    - [3. Type System (`types.ts`)](#3-type-system-typests)
  - [Authentication Flow](#authentication-flow)
    - [Security Considerations](#security-considerations)
  - [Tool Execution Flow](#tool-execution-flow)
    - [1. Claude Invokes Tool](#1-claude-invokes-tool)
    - [2. MCP Request](#2-mcp-request)
    - [3. Request Handler](#3-request-handler)
    - [4. Jenkins API Call](#4-jenkins-api-call)
    - [5. Response Processing](#5-response-processing)
    - [6. Claude Processes Result](#6-claude-processes-result)
  - [Jenkins API Integration](#jenkins-api-integration)
    - [API Endpoints Used](#api-endpoints-used)
    - [Tree Parameter Optimization](#tree-parameter-optimization)
    - [Color to Status Mapping](#color-to-status-mapping)
  - [Error Handling](#error-handling)
    - [Three-Layer Strategy](#three-layer-strategy)
      - [1. HTTP Layer (axios)](#1-http-layer-axios)
      - [2. Application Layer (JenkinsClient)](#2-application-layer-jenkinsclient)
      - [3. MCP Layer (index.ts)](#3-mcp-layer-indexts)
    - [Safe Error Serialization](#safe-error-serialization)
  - [Performance Optimizations](#performance-optimizations)
    - [1. Optimized Tools](#1-optimized-tools)
    - [2. Time-Windowed Queries](#2-time-windowed-queries)
    - [3. Console Log Handling](#3-console-log-handling)
    - [4. Search Instead of Full Retrieval](#4-search-instead-of-full-retrieval)
  - [Data Flow Example](#data-flow-example)
  - [Key Design Decisions](#key-design-decisions)
    - [1. Why stdio transport?](#1-why-stdio-transport)
    - [2. Why separate JenkinsClient class?](#2-why-separate-jenkinsclient-class)
    - [3. Why JSON responses instead of formatted text?](#3-why-json-responses-instead-of-formatted-text)
    - [4. Why not stream console logs?](#4-why-not-stream-console-logs)
  - [Extending the Server](#extending-the-server)
    - [Adding a New Tool](#adding-a-new-tool)
  - [Troubleshooting](#troubleshooting)
    - [Server not connecting to Jenkins](#server-not-connecting-to-jenkins)
    - [Tools returning 401/403](#tools-returning-401403)
    - [Slow responses](#slow-responses)
  - [Security Best Practices](#security-best-practices)
  - [Conclusion](#conclusion)

## Overview

The Jenkins MCP server is a bridge between Claude (Anthropic's AI assistant) and Jenkins CI/CD servers. It implements the Model Context Protocol (MCP) to expose Jenkins functionality as tools that Claude can use to query build information, analyze failures, and monitor CI/CD infrastructure.

**Key Technology Stack:**

- **TypeScript** - Type-safe implementation
- **@modelcontextprotocol/sdk** - MCP server framework
- **axios** - HTTP client for Jenkins API calls
- **Node.js** - Runtime environment

## Architecture

```
┌─────────────────┐
│  Claude Desktop │
│   or CLI        │
└────────┬────────┘
         │ stdio
         │ (JSON-RPC)
┌────────▼────────┐
│   MCP Server    │
│   (index.ts)    │
├─────────────────┤
│ Tool Handlers   │
│ Request Router  │
└────────┬────────┘
         │
┌────────▼────────┐
│ JenkinsClient   │
│ (HTTP Wrapper)  │
└────────┬────────┘
         │ HTTPS + Basic Auth
         │
┌────────▼────────┐
│ Jenkins Server  │
│   (REST API)    │
└─────────────────┘
```

### Communication Layers

1. **MCP Protocol Layer**: JSON-RPC over stdio
2. **Tool Layer**: Structured tool definitions and handlers
3. **Client Layer**: Jenkins API abstraction with authentication
4. **Network Layer**: HTTPS requests with retry logic

## Model Context Protocol (MCP)

MCP is Anthropic's protocol for connecting AI assistants to external systems. It defines:

### Server Capabilities

The server advertises its capabilities during initialization:

```typescript
{
  capabilities: {
    tools: {
    } // This server provides tools
  }
}
```

### Request Types

The server handles two main request types:

1. **ListTools** - Returns available tools with schemas
2. **CallTool** - Executes a specific tool with arguments

### Message Format

MCP uses JSON-RPC 2.0 over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "jenkins_get_job_status",
    "arguments": {
      "jobName": "my-app"
    }
  }
}
```

## Core Components

### 1. Server Initialization (`index.ts`)

The server bootstraps in three phases:

#### Phase 1: Configuration

```typescript
const config = {
  baseUrl: process.env.JENKINS_URL || "",
  username: process.env.JENKINS_USERNAME || "",
  apiToken: process.env.JENKINS_API_TOKEN || "",
};
```

Environment variables are read once at startup. Missing credentials trigger warnings but don't block server start (allowing unauthenticated public Jenkins instances).

#### Phase 2: MCP Server Setup

```typescript
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
```

Creates an MCP server instance with tool capabilities.

#### Phase 3: Tool Registration

Tools are defined with JSON Schema for input validation:

```typescript
{
  name: "jenkins_get_job_status",
  description: "Get detailed status and information about a specific Jenkins job",
  inputSchema: {
    type: "object",
    properties: {
      jobName: {
        type: "string",
        description: "The name of the Jenkins job",
      },
    },
    required: ["jobName"],
  },
}
```

This schema enables:

- **Client-side validation** - Claude validates inputs before calling
- **Auto-documentation** - Tools are self-documenting
- **Type safety** - MCP SDK validates against schema

### 2. JenkinsClient (`jenkins-client.ts`)

The client encapsulates all Jenkins API interactions.

#### Authentication

Uses HTTP Basic Authentication:

```typescript
private getAuthHeaders(): Record<string, string> {
  const auth = Buffer.from(`${this.username}:${this.apiToken}`).toString("base64");
  return {
    "Content-Type": "application/json",
    "Authorization": `Basic ${auth}`
  };
}
```

The API token is Jenkins-specific (not a password) and provides:

- Scoped permissions
- Revocability without password change
- Audit trail

#### API Abstraction

Each Jenkins API endpoint is wrapped in a typed method:

```typescript
async getJobStatus(jobName: string): Promise<JenkinsJobResponse> {
  const response = await axios.get(
    `${this.baseUrl}/job/${encodeURIComponent(jobName)}/api/json?tree=...`,
    { headers: this.getAuthHeaders(), timeout: 10000 }
  );
  return response.data;
}
```

The `tree` parameter filters the response to only include needed fields, reducing payload size.

### 3. Type System (`types.ts`)

TypeScript interfaces define the contract between:

- Jenkins API responses
- Internal data structures
- Tool return values

Example:

```typescript
export interface JenkinsBuild {
  number: number;
  url: string;
  result: string | null; // null for in-progress builds
  timestamp: number;
  duration: number;
  displayName: string;
}
```

This provides:

- Compile-time type checking
- IDE autocomplete
- Self-documenting code
- Runtime safety (when combined with validation)

## Authentication Flow

```
1. Server Start
   ├─ Read JENKINS_URL from env
   ├─ Read JENKINS_USERNAME from env
   └─ Read JENKINS_API_TOKEN from env

2. Tool Call Received
   ├─ Route to handler
   └─ Call JenkinsClient method

3. HTTP Request
   ├─ Encode credentials to Base64
   ├─ Add Authorization header
   └─ Send HTTPS request

4. Jenkins Server
   ├─ Verify credentials
   ├─ Check permissions
   └─ Return data or 401/403
```

### Security Considerations

1. **Credentials in Memory Only** - Never written to disk by the server
2. **HTTPS Required** - Credentials encrypted in transit
3. **Token-based** - Revocable without password change
4. **Least Privilege** - User should have minimal required permissions

## Tool Execution Flow

### 1. Claude Invokes Tool

Claude decides to call a tool based on user query:

```
User: "What's the status of my-app?"
Claude: [Decides to use jenkins_get_job_status tool]
```

### 2. MCP Request

MCP SDK serializes the tool call:

```json
{
  "method": "tools/call",
  "params": {
    "name": "jenkins_get_job_status",
    "arguments": { "jobName": "my-app" }
  }
}
```

### 3. Request Handler

The server's `CallToolRequestSchema` handler routes to the appropriate case:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "jenkins_get_job_status": {
      const jobName = (args as { jobName: string }).jobName;
      const result = await jenkinsClient.getJobStatus(jobName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  }
});
```

### 4. Jenkins API Call

JenkinsClient makes an authenticated HTTP request:

```typescript
const response = await axios.get(
  `https://jenkins.example.com/job/my-app/api/json?tree=name,color,lastBuild[...]`,
  { headers: { Authorization: "Basic ..." }, timeout: 10000 }
);
```

### 5. Response Processing

The response is:

1. Parsed from JSON
2. Validated against TypeScript types
3. Formatted for Claude
4. Returned via MCP

### 6. Claude Processes Result

Claude receives structured JSON and uses it to formulate a natural language response to the user.

## Jenkins API Integration

### API Endpoints Used

The server uses Jenkins' REST API with JSON responses:

| Endpoint                                | Purpose         | Tree Filter                                   |
| --------------------------------------- | --------------- | --------------------------------------------- |
| `/api/json`                             | List all jobs   | `jobs[name,url,color,lastBuild[...]]`         |
| `/job/{name}/api/json`                  | Job details     | `name,color,lastBuild[...],healthReport[...]` |
| `/job/{name}/{num}/api/json`            | Build details   | All fields                                    |
| `/job/{name}/{num}/consoleText`         | Console logs    | Raw text                                      |
| `/job/{name}/{num}/testReport/api/json` | Test results    | All fields                                    |
| `/job/{name}/{num}/wfapi/describe`      | Pipeline stages | All fields                                    |
| `/queue/api/json`                       | Build queue     | All fields                                    |
| `/computer/api/json`                    | Node status     | `computer[displayName,offline,...]`           |

### Tree Parameter Optimization

The `tree` parameter tells Jenkins to only include specified fields:

```
/api/json?tree=jobs[name,url,color]
```

This is critical for performance:

- **Without tree**: Returns all job data (potentially MBs)
- **With tree**: Returns only needed fields (KBs)

For a Jenkins instance with 1000 jobs:

- Full response: ~10MB, 5-10 seconds
- Filtered response: ~50KB, 0.5 seconds

### Color to Status Mapping

Jenkins uses "color" to indicate job status:

```typescript
private colorToStatus(color: string): JobSummary["status"] {
  const baseColor = color.replace("_anime", "");  // Remove "building" suffix

  switch (baseColor) {
    case "blue": return "success";
    case "red": return "failure";
    case "yellow": return "unstable";
    case "aborted": return "aborted";
    case "disabled": return "not_built";
    default: return "unknown";
  }
}
```

The `_anime` suffix indicates an in-progress build (animated icon in Jenkins UI).

## Error Handling

### Three-Layer Strategy

#### 1. HTTP Layer (axios)

```typescript
try {
  const response = await axios.get(url, { timeout: 10000 });
} catch (error) {
  // Network errors, timeouts, HTTP errors
}
```

#### 2. Application Layer (JenkinsClient)

```typescript
if (err.response?.status === 404) {
  throw new Error(`Job not found: ${jobName}`);
}
if (err.response?.status === 401) {
  throw new Error(`Authentication failed. Check credentials.`);
}
if (err.response?.status === 403) {
  throw new Error(`Access forbidden. User lacks permissions.`);
}
```

Translates HTTP status codes to user-friendly error messages.

#### 3. MCP Layer (index.ts)

```typescript
try {
  // Call tool handler
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
```

Ensures errors are always returned in valid MCP format.

### Safe Error Serialization

The `extractSafeError` method prevents sensitive data leakage:

```typescript
private extractSafeError(error: unknown): Record<string, unknown> {
  return {
    status: err.response?.status,      // HTTP status
    message: err.message,              // Error message
    code: err.code,                    // Error code (ECONNREFUSED, etc.)
    timestamp: new Date().toISOString() // When it happened
    // Excludes: raw response body, full config, authorization headers
  };
}
```

This logs detailed errors server-side while exposing only safe information to Claude.

## Performance Optimizations

### 1. Optimized Tools

Standard tools return full details. Optimized tools return summaries:

**Standard: `jenkins_list_jobs`**

- Returns full job details with health reports
- Response size: 5-10KB per job
- Use case: When you need detailed information

**Optimized: `jenkins_list_jobs_summary`**

- Returns only name, status, last build number/time
- Response size: 100-200 bytes per job
- Use case: Quick status overview

### 2. Time-Windowed Queries

`jenkins_get_failed_jobs(hoursAgo)` fetches recent builds in a single API call:

```typescript
// Instead of:
// 1. List all jobs
// 2. For each job, get recent builds (N requests)
// 3. Filter failed builds

// We do:
// 1. List all jobs with recent builds embedded (1 request)
const response = await axios.get(
  `${baseUrl}/api/json?tree=jobs[name,builds[number,result,timestamp]{0,10}]`
);
```

This reduces:

- API calls from N+1 to 1
- Latency from 5-30 seconds to <1 second
- Network traffic by 90%+

### 3. Console Log Handling

Console logs can be massive (100MB+). Two strategies:

**Tail Mode** (for debugging):

```typescript
if (tailLines > 0) {
  const lastLines = lines.slice(-tailLines);
  return `[Last ${tailLines} lines]\n${lastLines.join("\n")}`;
}
```

**Middle Truncation** (for overview):

```typescript
if (lines.length > maxLines) {
  const firstHalf = lines.slice(0, maxLines / 2);
  const lastHalf = lines.slice(-maxLines / 2);
  return `${firstHalf}\n... [truncated] ...\n${lastHalf}`;
}
```

This keeps Claude's context usage manageable while providing useful information.

### 4. Search Instead of Full Retrieval

`jenkins_search_build_console` uses regex to extract only relevant lines:

```typescript
// Download full log once
const fullLog = await getBuildConsoleOutput(jobName, buildNumber);

// Extract only matching lines with context
const matches = [];
for (let i = 0; i < lines.length; i++) {
  if (regex.test(lines[i])) {
    matches.push({
      line: i,
      context: lines.slice(i - contextLines, i + contextLines),
    });
  }
}
```

Returns <1% of total log content when searching for errors.

## Data Flow Example

Let's trace a complete request:

```
User Query: "What jobs failed in the last 24 hours?"

1. Claude decides to use: jenkins_get_failed_jobs

2. MCP Request:
   {
     "method": "tools/call",
     "params": {
       "name": "jenkins_get_failed_jobs",
       "arguments": { "hoursAgo": 24 }
     }
   }

3. Handler routes to case "jenkins_get_failed_jobs"

4. Calls: jenkinsClient.getFailedJobs(24)

5. JenkinsClient:
   a. Calculates cutoff: Date.now() - (24 * 60 * 60 * 1000)
   b. Requests: GET /api/json?tree=jobs[name,builds[...]{0,10}]
      Headers: { Authorization: "Basic <base64>" }
   c. Parses response
   d. Filters builds where:
      - timestamp >= cutoff
      - result === "FAILURE" or "UNSTABLE"
   e. Sorts by timestamp (newest first)

6. Returns: Array<FailedJobInfo>
   [
     {
       name: "backend-api",
       buildNumber: 142,
       timestamp: "2026-01-16T10:23:00Z",
       result: "FAILURE"
     },
     ...
   ]

7. Handler wraps in MCP format:
   {
     content: [
       { type: "text", text: JSON.stringify(result, null, 2) }
     ]
   }

8. MCP SDK sends response to Claude

9. Claude processes JSON and responds:
   "Two jobs failed in the last 24 hours:
    - backend-api (build #142) at 10:23 AM
    - frontend-app (build #89) at 2:14 PM"
```

## Key Design Decisions

### 1. Why stdio transport?

MCP uses stdio (standard input/output) instead of HTTP because:

- **Simpler security model**: No ports to expose, no TLS certificates
- **Process isolation**: Each server runs in its own sandboxed process
- **Built-in lifecycle**: Server stops when parent process exits
- **Lower latency**: No network stack overhead

### 2. Why separate JenkinsClient class?

Separates concerns:

- **index.ts**: MCP protocol handling (stable)
- **jenkins-client.ts**: Jenkins API logic (changes with API)
- Easier to test Jenkins API calls independently
- Could swap Jenkins for another CI system without touching MCP code

### 3. Why JSON responses instead of formatted text?

Claude can process structured data more reliably:

- Parse JSON to extract specific fields
- Combine multiple tool results
- Make decisions based on structured criteria

Human-readable text is generated by Claude, not the server.

### 4. Why not stream console logs?

MCP doesn't currently support streaming responses. Future enhancement could use MCP resources for streaming large content.

## Extending the Server

### Adding a New Tool

1. Define the tool in `index.ts`:

```typescript
{
  name: "jenkins_get_coverage",
  description: "Get code coverage metrics for a build",
  inputSchema: {
    type: "object",
    properties: {
      jobName: { type: "string" },
      buildNumber: { type: "number" }
    },
    required: ["jobName", "buildNumber"]
  }
}
```

2. Add the handler:

```typescript
case "jenkins_get_coverage": {
  const { jobName, buildNumber } = args;
  const result = await jenkinsClient.getCoverage(jobName, buildNumber);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

3. Implement in JenkinsClient:

```typescript
async getCoverage(jobName: string, buildNumber: number): Promise<CoverageReport> {
  const response = await axios.get(
    `${this.baseUrl}/job/${jobName}/${buildNumber}/coverage/api/json`,
    { headers: this.getAuthHeaders() }
  );
  return response.data;
}
```

4. Add types in `types.ts`:

```typescript
export interface CoverageReport {
  lineCoverage: number;
  branchCoverage: number;
  methodCoverage: number;
}
```

## Troubleshooting

### Server not connecting to Jenkins

Check:

1. `JENKINS_URL` format (should include `https://`)
2. Credentials validity (test with `curl`)
3. Network access (firewalls, VPN)
4. Jenkins CSRF protection settings

### Tools returning 401/403

Check:

1. API token is valid (regenerate if needed)
2. User has required permissions for the job
3. Jenkins authorization strategy (Matrix-based security, etc.)

### Slow responses

Check:

1. Jenkins instance performance
2. Network latency to Jenkins
3. Size of data being fetched (use optimized tools)
4. Jenkins load (concurrent builds)

## Security Best Practices

1. **Use dedicated Jenkins user** with minimal required permissions
2. **Store credentials securely** (environment variables, not code)
3. **Use HTTPS** for Jenkins URL
4. **Rotate API tokens periodically**
5. **Monitor MCP server logs** for suspicious activity
6. **Limit network access** to Jenkins from MCP server host
7. **Use read-only permissions** when possible

## Conclusion

The Jenkins MCP server is a well-architected bridge between Claude and Jenkins that:

- Uses MCP for standardized AI-system integration
- Abstracts Jenkins API complexity behind typed interfaces
- Handles errors gracefully with user-friendly messages
- Optimizes performance for large Jenkins instances
- Provides extensibility for new functionality

The three-layer architecture (MCP ↔ Client ↔ Jenkins) provides clean separation of concerns while maintaining type safety and error handling throughout the stack.
