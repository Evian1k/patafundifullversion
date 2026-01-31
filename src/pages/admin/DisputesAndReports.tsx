import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, MessageCircle, Image, CheckCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Dispute {
  id: string;
  type: "customer_report" | "fundi_report";
  jobId: string;
  reportedBy: string;
  description: string;
  evidence: string[];
  status: "open" | "resolved" | "closed";
  createdAt: string;
}

// Mock disputes data - in production this would come from DB
const mockDisputes: Dispute[] = [
  {
    id: "dispute_001",
    type: "customer_report",
    jobId: "job_123",
    reportedBy: "Customer ABC",
    description: "Fundi did not complete the work as agreed",
    evidence: [],
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "dispute_002",
    type: "fundi_report",
    jobId: "job_124",
    reportedBy: "Fundi XYZ",
    description: "Customer refused payment",
    evidence: [],
    status: "open",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function DisputesAndReports() {
  const [disputes, setDisputes] = useState<Dispute[]>(mockDisputes);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const handleResolve = (option: "refund" | "reassign" | "ban") => {
    if (!selectedDispute) return;

    toast.success(`Dispute resolved: ${option}`);
    setDisputes(
      disputes.map((d) =>
        d.id === selectedDispute.id ? { ...d, status: "resolved" } : d
      )
    );
    setSelectedDispute(null);
    setResolutionNote("");
  };

  const getTypeColor = (type: string) => {
    return type === "customer_report"
      ? "bg-blue-500/10 text-blue-500"
      : "bg-orange-500/10 text-orange-500";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-500/10 text-red-500";
      case "resolved":
        return "bg-green-500/10 text-green-500";
      case "closed":
        return "bg-slate-500/10 text-slate-500";
      default:
        return "bg-slate-500/10 text-slate-500";
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Disputes & Reports</h1>
        <p className="text-muted-foreground">Manage customer and fundi disputes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground mb-1">Open Disputes</p>
          <p className="text-2xl font-bold text-red-500">
            {disputes.filter((d) => d.status === "open").length}
          </p>
        </Card>
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground mb-1">Resolved</p>
          <p className="text-2xl font-bold text-green-500">
            {disputes.filter((d) => d.status === "resolved").length}
          </p>
        </Card>
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground mb-1">Total</p>
          <p className="text-2xl font-bold">{disputes.length}</p>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Disputes List */}
        <div className="lg:col-span-2 space-y-3 max-h-[calc(100vh-300px)] overflow-auto">
          {disputes.map((dispute) => (
            <motion.div
              key={dispute.id}
              whileHover={{ x: 4 }}
              onClick={() => setSelectedDispute(dispute)}
            >
              <Card
                className={`p-4 border-2 cursor-pointer transition ${
                  selectedDispute?.id === dispute.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(dispute.type)}`}>
                        {dispute.type}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(dispute.status)}`}>
                      {dispute.status}
                    </span>
                  </div>
                  <p className="font-semibold text-sm">Job: {dispute.jobId}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{dispute.description}</p>
                  <p className="text-xs text-muted-foreground">
                    By: {dispute.reportedBy} • {new Date(dispute.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedDispute && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <Card className="p-6 border-2 space-y-4">
              {/* Type & Status */}
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(selectedDispute.type)}`}>
                  {selectedDispute.type}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedDispute.status)}`}>
                  {selectedDispute.status}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">Job ID:</span> {selectedDispute.jobId}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Reported By:</span> {selectedDispute.reportedBy}
                </p>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-semibold mb-2">Description</p>
                <p className="text-sm text-muted-foreground bg-slate-500/5 p-3 rounded-lg">
                  {selectedDispute.description}
                </p>
              </div>

              {/* Evidence */}
              {selectedDispute.evidence.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Evidence</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedDispute.evidence.map((img, idx) => (
                      <div key={idx} className="relative">
                        <Image className="w-4 h-4 absolute top-2 left-2 text-muted-foreground" />
                        <div className="w-full h-24 bg-slate-200 rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat/Notes */}
              <div>
                <p className="text-sm font-semibold mb-2">Communication</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageCircle className="w-4 h-4" />
                  View chat history (placeholder)
                </div>
              </div>

              {/* Actions */}
              {selectedDispute.status === "open" && (
                <div className="pt-4 border-t border-border space-y-2">
                  <Textarea
                    placeholder="Resolution note..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleResolve("refund")}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Refund
                    </Button>
                    <Button
                      onClick={() => handleResolve("reassign")}
                      variant="outline"
                      size="sm"
                    >
                      Reassign
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleResolve("ban")}
                    variant="destructive"
                    className="w-full"
                    size="sm"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Ban User
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
