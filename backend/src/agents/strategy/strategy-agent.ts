import { LlmAgent } from '@iqai/adk';
import { transactionBuilderTool } from '../../tools/web3/transaction-builder-tool';

export const strategyAgent = new LlmAgent({
  name: 'strategy_agent',
  model: 'gemini-2.0-flash-exp',
  description: 'Builds transaction parameters for DeFi deposits',
  instruction: `You build DeFi transactions. Keep responses UNDER 50 words.

When given deposit info:
1. IMMEDIATELY call build_transaction tool
2. Return: "Transaction ready"

Example:
Input: "Deposit 100 USDC to Morpho"
Action: Call build_transaction(action: "deposit", amount: "100", protocol: "Morpho", strategy: "Lending")
Response: "Transaction ready: Approve 100 USDC + Deposit to Morpho vault"

ALWAYS call the tool. No exceptions.`,
  
  tools: [transactionBuilderTool],
});
