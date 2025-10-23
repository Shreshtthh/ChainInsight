import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { TrendingUp, Calendar, DollarSign, X, Loader2 } from 'lucide-react';
import { CONTRACTS, MOCK_VAULT_ABI } from '../lib/contracts';
import { useState } from 'react';

interface Position {
  amount: bigint;
  protocol: string;
  strategy: string;
  timestamp: bigint;
}

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);

  // Read positions from vault
  const { data: positionsData, isLoading, refetch } = useReadContract({
    address: CONTRACTS.MOCK_VAULT,
    abi: MOCK_VAULT_ABI,
    functionName: 'getPositions',
    args: address ? [address] : undefined,
  });

  const { writeContract, data: hash, error: writeError } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const positions = (positionsData as Position[] | undefined) || [];

  const handleWithdraw = async (positionId: number) => {
    console.log('🔄 Withdrawing position:', positionId);
    setWithdrawingId(positionId);

    try {
      writeContract({
        address: CONTRACTS.MOCK_VAULT,
        abi: MOCK_VAULT_ABI,
        functionName: 'withdraw',
        args: [BigInt(positionId)],
      });
    } catch (error: any | unknown) {
      console.error('❌ Withdraw failed:', error);
      setWithdrawingId(null);
    }
  };

  // Refetch positions after successful withdrawal
  if (isSuccess && withdrawingId !== null) {
    console.log('✅ Withdrawal successful, refetching positions...');
    refetch();
    setWithdrawingId(null);
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
        <p className="text-gray-500">Connect your wallet to view portfolio</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
        <Loader2 className="animate-spin mx-auto mb-2" size={32} />
        <p className="text-gray-500">Loading positions...</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
        <TrendingUp className="mx-auto mb-4 text-gray-300" size={48} />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Positions Yet</h3>
        <p className="text-gray-500">Deposit funds to start earning yield</p>
      </div>
    );
  }

  // Calculate total value
  const totalValue = positions.reduce((sum, pos) => sum + pos.amount, BigInt(0));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Your Portfolio</h2>
          <p className="text-gray-500 text-sm mt-1">{positions.length} active position(s)</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-purple-600">
            ${formatUnits(totalValue, 6)} <span className="text-lg text-gray-400">USDC</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {positions.map((position, index) => {
          const amountFormatted = formatUnits(position.amount, 6);
          const date = new Date(Number(position.timestamp) * 1000);
          const isWithdrawing = withdrawingId === index && (isConfirming || !isSuccess);

          return (
            <div 
              key={index} 
              className="border-2 border-gray-200 rounded-xl p-5 hover:border-purple-300 transition"
            >
              <div className="flex items-center justify-between">
                {/* Left side - Protocol info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <TrendingUp className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{position.protocol}</h3>
                      <p className="text-sm text-gray-500">{position.strategy} Strategy</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div className="flex items-center gap-2">
                      <DollarSign className="text-green-600" size={18} />
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {amountFormatted} USDC
                        </p>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2">
                      <Calendar className="text-blue-600" size={18} />
                      <div>
                        <p className="text-xs text-gray-500">Deposited</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {date.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side - Withdraw button */}
                <div className="ml-6">
                  <button
                    onClick={() => handleWithdraw(index)}
                    disabled={isWithdrawing}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isWithdrawing ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Withdrawing...
                      </>
                    ) : (
                      <>
                        <X size={18} />
                        Withdraw
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Position ID badge */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-400">Position #{index}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction status */}
      {isConfirming && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            <p className="text-blue-800">⏳ Withdrawal pending confirmation...</p>
          </div>
        </div>
      )}
      
      {hash && isSuccess && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-semibold mb-2">✅ Withdrawal successful!</p>
          <a 
            href={`https://sepolia.basescan.org/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline text-sm hover:text-blue-800"
          >
            View on BaseScan →
          </a>
        </div>
      )}

      {writeError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ Withdrawal failed: {writeError.message}</p>
        </div>
      )}
    </div>
  );
}
