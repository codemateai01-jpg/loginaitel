import { format } from "date-fns";

type ExportFormat = "csv" | "excel";

interface ExportOptions {
  filename: string;
  format?: ExportFormat;
}

/**
 * Convert data to CSV string
 */
function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeCSV).join(",");
  const dataRows = rows.map(row => row.map(escapeCSV).join(","));
  
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Convert data to Excel XML (simple spreadsheet format)
 */
function toExcelXML(headers: string[], rows: (string | number | null | undefined)[][], sheetName: string = "Sheet1"): string {
  const escapeXML = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  const headerCells = headers.map(h => 
    `<Cell><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`
  ).join("");

  const dataCells = rows.map(row => {
    const cells = row.map(cell => {
      const type = typeof cell === "number" ? "Number" : "String";
      return `<Cell><Data ss:Type="${type}">${escapeXML(cell)}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXML(sheetName)}">
    <Table>
      <Row ss:StyleID="Header">${headerCells}</Row>
      ${dataCells}
    </Table>
  </Worksheet>
</Workbook>`;
}

/**
 * Download data as a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV or Excel
 */
export function exportData(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options: ExportOptions
): void {
  const { filename, format: exportFormat = "csv" } = options;
  const timestamp = format(new Date(), "yyyy-MM-dd");
  
  if (exportFormat === "excel") {
    const content = toExcelXML(headers, rows, filename);
    downloadFile(content, `${filename}-${timestamp}.xls`, "application/vnd.ms-excel");
  } else {
    const content = toCSV(headers, rows);
    downloadFile(content, `${filename}-${timestamp}.csv`, "text/csv;charset=utf-8");
  }
}

/**
 * Export calls data
 */
export interface CallExportData {
  date: string;
  callType: string;
  phoneNumber: string;
  agentName: string;
  status: string;
  duration: string;
  connected: boolean;
  cost?: number;
  transcript?: string;
  summary?: string;
}

export function exportCalls(calls: CallExportData[], format: ExportFormat = "csv"): void {
  const headers = [
    "Date",
    "Type",
    "Phone Number",
    "Agent",
    "Status",
    "Duration",
    "Connected",
    "Cost (₹)",
    "Summary",
  ];

  const rows = calls.map(call => [
    call.date,
    call.callType,
    call.phoneNumber,
    call.agentName,
    call.status,
    call.duration,
    call.connected ? "Yes" : "No",
    call.cost ?? "",
    call.summary ?? "",
  ]);

  exportData(headers, rows, { filename: "call-history", format });
}

/**
 * Export campaign leads
 */
export interface LeadExportData {
  name: string;
  phone: string;
  email?: string;
  stage: string;
  interestLevel?: string;
  callStatus?: string;
  callDuration?: number;
  callSummary?: string;
  notes?: string;
  createdAt: string;
}

export function exportLeads(leads: LeadExportData[], campaignName: string, format: ExportFormat = "csv"): void {
  const headers = [
    "Name",
    "Phone",
    "Email",
    "Stage",
    "Interest Level",
    "Call Status",
    "Call Duration (sec)",
    "Call Summary",
    "Notes",
    "Added On",
  ];

  const rows = leads.map(lead => [
    lead.name,
    lead.phone,
    lead.email ?? "",
    lead.stage,
    lead.interestLevel ?? "",
    lead.callStatus ?? "",
    lead.callDuration ?? "",
    lead.callSummary ?? "",
    lead.notes ?? "",
    lead.createdAt,
  ]);

  const safeName = campaignName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  exportData(headers, rows, { filename: `${safeName}-leads`, format });
}

/**
 * Export payments/transactions
 */
export interface PaymentExportData {
  date: string;
  transactionId: string;
  amount: number;
  credits: number;
  status: string;
  paymentMethod?: string;
}

export function exportPayments(payments: PaymentExportData[], format: ExportFormat = "csv"): void {
  const headers = [
    "Date",
    "Transaction ID",
    "Amount (₹)",
    "Credits",
    "Status",
    "Payment Method",
  ];

  const rows = payments.map(payment => [
    payment.date,
    payment.transactionId,
    payment.amount,
    payment.credits,
    payment.status,
    payment.paymentMethod ?? "Razorpay",
  ]);

  exportData(headers, rows, { filename: "payment-history", format });
}

/**
 * Export analytics summary
 */
export interface AnalyticsSummary {
  period: string;
  totalCalls: number;
  connectedCalls: number;
  avgDuration: number;
  totalCost: number;
  interestedLeads: number;
  conversionRate: number;
  roi?: number;
}

export function exportAnalytics(data: AnalyticsSummary[], format: ExportFormat = "csv"): void {
  const headers = [
    "Period",
    "Total Calls",
    "Connected Calls",
    "Avg Duration (sec)",
    "Total Cost (₹)",
    "Interested Leads",
    "Conversion Rate (%)",
    "ROI (%)",
  ];

  const rows = data.map(row => [
    row.period,
    row.totalCalls,
    row.connectedCalls,
    row.avgDuration,
    row.totalCost,
    row.interestedLeads,
    row.conversionRate,
    row.roi ?? "",
  ]);

  exportData(headers, rows, { filename: "analytics-report", format });
}
