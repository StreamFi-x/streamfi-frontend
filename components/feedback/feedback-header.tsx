import { Info } from "lucide-react";

export function FeedbackHeader() {
  return (
    <div className="space-y-4 ">
      <h1 className="text-2xl font-semibold">Feedbacks and Suggestions</h1>
      <div className="flex items-start gap-3 p-4 bg-[#21202033] rounded-lg border border-gray-600">
        <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          At StreamFi, your experience matters to us. Whether you&apos;ve
          spotted a bug, find a flow confusing, or have an idea that could make
          the app better, your input helps us improve. Let us know what&apos;s
          not, or what you&apos;d love to see next.
        </p>
      </div>
    </div>
  );
}
