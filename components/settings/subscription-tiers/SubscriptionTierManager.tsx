"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, X } from "lucide-react";
import Button from "@/components/ui/button";

interface SubscriptionTier {
  id: string;
  name: string;
  price_usdc: number;
  duration_days: number;
  perks: string[];
  active: boolean;
  created_at: string;
}

interface TierFormData {
  name: string;
  price_usdc: string;
  duration_days: string;
  perks: string[];
}

const SubscriptionTierManager: React.FC = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TierFormData>({
    name: "",
    price_usdc: "",
    duration_days: "",
    perks: [],
  });
  const [currentPerk, setCurrentPerk] = useState("");
  const [errors, setErrors] = useState<Partial<TierFormData>>({});

  // Fetch tiers on mount
  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/routes-f/subscription-tiers");
      if (!response.ok) throw new Error("Failed to fetch tiers");
      const data = await response.json();
      setTiers(data.tiers || []);
    } catch (error) {
      console.error("Error fetching tiers:", error);
      toast.error("Failed to load subscription tiers");
    } finally {
      setLoading(false);
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<TierFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tier name is required";
    }

    const price = parseFloat(formData.price_usdc);
    if (!formData.price_usdc || isNaN(price) || price <= 0) {
      newErrors.price_usdc = "Price must be greater than 0";
    }

    const duration = parseInt(formData.duration_days);
    if (!formData.duration_days || isNaN(duration) || duration <= 0) {
      newErrors.duration_days = "Duration must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddPerk = () => {
    if (currentPerk.trim()) {
      setFormData({
        ...formData,
        perks: [...formData.perks, currentPerk.trim()],
      });
      setCurrentPerk("");
    }
  };

  const handleRemovePerk = (index: number) => {
    setFormData({
      ...formData,
      perks: formData.perks.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        name: formData.name,
        price_usdc: parseFloat(formData.price_usdc),
        duration_days: parseInt(formData.duration_days),
        perks: formData.perks,
      };

      if (editingId) {
        // Update existing tier
        const response = await fetch(
          `/api/routes-f/subscription-tiers/${editingId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) throw new Error("Failed to update tier");
        toast.success("Tier updated successfully");
      } else {
        // Create new tier
        const response = await fetch("/api/routes-f/subscription-tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Failed to create tier");
        toast.success("Tier created successfully");
      }

      // Reset form and refresh tiers
      resetForm();
      await fetchTiers();
    } catch (error) {
      console.error("Error saving tier:", error);
      toast.error("Failed to save tier");
    }
  };

  const handleEdit = (tier: SubscriptionTier) => {
    setEditingId(tier.id);
    setFormData({
      name: tier.name,
      price_usdc: tier.price_usdc.toString(),
      duration_days: tier.duration_days.toString(),
      perks: [...tier.perks],
    });
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tier?")) {
      return;
    }

    try {
      const response = await fetch(`/api/routes-f/subscription-tiers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete tier");
      toast.success("Tier deleted successfully");
      await fetchTiers();
    } catch (error) {
      console.error("Error deleting tier:", error);
      toast.error("Failed to delete tier");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price_usdc: "",
      duration_days: "",
      perks: [],
    });
    setCurrentPerk("");
    setErrors({});
    setEditingId(null);
    setIsCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-highlight" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Subscription Tiers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage subscription tiers for your channel
          </p>
        </div>
        {!isCreating && tiers.length < 5 && (
          <Button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Tier
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="border border-border rounded-lg p-6 bg-card/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {editingId ? "Edit Tier" : "Create New Tier"}
            </h3>
            <button
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tier Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tier Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Premium"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-highlight"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Price (USDC)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_usdc}
                  onChange={(e) =>
                    setFormData({ ...formData, price_usdc: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-highlight"
                />
                {errors.price_usdc && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.price_usdc}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Duration (days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration_days}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_days: e.target.value })
                  }
                  placeholder="30"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-highlight"
                />
                {errors.duration_days && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.duration_days}
                  </p>
                )}
              </div>
            </div>

            {/* Perks */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Perks
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={currentPerk}
                  onChange={(e) => setCurrentPerk(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPerk();
                    }
                  }}
                  placeholder="Add a perk (e.g., Ad-free content)"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-highlight"
                />
                <Button
                  type="button"
                  onClick={handleAddPerk}
                  variant="secondary"
                >
                  Add
                </Button>
              </div>

              {formData.perks.length > 0 && (
                <div className="space-y-2">
                  {formData.perks.map((perk, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-background border border-border rounded px-3 py-2"
                    >
                      <span className="text-sm text-foreground">{perk}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePerk(index)}
                        className="text-muted-foreground hover:text-red-500 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Update Tier"
                ) : (
                  "Create Tier"
                )}
              </Button>
              <Button
                type="button"
                onClick={resetForm}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tiers List */}
      <div className="space-y-3">
        {tiers.length === 0 ? (
          <div className="border border-border rounded-lg p-8 text-center bg-card/30">
            <p className="text-muted-foreground">
              No subscription tiers yet. Create one to get started.
            </p>
          </div>
        ) : (
          tiers.map((tier) => (
            <div
              key={tier.id}
              className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card/70 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">
                    {tier.name}
                  </h3>
                  <p className="text-lg font-bold text-highlight mt-1">
                    ${tier.price_usdc.toFixed(2)} USDC
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tier.duration_days} day
                    {tier.duration_days !== 1 ? "s" : ""}
                  </p>

                  {tier.perks.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Perks:
                      </p>
                      <ul className="space-y-1">
                        {tier.perks.map((perk, index) => (
                          <li
                            key={index}
                            className="text-sm text-foreground flex items-start gap-2"
                          >
                            <span className="text-highlight mt-0.5">•</span>
                            {perk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(tier)}
                    className="p-2 rounded hover:bg-background text-muted-foreground hover:text-foreground transition"
                    title="Edit tier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tier.id)}
                    className="p-2 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition"
                    title="Delete tier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tier Limit Notice */}
      {tiers.length >= 5 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4">
          <p className="text-sm text-foreground">
            You have reached the maximum of 5 active subscription tiers.
          </p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionTierManager;
