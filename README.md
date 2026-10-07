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

## How the website works

The website has a seller flow, a buyer flow, and a ticket-history view.

### 1. Marketplace

The Marketplace loads ticket data from `GET /api/tickets`. Users can select a
ticket from the dropdown to see its ticket ID, event, seat, current holder,
original price, resale price, and status. Only tickets with status `Listed`
can be purchased.

### 2. Seller flow

1. The seller enters a ticket ID and seller account.
2. The website looks up the original ticket price and displays the maximum
   resale price, calculated as `original price x 1.2`.
3. The seller enters a resale price. The frontend shows an immediate warning
   if the price is above the limit.
4. When the seller clicks **Verify and list**, the backend checks that the
   ticket exists, is valid, belongs to the seller, is transferable, and has no
   active resale.
5. If verification succeeds, the ticket status changes to `Listed` and it
   becomes available in the Marketplace.

### 3. Buyer flow

1. The buyer selects a listed ticket from the Marketplace.
2. The ticket ID is automatically filled into the Buyer form.
3. The buyer enters a buyer account and selects a mock payment method:
   `Mock Apple Pay`, `Mock Credit Card`, `Mock PayNow`, or `Mock Bank Transfer`.
4. When the buyer clicks **Pay and transfer**, the backend simulates payment
   confirmation and official ownership transfer.
5. The ticket owner changes to the buyer and the final status becomes
   `TransferCompleted`.

### 4. Ticket statuses

- `Owned`: held by the current owner and not listed for resale.
- `Listed`: verified and available for purchase.
- `PaymentConfirmed`: buyer payment has been confirmed.
- `TransferPending`: payment is complete and official transfer is pending.
- `TransferCompleted`: transfer event is complete; after the event, the ticket's current status becomes `Owned` for the new owner.

### 5. Ticket chain memory

Each ticket stores a history of important events, including issuance, primary
purchase, listing, payment confirmation, and ownership transfer. The
**Ticket chain memory** panel displays this history for the selected ticket.

### 6. AI Agent

The Agent panel provides simple prototype explanations about verification,
resale, price limits, and transfer status. It is a mock interface and does not
connect to an external AI service.

### 7. Deployment and updates

The project can be deployed as a Node web service on Render. The GitHub
repository is connected to Render, so pushing a new commit to the `main`
branch triggers a new deployment. After deployment completes, users can
refresh the public Render URL to see the latest version.

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

Ticket data is currently stored in memory in `server.js`. Restarting the server
or redeploying the service resets the demo data to the initial ticket set.
