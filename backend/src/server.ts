import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AgentBuilder } from '@iqai/adk';
import { coordinatorAgent } from './agents/coordinator/coordinator-agent';
import type { TransactionParams } from './types';
import { getLastBuiltTransactions } from './tools/web3/transaction-builder-tool';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Store active sessions with transaction params
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

let runner: any = null;

// Helper function for logging
function log(emoji: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${emoji} [${timestamp}] ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
}

// Token usage tracking
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

async function initializeAgent() {
  try {
    log('⏳', 'Starting agent initialization...');
    
    const { runner: agentRunner } = await AgentBuilder
      .create('chaininsight')
      .withAgent(coordinatorAgent)
      .build();
    
    runner = agentRunner;
    log('✅', 'ChainInsight agent initialized successfully');
    
  } catch (error) {
    log('❌', 'Agent initialization failed', error);
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    agent: runner ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    sessions: sessions.size
  };
  log('🏥', 'Health check', status);
  res.json(status);
});

// Query endpoint
// Query endpoint
app.post('/api/query', async (req, res) => {
  const requestId = Date.now().toString();
  
  try {
    const { query, sessionId } = req.body;
    
    log('📝', `[${requestId}] New query received`, {
      query,
      sessionId: sessionId || 'new',
      hasRunner: !!runner
    });

    // Log token estimates
    const queryTokens = estimateTokens(query);
    log('📊', `[${requestId}] Query token estimate: ${queryTokens}`);
    
    if (!query) {
      log('⚠️', `[${requestId}] Missing query parameter`);
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!runner) {
      log('❌', `[${requestId}] Agent not ready`);
      return res.status(503).json({ error: 'Agent not ready yet' });
    }

    log('🤖', `[${requestId}] Sending query to agent...`);

    // Optimized instruction
    const instructedQuery = `${query}

INSTRUCTIONS:
1. Research protocols (use tools)
2. Generate strategy
3. CALL build_transaction tool to get params
4. Present findings in <150 words
5. ASK for approval

Be concise.`;

    log('📤', `[${requestId}] Instructed query`, { 
      instructedQuery: instructedQuery.substring(0, 100) + '...',
      estimatedTokens: estimateTokens(instructedQuery)
    });

    const startTime = Date.now();
    const response = await runner.ask(instructedQuery);
    const duration = Date.now() - startTime;
    
    const responseTokens = estimateTokens(response);
    const totalTokens = queryTokens + responseTokens;
    
    log('📥', `[${requestId}] Agent response received`, {
      duration: `${duration}ms`,
      responseLength: response.length,
      responseTokens,
      totalTokens,
      preview: response.substring(0, 100) + '...'
    });
    
    // Get transactions from tool
    let transactions = getLastBuiltTransactions();

    if (transactions) {
      log('✅', `[${requestId}] Retrieved ${transactions.length} transaction(s) from tool storage`);
    } else {
      log('⚠️', `[${requestId}] No transactions found from tool`);
    }
    
    // Store session
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
      transactionCount: transactions?.length || 0
    });

    // Check if approval is needed
    const requiresApproval = 
      !!transactions ||
      response.toLowerCase().includes('approve') || 
      response.toLowerCase().includes('proceed') ||
      response.toLowerCase().includes('execute') ||
      response.toLowerCase().includes('would you like');

    log('🔍', `[${requestId}] Approval check`, { 
      requiresApproval,
      hasTransactions: !!transactions 
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
        tokenEstimate: totalTokens,
        transactionCount: transactions?.length || 0
      }
    });

    log('✅', `[${requestId}] Response sent successfully`);

  } catch (error) {
    log('❌', `[${requestId}] Query failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(500).json({ 
      error: 'Query failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});


// Approval endpoint - Returns transaction params for frontend execution
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
      log('⚠️', `[${requestId}] Missing session ID`);
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      log('❌', `[${requestId}] Session not found`, { sessionId });
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

    log('✅', `[${requestId}] User approved - returning transaction params for frontend execution`);

    // Mark as approved
    session.approved = true;
    sessions.set(sessionId, session);

    log('💾', `[${requestId}] Session updated with approval`);

    // Return transaction params for frontend to execute
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

    log('✅', `[${requestId}] Approval response sent successfully with ${session.transactions?.length || 0} transaction(s)`);

  } catch (error) {
    log('❌', `[${requestId}] Approval failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(500).json({ 
      error: 'Approval failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Get session info (optional - for debugging)
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

// Start server
app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ChainInsight API Server');
  console.log('='.repeat(60));
  console.log(`📡 Running on http://localhost:${PORT}`);
  console.log(`⏰ Started at ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('\n⏳ Initializing agent system...\n');
  
  try {
    await initializeAgent();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ System Ready!');
    console.log('='.repeat(60));
    console.log('\nAPI Endpoints:');
    console.log(`  POST http://localhost:${PORT}/api/query     - Submit query`);
    console.log(`  POST http://localhost:${PORT}/api/approve   - Approve execution`);
    console.log(`  GET  http://localhost:${PORT}/api/session/:id - Get session info`);
    console.log(`  GET  http://localhost:${PORT}/health        - Health check`);
    console.log('\n' + '='.repeat(60));
    console.log('📊 Token Usage Tracking: ENABLED');
    console.log('🔐 Execution Mode: Frontend (User Wallet)');
    console.log('⚡ Transaction Builder: ACTIVE');
    console.log('='.repeat(60));
    console.log('\n📊 Waiting for requests...\n');
    
  } catch (error) {
    console.error('\n❌ Failed to start server:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('⚠️', 'SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('⚠️', 'SIGINT received, shutting down gracefully...');
  process.exit(0);
});
