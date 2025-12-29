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
