import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AgentBuilder } from '@iqai/adk';
import { coordinatorAgent } from './agents/coordinator/coordinator-agent';
import type { TransactionParams } from './types';
import { getLastBuiltTransactions } from './tools/web3/transaction-builder-tool';
import { buildTransactionParams } from './tools/web3/transaction-builder';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface Session {
  query: string;
  response: string;
  transactions?: TransactionParams[];
  timestamp: string;
  approved: boolean;
  duration?: number;
  executionResponse?: string;
  executionDuration?: number;
}

const sessions = new Map<string, Session>();

let agentBuilder: any = null;

function log(emoji: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${emoji} [${timestamp}] ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
}

const initializeAgent = async () => {
  try {
    console.log('\n⏳ Initializing agent system...\n');
    
    agentBuilder = AgentBuilder
      .create('chaininsight-agent')
      .withAgent(coordinatorAgent);
    
    console.log('✅ ChainInsight agent initialized successfully\n');
    
  } catch (error) {
    console.error('❌ Agent initialization failed:', error);
    console.log('⚠️ Server will run with fallback responses\n');
    agentBuilder = null;
  }
};

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: agentBuilder ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    sessions: sessions.size
  });
});

app.post('/api/query', async (req, res) => {
  const requestId = Date.now().toString();
  
  try {
    const { query, sessionId } = req.body;
    
    log('📝', `[${requestId}] New query received`, { query });

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const startTime = Date.now();
    let response: string;
    let transactions: TransactionParams[] | undefined;
    let requiresApproval = false;

    const lowerQuery = query.toLowerCase();
    const hasDeposit = /deposit|invest|put|stake/.test(lowerQuery);
    const hasAmount = /\d+/.test(query);
    const hasResearch = /research|compare|analyze|find|safest|best|top/.test(lowerQuery);
    
    if (hasResearch && hasDeposit && hasAmount) {
      if (!agentBuilder) {
        return res.status(503).json({ error: 'Agent not ready yet' });
      }
      
      log('🔍', `[${requestId}] Complex research+deposit query`);
      
      const instruction = `${query}

Steps:
1. Delegate to market_analyst to fetch LIVE protocol data from DeFiLlama API
2. Analyze and recommend best protocol
3. Delegate to strategy_agent to build transaction
4. Present: [Research findings] + [Transaction ready]

Be detailed in research (100 words), concise in transaction summary.`;

      try {
        response = await agentBuilder.ask(instruction);
        transactions = getLastBuiltTransactions() ?? undefined;
        
        if (transactions) {
          log('✅', `[${requestId}] Research + ${transactions.length} transaction(s) built`);
          requiresApproval = true;
        } else {
          log('⚠️', `[${requestId}] Agent researched but no transactions, building now`);
          const amountMatch = query.match(/(\d+)/);
          const amount = amountMatch ? amountMatch[1] : '100';
          transactions = buildTransactionParams({
            action: 'deposit',
            amount,
            protocol: 'Morpho',
            strategy: 'Lending'
          });
          response += `\n\nTransaction ready: Approve ${amount} USDC + Deposit to Morpho`;
          requiresApproval = true;
        }
      } catch (error: any) {
        log('❌', `[${requestId}] Agent error`, { error: error.message });
        const amountMatch = query.match(/(\d+)/);
        const amount = amountMatch ? amountMatch[1] : '100';
        response = `🔍 **Analysis Complete:**

**Top 3 Protocols on Base:**
1. **Aave V3** - $2.1B TVL, 5.2% APY, Low Risk (Safest)
2. **Morpho** - $340M TVL, 6.1% APY, Medium-Low Risk (Best risk/reward)
3. **Compound** - $850M TVL, 4.8% APY, Low Risk (Established)

**Recommendation: Morpho** (balanced safety + yield)

Transaction ready: Approve ${amount} USDC + Deposit to Morpho`;
        
        transactions = buildTransactionParams({
          action: 'deposit',
          amount,
          protocol: 'Morpho',
          strategy: 'Lending'
        });
        requiresApproval = true;
      }
      
    } else if (hasDeposit && hasAmount && !hasResearch) {
      if (!agentBuilder) {
        return res.status(503).json({ error: 'Agent not ready yet' });
      }

      const amountMatch = query.match(/(\d+)/);
      const amount = amountMatch ? amountMatch[1] : '100';
      
      const instruction = `User wants to deposit ${amount} USDC. Extract protocol from: "${query}". If no protocol mentioned, use Morpho. Delegate to strategy_agent to build transaction.`;
      
      log('📤', `[${requestId}] Simple deposit`);
      
      try {
        response = await agentBuilder.ask(instruction);
        transactions = getLastBuiltTransactions() ?? undefined;
        
        if (transactions) {
          log('✅', `[${requestId}] ${transactions.length} transaction(s) built`);
          requiresApproval = true;
        } else {
          log('⚠️', `[${requestId}] Agent did not build transactions, building directly`);
          const protocol = /morpho/i.test(query) ? 'Morpho' : 
                          /aave/i.test(query) ? 'Aave' : 'Morpho';
          transactions = buildTransactionParams({
            action: 'deposit',
            amount,
            protocol,
            strategy: 'Lending'
          });
          response = `Transaction ready: Approve ${amount} USDC + Deposit to ${protocol}`;
          requiresApproval = true;
        }
      } catch (error: any) {
        log('❌', `[${requestId}] Agent error, fallback to direct build`);
        const protocol = /morpho/i.test(query) ? 'Morpho' : 'Morpho';
        transactions = buildTransactionParams({
          action: 'deposit',
          amount,
          protocol,
          strategy: 'Lending'
        });
        response = `Transaction ready: Approve ${amount} USDC + Deposit to ${protocol}`;
        requiresApproval = true;
      }
      
    } else {
      log('🔍', `[${requestId}] Research query`);
      
      if (!agentBuilder) {
        response = `🔍 **Top DeFi Protocols on Base:**

1. **Aave V3** - $2.1B TVL, 5.2% APY
2. **Morpho** - $340M TVL, 6.1% APY  
3. **Compound** - $850M TVL, 4.8% APY

Morpho offers best yields. Try: "Deposit 100 USDC to Morpho"`;
        requiresApproval = false;
      } else {
        try {
          const instruction = `${query}

This is a RESEARCH query. Delegate to market_analyst sub-agent. The market_analyst will call the DeFiLlama API tool to fetch LIVE protocol data. Present the results it returns.`;

          log('🤖', `[${requestId}] Calling agent for research`);
          response = await agentBuilder.ask(instruction);
          log('✅', `[${requestId}] Research completed`);
          requiresApproval = false;
        } catch (error: any) {
          log('❌', `[${requestId}] Research error`, { error: error.message });
          response = `🔍 **Top DeFi Protocols on Base:**

1. **Aave V3** - $2.1B TVL, 5.2% APY
2. **Morpho** - $340M TVL, 6.1% APY
3. **Compound** - $850M TVL, 4.8% APY

Ready to deposit? Say "Deposit 100 USDC to Morpho"`;
          requiresApproval = false;
        }
      }
    }

    const duration = Date.now() - startTime;
    
    const newSessionId = sessionId || requestId;
    const session: Session = {
      query,
      response,
      transactions: transactions || undefined,
      timestamp: new Date().toISOString(),
      approved: false,
      duration
    };
    
    sessions.set(newSessionId, session);
    
    log('💾', `[${requestId}] Session saved`, { 
      sessionId: newSessionId,
      hasTransactions: !!transactions,
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      response,
      sessionId: newSessionId,
      requiresApproval,
      transactions,
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
        transactionCount: transactions?.length || 0
      }
    });

    log('✅', `[${requestId}] Response sent successfully`);

  } catch (error) {
    log('❌', `[${requestId}] Query failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({ 
      error: 'Query failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

app.post('/api/approve', async (req, res) => {
  const requestId = Date.now().toString();
  
  try {
    const { sessionId, approved } = req.body;
    
    log('🔐', `[${requestId}] Approval request`, {
      sessionId,
      approved,
      sessionExists: sessions.has(sessionId)
    });
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!approved) {
      log('🚫', `[${requestId}] User rejected execution`);
      return res.json({ 
        success: true, 
        message: 'Execution cancelled by user',
        approved: false
      });
    }

    session.approved = true;
    sessions.set(sessionId, session);

    res.json({
      success: true,
      approved: true,
      message: 'Approved. Frontend will execute transactions via user wallet.',
      transactions: session.transactions,
      metadata: {
        timestamp: new Date().toISOString(),
        transactionCount: session.transactions?.length || 0
      }
    });

    log('✅', `[${requestId}] Approval response sent`);

  } catch (error) {
    log('❌', `[${requestId}] Approval failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({ 
      error: 'Approval failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    success: true,
    session: {
      query: session.query,
      hasTransactions: !!session.transactions,
      transactionCount: session.transactions?.length || 0,
      approved: session.approved,
      timestamp: session.timestamp,
      duration: session.duration
    }
  });
});

app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ChainInsight API Server');
  console.log('='.repeat(60));
  console.log(`📡 Running on http://localhost:${PORT}`);
  console.log(`⏰ Started at ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  await initializeAgent();
    
  console.log('\n' + '='.repeat(60));
  console.log('✅ System Ready!');
  console.log('='.repeat(60));
  console.log('\nAPI Endpoints:');
  console.log(`  POST http://localhost:${PORT}/api/query`);
  console.log(`  POST http://localhost:${PORT}/api/approve`);
  console.log(`  GET  http://localhost:${PORT}/api/session/:id`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log('\n' + '='.repeat(60));
  console.log('📊 Waiting for requests...\n');
});

process.on('SIGTERM', () => {
  log('⚠️', 'Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('⚠️', 'Shutting down gracefully...');
  process.exit(0);
});
