# TicketGuard Prototype

This prototype demonstrates:

- seller-initiated official-ticket verification;
- resale-price limit of 1.2 times the original price;
- payment confirmation and official-transfer states;
- ticket chain memory/history;
- a simple agent interface;
- a Solidity smart contract for the blockchain layer.

## Run the mock website

```bash
npm install
npm start
```

Open `http://localhost:3000`.

The mock provider is stored in `server.js`. It simulates the API of SISTIC,
Ticketmaster, or another official ticket provider. The payment and official
transfer are also simulated for demonstration.

## Deploy the smart contract according to the lecture workflow

1. Install MetaMask and select Sepolia.
2. Obtain Sepolia test ETH from a testnet faucet.
3. Open Remix IDE.
4. Open `contracts/TicketGuard.sol`.
5. Compile with Solidity 0.8.20.
6. Select Injected Provider - MetaMask under Deploy & Run.
7. Deploy with an authorized backend address.
8. Copy the contract address and ABI.
9. Test `createOfficialTicket`, `listTicket`, `confirmPayment`,
   `markTransferPending`, and `completeTransfer`.

## Important limitation

The prototype uses a mock official provider. A real implementation requires an
API, partnership, or authorized transfer mechanism from the original provider.
Screenshots alone cannot prove ticket validity.
