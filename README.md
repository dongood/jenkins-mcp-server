# Jenkins MCP Server

An MCP (Model Context Protocol) server that enables Claude to communicate with Jenkins CI/CD servers.

## Features

- Health check for Jenkins connectivity
- List all Jenkins jobs
- Get detailed job status and information
- Get build details for specific builds
- Get latest build information
- Retrieve build console output (logs)

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

```bash
export JENKINS_URL=https://your-jenkins-server.com
export JENKINS_USERNAME=your-username
export JENKINS_API_TOKEN=your-api-token
```

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

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `jenkins_health_check` | Test Jenkins server connectivity | None |
| `jenkins_list_jobs` | List all Jenkins jobs | None |
| `jenkins_get_job_status` | Get detailed job status | `jobName: string` |
| `jenkins_get_build_details` | Get specific build info | `jobName: string`, `buildNumber: number` |
| `jenkins_get_latest_build` | Get most recent build | `jobName: string` |
| `jenkins_get_build_console` | Get build console output | `jobName: string`, `buildNumber: number` |

## Usage Examples

Once configured, you can ask Claude:

- "Check if Jenkins is healthy"
- "List all Jenkins jobs"
- "What's the status of the 'my-app-build' job?"
- "Show me the latest build for 'my-app-build'"
- "Get the console output for build #42 of 'my-app-build'"

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
