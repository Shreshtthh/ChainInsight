import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AgentBuilder } from '@iqai/adk';
import { coordinatorAgent } from './agents/coordinator/coordinator-agent';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Store active sessions
const sessions = new Map();

// Initialize agent
let runner: any = null;

async function initializeAgent() {
  const { runner: agentRunner } = await AgentBuilder
    .create('chaininsight')
    .withAgent(coordinatorAgent)
    .build();
  
  runner = agentRunner;
  console.log('✅ ChainInsight agent initialized');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: runner ? 'ready' : 'initializing' });
});

// Query endpoint - returns research + strategy
app.post('/api/query', async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!runner) {
      return res.status(503).json({ error: 'Agent not ready yet' });
    }

    console.log(`\n📝 New query: ${query}`);
    console.log(`Session: ${sessionId || 'new'}`);

    // Add instruction to STOP before execution and ask for approval
    const instructedQuery = `${query}

IMPORTANT: After generating strategy and simulation results, STOP and present findings.
Ask user: "Would you like me to proceed with execution?" 
DO NOT execute without explicit approval.`;

    const response = await runner.ask(instructedQuery);
    
    // Store session data
    const session = {
      query,
      response,
      timestamp: new Date().toISOString(),
      approved: false
    };
    
    sessions.set(sessionId || Date.now().toString(), session);

    res.json({
      success: true,
      response,
      sessionId: sessionId || Date.now().toString(),
      requiresApproval: response.toLowerCase().includes('approve') || 
                        response.toLowerCase().includes('proceed') ||
                        response.toLowerCase().includes('execute')
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Query failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Approval endpoint - executes after user confirms
app.post('/api/approve', async (req, res) => {
  try {
    const { sessionId, approved } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!approved) {
      return res.json({ 
        success: true, 
        message: 'Execution cancelled by user' 
      });
    }

    // Execute with approval
    const executeQuery = `The user has APPROVED the previous strategy. 
Proceed with execution using the execution_agent. 
Set userApproved: true when calling execution tools.`;

    const executionResponse = await runner.ask(executeQuery);
    
    session.approved = true;
    session.executionResponse = executionResponse;
    sessions.set(sessionId, session);

    res.json({
      success: true,
      response: executionResponse,
      message: 'Execution completed'
    });

  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ 
      error: 'Execution failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 ChainInsight API Server`);
  console.log(`📡 Running on http://localhost:${PORT}`);
  console.log(`\n⏳ Initializing agent...\n`);
  
  await initializeAgent();
  
  console.log(`\n✅ Ready to accept queries!`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  POST /api/query   - Submit query`);
  console.log(`  POST /api/approve - Approve execution`);
  console.log(`  GET  /health      - Health check\n`);
});
