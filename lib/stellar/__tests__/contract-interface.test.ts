import { STREAMFI_CONTRACT_INTERFACE } from "../contract-interface.fixture";

describe("StreamFi frontend contract interface fixture", () => {
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

  it("matches submitTransaction return-shape assumptions", () => {
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

  it("demonstrates CI catches incompatible contract shape changes", () => {
    const required = STREAMFI_CONTRACT_INTERFACE.contracts.tipping.methods
      .submitTransaction.returns;
    expect(required.hash).toBe("string?");
    expect(required.success).toBe("boolean");
  });
});
