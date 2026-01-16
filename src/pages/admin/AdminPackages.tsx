import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, History } from "lucide-react";
import { PackageManagement } from "@/components/admin/PackageManagement";
import { ClientSubscriptions } from "@/components/admin/ClientSubscriptions";
import { SubscriptionHistory } from "@/components/admin/SubscriptionHistory";

export default function AdminPackages() {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Package Management</h1>
          <p className="text-muted-foreground">
            Manage pricing packages, view client subscriptions, and track upgrade history
          </p>
        </div>

        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList className="border-2 border-border bg-card p-1 h-auto flex-wrap">
            <TabsTrigger value="packages" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Package className="h-4 w-4" />
              Packages
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4" />
              Client Subscriptions
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="h-4 w-4" />
              Upgrade History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages">
            <PackageManagement />
          </TabsContent>

          <TabsContent value="subscriptions">
            <ClientSubscriptions />
          </TabsContent>

          <TabsContent value="history">
            <SubscriptionHistory />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
