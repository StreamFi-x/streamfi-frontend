/**
 * Focused regression coverage for the remaining icon transition on the 404
 * page. Upstream already gates particles and glitch motion; this verifies that
 * the icon swap is static too (#1698).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import NotFound from "@/components/error/NotFound";

const mockCapturedMotionProps: Array<Record<string, unknown>> = [];

jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion");
  const ReactModule = jest.requireActual("react") as typeof import("react");
  const componentCache = new Map<string, React.ComponentType<any>>();

  const createMotionComponent = (tag: string) =>
    ReactModule.forwardRef<HTMLElement, Record<string, unknown>>(
      (props, ref) => {
        mockCapturedMotionProps.push(props);
        const {
          initial,
          animate,
          exit,
          transition,
          variants,
          whileHover,
          whileTap,
          children,
          ...rest
        } = props as Record<string, unknown> & { children?: React.ReactNode };
        void initial;
        void animate;
        void exit;
        void transition;
        void variants;
        void whileHover;
        void whileTap;
        return ReactModule.createElement(tag, { ...rest, ref }, children);
      }
    );

  const motion = new Proxy(
    {},
    {
      get: (_target, tag) => {
        if (typeof tag !== "string") return undefined;
        let component = componentCache.get(tag);
        if (!component) {
          component = createMotionComponent(tag);
          componentCache.set(tag, component);
        }
        return component;
      },
    }
  );

  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: jest.fn(),
    motion,
  };
});

function containsRotate(value: unknown): boolean {
  return JSON.stringify(value ?? {}).includes("rotate");
}

describe("NotFound reduced-motion icon transition (#1698)", () => {
  beforeEach(() => {
    mockCapturedMotionProps.length = 0;
    jest.clearAllMocks();
  });

  it("renders the icon without rotation or scale animation when reduced motion is requested", () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);

    render(<NotFound />);

    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(
      mockCapturedMotionProps.some(
        (props) =>
          containsRotate(props.initial) ||
          containsRotate(props.animate) ||
          containsRotate(props.exit)
      )
    ).toBe(false);
  });

  it("keeps the rotating icon animation for users who allow motion", () => {
    (useReducedMotion as jest.Mock).mockReturnValue(false);

    render(<NotFound />);

    expect(
      mockCapturedMotionProps.some((props) => containsRotate(props.initial))
    ).toBe(true);
  });
});
