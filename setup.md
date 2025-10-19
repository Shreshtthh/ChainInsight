# ChainInsight Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Base Sepolia testnet wallet with some test ETH
- Gemini API key (free from ai.google.dev)
- Etherscan API key (free from etherscan.io)

## Quick Start

### 1. Install Dependencies
npm install

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in:
cp .env.example .env
Edit `.env`:
GOOGLE_API_KEY=your_gemini_key
TESTNET_PRIVATE_KEY=your_wallet_private_key
BASE_SEPOLIA_RPC=https://sepolia.base.org
ETHERSCAN_API_KEY=your_etherscan_key


### 3. Run Development Mode
npm run dev


### 4. Build for Production
npm run build
npm start


## Get API Keys

### Gemini API (Required)
1. Visit https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy key to .env

### Etherscan API (Required)
1. Visit https://etherscan.io/apis
2. Register account
3. Create API key
4. Copy to .env

### Base Sepolia Testnet
1. Add Base Sepolia to MetaMask
2. Get test ETH from Base Sepolia faucet
3. Export private key (keep secure!)
4. Add to .env

## Testing

Try these queries:
- "Find the best yield on Base"
- "Analyze Aave protocol"
- "What's trending in DeFi?"
