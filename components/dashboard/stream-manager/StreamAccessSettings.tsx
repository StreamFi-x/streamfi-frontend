import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface StreamAccessSettingsProps {
  initialAccessType: string;
  initialAccessConfig: any;
  onSave: (accessType: string, accessConfig: any) => Promise<void>;
  isSaving: boolean;
}

/**
 * StreamAccessSettings allows streamers to configure how viewers access their stream.
 * It supports various gating methods including passwords, payments, and token requirements.
 * [access-control 1/5]
 */
export default function StreamAccessSettings({
  initialAccessType,
  initialAccessConfig,
  onSave,
  isSaving
}: StreamAccessSettingsProps) {
  const [accessType, setAccessType] = useState(initialAccessType || 'public');
  const [config, setConfig] = useState(initialAccessConfig || {});

  // Sync with initial props when they load
  useEffect(() => {
    if (initialAccessType) setAccessType(initialAccessType);
    if (initialAccessConfig) setConfig(initialAccessConfig);
  }, [initialAccessType, initialAccessConfig]);

  const handleSave = () => {
    onSave(accessType, config);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mt-3 shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-highlight" />
          <span className="text-sm font-bold text-foreground tracking-tight">Stream Access</span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] block ml-0.5">
            Gating Method
          </label>
          <select
            value={accessType}
            onChange={(e) => setAccessType(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-highlight/20 focus:border-highlight transition-all cursor-pointer"
          >
            <option value="public">Public (Default)</option>
            <option value="password">Password Protected</option>
            <option value="invite_only">Invite Only</option>
            <option value="paid">Paid Access (USDC)</option>
            <option value="token_gated">Token Gated</option>
            <option value="subscription">Subscribers Only</option>
          </select>
        </div>

        {/* Dynamic configuration fields based on selection */}
        <div className="space-y-4">
          {accessType === 'paid' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] block">
                Access Price (USDC)
              </label>
              <div className="relative group">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={config.price_usdc || ''}
                  onChange={(e) => setConfig({ ...config, price_usdc: e.target.value })}
                  placeholder="10.00"
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-highlight/20 focus:border-highlight transition-all pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">USDC</span>
              </div>
            </div>
          )}

          {accessType === 'token_gated' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-secondary/20 p-3 rounded-xl border border-border/50 shadow-inner">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Asset Code</label>
                  <input
                    type="text"
                    value={config.asset_code || ''}
                    onChange={(e) => setConfig({ ...config, asset_code: e.target.value })}
                    placeholder="USDC"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-highlight/20 focus:border-highlight transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Min Balance</label>
                  <input
                    type="number"
                    value={config.min_balance || ''}
                    onChange={(e) => setConfig({ ...config, min_balance: e.target.value })}
                    placeholder="1.00"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-highlight/20 focus:border-highlight transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Asset Issuer Address</label>
                <input
                  type="text"
                  value={config.asset_issuer || ''}
                  onChange={(e) => setConfig({ ...config, asset_issuer: e.target.value })}
                  placeholder="G..."
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-highlight/20 focus:border-highlight transition-all"
                />
              </div>
            </div>
          )}

          {accessType === 'password' && (
            <div className="bg-highlight/5 border border-highlight/10 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] text-highlight font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-highlight animate-pulse" />
                Password hashing logic will be enabled in next module [2/5]
              </p>
            </div>
          )}

          {(accessType === 'invite_only' || accessType === 'subscription') && (
            <div className="bg-zinc-800/30 border border-border p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-zinc-500 text-[10px] italic">
                {accessType === 'invite_only' ? 'User whitelisting' : 'Subscription check'} module coming soon.
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-highlight text-black hover:bg-highlight/90 font-bold h-11 rounded-xl text-sm transition-all shadow-lg shadow-highlight/10 hover:shadow-highlight/20 active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Updating...
            </span>
          ) : (
            'Save Access Policy'
          )}
        </Button>
      </div>
    </div>
  );
}
