import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LogIn, 
  Eye, 
  Phone as PhoneIcon, 
  ClipboardList,
  Activity,
  RefreshCw,
  User
} from "lucide-react";

interface ActivityLog {
  id: string;
  sub_user_id: string;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface SubUserActivityLogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subUserId: string;
  subUserName: string | null;
}

const actionIcons: Record<string, React.ReactNode> = {
  login: <LogIn className="h-4 w-4" />,
  first_login: <User className="h-4 w-4" />,
  view_lead: <Eye className="h-4 w-4" />,
  call_lead: <PhoneIcon className="h-4 w-4" />,
  update_lead: <ClipboardList className="h-4 w-4" />,
  default: <Activity className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  login: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  first_login: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  view_lead: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  call_lead: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  update_lead: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const actionLabels: Record<string, string> = {
  login: "Login",
  first_login: "First Login",
  view_lead: "Viewed Lead",
  call_lead: "Called Lead",
  update_lead: "Updated Lead",
};

export function SubUserActivityLog({ 
  open, 
  onOpenChange, 
  subUserId, 
  subUserName 
}: SubUserActivityLogProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["sub-user-activity", subUserId],
    queryFn: async () => {
      // Use type assertion since table is new and not in generated types yet
      const result = await (supabase as any)
        .from("sub_user_activity_logs")
        .select("*")
        .eq("sub_user_id", subUserId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (result.error) throw result.error;
      return (result.data || []) as ActivityLog[];
    },
    enabled: open && !!subUserId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </DialogTitle>
          <DialogDescription>
            Recent activity for {subUserName || "this team member"}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className={`p-2 rounded-full ${actionColors[activity.action_type] || actionColors.default}`}>
                    {actionIcons[activity.action_type] || actionIcons.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {actionLabels[activity.action_type] || activity.action_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm">{activity.description}</p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {activity.metadata.phone && (
                          <span>Phone: {activity.metadata.phone}</span>
                        )}
                        {activity.metadata.lead_name && (
                          <span>Lead: {activity.metadata.lead_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No activity yet</h3>
              <p className="text-muted-foreground">
                Activity will appear here once this team member logs in or performs actions.
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}