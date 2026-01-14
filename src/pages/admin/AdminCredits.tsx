import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreditManagement } from "@/components/admin/CreditManagement";

export default function AdminCredits() {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Credit Management</h1>
          <p className="text-muted-foreground">
            Manage client credits and view transaction history
          </p>
        </div>
        <CreditManagement />
      </div>
    </DashboardLayout>
  );
}
