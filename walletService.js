// Mock custodial wallet layer for the prototype.
// This stores no private keys and creates no real blockchain wallet.
const wallets = new Map();

function safeUserId(userId) {
  return String(userId || "anonymous").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

export function getOrCreateWallet(userId) {
  const normalizedUserId = safeUserId(userId);
  if (!wallets.has(normalizedUserId)) {
    wallets.set(normalizedUserId, {
      userId: normalizedUserId,
      address: `mock-wallet-${normalizedUserId}`,
      network: "mock-sepolia",
      isCustodial: true,
      isReal: false,
      createdAt: new Date().toISOString()
    });
  }
  return wallets.get(normalizedUserId);
}

export function getWallet(userId) {
  return wallets.get(safeUserId(userId)) || null;
}
