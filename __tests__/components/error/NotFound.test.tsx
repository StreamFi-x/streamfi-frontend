/**
 * Tests for NotFound component - prefers-reduced-motion accessibility (#1698)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import NotFound from "@/components/error/NotFound";
import { useReducedMotion } from "framer-motion";

jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion");
  return {
    ...actual,
    useReducedMotion: jest.fn(),
  };
});

describe("NotFound component (#1698)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with default motion", () => {
    (useReducedMotion as jest.Mock).mockReturnValue(false);

    render(<NotFound />);

    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(screen.getByText("Go Home")).toBeInTheDocument();
    expect(screen.getByText("Explore Streams")).toBeInTheDocument();
  });

  it("respects prefers-reduced-motion without crashing and displays static accessible content", () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);

    const { container } = render(<NotFound />);

    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(screen.getByText("Go Home")).toBeInTheDocument();
    expect(screen.getByText("Explore Streams")).toBeInTheDocument();

    // With reduced motion, floating background particles are not rendered
    const animatedBg = container.querySelector(".pointer-events-none");
    expect(animatedBg).toBeNull();
  });
});
