import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Send, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { CONTRACTS, MOCK_USDC_ABI, MOCK_VAULT_ABI } from '../lib/contracts';

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showApproval, setShowApproval] = useState(false);

  const { address, isConnected } = useAccount();
  
  // Read USDC balance
  // Near the top, update the balance reading:
  const { data: balanceData } = useReadContract({
    address: CONTRACTS.MOCK_USDC,
    abi: MOCK_USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const balance = balanceData as bigint | undefined;


  const { writeContract, data: hash } = useWriteContract();
  
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  });

  const addMessage = (role: 'user' | 'agent', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput('');
    addMessage('user', query);
    setIsLoading(true);

    try {
      const response = await api.query(query, sessionId || undefined);
      setSessionId(response.sessionId);
      addMessage('agent', response.response);

      if (response.requiresApproval) {
        setShowApproval(true);
      }
    } catch (error) {
      addMessage('agent', 'Sorry, there was an error processing your request.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sessionId) return;
    
    setShowApproval(false);
    setIsLoading(true);
    addMessage('user', '✅ Approved execution');

    try {
      const response = await api.approve(sessionId, true);
      addMessage('agent', response.response);

      // Example: Execute deposit transaction
      // In production, agent would return tx params
      if (isConnected && address) {
        // Approve USDC first
        writeContract({
          address: CONTRACTS.MOCK_USDC,
          abi: MOCK_USDC_ABI,
          functionName: 'approve',
          args: [CONTRACTS.MOCK_VAULT, parseUnits('100', 6)],
        });

        // Then deposit (in real app, wait for approval first)
        setTimeout(() => {
          writeContract({
            address: CONTRACTS.MOCK_VAULT,
            abi: MOCK_VAULT_ABI,
            functionName: 'deposit',
            args: [parseUnits('100', 6), 'Morpho', 'Lending'],
          });
        }, 2000);
      }
    } catch (error) {
      addMessage('agent', 'Execution failed. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    setShowApproval(false);
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
            {isConnected && balance !== undefined && balance !== 0n ? (
            <div className="text-right">
              <div className="text-sm text-gray-500">mUSDC Balance</div>
                <div className="text-lg font-semibold">
                    {String(formatUnits(balance as bigint, 6))}
                </div>
              </div>
              ) : isConnected ? (
              <div className="text-right">
              <div className="text-sm text-gray-500">mUSDC Balance</div>
              <div className="text-lg font-semibold">0.00</div>
            </div>
            ) : null}
            <ConnectButton />
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="bg-white p-6 min-h-[500px] max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg mb-4">👋 Welcome! Ask me anything about DeFi protocols and yields.</p>
            <div className="space-y-2">
              <button 
                onClick={() => setInput("What are the top DeFi protocols on Base?")}
                className="block mx-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
              >
                What are the top DeFi protocols on Base?
              </button>
              <button 
                onClick={() => setInput("Find me a safe yield opportunity with >5% APY")}
                className="block mx-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
              >
                Find me a safe yield opportunity with &gt;5% APY
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
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <Loader2 className="animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApproval && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-4">
          <h3 className="text-lg font-bold text-yellow-900 mb-2">⚠️ Approval Required</h3>
          <p className="text-yellow-800 mb-4">
            The agent has completed research and generated a strategy. Would you like to proceed with execution?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ✅ Approve & Execute
            </button>
            <button
              onClick={handleReject}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="bg-white rounded-b-2xl p-6 shadow-lg">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about DeFi protocols, yields, or strategies..."
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send />
          </button>
        </div>
      </form>

      {/* Transaction Status */}
      {isConfirming && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">⏳ Transaction pending confirmation...</p>
        </div>
      )}
      {hash && !isConfirming && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">✅ Transaction confirmed!</p>
          <a 
            href={`https://sepolia.basescan.org/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline text-sm"
          >
            View on BaseScan →
          </a>
        </div>
      )}
    </div>
  );
}
