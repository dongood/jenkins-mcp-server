import axios, { AxiosResponse } from "axios";
import {
  JenkinsBuild,
  JenkinsConfig,
  JenkinsJobResponse,
  JenkinsJobsResponse,
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
}
