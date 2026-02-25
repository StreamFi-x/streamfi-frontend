"use client";

import { useState } from "react";
import { TipModal } from "@/components/tipping";
import { Button } from "@/components/ui/button";

/**
 * Test page for TipModal component
 * This page allows testing the TipModal functionality
 *
 * To use this page:
 * 1. Navigate to /test-tip
 * 2. Click "Open Tip Modal" button
 * 3. Enter sender and recipient public keys
 * 4. Test the tipping flow
 */
export default function TestTipPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [senderPublicKey, setSenderPublicKey] = useState("");
  const [recipientPublicKey, setRecipientPublicKey] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("testuser");

  const handleOpenModal = () => {
    // Validate that keys are provided
    if (!senderPublicKey || !recipientPublicKey) {
      alert("Please enter both sender and recipient public keys");
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">TipModal Test Page</h1>
          <p className="text-muted-foreground">
            Test the TipModal component functionality
          </p>
        </div>

        <div className="space-y-6 p-6 border rounded-lg bg-card">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="sender" className="text-sm font-medium">
                Sender Public Key (Your Wallet)
              </label>
              <input
                id="sender"
                type="text"
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={senderPublicKey}
                onChange={(e) => setSenderPublicKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Enter your Stellar public key (starts with G)
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="recipient" className="text-sm font-medium">
                Recipient Public Key
              </label>
              <input
                id="recipient"
                type="text"
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={recipientPublicKey}
                onChange={(e) => setRecipientPublicKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Enter the recipient's Stellar public key
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Recipient Username (Display Name)
              </label>
              <input
                id="username"
                type="text"
                placeholder="testuser"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
          </div>

          <Button
            onClick={handleOpenModal}
            className="w-full"
            size="lg"
          >
            Open Tip Modal
          </Button>

          <div className="space-y-2 p-4 bg-muted rounded-lg text-sm">
            <p className="font-semibold">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Make sure you have Freighter wallet extension installed</li>
              <li>Ensure you have a funded testnet account</li>
              <li>Enter your public key as the sender</li>
              <li>Enter a valid recipient public key</li>
              <li>Click "Open Tip Modal" to test the component</li>
            </ol>
          </div>

          <div className="space-y-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
            <p className="font-semibold text-blue-500">
              Environment Variables Required:
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-400">
              <li>
                <code>NEXT_PUBLIC_STELLAR_HORIZON_URL</code> - Horizon server
                URL
              </li>
              <li>
                <code>NEXT_PUBLIC_STELLAR_NETWORK</code> - "public" or
                "testnet"
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* TipModal Component */}
      {senderPublicKey && recipientPublicKey && (
        <TipModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          recipientUsername={recipientUsername}
          recipientPublicKey={recipientPublicKey}
          senderPublicKey={senderPublicKey}
        />
      )}
    </div>
  );
}
