import axios, { AxiosResponse } from "axios";
import {
  JenkinsBuild,
  JenkinsConfig,
  JenkinsJobResponse,
  JenkinsJobsResponse,
  JobSummary,
  FailedJobInfo,
  JenkinsJobWithBuilds,
  TestResultSummary,
  PipelineInfo,
  BuildQueueStatus,
  QueueItem,
  NodeStatus,
  JenkinsNode,
  BuildComparison,
} from "./types.js";

export class JenkinsClient {
  private baseUrl: string;
  private username: string;
  private apiToken: string;

  constructor(config: JenkinsConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.username = config.username;
    this.apiToken = config.apiToken;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.username && this.apiToken) {
      const auth = Buffer.from(`${this.username}:${this.apiToken}`).toString(
        "base64"
      );
      headers["Authorization"] = `Basic ${auth}`;
    }

    return headers;
  }

  private extractSafeError(
    error: unknown,
    context: string = ""
  ): Record<string, unknown> {
    const err = error as {
      response?: { status?: number; statusText?: string };
      message?: string;
      code?: string;
      config?: { url?: string; method?: string };
    };

    return {
      context,
      status: err.response?.status,
      statusText: err.response?.statusText,
      message: err.message,
      code: err.code,
      url: err.config?.url,
      method: err.config?.method?.toUpperCase(),
      timestamp: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      if (!this.baseUrl) {
        return { healthy: false, message: "No Jenkins base URL configured" };
      }

      const response = await axios.get(`${this.baseUrl}/api/json`, {
        headers: this.getAuthHeaders(),
        timeout: 5000,
      });

      if (response.status === 200) {
        return { healthy: true, message: "Jenkins is reachable" };
      }

      return {
        healthy: false,
        message: `Unexpected status: ${response.status}`,
      };
    } catch (error) {
      const safeError = this.extractSafeError(error, "healthCheck");
      console.error("Jenkins health check failed", safeError);
      return {
        healthy: false,
        message: `Health check failed: ${safeError.message}`,
      };
    }
  }

  async listJobs(): Promise<JenkinsJobsResponse> {
    try {
      const response: AxiosResponse<JenkinsJobsResponse> = await axios.get(
        `${this.baseUrl}/api/json?tree=jobs[name,url,color,lastBuild[number,url]]`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      const safeError = this.extractSafeError(error, "listJobs");
      console.error("Failed to list Jenkins jobs", safeError);
      throw new Error(`Failed to list jobs: ${safeError.message}`);
    }
  }

  async getJobStatus(jobName: string): Promise<JenkinsJobResponse> {
    try {
      const response: AxiosResponse<JenkinsJobResponse> = await axios.get(
        `${this.baseUrl}/job/${encodeURIComponent(jobName)}/api/json?tree=name,url,color,description,buildable,lastBuild[number,url,result,timestamp,duration,displayName],lastSuccessfulBuild[number,url],lastFailedBuild[number,url],healthReport[description,score]`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Job not found: ${jobName}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          `Authentication failed. Please check JENKINS_USERNAME and JENKINS_API_TOKEN.`
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for job ${jobName}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(error, `getJobStatus(${jobName})`);
      console.error("Failed to get job status", safeError);
      throw new Error(`Failed to get job status: ${safeError.message}`);
    }
  }

  async getBuildDetails(
    jobName: string,
    buildNumber: number
  ): Promise<JenkinsBuild> {
    try {
      const response: AxiosResponse<JenkinsBuild> = await axios.get(
        `${this.baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Build #${buildNumber} not found for job: ${jobName}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          `Authentication failed. Please check JENKINS_USERNAME and JENKINS_API_TOKEN.`
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for job ${jobName}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getBuildDetails(${jobName}, ${buildNumber})`
      );
      console.error("Failed to get build details", safeError);
      throw new Error(`Failed to get build details: ${safeError.message}`);
    }
  }

  async getLatestBuild(jobName: string): Promise<JenkinsBuild | null> {
    try {
      const response: AxiosResponse<{ lastBuild: JenkinsBuild | null }> =
        await axios.get(
          `${this.baseUrl}/job/${encodeURIComponent(jobName)}/api/json?tree=lastBuild[number,url,result,timestamp,duration,displayName]`,
          {
            headers: this.getAuthHeaders(),
            timeout: 10000,
          }
        );

      return response.data.lastBuild;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Job not found: ${jobName}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          `Authentication failed. Please check JENKINS_USERNAME and JENKINS_API_TOKEN.`
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for job ${jobName}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getLatestBuild(${jobName})`
      );
      console.error("Failed to get latest build", safeError);
      throw new Error(`Failed to get latest build: ${safeError.message}`);
    }
  }

  async getBuildConsoleOutput(
    jobName: string,
    buildNumber: number
  ): Promise<string> {
    try {
      const response: AxiosResponse<string> = await axios.get(
        `${this.baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`,
        {
          headers: this.getAuthHeaders(),
          responseType: "text",
          timeout: 30000, // Longer timeout for potentially large logs
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Build #${buildNumber} not found for job: ${jobName}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          `Authentication failed. Please check JENKINS_USERNAME and JENKINS_API_TOKEN.`
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for job ${jobName}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getBuildConsoleOutput(${jobName}, ${buildNumber})`
      );
      console.error("Failed to get build console output", safeError);
      throw new Error(`Failed to get console output: ${safeError.message}`);
    }
  }

  /**
   * Convert Jenkins color to a readable status
   */
  private colorToStatus(color: string): JobSummary["status"] {
    if (!color) return "unknown";
    // Remove "_anime" suffix for building jobs
    const baseColor = color.replace("_anime", "");
    if (color.endsWith("_anime")) return "building";

    switch (baseColor) {
      case "blue": return "success";
      case "red": return "failure";
      case "yellow": return "unstable";
      case "aborted": return "aborted";
      case "notbuilt":
      case "disabled": return "not_built";
      default: return "unknown";
    }
  }

  /**
   * Get a compact list of all jobs with their current status
   * Much faster than getting full job details
   */
  async listJobsSummary(): Promise<JobSummary[]> {
    try {
      const response: AxiosResponse<JenkinsJobsResponse> = await axios.get(
        `${this.baseUrl}/api/json?tree=jobs[name,url,color,lastBuild[number,timestamp]]`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data.jobs.map((job) => ({
        name: job.name,
        url: job.url,
        status: this.colorToStatus(job.color),
        lastBuildNumber: job.lastBuild?.number ?? null,
        lastBuildTime: job.lastBuild
          ? new Date((job.lastBuild as { timestamp?: number }).timestamp ?? 0).toISOString()
          : null,
      }));
    } catch (error) {
      const safeError = this.extractSafeError(error, "listJobsSummary");
      console.error("Failed to list jobs summary", safeError);
      throw new Error(`Failed to list jobs: ${safeError.message}`);
    }
  }

  /**
   * Get jobs that have failed, optionally within a time window
   * This fetches recent builds in a single API call per job, much more efficient
   */
  async getFailedJobs(hoursAgo: number = 24): Promise<FailedJobInfo[]> {
    const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;
    const failedJobs: FailedJobInfo[] = [];

    try {
      // First get all jobs with their recent builds (up to 10 per job)
      const response: AxiosResponse<{ jobs: JenkinsJobWithBuilds[] }> = await axios.get(
        `${this.baseUrl}/api/json?tree=jobs[name,url,color,builds[number,url,result,timestamp,duration]{0,10}]`,
        {
          headers: this.getAuthHeaders(),
          timeout: 30000,
        }
      );

      for (const job of response.data.jobs) {
        if (!job.builds) continue;

        for (const build of job.builds) {
          // Check if build is within time window and failed
          if (
            build.timestamp >= cutoffTime &&
            (build.result === "FAILURE" || build.result === "UNSTABLE")
          ) {
            failedJobs.push({
              name: job.name,
              url: job.url,
              buildNumber: build.number,
              buildUrl: build.url,
              timestamp: new Date(build.timestamp).toISOString(),
              duration: build.duration,
              result: build.result,
            });
          }
        }
      }

      // Sort by timestamp descending (most recent first)
      failedJobs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return failedJobs;
    } catch (error) {
      const safeError = this.extractSafeError(error, "getFailedJobs");
      console.error("Failed to get failed jobs", safeError);
      throw new Error(`Failed to get failed jobs: ${safeError.message}`);
    }
  }

  /**
   * Get a quick summary of recent failures (last 24h by default)
   * Returns a compact, human-readable summary
   */
  async getRecentFailuresSummary(hoursAgo: number = 24): Promise<{
    totalFailures: number;
    timeWindow: string;
    failures: Array<{
      job: string;
      build: number;
      time: string;
      result: string;
    }>;
  }> {
    const failures = await this.getFailedJobs(hoursAgo);

    return {
      totalFailures: failures.length,
      timeWindow: `Last ${hoursAgo} hours`,
      failures: failures.map((f) => ({
        job: f.name,
        build: f.buildNumber,
        time: f.timestamp,
        result: f.result,
      })),
    };
  }

  /**
   * Get test results for a specific build
   */
  async getTestResults(
    jobName: string,
    buildNumber: number
  ): Promise<TestResultSummary> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/testReport/api/json`,
        {
          headers: this.getAuthHeaders(),
          timeout: 15000,
        }
      );

      const data = response.data;

      // Extract failed tests (limit to first 20 for readability)
      const failedTests: TestResultSummary["failedTests"] = [];
      if (data.suites) {
        for (const suite of data.suites) {
          for (const testCase of suite.cases || []) {
            if (testCase.status === "FAILED" || testCase.status === "REGRESSION") {
              if (failedTests.length < 20) {
                failedTests.push({
                  name: testCase.name,
                  className: testCase.className,
                  errorMessage: testCase.errorDetails?.substring(0, 500),
                });
              }
            }
          }
        }
      }

      return {
        totalCount: data.totalCount || 0,
        passCount: data.passCount || 0,
        failCount: data.failCount || 0,
        skipCount: data.skipCount || 0,
        duration: data.duration || 0,
        failedTests,
      };
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(
          `No test results found for ${jobName} #${buildNumber}. The build may not have run tests.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getTestResults(${jobName}, ${buildNumber})`
      );
      console.error("Failed to get test results", safeError);
      throw new Error(`Failed to get test results: ${safeError.message}`);
    }
  }

  /**
   * Get pipeline stage information for a build (Pipeline/Workflow jobs only)
   */
  async getPipelineStages(
    jobName: string,
    buildNumber: number
  ): Promise<PipelineInfo> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/wfapi/describe`,
        {
          headers: this.getAuthHeaders(),
          timeout: 15000,
        }
      );

      const data = response.data;
      const stages = (data.stages || []).map(
        (stage: { name: string; status: string; durationMillis: number; startTimeMillis?: number }) => ({
          name: stage.name,
          status: stage.status,
          durationMillis: stage.durationMillis,
          startTimeMillis: stage.startTimeMillis,
        })
      );

      // Find the first failed stage
      const failedStage = stages.find(
        (s: { status: string }) => s.status === "FAILED" || s.status === "ABORTED"
      );

      return {
        stages,
        totalDuration: data.durationMillis || 0,
        failedStage: failedStage?.name,
      };
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(
          `No pipeline info found for ${jobName} #${buildNumber}. This may not be a Pipeline job.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getPipelineStages(${jobName}, ${buildNumber})`
      );
      console.error("Failed to get pipeline stages", safeError);
      throw new Error(`Failed to get pipeline stages: ${safeError.message}`);
    }
  }

  /**
   * Get current build queue status
   */
  async getBuildQueueStatus(): Promise<BuildQueueStatus> {
    try {
      const response: AxiosResponse<{ items: QueueItem[] }> = await axios.get(
        `${this.baseUrl}/queue/api/json`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      const items = response.data.items.map((item) => ({
        id: item.id,
        jobName: item.task.name,
        waiting: item.why,
        inQueueSince: new Date(item.inQueueSince).toISOString(),
        stuck: item.stuck,
      }));

      return {
        queueLength: items.length,
        items,
      };
    } catch (error) {
      const safeError = this.extractSafeError(error, "getBuildQueueStatus");
      console.error("Failed to get build queue", safeError);
      throw new Error(`Failed to get build queue: ${safeError.message}`);
    }
  }

  /**
   * Search for jobs matching a pattern
   */
  async searchJobs(pattern: string): Promise<JobSummary[]> {
    try {
      // Get all jobs first
      const allJobs = await this.listJobsSummary();

      // Filter by pattern (case-insensitive glob-like matching)
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        "i"
      );

      return allJobs.filter((job) => regex.test(job.name));
    } catch (error) {
      const safeError = this.extractSafeError(error, `searchJobs(${pattern})`);
      console.error("Failed to search jobs", safeError);
      throw new Error(`Failed to search jobs: ${safeError.message}`);
    }
  }

  /**
   * Get node/agent status
   */
  async getNodeStatus(): Promise<NodeStatus> {
    try {
      const response: AxiosResponse<{ computer: JenkinsNode[] }> = await axios.get(
        `${this.baseUrl}/computer/api/json?tree=computer[displayName,description,offline,offlineCauseReason,temporarilyOffline,numExecutors,idle]`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      const nodes = response.data.computer.map((node) => {
        let status: "online" | "offline" | "temporarily_offline" = "online";
        if (node.offline) {
          status = node.temporarilyOffline ? "temporarily_offline" : "offline";
        }

        return {
          name: node.displayName,
          status,
          executors: node.numExecutors,
          idle: node.idle,
          offlineReason: node.offlineCauseReason,
        };
      });

      const onlineNodes = nodes.filter((n) => n.status === "online").length;
      const offlineNodes = nodes.filter((n) => n.status !== "online").length;

      return {
        totalNodes: nodes.length,
        onlineNodes,
        offlineNodes,
        nodes,
      };
    } catch (error) {
      const safeError = this.extractSafeError(error, "getNodeStatus");
      console.error("Failed to get node status", safeError);
      throw new Error(`Failed to get node status: ${safeError.message}`);
    }
  }

  /**
   * Compare two builds of the same job
   */
  async compareBuilds(
    jobName: string,
    buildNumber1: number,
    buildNumber2: number
  ): Promise<BuildComparison> {
    try {
      // Fetch both builds in parallel
      const [build1, build2] = await Promise.all([
        this.getBuildDetails(jobName, buildNumber1),
        this.getBuildDetails(jobName, buildNumber2),
      ]);

      const durationDiff = build2.duration - build1.duration;
      const durationDiffPercent =
        build1.duration > 0 ? (durationDiff / build1.duration) * 100 : 0;

      return {
        build1: {
          number: build1.number,
          result: build1.result,
          timestamp: new Date(build1.timestamp).toISOString(),
          duration: build1.duration,
        },
        build2: {
          number: build2.number,
          result: build2.result,
          timestamp: new Date(build2.timestamp).toISOString(),
          duration: build2.duration,
        },
        changes: {
          resultChanged: build1.result !== build2.result,
          durationDiff,
          durationDiffPercent: Math.round(durationDiffPercent * 10) / 10,
        },
      };
    } catch (error) {
      const safeError = this.extractSafeError(
        error,
        `compareBuilds(${jobName}, ${buildNumber1}, ${buildNumber2})`
      );
      console.error("Failed to compare builds", safeError);
      throw new Error(`Failed to compare builds: ${safeError.message}`);
    }
  }
}
