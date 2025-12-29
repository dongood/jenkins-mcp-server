export interface JenkinsBuild {
  number: number;
  url: string;
  result: string | null;
  timestamp: number;
  duration: number;
  displayName: string;
}

export interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  lastBuild?: {
    number: number;
    url: string;
  };
}

export interface JenkinsJobsResponse {
  jobs: JenkinsJob[];
}

export interface JenkinsJobResponse {
  name: string;
  url: string;
  color: string;
  description: string | null;
  buildable: boolean;
  lastBuild?: JenkinsBuild;
  lastSuccessfulBuild?: {
    number: number;
    url: string;
  };
  lastFailedBuild?: {
    number: number;
    url: string;
  };
  healthReport?: Array<{
    description: string;
    score: number;
  }>;
}

export interface JenkinsConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
}

// Optimized response types for faster queries
export interface JobSummary {
  name: string;
  url: string;
  status: "success" | "failure" | "unstable" | "aborted" | "not_built" | "building" | "unknown";
  lastBuildNumber: number | null;
  lastBuildTime: string | null;
}

export interface FailedJobInfo {
  name: string;
  url: string;
  buildNumber: number;
  buildUrl: string;
  timestamp: string;
  duration: number;
  result: string;
}

export interface JenkinsJobWithBuilds {
  name: string;
  url: string;
  color: string;
  builds?: Array<{
    number: number;
    url: string;
    result: string | null;
    timestamp: number;
    duration: number;
  }>;
}

// Test results types
export interface TestResultSummary {
  totalCount: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  duration: number;
  failedTests: Array<{
    name: string;
    className: string;
    errorMessage?: string;
  }>;
}

// Pipeline stage types
export interface PipelineStage {
  name: string;
  status: string;
  durationMillis: number;
  startTimeMillis?: number;
}

export interface PipelineInfo {
  stages: PipelineStage[];
  totalDuration: number;
  failedStage?: string;
}

// Build queue types
export interface QueueItem {
  id: number;
  task: {
    name: string;
    url: string;
  };
  why: string;
  inQueueSince: number;
  buildable: boolean;
  stuck: boolean;
}

export interface BuildQueueStatus {
  queueLength: number;
  items: Array<{
    id: number;
    jobName: string;
    waiting: string;
    inQueueSince: string;
    stuck: boolean;
  }>;
}

// Node/agent types
export interface JenkinsNode {
  displayName: string;
  description: string;
  offline: boolean;
  offlineCauseReason?: string;
  temporarilyOffline: boolean;
  numExecutors: number;
  idle: boolean;
}

export interface NodeStatus {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  nodes: Array<{
    name: string;
    status: "online" | "offline" | "temporarily_offline";
    executors: number;
    idle: boolean;
    offlineReason?: string;
  }>;
}

// Build comparison types
export interface BuildComparison {
  build1: {
    number: number;
    result: string | null;
    timestamp: string;
    duration: number;
  };
  build2: {
    number: number;
    result: string | null;
    timestamp: string;
    duration: number;
  };
  changes: {
    resultChanged: boolean;
    durationDiff: number;
    durationDiffPercent: number;
  };
}
