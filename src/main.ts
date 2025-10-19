import 'dotenv/config';
import { AgentBuilder } from '@iqai/adk';
import { coordinatorAgent } from './agents/coordinator/coordinator-agent';

async function main() {
  console.log('🚀 ChainInsight - Web3 Research & Execution Agent');
  console.log('================================================\n');

  // Validate environment
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY not set in .env file');
  }

  console.log('✅ ChainInsight initialized\n');

  // Build agent (just like the starter template)
  const { runner } = await AgentBuilder
    .create('chaininsight')
    .withAgent(coordinatorAgent)
    .build();

  // Example queries
  const questions = [
    "What are the top DeFi protocols?",
    "Find the safest yield opportunity on Base with >5% APY"
  ];

  for (const question of questions) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 Question: ${question}`);
    console.log('─'.repeat(80));
    
    const response = await runner.ask(question);
    
    console.log(`\n🤖 Response: ${response}\n`);
  }

  console.log('✅ All queries completed!\n');
}

main().catch(console.error);
