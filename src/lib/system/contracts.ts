export interface TerminalProxyResponseContract {
  url?: string;
  detail?: string;
}

export interface HealthResponseContract {
  status: string;
  agent: string;
  framework: string;
  workspace: string;
  workspace_ready: boolean;
}
