/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useConnect, useDisconnect } from 'wagmi';
import { formatUnits } from 'viem';
import { Send, Loader2, Wallet, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { CONTRACTS, MOCK_USDC_ABI, MOCK_VAULT_ABI } from '../lib/contracts';
import Portfolio from './Portfolio';

interface Message {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

interface TransactionParams {
  to: string;
  data: string;
  value: string;
  description: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<TransactionParams[]>([]);
  const [currentTxIndex, setCurrentTxIndex] = useState(0);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [showPortfolio, setShowPortfolio] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Read USDC balance
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.MOCK_USDC,
    abi: MOCK_USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const balance = balanceData as bigint | undefined;

  const { writeContract, data: hash, error: writeError, reset: resetWrite } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Debug logging
  useEffect(() => {
    console.log('🔌 Wallet Status:', {
      isConnected,
      address,
      balance: balance ? formatUnits(balance, 6) : 'N/A',
    });
  }, [isConnected, address, balance]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash) {
      console.log('✅ Transaction Confirmed:', hash);
      
      const txUrl = `https://sepolia.basescan.org/tx/${hash}`;
      const txDescription = pendingTransactions[currentTxIndex]?.description || 'Transaction';
      
      addMessage('system', `✅ ${txDescription} confirmed!\n\nView on BaseScan: ${txUrl}`);
      
      // Refetch balance
      refetchBalance();
      
      // Move to next transaction or finish
      if (currentTxIndex < pendingTransactions.length - 1) {
        console.log(`🔄 Moving to transaction ${currentTxIndex + 2}/${pendingTransactions.length}`);
        setCurrentTxIndex(currentTxIndex + 1);
        executeNextTransaction(currentTxIndex + 1);
      } else {
        console.log('🎉 All transactions completed successfully');
        setExecutionStatus('success');
        setPendingTransactions([]);
        setCurrentTxIndex(0);
        addMessage('system', '🎉 All transactions completed successfully!');
      }
    }
  }, [isConfirmed, hash]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      console.error('❌ Transaction Error:', writeError);
      setExecutionStatus('error');
      
      const errorMessage = writeError.message.includes('User rejected')
        ? '❌ Transaction rejected by user'
        : `❌ Transaction failed: ${writeError.message}`;
      
      addMessage('system', errorMessage);
    }
  }, [writeError]);

  const addMessage = (role: 'user' | 'agent' | 'system', content: string) => {
    const msg = { role, content, timestamp: new Date() };
    console.log(`💬 [${role.toUpperCase()}]:`, content.substring(0, 100));
    setMessages(prev => [...prev, msg]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    console.log('📤 Sending query:', query);
    
    setInput('');
    addMessage('user', query);
    setIsLoading(true);

    try {
      console.log('🔄 Calling API...');
      const response = await api.query(query, sessionId || undefined);
      
      console.log('📥 API Response:', {
        sessionId: response.sessionId,
        requiresApproval: response.requiresApproval,
        hasTransactions: !!response.transactions,
        transactionCount: response.transactions?.length || 0,
      });
      
      setSessionId(response.sessionId);
      addMessage('agent', response.response);

      // If transactions are included, store them
      if (response.transactions && response.transactions.length > 0) {
        console.log('💾 Storing transactions:', response.transactions);
        setPendingTransactions(response.transactions);
      }

      if (response.requiresApproval) {
        console.log('⚠️ Approval required - showing modal');
        setShowApproval(true);
      }
    } catch (error: any) {
      console.error('❌ Query failed:', error);
      addMessage('system', `❌ Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMint = async () => {
    if (!isConnected || !address) {
      console.warn('⚠️ Wallet not connected');
      addMessage('system', '⚠️ Please connect your wallet first');
      return;
    }

    try {
      console.log('🎁 Minting 1000 mUSDC to:', address);
      addMessage('system', '⏳ Minting 1000 mUSDC...');
      
      writeContract({
        address: CONTRACTS.MOCK_USDC,
        abi: MOCK_USDC_ABI,
        functionName: 'mint',
        args: [BigInt(1000 * 10 ** 6)],
      });
      
      console.log('✅ Mint transaction submitted');
      
    } catch (error: any) {
      console.error('❌ Mint failed:', error);
      addMessage('system', `❌ Mint failed: ${error.message}`);
    }
  };

  const executeNextTransaction = async (txIndex: number) => {
    if (txIndex >= pendingTransactions.length) {
      console.log('✅ All transactions executed');
      return;
    }

    const tx = pendingTransactions[txIndex];
    console.log(`🔄 Executing transaction ${txIndex + 1}/${pendingTransactions.length}:`, tx);
    
    addMessage('system', `⏳ Step ${txIndex + 1}/${pendingTransactions.length}: ${tx.description}`);

    try {
      resetWrite();
      
      // Determine which contract and function from description
      if (tx.description.includes('Approve')) {
        const amount = tx.description.match(/(\d+)/)?.[0] || '100';
        
        writeContract({
          address: CONTRACTS.MOCK_USDC,
          abi: MOCK_USDC_ABI,
          functionName: 'approve',
          args: [CONTRACTS.MOCK_VAULT, BigInt(amount) * BigInt(10 ** 6)],
        });
        
      } else if (tx.description.includes('Deposit')) {
        const amount = tx.description.match(/(\d+)/)?.[0] || '100';
        const protocol = tx.description.match(/to (\w+)/)?.[1] || 'Morpho';
        
        writeContract({
          address: CONTRACTS.MOCK_VAULT,
          abi: MOCK_VAULT_ABI,
          functionName: 'deposit',
          args: [BigInt(amount) * BigInt(10 ** 6), protocol, 'Lending'],
        });
      }
      
      console.log(`✅ Transaction ${txIndex + 1} submitted, waiting for confirmation...`);
      
    } catch (error: any) {
      console.error(`❌ Transaction ${txIndex + 1} failed:`, error);
      setExecutionStatus('error');
      addMessage('system', `❌ Transaction failed: ${error.message}`);
    }
  };

  const handleApprove = async () => {
    if (!sessionId) {
      console.error('❌ No session ID');
      addMessage('system', '❌ No session found');
      return;
    }

    if (!isConnected || !address) {
      console.error('❌ Wallet not connected');
      addMessage('system', '❌ Please connect your wallet first');
      return;
    }
    
    console.log('✅ User approved execution for session:', sessionId);
    
    setShowApproval(false);
    setIsLoading(true);
    addMessage('user', '✅ Approved execution');

    try {
      console.log('🔄 Calling approval API...');
      const response = await api.approve(sessionId, true);
      
      console.log('📥 Approval response:', response);

      const transactions = response.transactions || pendingTransactions;
      
      if (!transactions || transactions.length === 0) {
        console.warn('⚠️ No transactions to execute');
        addMessage('system', '⚠️ No transactions found. Please try your query again.');
        setIsLoading(false);
        return;
      }

      console.log(`🎯 Starting execution of ${transactions.length} transaction(s)`);
      setPendingTransactions(transactions);
      setCurrentTxIndex(0);
      setExecutionStatus('executing');
      
      executeNextTransaction(0);
      
    } catch (error: any) {
      console.error('❌ Approval failed:', error);
      addMessage('system', `❌ Approval failed: ${error.message}`);
      setExecutionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    console.log('🚫 User rejected execution');
    setShowApproval(false);
    setPendingTransactions([]);
    addMessage('user', '❌ Rejected execution');
    addMessage('agent', 'Execution cancelled. How else can I help you?');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-t-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🔍 ChainInsight</h1>
            <p className="text-gray-600 mt-1">Autonomous Web3 Research & Execution Agent</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Portfolio Toggle Button */}
            {isConnected && (
              <button
                onClick={() => setShowPortfolio(!showPortfolio)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                {showPortfolio ? '💬 Chat' : '📊 Portfolio'}
              </button>
            )}

            {/* Balance Display */}
            {isConnected && balance !== undefined ? (
              <div className="text-right">
                <div className="text-sm text-gray-500">mUSDC Balance</div>
                <div className="text-lg font-semibold">
                  {String(formatUnits(balance, 6))}
                </div>
              </div>
            ) : null}

            {/* Mint Button */}
            {isConnected && (
              <button
                onClick={handleMint}
                disabled={isConfirming}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                🎁 Mint Test USDC
              </button>
            )}

            {/* Wallet Connection */}
            {!isConnected ? (
              <button
                onClick={() => {
                  console.log('🔌 Connecting wallet...');
                  connect({ connector: connectors[0] });
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
              >
                <Wallet size={20} />
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <button
                  onClick={() => {
                    console.log('🔌 Disconnecting wallet...');
                    disconnect();
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat/Portfolio Section */}
      <div className="bg-white p-6 min-h-[500px] max-h-[600px] overflow-y-auto">
        {showPortfolio ? (
          <Portfolio />
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                <p className="text-lg mb-4">👋 Welcome! Ask me anything about DeFi protocols and yields.</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => setInput("What are the top DeFi protocols on Base?")}
                    className="block mx-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
                  >
                    What are the top DeFi protocols on Base?
                  </button>
                  <button 
                    onClick={() => setInput("Deposit 100 USDC to Morpho")}
                    className="block mx-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
                  >
                    Deposit 100 USDC to Morpho
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-purple-600 text-white' 
                        : msg.role === 'system'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                      {msg.content.includes('basescan.org') && (
                        <a 
                          href={msg.content.match(/https:\/\/[^\s]+/)?.[0]} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:text-blue-800 underline"
                        >
                          <ExternalLink size={14} />
                          View Transaction
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Approval Modal */}
      {showApproval && !showPortfolio && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 mb-2">⚠️ Approval Required</h3>
              <p className="text-yellow-800 mb-3">
                The agent has completed research and generated a strategy with {pendingTransactions.length} transaction(s). 
                Would you like to proceed with execution?
              </p>
              
              {pendingTransactions.length > 0 && (
                <div className="bg-white rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Transaction Steps:</p>
                  <ol className="text-sm text-gray-600 space-y-1">
                    {pendingTransactions.map((tx, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-semibold">{idx + 1}.</span>
                        <span>{tx.description}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={!isConnected || isLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  Approve & Execute
                </button>
                <button
                  onClick={handleReject}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50"
                >
                  ❌ Cancel
                </button>
              </div>
              
              {!isConnected && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle size={16} />
                  Connect wallet to approve execution
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!showPortfolio && (
        <form onSubmit={handleSubmit} className="bg-white rounded-b-2xl p-6 shadow-lg">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about DeFi protocols, yields, or strategies..."
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              disabled={isLoading || executionStatus === 'executing'}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || executionStatus === 'executing'}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send />
            </button>
          </div>
        </form>
      )}

      {/* Transaction Status */}
      {isConfirming && !showPortfolio && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            <p className="text-blue-800">
              ⏳ Confirming transaction {currentTxIndex + 1}/{pendingTransactions.length}...
            </p>
          </div>
        </div>
      )}
      
      {executionStatus === 'success' && !showPortfolio && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-green-600" size={20} />
            <p className="text-green-800 font-semibold">
              🎉 All transactions completed successfully!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
