"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Info, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportLiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

interface ReportReason {
  id: string;
  title: string;
  description: string;
}

const reportReasons: ReportReason[] = [
  {
    id: "harassment",
    title: "Harassment",
    description:
      "This stream contains bullying, threatening behavior, or targeted harassment towards individuals or groups. This includes hate speech, doxxing, or encouraging harmful actions against others.",
  },
  {
    id: "inappropriate-content",
    title: "Inappropriate content",
    description:
      "The stream shows explicit sexual content, graphic violence, or other material not suitable for the platform. This includes nudity, excessive profanity, or disturbing imagery.",
  },
  {
    id: "misinformation",
    title: "Misinformation",
    description:
      "The streamer is spreading false information, conspiracy theories, or misleading content that could cause harm. This includes medical misinformation or election fraud claims.",
  },
];

export default function ReportLiveStreamModal({
  isOpen,
  onClose,
  username,
}: ReportLiveStreamModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason("");
      setIsSubmitted(false);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedReason) return;

    console.log("Report submitted:", {
      username,
      reason: selectedReason,
      timestamp: new Date().toISOString(),
    });

    setIsSubmitted(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] bg-[#151515] text-white p-0 gap-0 rounded-2xl border-0">
        {!isSubmitted ? (
          <>
            {/* Header */}
            <div className="p-4 relative">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white text-sm font-medium">
                  Getting Information
                </span>
              </div>
              <div className="absolute bottom-0 left-4 right-4 h-px bg-gray-700"></div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-medium text-sm">
                    Reason for report:
                  </h3>
                  <Info className="h-3 w-3 text-gray-400" />
                </div>
                <p className="text-gray-400 text-xs">
                  Select one or more reason below.
                </p>
              </div>

              <div className="space-y-4">
                {reportReasons.map((reason) => (
                  <div
                    key={reason.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm mb-1">
                        {reason.title}
                      </h4>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        {reason.description}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedReason(reason.id)}
                      className="mt-1 flex-shrink-0 hover:scale-110 transition-transform"
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          selectedReason === reason.id
                            ? "border-[#52168C] bg-[#52168C]"
                            : "border-gray-500 hover:border-gray-400"
                        )}
                      >
                        {selectedReason === reason.id && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4">
              <Button
                onClick={handleSubmit}
                disabled={!selectedReason}
                className={cn(
                  "w-full font-medium py-2.5 text-sm transition-colors",
                  selectedReason
                    ? "bg-[#52168C] text-white hover:bg-[#52168C]/90"
                    : "bg-[#262626] text-gray-400"
                )}
              >
                Next →
              </Button>
            </div>
          </>
        ) : (
          /* Success State */
          <div className="rounded-2xl border border-[#B8B8B8] bg-[#151515]">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Bookmark className="h-4 w-4 text-white" />
                <span className="text-white font-medium text-sm">
                  Submitted
                </span>
              </div>

              {/* Horizontal divider */}
              <div className="w-full h-px bg-[#B8B8B8] mb-6"></div>

              <div className="text-center mb-6">
                <h3 className="text-white text-lg font-semibold mb-1">
                  Thanks for your feedback
                </h3>
                <p className="text-gray-400 text-xs">
                  for helping make streamFi better for everyone
                </p>
              </div>

              <Button
                onClick={onClose}
                className="w-full bg-[#52168C] hover:bg-[#52168C]/90 text-white font-medium py-2.5 text-sm"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
