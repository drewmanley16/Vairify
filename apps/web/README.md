# Vairify web app

Next.js App Router frontend for the VairifyEscrow contract (see ../contracts).

## Run
```bash
cd apps/web
cp .env.example .env.local   # fill NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS after deploying
npm install
npm run dev
```

## Config
- `NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS`: deployed VairifyEscrow address. Without it, pages show an honest configuration state and no fake data.
- `NEXT_PUBLIC_CHAIN_ID`: default 84532 (Base Sepolia).
- `NEXT_PUBLIC_USDC_ADDRESS`: default Base Sepolia USDC 0x036CbD53842c5426634e7929541eC2318f3dCF7e (verify at developers.circle.com before mainnet use).
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: WalletConnect Cloud project ID; a placeholder will not connect wallets in production.

## Dashboard indexing limitation
There is no separate indexer in this MVP. The dashboard scans the most recent 50 payment IDs via the contract's `nextPaymentId`, plus IDs saved in the browser's localStorage when a payment is created, plus any ID entered manually. Older payments outside that window will not appear unless their ID is entered.

## Security
The contract is unaudited. Do not use it with real funds without an independent security review. A wallet signature proves wallet authorization, not real-world identity.
