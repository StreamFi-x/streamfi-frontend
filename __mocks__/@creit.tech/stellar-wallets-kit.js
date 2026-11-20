// Manual mock for @creit.tech/stellar-wallets-kit
// This package is pure ESM and depends on `lit` (web components), which is not
// relevant to unit tests. We stub the minimum API used in contexts and components.

const WalletNetwork = {
  PUBLIC: "Public Global Stellar Network ; September 2015",
  TESTNET: "Test SDF Network ; September 2015",
};

const FREIGHTER_ID = "freighter";

const allowAllModules = jest.fn(() => []);

class StellarWalletsKit {
  constructor(params) {
    this.params = params;
    this.modules = params?.modules ?? [];
    this.selectedWalletId = params?.selectedWalletId ?? FREIGHTER_ID;
  }
  openModal = jest.fn().mockResolvedValue(undefined);
  setWallet = jest.fn(walletId => {
    this.selectedWalletId = walletId;
  });
  getAddress = jest.fn().mockResolvedValue({ address: "" });
  signTransaction = jest.fn().mockResolvedValue({ signedTxXdr: "" });
}

module.exports = {
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
  StellarWalletsKit,
};
