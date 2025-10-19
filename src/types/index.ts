// Type definitions
export interface ResearchQuery {
  query: string;
  priority: 'high' | 'medium' | 'low';
  requiredData: ('onchain' | 'market' | 'social' | 'docs')[];
}

export interface ResearchResult {
  source: string;
  data: any;
  confidence: number;
  timestamp: string;
}

export interface Strategy {
  action: string;
  protocol: string;
  amount?: string;
  reasoning: string;
  riskScore: number;
  expectedReturn?: string;
}

export interface SimulationResult {
  success: boolean;
  gasEstimate: string;
  expectedOutcome: any;
  warnings?: string[];
}

export interface ExecutionResult {
  txHash: string;
  status: 'pending' | 'success' | 'failed';
  blockNumber?: number;
}
