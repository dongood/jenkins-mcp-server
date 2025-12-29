# Jenkins MCP Server Implementation Plan

## Overview

Create an MCP server that enables Claude to communicate with Jenkins, exposing core operations for job and build management.

## Scope

- **Operations**: Core operations only (no build triggers or job management)
- **AI Analysis**: None (simple, raw Jenkins data exposure)
- **Authentication**: Environment variables

## Project Structure

```
jenkins-mcp-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── types.ts              # TypeScript interfaces
│   └── jenkins-client.ts     # Jenkins API client
├── package.json
├── tsconfig.json
└── README.md
```

## Files to Create

### 1. `package.json`

- Dependencies: `@modelcontextprotocol/sdk`, `axios`
- Dev dependencies: `typescript`, `@types/node`
- ES modules configuration (`"type": "module"`)
- Scripts: build, start

### 2. `tsconfig.json`

- Target: ES2020
- Module: ES2020
- Strict mode enabled
- Output to `build/` directory

### 3. `src/types.ts`

TypeScript interfaces (based on amt-api patterns):

```typescript
interface JenkinsBuild {
  number: number;
  url: string;
  result: string | null;
  timestamp: number;
  duration: number;
  displayName: string;
}

interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  lastBuild?: { number: number; url: string };
}
```

### 4. `src/jenkins-client.ts`

Jenkins API client with methods:

- `healthCheck()` - Test connectivity
- `listJobs()` - Get all jobs
- `getJobStatus(jobName)` - Get job details
- `getBuildDetails(jobName, buildNumber)` - Get specific build
- `getLatestBuild(jobName)` - Get most recent build
- `getBuildConsoleOutput(jobName, buildNumber)` - Get build logs

Authentication pattern from amt-api:

```typescript
const auth = Buffer.from(`${username}:${apiToken}`).toString("base64");
headers["Authorization"] = `Basic ${auth}`;
```

### 5. `src/index.ts`

MCP server with 6 tools:

| Tool                        | Description               | Parameters                             |
| --------------------------- | ------------------------- | -------------------------------------- |
| `jenkins_health_check`      | Test Jenkins connectivity | None                                   |
| `jenkins_list_jobs`         | List all Jenkins jobs     | None                                   |
| `jenkins_get_job_status`    | Get job details           | `jobName: string`                      |
| `jenkins_get_build_details` | Get specific build info   | `jobName: string, buildNumber: number` |
| `jenkins_get_latest_build`  | Get most recent build     | `jobName: string`                      |
| `jenkins_get_build_console` | Get build console output  | `jobName: string, buildNumber: number` |

### 6. `README.md`

Documentation with:

- Installation instructions
- Environment variable configuration
- Claude Desktop setup
- Tool descriptions

## Environment Variables

```
JENKINS_URL=https://your-jenkins-server.com
JENKINS_USERNAME=your-username
JENKINS_API_TOKEN=your-api-token
```

## Implementation Steps

1. Initialize project with `package.json` and `tsconfig.json`
2. Create TypeScript interfaces in `types.ts`
3. Implement Jenkins API client in `jenkins-client.ts`
4. Create MCP server with tool registrations in `index.ts`
5. Add README with setup instructions
6. Build and test

## Key Patterns from amt-api

- URL encoding: `encodeURIComponent(jobName)` for job names
- Timeouts: 5s for health checks, 10s for API calls
- Tree parameter optimization: `?tree=lastBuild[number,url,result,timestamp,duration,displayName]`
- Error handling: Special messages for 401/403 errors
- Logging: Use `console.error()` only (stdout reserved for JSON-RPC)

## API Endpoints Used

```
GET /api/json                              - Health check / list jobs
GET /job/{jobName}/api/json                - Job status
GET /job/{jobName}/{buildNumber}/api/json  - Build details
GET /job/{jobName}/{buildNumber}/consoleText - Console output
```
