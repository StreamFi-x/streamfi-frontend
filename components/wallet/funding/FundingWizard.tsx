"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INTRO_STEPS } from "@/lib/onboarding/funding-machine";
import { useFundingOnboarding } from "./FundingOnboardingProvider";

function AddressBox({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the address stays selectable.
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code className="flex-1 break-all text-xs" data-testid="wallet-address">
        {address}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        aria-label="Copy wallet address"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function OtherWays({ address }: { address: string | null }) {
  if (!address) {
    return null;
  }
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        Already have XLM on an exchange or in another wallet? Send at least 1
        XLM to your StreamFi wallet address:
      </p>
      <AddressBox address={address} />
    </div>
  );
}

const INTRO_COPY: Record<
  (typeof INTRO_STEPS)[number],
  { title: string; body: string[] }
> = {
  wallet: {
    title: "You have a StreamFi wallet",
    body: [
      "When you signed up, StreamFi created a wallet for you. It is how tips and other payments work here, and StreamFi keeps it secure for you.",
      "It is empty right now. That is normal for a new account: nothing is wrong.",
    ],
  },
  xlm: {
    title: "What is XLM?",
    body: [
      "XLM (Stellar Lumens) is the digital currency your wallet holds. Tips on StreamFi are sent in XLM.",
      "A new wallet becomes active on the Stellar network once it receives at least 1 XLM, which stays in the wallet as a small reserve.",
    ],
  },
  how: {
    title: "How to add funds",
    body: [
      "You can buy XLM with a card or bank transfer through Transak, our payment partner. Transak handles the payment and any identity checks; StreamFi never sees your card details.",
      "Transak decides which payment methods are available and may ask for ID, depending on your country. In some countries it may not be available at all.",
    ],
  },
};

export function FundingWizard() {
  const ctx = useFundingOnboarding();
  if (!ctx) {
    return null;
  }
  const { machine, address, widgetOpen } = ctx;
  const visible =
    machine.open && !widgetOpen && machine.state !== "not_applicable";

  let title = "";
  let description = "";
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  switch (machine.state) {
    case "intro": {
      const step = INTRO_STEPS[machine.introStep];
      const copy = INTRO_COPY[step];
      const last = machine.introStep === INTRO_STEPS.length - 1;
      title = copy.title;
      description = `Step ${machine.introStep + 1} of ${INTRO_STEPS.length}`;
      body = (
        <div className="space-y-3 text-sm">
          {copy.body.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {last && <OtherWays address={address} />}
        </div>
      );
      actions = (
        <>
          <Button variant="ghost" onClick={ctx.defer}>
            Maybe later
          </Button>
          {machine.introStep > 0 && (
            <Button variant="outline" onClick={ctx.back}>
              Back
            </Button>
          )}
          {last ? (
            <Button onClick={ctx.startFunding}>Add funds with Transak</Button>
          ) : (
            <Button onClick={ctx.next}>Next</Button>
          )}
        </>
      );
      break;
    }
    case "funding":
      title = "Opening Transak";
      description = "Complete your purchase in the Transak window.";
      body = <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
      break;
    case "pending":
      title = machine.stalled
        ? "Your purchase is taking longer than usual"
        : "Your purchase is on its way";
      description = machine.stalled
        ? "Your wallet has not received the XLM yet."
        : "Transak is processing your order.";
      body = (
        <div className="space-y-3 text-sm">
          {machine.stalled ? (
            <p>
              Check the email Transak sent you for the status of your order. If
              Transak says the order failed or was refunded, you can try again.
              If it is still processing, there is no need to buy again.
            </p>
          ) : (
            <>
              <p>
                XLM usually arrives within a few minutes, but it can take
                longer. You do not need to buy again: this updates on its own
                when the funds reach your wallet.
              </p>
              <p>You can close this and keep using StreamFi meanwhile.</p>
            </>
          )}
          {!machine.stalled && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for your
              wallet balance to update
            </p>
          )}
        </div>
      );
      actions = (
        <>
          {machine.stalled && (
            <Button variant="outline" onClick={ctx.startFunding}>
              Try again
            </Button>
          )}
          <Button onClick={ctx.close}>Close</Button>
        </>
      );
      break;
    case "success":
      title = "Your wallet is funded";
      description = "Your XLM has arrived and your wallet is active.";
      actions = <Button onClick={ctx.close}>Done</Button>;
      break;
    case "abandoned":
      title = "No purchase was made";
      description = "Transak was closed before an order was placed.";
      body = (
        <div className="space-y-3 text-sm">
          <p>You can continue whenever you are ready.</p>
          <OtherWays address={address} />
        </div>
      );
      actions = (
        <>
          <Button variant="ghost" onClick={ctx.defer}>
            Maybe later
          </Button>
          <Button onClick={ctx.startFunding}>Continue with Transak</Button>
        </>
      );
      break;
    case "failed":
      title = machine.unavailable
        ? "Adding funds is not available right now"
        : "Your purchase did not go through";
      description = machine.unavailable
        ? "Transak could not be opened."
        : "Transak reported that the order did not complete.";
      body = (
        <div className="space-y-3 text-sm">
          {!machine.unavailable && (
            <p>
              Transak&apos;s emails have the details of what happened. Payment
              methods, ID checks and availability are decided by Transak and can
              depend on your country; StreamFi cannot change them.
            </p>
          )}
          <OtherWays address={address} />
        </div>
      );
      actions = (
        <>
          <Button variant="ghost" onClick={ctx.defer}>
            Maybe later
          </Button>
          <Button onClick={ctx.startFunding}>Try again</Button>
        </>
      );
      break;
    default:
      break;
  }

  return (
    <Dialog
      open={visible}
      onOpenChange={next => {
        if (!next) {
          ctx.close();
        }
      }}
    >
      <DialogContent className="sm:max-w-[460px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-highlight" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {body}
        {actions && (
          <DialogFooter className="gap-2 sm:gap-2">{actions}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
