import { FunctionTool, ToolContext } from '@iqai/adk';
import { ethers } from 'ethers';

/**
 * Simulate transaction execution
 */
async function simulateTransaction(
  params: {
    to: string;
    data?: string;
    value?: string;
  },
  toolContext: ToolContext
) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
    const wallet = new ethers.Wallet(process.env.TESTNET_PRIVATE_KEY!, provider);

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      from: wallet.address,
      to: params.to,
      data: params.data || '0x',
      value: params.value ? ethers.parseEther(params.value) : 0n
    });

    // Get gas price
    const feeData = await provider.getFeeData();
    const gasCost = gasEstimate * (feeData.gasPrice || 0n);

    // Save simulation result
    const result = {
      success: true,
      gasEstimate: gasEstimate.toString(),
      gasCostInETH: ethers.formatEther(gasCost),
      to: params.to,
      value: params.value || '0',
      timestamp: new Date().toISOString()
    };

    toolContext.state.lastSimulation = result;

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed'
    };
  }
}

export const transactionSimulatorTool = new FunctionTool(simulateTransaction, {
  name: 'simulate_transaction',
  description: 'Simulate transaction execution and estimate gas costs before actual execution'
});
