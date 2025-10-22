import { createTool } from '@iqai/adk';
import { z } from 'zod';
import { buildTransactionParams, StrategyAction, TransactionParams } from './transaction-builder';

// Global storage for last built transactions (temporary workaround)
let lastBuiltTransactions: TransactionParams[] | null = null;

export const transactionBuilderTool = createTool({
  name: 'build_transaction',
  description: 'Builds transaction parameters for executing DeFi strategies. Returns to, data, value for frontend execution.',
  schema: z.object({
    action: z.enum(['deposit', 'withdraw']).describe('The action to perform'),
    amount: z.string().optional().describe('Amount in human-readable format (e.g., "100" for 100 USDC)'),
    protocol: z.string().optional().describe('Protocol name (e.g., "Morpho", "Aave")'),
    strategy: z.string().optional().describe('Strategy type (e.g., "Lending", "Staking")'),
    positionId: z.number().optional().describe('Position ID for withdrawals'),
  }),
  
  fn: async (params, context) => {
    console.log('🔧 Transaction Builder Tool called with:', params);

    try {
      const strategyAction: StrategyAction = {
        action: params.action,
        amount: params.amount,
        protocol: params.protocol,
        strategy: params.strategy,
        positionId: params.positionId,
      };

      const transactions = buildTransactionParams(strategyAction);

      console.log('✅ Transaction parameters built successfully');
      console.log('📦 Transactions:', JSON.stringify(transactions, null, 2));

      // Store globally so server can access
      lastBuiltTransactions = transactions;

      // Also try to store in context if available
      if (context && context.state) {
        context.state.pendingTransactions = transactions;
      }

      // Return as JSON string for agent to parse
      const result = {
        success: true,
        transactions,
        message: `Built ${transactions.length} transaction(s) for ${params.action}`,
      };
      
      return JSON.stringify(result);

    } catch (error: any) {
      console.error('❌ Transaction builder tool error:', error);
      lastBuiltTransactions = null;
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to build transaction parameters',
      });
    }
  },
});

// Export function to retrieve last built transactions
export function getLastBuiltTransactions(): TransactionParams[] | null {
  const txs = lastBuiltTransactions;
  lastBuiltTransactions = null; // Clear after retrieval
  return txs;
}
