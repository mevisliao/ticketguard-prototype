// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TicketGuard {
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
        tickets[ticketId] = Ticket(ticketId, eventName, seat, originalOwner, originalPrice, 0, Status.Owned, transferable, block.timestamp);
        emit TicketCreated(ticketId, originalOwner, originalPrice);
    }

    function listTicket(string memory ticketId, uint256 resalePrice) external {
        Ticket storage t = tickets[ticketId];
        require(t.currentOwner == msg.sender, "Not owner");
        require(t.transferable, "Not transferable");
        require(t.status == Status.Owned || t.status == Status.TransferCompleted, "Cannot list");
        require(resalePrice > 0, "Invalid price");
        require(resalePrice <= t.originalPrice * 120 / 100, "Price exceeds 1.2x original price");
        t.resalePrice = resalePrice;
        t.status = Status.Listed;
        t.lastUpdated = block.timestamp;
        emit TicketListed(ticketId, msg.sender, resalePrice);
    }

    function confirmPayment(string memory ticketId, address buyer) external onlyBackend {
        Ticket storage t = tickets[ticketId];
        require(t.status == Status.Listed, "Not listed");
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
        address previousOwner = t.currentOwner;
        t.currentOwner = newOwner;
        t.status = Status.TransferCompleted;
        t.lastUpdated = block.timestamp;
        emit TransferCompleted(ticketId, previousOwner, newOwner);
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
}
