// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TicketGuard {
    uint256 public constant BUYER_SERVICE_FEE_BPS = 300; // 3%
    uint256 public constant MAX_BUYER_TOTAL_BPS = 12000; // 1.2x original price
    // Demo accounting unit for platform cost tracking. It is covered by
    // platform fees and is not added as a separate buyer charge.
    uint256 public constant ESTIMATED_BLOCKCHAIN_FEE = 50;

    enum Status { Issued, Owned, Listed, PaymentConfirmed, TransferPending, TransferCompleted, Cancelled, Used }

    struct Ticket {
        string ticketId;
        string eventName;
        string seat;
        address currentOwner;
        uint256 originalPrice;
        uint256 resalePrice;
        Status status;
        bool transferable;
        uint256 lastUpdated;
        address pendingBuyer;
    }

    mapping(string => Ticket) public tickets;
    address public organizer;
    address public authorizedBackend;

    event TicketCreated(string ticketId, address owner, uint256 originalPrice);
    event TicketListed(string ticketId, address owner, uint256 resalePrice);
    event PaymentConfirmed(string ticketId, address buyer, uint256 amount);
    event TransferPending(string ticketId);
    event TransferCompleted(string ticketId, address previousOwner, address newOwner);
    event TicketRedeemed(string ticketId, address owner);

    constructor(address _authorizedBackend) {
        organizer = msg.sender;
        authorizedBackend = _authorizedBackend;
    }

    modifier onlyOrganizer() {
        require(msg.sender == organizer, "Only organizer");
        _;
    }

    modifier onlyBackend() {
        require(msg.sender == authorizedBackend, "Only authorized backend");
        _;
    }

    function createOfficialTicket(
        string memory ticketId,
        string memory eventName,
        string memory seat,
        address originalOwner,
        uint256 originalPrice,
        bool transferable
    ) external onlyOrganizer {
        require(bytes(tickets[ticketId].ticketId).length == 0, "Already exists");
        tickets[ticketId] = Ticket(ticketId, eventName, seat, originalOwner, originalPrice, 0, Status.Owned, transferable, block.timestamp, address(0));
        emit TicketCreated(ticketId, originalOwner, originalPrice);
    }

    function listTicket(string memory ticketId, uint256 resalePrice) external {
        Ticket storage t = tickets[ticketId];
        require(t.currentOwner == msg.sender, "Not owner");
        require(t.transferable, "Not transferable");
        require(t.status == Status.Owned, "Cannot list");
        require(resalePrice > 0, "Invalid price");
        require(buyerTotal(resalePrice) <= maximumBuyerTotal(t.originalPrice), "Buyer total exceeds cap");
        t.resalePrice = resalePrice;
        t.status = Status.Listed;
        t.lastUpdated = block.timestamp;
        emit TicketListed(ticketId, msg.sender, resalePrice);
    }

    function confirmPayment(string memory ticketId, address buyer, uint256 paidBuyerTotal) external onlyBackend {
        Ticket storage t = tickets[ticketId];
        require(t.status == Status.Listed, "Not listed");
        require(buyer != address(0), "Invalid buyer");
        require(paidBuyerTotal == buyerTotal(t.resalePrice), "Buyer total does not match quote");
        require(paidBuyerTotal <= maximumBuyerTotal(t.originalPrice), "Buyer total exceeds cap");
        t.pendingBuyer = buyer;
        t.status = Status.PaymentConfirmed;
        t.lastUpdated = block.timestamp;
        emit PaymentConfirmed(ticketId, buyer, t.resalePrice);
    }

    function markTransferPending(string memory ticketId) external onlyBackend {
        Ticket storage t = tickets[ticketId];
        require(t.status == Status.PaymentConfirmed, "Payment not confirmed");
        t.status = Status.TransferPending;
        t.lastUpdated = block.timestamp;
        emit TransferPending(ticketId);
    }

    function completeTransfer(string memory ticketId, address newOwner) external onlyBackend {
        Ticket storage t = tickets[ticketId];
        require(t.status == Status.TransferPending, "Transfer not pending");
        require(t.pendingBuyer != address(0), "Buyer not confirmed");
        require(newOwner == t.pendingBuyer, "New owner is not the confirmed buyer");
        address previousOwner = t.currentOwner;
        t.currentOwner = newOwner;
        t.pendingBuyer = address(0);
        t.status = Status.TransferCompleted;
        t.lastUpdated = block.timestamp;
        emit TransferCompleted(ticketId, previousOwner, newOwner);
        // TransferCompleted is the event record. The current state after a
        // successful transfer is Owned by the new owner, matching the backend.
        t.status = Status.Owned;
        t.lastUpdated = block.timestamp;
    }

    function redeemTicket(string memory ticketId) external onlyBackend {
        Ticket storage t = tickets[ticketId];
        require(bytes(t.ticketId).length != 0, "Ticket does not exist");
        require(t.status == Status.Owned, "Ticket is not redeemable");
        require(t.transferable, "Ticket is not transferable");
        t.status = Status.Used;
        t.transferable = false;
        t.lastUpdated = block.timestamp;
        emit TicketRedeemed(ticketId, t.currentOwner);
    }

    function getTicket(string memory ticketId) external view returns (Ticket memory) {
        return tickets[ticketId];
    }

    function buyerServiceFee(uint256 resalePrice) public pure returns (uint256) {
        return resalePrice * BUYER_SERVICE_FEE_BPS / 10000;
    }

    function buyerTotal(uint256 resalePrice) public pure returns (uint256) {
        return resalePrice + buyerServiceFee(resalePrice);
    }

    function maximumBuyerTotal(uint256 originalPrice) public pure returns (uint256) {
        return originalPrice * MAX_BUYER_TOTAL_BPS / 10000;
    }

    function maximumResalePrice(uint256 originalPrice) public pure returns (uint256) {
        uint256 cap = maximumBuyerTotal(originalPrice);
        return cap * 10000 / (10000 + BUYER_SERVICE_FEE_BPS);
    }
}
