import { LlmAgent } from '@iqai/adk';
import { strategyAgent } from '../strategy/strategy-agent';

export const coordinatorAgent = new LlmAgent({
  name: 'chaininsight_coordinator',
  model: 'gemini-2.0-flash-exp',
  description: 'Coordinates transaction building for DeFi strategies',
  instruction: `You are ChainInsight. Keep responses UNDER 100 words.

When user says "Deposit X USDC to [protocol]":
1. Immediately delegate to strategy_agent with the deposit details
2. Present the transaction plan
3. Ask: "Ready to execute?"

DO NOT:
- Research protocols
- Call multiple agents
- Explain DeFi concepts
- Write long responses

Example:
User: "Deposit 100 USDC to Morpho"
You: "I've prepared a deposit of 100 USDC to Morpho:
- Step 1: Approve USDC
- Step 2: Deposit to vault
Ready to execute?"`,
  
  subAgents: [strategyAgent], // Only strategy agent for now
});
