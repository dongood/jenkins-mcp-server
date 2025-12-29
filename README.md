# Jenkins MCP Server

An MCP (Model Context Protocol) server that enables Claude to communicate with Jenkins CI/CD servers.

## Features

- Health check for Jenkins connectivity
- List and search Jenkins jobs
- Get detailed job status and build information
- Retrieve build console output (logs)
- Get test results summary with failed test names
- View pipeline stage information
- Check build queue status
- Monitor build agent/node health
- Compare builds to investigate regressions
- Optimized tools for fast failure analysis

## Installation

```bash
npm install
npm run build
```

## Configuration

The server requires these environment variables:

- `JENKINS_URL` - Your Jenkins server URL (e.g., `https://jenkins.example.com`)
- `JENKINS_USERNAME` - Your Jenkins username
- `JENKINS_API_TOKEN` - Your Jenkins API token

**Note:** When using Claude Desktop or Claude Code, set these in the JSON config file (see setup sections below). You only need to export them in your shell for manual testing.

### Getting a Jenkins API Token

1. Log in to your Jenkins server
2. Click on your username in the top right
3. Click "Configure"
4. Under "API Token", click "Add new Token"
5. Give it a name and click "Generate"
6. Copy the token (you won't be able to see it again)

## Claude Desktop Setup

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "node",
      "args": ["/absolute/path/to/jenkins-mcp-server/build/index.js"],
      "env": {
        "JENKINS_URL": "https://your-jenkins-server.com",
        "JENKINS_USERNAME": "your-username",
        "JENKINS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

**Important**: Use absolute paths, not relative paths.

After updating the configuration, fully quit Claude Desktop (Cmd+Q on macOS) and reopen it.

## Claude Code Setup

Add a `.mcp.json` file to your project root (or `~/.claude/settings.json` for global access):

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "node",
      "args": ["/absolute/path/to/jenkins-mcp-server/build/index.js"],
      "env": {
        "JENKINS_URL": "https://your-jenkins-server.com",
        "JENKINS_USERNAME": "your-username",
        "JENKINS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

After adding the config, restart Claude Code (`exit` then `claude`).

## Available Tools

### Core Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `jenkins_health_check` | Test Jenkins server connectivity | None |
| `jenkins_list_jobs` | List all Jenkins jobs with full details | None |
| `jenkins_get_job_status` | Get detailed status for a specific job | `jobName` |
| `jenkins_get_build_details` | Get detailed info for a specific build | `jobName`, `buildNumber` |
| `jenkins_get_latest_build` | Get the most recent build for a job | `jobName` |
| `jenkins_get_build_console` | Get console output (logs) from a build | `jobName`, `buildNumber` |

### Optimized Tools (Faster for Common Queries)

| Tool | Description | Parameters |
|------|-------------|------------|
| `jenkins_list_jobs_summary` | Compact job list with status - faster than full list | None |
| `jenkins_get_failed_jobs` | Get all failures within a time window | `hoursAgo` (default: 24) |
| `jenkins_get_recent_failures_summary` | Quick failure count and list | `hoursAgo` (default: 24) |

### Analysis Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `jenkins_get_test_results` | Get test pass/fail counts and failed test names | `jobName`, `buildNumber` |
| `jenkins_get_pipeline_stages` | Get pipeline stage breakdown (which stage failed) | `jobName`, `buildNumber` |
| `jenkins_compare_builds` | Compare two builds (result, duration changes) | `jobName`, `buildNumber1`, `buildNumber2` |

### Infrastructure Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `jenkins_get_queue_status` | See what's waiting to build and why | None |
| `jenkins_get_node_status` | Check build agent health (online/offline) | None |
| `jenkins_search_jobs` | Search jobs by pattern (`*` and `?` wildcards) | `pattern` |

## Usage Examples

Once configured, you can ask Claude:

**Failure Analysis:**
- "What Jenkins jobs failed in the last 24 hours?"
- "Analyze the console output for job my-app build #42 and identify the root cause"
- "What tests failed in build #42 of my-app?"
- "Which pipeline stage failed in the latest build?"

**Status Checks:**
- "Is Jenkins healthy?"
- "Give me a quick overview of all jobs"
- "What's the status of the my-app job?"
- "What's currently building or waiting in the queue?"

**Investigation:**
- "Compare build #41 and #42 of my-app - what changed?"
- "Find all jobs matching cfg-deploy-*"
- "Are all build agents online?"

**Build Details:**
- "Show me the latest build for my-app"
- "Get the console output for build #42"

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server (for testing)
npm start
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## License

MIT
