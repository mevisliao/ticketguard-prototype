# TicketGuard Prototype

This prototype demonstrates:

- seller-initiated official-ticket verification;
- a buyer total spending limit of 1.2 times the original ticket price;
- 3% Seller commission and 3% Buyer service fee;
- platform-covered blockchain gas costs;
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
   resale price. The maximum is calculated as:

   `maximum resale price = (original price x 1.2) / (1 + 3% Buyer service fee)`

   This ensures that the buyer's ticket price plus the 3% Buyer service fee
   stays within the buyer total spending limit. Blockchain gas is covered by
   the platform fees and is not charged separately.
3. The seller enters a resale price. The frontend shows an immediate warning
   if the price is above the limit.
4. When the seller clicks **Verify and list**, the backend checks that the
   ticket exists, is valid, belongs to the seller, is transferable, and has no
   active resale.
5. If verification succeeds, the ticket status changes to `Listed` and it
   becomes available in the Marketplace. The seller's estimated payout is the
   listed price minus the 3% Seller commission.

### 3. Ticket Bank for the Seller demo

The repository includes `ticket-bank.xlsx`, a reference dataset containing 50
mock tickets for Seller demonstrations. It is not connected to the backend and
does not automatically change the website data.

To use it during a demo:

1. Open `ticket-bank.xlsx` and choose a ticket row.
2. Copy the `Ticket ID` into the Seller panel.
3. Copy the matching `Current owner` into the Seller account field.
4. Check that the ticket has `Status = Owned`, `Valid = Yes`, and
   `Transferable = Yes`.
5. Enter a resale price within the maximum resale price shown by the Seller
   panel.
6. Click **Verify and list**. The mock backend verifies the ticket information
   and lists the ticket in the Marketplace if the information is valid.

The `Original price (SGD)` column is used to calculate the buyer total limit
and the maximum resale price. The `Resale price (SGD)` column is initially
blank because the Seller chooses the resale price during the demonstration.

### 4. Fee policy

- Seller commission: 3% of the listed resale price.
- Buyer service fee: 3% of the listed resale price.
- Buyer estimated payment: listed price plus the 3% Buyer service fee.
- Blockchain gas: paid by the platform through the service-fee revenue; it is
  not added as a second charge to either party.
- If actual blockchain gas is higher than the platform estimate, the platform
  absorbs the difference.

### 5. Buyer flow

1. The buyer selects a listed ticket from the Marketplace.
2. The ticket ID can be filled from the Marketplace or entered manually. The
   buyer also enters a buyer account.
3. After both the ticket ID and buyer account are entered, the Buyer panel
   displays the estimated payment as `listed price + 3% Buyer service fee`.
4. The buyer selects a mock payment method:
   `Mock Apple Pay`, `Mock Credit Card`, `Mock PayNow`, or `Mock Bank Transfer`.
5. When the buyer clicks **Pay and transfer**, the backend simulates payment
   confirmation and official ownership transfer.
6. The ticket owner changes to the buyer. `TransferCompleted` is recorded in
   the history, and the final ticket status becomes `Owned` for the new buyer.

### 6. Ticket statuses

- `Owned`: held by the current owner and not listed for resale.
- `Listed`: verified and available for purchase.
- `PaymentConfirmed`: buyer payment has been confirmed.
- `TransferPending`: payment is complete and official transfer is pending.
- `TransferCompleted`: transfer event is complete; after the event, the ticket's current status becomes `Owned` for the new owner.

### 7. Ticket chain memory

Each ticket stores a history of important events, including issuance, primary
purchase, listing, payment confirmation, and ownership transfer. The
**Ticket chain memory** panel displays this history for the selected ticket.

### 8. AI Agent

The Agent panel provides simple prototype explanations about verification,
resale, price limits, and transfer status. It is a mock interface and does not
connect to an external AI service.

### 9. Deployment and updates

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
9. Test `createOfficialTicket`, `listTicket`, `confirmPayment(ticketId,
   buyer, paidBuyerTotal)`, `markTransferPending`, and `completeTransfer`.

## Important limitation

The prototype uses a mock official provider. A real implementation requires an
API, partnership, or authorized transfer mechanism from the original provider.
Screenshots alone cannot prove ticket validity.

Ticket data is currently stored in memory in `server.js`. Restarting the server
or redeploying the service resets the demo data to the initial ticket set.
