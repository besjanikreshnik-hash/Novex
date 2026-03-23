"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { KycSubmission } from "@/types";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CheckCircle, Eye, FileText, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

const mockKycQueue: KycSubmission[] = [
  {
    id: "kyc_001", userId: "usr_000012", userEmail: "mike@trader.com", tier: "basic",
    status: "pending", submittedAt: "2026-03-22T06:00:00Z", reviewedAt: null, reviewedBy: null,
    documents: [
      { id: "doc_1", type: "passport", filename: "passport_scan.pdf", uploadedAt: "2026-03-22T05:55:00Z", status: "pending" },
      { id: "doc_2", type: "selfie", filename: "selfie.jpg", uploadedAt: "2026-03-22T05:58:00Z", status: "pending" },
    ],
    notes: "",
  },
  {
    id: "kyc_002", userId: "usr_000025", userEmail: "sarah@defi.io", tier: "advanced",
    status: "pending", submittedAt: "2026-03-22T04:30:00Z", reviewedAt: null, reviewedBy: null,
    documents: [
      { id: "doc_3", type: "drivers_license", filename: "dl_front.jpg", uploadedAt: "2026-03-22T04:25:00Z", status: "pending" },
      { id: "doc_4", type: "proof_of_address", filename: "utility_bill.pdf", uploadedAt: "2026-03-22T04:28:00Z", status: "pending" },
      { id: "doc_5", type: "selfie", filename: "selfie_with_id.jpg", uploadedAt: "2026-03-22T04:29:00Z", status: "pending" },
    ],
    notes: "",
  },
  {
    id: "kyc_003", userId: "usr_000031", userEmail: "carlos@hodl.net", tier: "basic",
    status: "pending", submittedAt: "2026-03-21T22:15:00Z", reviewedAt: null, reviewedBy: null,
    documents: [
      { id: "doc_6", type: "national_id", filename: "id_card.jpg", uploadedAt: "2026-03-21T22:10:00Z", status: "pending" },
      { id: "doc_7", type: "selfie", filename: "selfie.jpg", uploadedAt: "2026-03-21T22:12:00Z", status: "pending" },
    ],
    notes: "",
  },
  {
    id: "kyc_004", userId: "usr_000042", userEmail: "yuki@exchange.jp", tier: "institutional",
    status: "pending", submittedAt: "2026-03-21T18:00:00Z", reviewedAt: null, reviewedBy: null,
    documents: [
      { id: "doc_8", type: "passport", filename: "passport.pdf", uploadedAt: "2026-03-21T17:50:00Z", status: "pending" },
      { id: "doc_9", type: "proof_of_address", filename: "bank_statement.pdf", uploadedAt: "2026-03-21T17:55:00Z", status: "pending" },
      { id: "doc_10", type: "selfie", filename: "selfie.jpg", uploadedAt: "2026-03-21T17:58:00Z", status: "pending" },
    ],
    notes: "Institutional application - requires enhanced due diligence",
  },
  ...Array.from({ length: 19 }, (_, i) => ({
    id: `kyc_${String(i + 5).padStart(3, "0")}`,
    userId: `usr_${String(50 + i).padStart(6, "0")}`,
    userEmail: `user${50 + i}@example.com`,
    tier: (["basic", "advanced", "basic", "basic"] as const)[i % 4]!,
    status: "pending" as const,
    submittedAt: new Date(2026, 2, 21 - (i % 5), 10 + (i % 12)).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    documents: [
      { id: `doc_a${i}`, type: "passport" as const, filename: "passport.pdf", uploadedAt: new Date(2026, 2, 21 - (i % 5)).toISOString(), status: "pending" as const },
      { id: `doc_b${i}`, type: "selfie" as const, filename: "selfie.jpg", uploadedAt: new Date(2026, 2, 21 - (i % 5)).toISOString(), status: "pending" as const },
    ],
    notes: "",
  })),
];

