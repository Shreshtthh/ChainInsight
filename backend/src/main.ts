import 'dotenv/config';
import { AgentBuilder } from '@iqai/adk';
import { coordinatorAgent } from './agents/coordinator/coordinator-agent';

async function main() {
  console.log('🚀 ChainInsight - Web3 Research & Execution Agent');
  console.log('================================================\n');

  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY not set in .env file');
  }

  console.log('✅ ChainInsight initialized\n');

  const { runner } = await AgentBuilder
    .create('chaininsight')
    .withAgent(coordinatorAgent)
    .build();

  // Test queries showcasing full pipeline
  const queries = [
    // Query 1: Research only
    "What are the top 3 DeFi lending protocols on Base blockchain by TVL? Use your tools to get real data.",
    
    // Query 2: Full pipeline (research → strategy → simulate)
    "Find me a safe yield opportunity on Base with at least 5% APY. Generate a strategy and simulate depositing 100 USDC."
  ];

  for (const query of queries) {
    console.log('\n' + '═'.repeat(100));
    console.log(`📝 QUERY: ${query}`);
    console.log('═'.repeat(100) + '\n');
    
    try {
      const response = await runner.ask(query);
      console.log('🤖 RESPONSE:\n');
      console.log(response);
      console.log('\n');
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }

  console.log('✅ All queries completed!\n');
}

main().catch(console.error);
