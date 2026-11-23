const WALLET_CONNECT_ID = "wallet_connect";

const WalletConnectAllowedMethods = {
  SIGN: "stellar_signXDR",
  SIGN_AND_SUBMIT: "stellar_signAndSubmitXDR",
};

const WalletConnectTargetChain = {
  PUBLIC: "stellar:pubnet",
  TESTNET: "stellar:testnet",
};

class WalletConnectModule {
  constructor(wcParams) {
    this.wcParams = wcParams;
    this.productId = WALLET_CONNECT_ID;
    this.productName = "Wallet Connect";
  }
  isAvailable = jest.fn().mockResolvedValue(true);
  getAddress = jest.fn().mockResolvedValue({ address: "" });
  signTransaction = jest.fn().mockResolvedValue({ signedTxXdr: "" });
  setSession = jest.fn();
  onSessionDeleted = jest.fn();
  connectWalletConnect = jest.fn();
  disconnect = jest.fn().mockResolvedValue(undefined);
  closeSession = jest.fn().mockResolvedValue(undefined);
  getSessions = jest.fn().mockResolvedValue([]);
}

module.exports = {
  WALLET_CONNECT_ID,
  WalletConnectAllowedMethods,
  WalletConnectTargetChain,
  WalletConnectModule,
};
