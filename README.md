# Vairify

**Verify before you send.**

Vairify is a crypto payment security app for USDC transfers. A sender escrows the full amount in a smart contract, a tiny test payment goes to the recipient immediately, the recipient cryptographically confirms receipt with an EIP-712 signature, and only then does the sender explicitly release the remaining balance.

Example: a 5,000 USDC payment = 0.01 USDC test payment + 4,999.99 USDC final payment. The test amount counts toward the total, it is not charged on top.

> **Unaudited MVP, test funds only.** Do not use this contract with real funds without an independent security review. A wallet signature proves authorization by the receiving wallet, not the real-world identity of the intended recipient.

## Project structure

- `apps/web` - Next.js App Router frontend (landing, dashboard, send, transfer details, recipient verification)
- `contracts` - Foundry project with `VairifyEscrow.sol`, tests, and deployment script
- `.github/workflows/ci.yml` - lint, typecheck, build, and Foundry tests

## How it works

1. Sender approves USDC and calls `createPayment`. The contract pulls the total amount, sends 0.01 USDC to the recipient, and escrows the rest.
2. Recipient opens `/receive/[id]`, connects the receiving wallet, and signs an EIP-712 receipt binding payment ID, escrow contract, chain ID, sender, recipient, total, test amount, and expiration.
3. The contract verifies the signature, including ERC-1271 contract wallets, and moves the payment to awaiting sender approval.
4. Sender reviews the full recipient address and breakdown on `/transfer/[id]` and explicitly calls `releasePayment`. The remaining balance goes to the same recipient address. Release is never automatic.
5. Sender can cancel before release, and anyone can expire an overdue payment, refunding the remaining escrow to the sender.

## Environment variables

Frontend (`apps/web/.env.example`):

- `NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS` - deployed VairifyEscrow address (required for live flows; unset shows a configuration state, never fake data)
- `NEXT_PUBLIC_CHAIN_ID` - default `84532` (Base Sepolia)
- `NEXT_PUBLIC_USDC_ADDRESS` - default Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, verified on BaseScan Sepolia as the Circle FiatTokenProxy USDC token. Base mainnet USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA`. Re-verify both against Circle docs before any mainnet use.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - real WalletConnect project ID required for wallet connection in production

Deployment (never commit these):

- `VAIRIFY_USDC_ADDRESS` - USDC token address for the deployment script
- `PRIVATE_KEY` - deployer key, passed via environment only

## Run locally

### Frontend

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

### Contracts

```bash
cd contracts
forge build
forge test
```

Local chain:

```bash
anvil
# in another terminal, with VAIRIFY_USDC_ADDRESS set to a test token on the local chain
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### Base Sepolia deployment

```bash
cd contracts
export VAIRIFY_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast
```

Then set `NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS` to the deployed address and restart the frontend.

## Tests executed

- `forge test`: 22 passed, 0 failed, including deposit and test payment, recipient confirmation, sender release, wrong-wallet rejection, replay prevention (including cross-payment and cross-chain), duplicate release, cancel before and after approval, expiration and refund, invalid token/amount/address/deadline, concurrent escrow accounting, ERC-1271 wallets, reentrancy attempt, and a 256-run fuzz test.
- `npm run build` in `apps/web`: passes, 6 routes generated.

## Known limitations

- No escrow contract is deployed yet, so live end-to-end flows require deployment first.
- Dashboard has no separate indexer: it scans the most recent 50 payment IDs plus IDs saved in browser localStorage on creation, plus any ID entered manually.
- WalletConnect needs a real project ID; the placeholder will not connect wallets in production.
- The verification threshold on `/send` is a local user preference only. It is not enforced on-chain, and it does not apply to transfers made outside Vairify.
- ERC-1271 signature validation happens at confirmation time. A later revocation cannot undo a confirmation already recorded on-chain.
- Contract is unaudited. See `contracts/src/VairifyEscrow.sol` comments and the security notes in `apps/web/README.md` for details.

### Installing contract dependencies

After cloning, install Foundry dependencies (they are not committed):

```bash
cd contracts
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
```
