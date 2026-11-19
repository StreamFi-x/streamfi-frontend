import React from "react";
import { render, screen } from "@testing-library/react";
import { StellarNetworkBadge } from "../StellarNetworkBadge";

describe("StellarNetworkBadge (#1739)", () => {
  const originalNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  afterEach(() => {
    if (originalNetwork === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
    }
  });

  it("renders a prominent Testnet pill when NEXT_PUBLIC_STELLAR_NETWORK is testnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    render(<StellarNetworkBadge variant="pill" />);

    const badge = screen.getByTestId("stellar-network-badge");
    expect(badge).toHaveAttribute("data-network", "testnet");
    expect(badge).toHaveTextContent("Testnet");
  });

  it("defaults to Testnet when NEXT_PUBLIC_STELLAR_NETWORK is unset", () => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    render(<StellarNetworkBadge />);

    const badge = screen.getByTestId("stellar-network-badge");
    expect(badge).toHaveAttribute("data-network", "testnet");
    expect(badge).toHaveTextContent("Testnet");
  });

  it("renders a Testnet warning banner when variant is banner", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    render(<StellarNetworkBadge variant="banner" />);

    const badge = screen.getByTestId("stellar-network-badge");
    expect(badge).toHaveAttribute("data-network", "testnet");
    expect(badge).toHaveTextContent("Stellar Testnet");
    expect(badge).toHaveTextContent(/no real value/i);
  });

  it("renders a Mainnet pill when NEXT_PUBLIC_STELLAR_NETWORK is mainnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    render(<StellarNetworkBadge variant="pill" />);

    const badge = screen.getByTestId("stellar-network-badge");
    expect(badge).toHaveAttribute("data-network", "mainnet");
    expect(badge).toHaveTextContent("Mainnet");
  });

  it("renders a Mainnet banner when network prop is mainnet", () => {
    render(<StellarNetworkBadge network="mainnet" variant="banner" />);

    const badge = screen.getByTestId("stellar-network-badge");
    expect(badge).toHaveAttribute("data-network", "mainnet");
    expect(badge).toHaveTextContent("Stellar Mainnet");
  });
});