const tierVariant: Record<string, "neutral" | "info" | "success" | "warning"> = {
  none: "neutral",
  basic: "info",
  advanced: "success",
  institutional: "warning",
};

export default function KycPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = mockKycQueue.find((k) => k.id === selectedId);

  const columns: ColumnDef<KycSubmission, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => <span className="font-mono text-xs text-surface-400">{getValue<string>()}</span>,
      },
      {
        accessorKey: "userEmail",
        header: "User",
        cell: ({ row }) => (
          <div>
            <p className="text-sm text-surface-200">{row.original.userEmail}</p>
            <p className="font-mono text-xs text-surface-500">{row.original.userId}</p>
          </div>
        ),
      },
      {
        accessorKey: "tier",
        header: "Requested Tier",
        cell: ({ getValue }) => {
          const t = getValue<string>();
          return <Badge variant={tierVariant[t] ?? "neutral"}>{t.charAt(0).toUpperCase() + t.slice(1)}</Badge>;
        },
      },
      {
        accessorKey: "documents",
        header: "Documents",
        enableSorting: false,
        cell: ({ getValue }) => {
          const docs = getValue<KycSubmission["documents"]>();
          return (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4 text-surface-500" />
              <span className="text-xs text-surface-300">{docs.length} files</span>
            </div>
          );
        },
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        cell: ({ getValue }) => (
          <span className="text-xs text-surface-400">
            {format(new Date(getValue<string>()), "MMM d, HH:mm")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setSelectedId(row.original.id)}>
              Review
            </Button>
            <Button variant="ghost" size="sm" icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}>
              Approve
            </Button>
            <Button variant="ghost" size="sm" icon={<XCircle className="h-4 w-4 text-red-400" />}>
              Reject
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">KYC Review Queue</h1>
        <p className="text-sm text-surface-400">
          Review and approve KYC verification submissions ({mockKycQueue.length} pending)
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Pending Reviews", value: mockKycQueue.length, variant: "warning" as const },
          { label: "Basic Tier", value: mockKycQueue.filter((k) => k.tier === "basic").length, variant: "info" as const },
          { label: "Advanced Tier", value: mockKycQueue.filter((k) => k.tier === "advanced").length, variant: "success" as const },
          { label: "Institutional", value: mockKycQueue.filter((k) => k.tier === "institutional").length, variant: "warning" as const },
        ].map((stat) => (
          <div key={stat.label} className="card flex items-center justify-between">
            <span className="text-sm text-surface-400">{stat.label}</span>
            <Badge variant={stat.variant}>{stat.value}</Badge>
          </div>
        ))}
      </div>

      {/* Review Panel */}
      {selected && (
        <div className="card animate-fade-in border-novex-500/30">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-surface-100">Reviewing: {selected.userEmail}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>Close</Button>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs text-surface-500">Requested Tier</p>
              <Badge variant={tierVariant[selected.tier] ?? "neutral"}>{selected.tier.charAt(0).toUpperCase() + selected.tier.slice(1)}</Badge>
              <p className="text-xs text-surface-500">Submitted</p>
              <p className="text-sm text-surface-200">{format(new Date(selected.submittedAt), "MMM d, yyyy HH:mm")}</p>
              {selected.notes && (
                <>
                  <p className="text-xs text-surface-500">Notes</p>
                  <p className="text-sm text-surface-300">{selected.notes}</p>
                </>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs text-surface-500">Documents</p>
              <div className="space-y-2">
                {selected.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-surface-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-surface-500" />
                      <div>
                        <p className="text-sm text-surface-200">{doc.filename}</p>
                        <p className="text-xs capitalize text-surface-500">{doc.type.replace("_", " ")}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">View</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-surface-800 pt-4">
            <Button variant="danger" icon={<XCircle className="h-4 w-4" />}>Reject</Button>
            <Button variant="primary" icon={<CheckCircle className="h-4 w-4" />}>Approve</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable columns={columns} data={mockKycQueue} pageSize={10} />
    </div>
  );
}
