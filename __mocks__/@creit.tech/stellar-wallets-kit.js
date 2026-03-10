// Manual mock for @creit.tech/stellar-wallets-kit
// This package is pure ESM and depends on `lit` (web components), which is not
// relevant to unit tests. We stub the minimum API used in contexts and components.

const WalletNetwork = {
  PUBLIC: "PUBLIC",
  TESTNET: "TESTNET",
};

class StellarWalletsKit {
  constructor() {}
  openModal = jest.fn().mockResolvedValue(undefined);
  setWallet = jest.fn();
  getAddress = jest.fn().mockResolvedValue({ address: "" });
}

module.exports = { WalletNetwork, StellarWalletsKit };
