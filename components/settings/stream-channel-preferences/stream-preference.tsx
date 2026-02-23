"use client";
import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Eye } from "lucide-react";
import StreamKeyModal from "@/components/ui/streamkeyModal";
import StreamKeyConfirmationModal from "@/components/ui/streamKeyConfirmationModal";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

interface SecretFieldProps {
  label: string;
  value: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
  actions?: React.ReactNode;
}

interface ToggleSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange }) => {
  return (
    <div
      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${enabled ? "bg-highlight" : "bg-muted"}`}
      onClick={onChange}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${enabled ? "translate-x-6" : "translate-x-0"}`}
      />
    </div>
  );
};

const SectionCard: React.FC<SectionCardProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`bg-card border border-border shadow-sm rounded-lg p-6 mb-6 ${className}`}
    >
      {children}
    </div>
  );
};

const SecretField: React.FC<SecretFieldProps> = ({
  label,
  value,
  isVisible,
  onToggleVisibility,
  actions,
}) => {
  return (
    <div className="mb-8">
      <h2 className="text-highlight text-xl font-medium mb-4">{label}</h2>
      <div className="w-full flex flex-col md:flex-row gap-4">
        <div className="relative w-full">
          <input
            type={isVisible ? "text" : "password"}
            value={value}
            readOnly
            className="w-full bg-input text-foreground rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            className="text-muted-foreground absolute right-3 top-1/2 transform -translate-y-1/2 hover:text-white"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onToggleVisibility();
            }}
          >
            <Eye size={20} />
          </button>
        </div>
        {actions}
      </div>
    </div>
  );
};

const ToggleSection: React.FC<ToggleSectionProps> = ({
  title,
  description,
  enabled,
  onToggle,
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-highlight text-xl font-medium">{title}</h2>
        <ToggleSwitch enabled={enabled} onChange={onToggle} />
      </div>
      <p className="text-muted-foreground text-sm italic">{description}</p>
    </div>
  );
};

const StreamPreferencesPage: React.FC = () => {
  const { address } = useStellarWallet();

  const [state, setState] = useState({
    urlVisible: false,
    keyVisible: false,
    disconnectedProtection: false,
    copyrightWarning: true,
  });

  // Real stream data from API
  const [streamData, setStreamData] = useState<{
    streamKey: string;
    rtmpUrl: string;
    playbackId: string;
    isLive: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // State for the modals
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);

  // Add auto-hide timer ref
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch stream key on mount
  useEffect(() => {
    if (!address) {
      return;
    }

    const fetchStreamKey = async () => {
      try {
        const response = await fetch(`/api/streams/key?wallet=${address}`);
        const data = await response.json();

        if (data.hasStream && data.streamData) {
          setStreamData(data.streamData);
        }
      } catch (error) {
        console.error("Failed to fetch stream key:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStreamKey();
  }, [address]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Add effect to handle page visibility changes and auto-hide
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateState("keyVisible", false);
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
      }
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Add beforeunload listener
    window.addEventListener("beforeunload", () => {
      updateState("keyVisible", false);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", () => {
        updateState("keyVisible", false);
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
      });
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const updateState = (key: keyof typeof state, value: boolean) => {
    setState(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleVisibility = (key: "urlVisible" | "keyVisible") => {
    if (key === "keyVisible") {
      console.log("Selected Item is Key Visible");
      // Always show the modal when trying to reveal the key
      setIsRevealModalOpen(true);
    } else {
      updateState(key, !state[key]);
    }
  };

  const confirmRevealKey = () => {
    updateState("keyVisible", true);
    setIsRevealModalOpen(false);

    // Set auto-hide timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(
      () => {
        updateState("keyVisible", false);
      },
      10 * 60 * 1000
    ); // 10 minutes
  };

  const copyKey = () => {
    if (streamData?.streamKey) {
      navigator.clipboard.writeText(streamData.streamKey);
      setIsCopyModalOpen(true);
    }
  };

  const closeCopyModal = () => {
    setIsCopyModalOpen(false);
  };

  const closeRevealModal = () => {
    setIsRevealModalOpen(false);
  };

  const toggleSetting = (
    key: "disconnectedProtection" | "copyrightWarning"
  ) => {
    updateState(key, !state[key]);
  };

  const handleReset = () => {
    console.log("Reset clicked");
    // Clear any existing timers
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Reset visibility state
    updateState("keyVisible", false);

    // Clear any stored confirmation data
    localStorage.removeItem("stream_key_confirmation");

    // Reset modal state
    setIsRevealModalOpen(false);
    setIsCopyModalOpen(false);
  };

  const placeholderDescription =
    "Add up to 5 social media links to showcase your online presence ";

  const streamKeyActions = (
    <div className="flex flex-col items-end gap-4 md:flex-row md:justify-start">
      <button
        className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md whitespace-nowrap"
        onClick={copyKey}
      >
        Copy Key
      </button>
      <button
        onClick={handleReset}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-md"
      >
        Reset
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading stream settings...</div>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  if (!streamData) {
    return (
      <div className="min-h-screen bg-secondary text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">No stream key found</div>
          <p className="text-muted-foreground">
            Create a stream first to get your stream key
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="max-w-8xl mx-auto px-4 pt-12 pb-16">
        <SectionCard>
          {/* Stream URL */}
          <SecretField
            label="Stream URL (RTMP Server)"
            value={streamData.rtmpUrl}
            isVisible={state.urlVisible}
            onToggleVisibility={() => toggleVisibility("urlVisible")}
          />

          {/* Stream Key */}
          <SecretField
            label="Stream Key (Keep Secret!)"
            value={streamData.streamKey}
            isVisible={state.keyVisible}
            onToggleVisibility={() => toggleVisibility("keyVisible")}
            actions={streamKeyActions}
          />

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mt-4">
            <p className="text-yellow-600 dark:text-yellow-400 font-semibold mb-2">
              ⚠️ Important Security Notice
            </p>
            <p className="text-sm text-muted-foreground">
              Never share your stream key with anyone. Anyone with this key can
              broadcast to your channel. If you suspect your key has been
              compromised, use the &quot;Reset&quot; button to generate a new
              one.
            </p>
          </div>
        </SectionCard>

        <SectionCard className="flex w-full flex-col items-center-justify-center">
          <SectionCard className="bg-transparent py-2 px-4 mb-0">
            <ToggleSection
              title="Disconnected Protection"
              description={placeholderDescription}
              enabled={state.disconnectedProtection}
              onToggle={() => toggleSetting("disconnectedProtection")}
            />
          </SectionCard>

          <hr className="border border-border my-4" />

          <SectionCard className="bg-transparent py-2 px-4 mb-0">
            <ToggleSection
              title="Copyright Warning"
              description={placeholderDescription}
              enabled={state.copyrightWarning}
              onToggle={() => toggleSetting("copyrightWarning")}
            />
          </SectionCard>
        </SectionCard>
      </div>

      {/* Stream Key Copy Modal */}
      <StreamKeyModal isOpen={isCopyModalOpen} onClose={closeCopyModal} />

      {/* Stream Key Reveal Modal */}
      <StreamKeyConfirmationModal
        isOpen={isRevealModalOpen}
        onClose={closeRevealModal}
        onConfirm={confirmRevealKey}
      />
    </div>
  );
};

export default StreamPreferencesPage;
