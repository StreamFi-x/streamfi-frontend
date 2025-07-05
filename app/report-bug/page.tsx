import { ReportBugForm } from "@/components/feedback/ReportBugForm";

export default function ReportBugPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <ReportBugForm />
      </div>
    </div>
  );
}
