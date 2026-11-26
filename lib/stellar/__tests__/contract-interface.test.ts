import {
  STREAMFI_CONTRACT_INTERFACE,
  isContractInterfaceCompatible,
} from "../contract-interface.fixture";

describe("StreamFi frontend contract interface fixture (#1700)", () => {
  it("declares the tipping contract methods the frontend depends on", () => {
    expect(STREAMFI_CONTRACT_INTERFACE.version).toBe(1);
    expect(Object.keys(STREAMFI_CONTRACT_INTERFACE.contracts.tipping.methods)).toEqual([
      "buildTipTransaction",
      "submitTransaction",
    ]);
  });

  it("matches buildTipTransaction argument and return-shape assumptions", () => {
    const spec = STREAMFI_CONTRACT_INTERFACE.contracts.tipping.methods.buildTipTransaction;
    expect(spec.args).toEqual({
      sourcePublicKey: "string",
      destinationPublicKey: "string",
      amount: "string",
      network: ["testnet", "mainnet"],
    });
    expect(spec.returns).toEqual({
      type: "StellarTransaction",
      requiredMethods: ["toXDR", "sign"],
    });
  });

  it("matches submitTransaction argument and return-shape assumptions", () => {
    const spec = STREAMFI_CONTRACT_INTERFACE.contracts.tipping.methods.submitTransaction;
    expect(spec.args).toEqual({
      signedTransaction: "StellarTransaction",
      network: ["testnet", "mainnet"],
    });
    expect(spec.returns).toEqual({
      success: "boolean",
      hash: "string?",
      ledger: "number?",
      error: "string?",
      resultCode: "string?",
    });
  });

  it("fails when a deliberately breaking mock change alters a return shape", () => {
    const broken = JSON.parse(JSON.stringify(STREAMFI_CONTRACT_INTERFACE));
    broken.contracts.tipping.methods.submitTransaction.returns.hash = "number?";

    expect(isContractInterfaceCompatible(broken)).toBe(false);
    expect(isContractInterfaceCompatible(STREAMFI_CONTRACT_INTERFACE)).toBe(true);
  });
});
