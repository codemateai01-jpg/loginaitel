import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tasks = [
  {
    id: 1,
    title: "Healthcare Support Agent",
    engineer: "Rahul Kumar",
    client: "MedCare India",
    status: "pending_review",
    deadline: "2h remaining",
    points: 150,
  },
  {
    id: 2,
    title: "E-commerce Sales Bot",
    engineer: "Priya Singh",
    client: "ShopMax",
    status: "in_progress",
    deadline: "Due tomorrow",
    points: 120,
  },
  {
    id: 3,
    title: "Banking FAQ Agent",
    engineer: "Amit Patel",
    client: "HDFC Bank",
    status: "completed",
    deadline: "Completed",
    points: 180,
  },
  {
    id: 4,
    title: "Travel Booking Assistant",
    engineer: "Sneha Reddy",
    client: "TravelX",
    status: "not_started",
    deadline: "Due in 3 days",
    points: 100,
  },
  {
    id: 5,
    title: "Insurance Claim Bot",
    engineer: "Vikram Joshi",
    client: "ICICI Lombard",
    status: "pending_review",
    deadline: "Review pending",
    points: 200,
  },
];

const statusConfig = {
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-chart-2/10 border-chart-2 text-chart-2",
  },
  pending_review: {
    label: "Pending Review",
    icon: AlertCircle,
    className: "bg-chart-4/10 border-chart-4 text-chart-4",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-chart-1/10 border-chart-1 text-chart-1",
  },
  not_started: {
    label: "Not Started",
    icon: ClipboardList,
    className: "bg-muted border-border text-muted-foreground",
  },
};

export default function AdminTasks() {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Task Management</h1>
            <p className="text-muted-foreground">
              Create, assign, and track engineer tasks
            </p>
          </div>
          <Button className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">47</p>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">12</p>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-1">18</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">17</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-10 border-2"
            />
          </div>
          <Button variant="outline" className="shadow-xs">
            Filter by Status
          </Button>
          <Button variant="outline" className="shadow-xs">
            Filter by Engineer
          </Button>
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border hover:bg-transparent">
                <TableHead className="font-bold">Task</TableHead>
                <TableHead className="font-bold">Engineer</TableHead>
                <TableHead className="font-bold">Client</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Deadline</TableHead>
                <TableHead className="font-bold text-right">Points</TableHead>
                <TableHead className="font-bold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const status = statusConfig[task.status as keyof typeof statusConfig];
                const StatusIcon = status.icon;
                return (
                  <TableRow key={task.id} className="border-b-2 border-border">
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.engineer}</TableCell>
                    <TableCell>{task.client}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.deadline}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {task.points}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Review Agent</DropdownMenuItem>
                          <DropdownMenuItem>Reassign</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Cancel Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
