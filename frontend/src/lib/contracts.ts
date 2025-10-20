export const MOCK_USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(uint256 amount)",
  "function decimals() view returns (uint8)"
];

export const MOCK_VAULT_ABI = [
  "function deposit(uint256 amount, string protocol, string strategy) returns (uint256)",
  "function withdraw(uint256 positionId)",
  "function getPositions(address user) view returns (tuple(uint256 amount, string protocol, string strategy, uint256 timestamp)[])",
  "function getTotalDeposit(address user) view returns (uint256)"
];

export const CONTRACTS = {
  MOCK_USDC: import.meta.env.VITE_MOCK_USDC_ADDRESS as `0x${string}`,
  MOCK_VAULT: import.meta.env.VITE_MOCK_VAULT_ADDRESS as `0x${string}`,
};
