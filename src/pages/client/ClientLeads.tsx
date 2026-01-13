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
  Upload,
  Download,
  Search,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const leads = [
  {
    id: 1,
    name: "Rajesh Kumar",
    phone: "+91 98765 43210",
    agent: "Sales Assistant",
    status: "interested",
    lastCall: "2h ago",
    calls: 2,
  },
  {
    id: 2,
    name: "Priya Sharma",
    phone: "+91 87654 32109",
    agent: "Lead Qualifier",
    status: "callback",
    lastCall: "4h ago",
    calls: 1,
  },
  {
    id: 3,
    name: "Amit Patel",
    phone: "+91 76543 21098",
    agent: "Sales Assistant",
    status: "not_interested",
    lastCall: "1d ago",
    calls: 3,
  },
  {
    id: 4,
    name: "Sneha Reddy",
    phone: "+91 65432 10987",
    agent: "Support Bot",
    status: "no_answer",
    lastCall: "2d ago",
    calls: 5,
  },
  {
    id: 5,
    name: "Vikram Joshi",
    phone: "+91 54321 09876",
    agent: "Lead Qualifier",
    status: "interested",
    lastCall: "3h ago",
    calls: 1,
  },
];

const statusConfig = {
  interested: {
    label: "Interested",
    icon: CheckCircle,
    className: "bg-chart-2/10 border-chart-2 text-chart-2",
  },
  callback: {
    label: "Callback",
    icon: Clock,
    className: "bg-chart-4/10 border-chart-4 text-chart-4",
  },
  not_interested: {
    label: "Not Interested",
    icon: XCircle,
    className: "bg-muted border-border text-muted-foreground",
  },
  no_answer: {
    label: "No Answer",
    icon: Phone,
    className: "bg-muted border-border text-muted-foreground",
  },
};

export default function ClientLeads() {
  return (
    <DashboardLayout role="client">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Lead Management</h1>
            <p className="text-muted-foreground">
              Upload, track, and manage your campaign leads
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="shadow-xs">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="shadow-sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">1,247</p>
            <p className="text-sm text-muted-foreground">Total Leads</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">287</p>
            <p className="text-sm text-muted-foreground">Interested</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">124</p>
            <p className="text-sm text-muted-foreground">Callbacks</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">836</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by name or phone..."
              className="pl-10 border-2"
            />
          </div>
          <Button variant="outline" className="shadow-xs">
            Filter by Status
          </Button>
          <Button variant="outline" className="shadow-xs">
            Filter by Agent
          </Button>
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border hover:bg-transparent">
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Phone</TableHead>
                <TableHead className="font-bold">Agent</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Calls</TableHead>
                <TableHead className="font-bold">Last Call</TableHead>
                <TableHead className="font-bold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const status = statusConfig[lead.status as keyof typeof statusConfig];
                const StatusIcon = status.icon;
                return (
                  <TableRow key={lead.id} className="border-b-2 border-border">
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {lead.phone}
                    </TableCell>
                    <TableCell>{lead.agent}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell>{lead.calls}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.lastCall}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Call History</DropdownMenuItem>
                          <DropdownMenuItem>View Transcript</DropdownMenuItem>
                          <DropdownMenuItem>Update Status</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Remove Lead
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

        {/* Pagination placeholder */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-5 of 1,247 leads
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
