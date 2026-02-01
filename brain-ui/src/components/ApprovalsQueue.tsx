import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Separator } from "./ui/separator";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Zap,
  Shield,
  TrendingUp,
  Loader2,
  RefreshCw
} from "lucide-react";
import { usePendingApprovals, useApproveAction, useRejectAction } from "../lib/hooks";
import { Incident } from "../types";
import { toast } from "sonner";

interface ApprovalsQueueProps {
  onViewIncident: (id: string) => void;
}

export function ApprovalsQueue({ onViewIncident }: ApprovalsQueueProps) {
  const { pending, count, loading, refetch } = usePendingApprovals();
  const { approve, loading: approving } = useApproveAction();
  const { reject, loading: rejecting } = useRejectAction();

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const pendingApprovals = pending.filter(
    (i: Incident) => !approvedIds.has(i.id) && !rejectedIds.has(i.id)
  );

  const handleApprove = (incident: Incident) => {
    setSelectedIncident(incident);
    setActionType('approve');
  };

  const handleReject = (incident: Incident) => {
    setSelectedIncident(incident);
    setActionType('reject');
  };

  const confirmApprove = async () => {
    if (selectedIncident) {
      try {
        const result = await approve(selectedIncident.id);
        setApprovedIds(new Set(approvedIds).add(selectedIncident.id));
        toast.success("Remediation Approved", {
          description: result.message || `${selectedIncident.proposedRemediation?.type} executed for ${selectedIncident.service}`
        });
        refetch();
      } catch (e) {
        toast.error("Failed to approve", {
          description: e instanceof Error ? e.message : "Unknown error"
        });
      }
      setSelectedIncident(null);
      setActionType(null);
    }
  };

  const confirmReject = async () => {
    if (selectedIncident) {
      try {
        const result = await reject(selectedIncident.id);
        setRejectedIds(new Set(rejectedIds).add(selectedIncident.id));
        toast.error("Remediation Rejected", {
          description: result.message || `Action rejected for ${selectedIncident.service}. Incident will be escalated.`
        });
        refetch();
      } catch (e) {
        toast.error("Failed to reject", {
          description: e instanceof Error ? e.message : "Unknown error"
        });
      }
      setSelectedIncident(null);
      setActionType(null);
    }
  };

  const getRiskBadgeVariant = (riskLevel: 'low' | 'medium' | 'high') => {
    switch (riskLevel) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'outline';
    }
  };

  const formatTimestamp = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="size-8" />
            Approval Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve remediation actions
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedIds.size}</div>
            <p className="text-xs text-muted-foreground">In this session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedIds.size}</div>
            <p className="text-xs text-muted-foreground">In this session</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>
            Actions requiring human review before execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="size-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading approvals...</p>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No pending approvals</p>
              <p className="text-sm text-muted-foreground mt-1">
                All remediation actions have been reviewed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((incident: Incident) => (
                <Card key={incident.id} className="border-orange-200 bg-orange-50/30">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{incident.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {incident.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">
                              {incident.severity}
                            </Badge>
                            <Badge variant="outline">
                              {Math.round(incident.confidence * 100)}% confidence
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {incident.namespace}/{incident.service}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewIncident(incident.id)}
                        >
                          View Details
                        </Button>
                      </div>

                      <Separator />

                      {/* Proposed Action */}
                      {incident.proposedRemediation && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Zap className="size-5 text-orange-600" />
                            <h4 className="font-semibold">Proposed Remediation</h4>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-muted-foreground mb-1">Action Type</p>
                                <Badge variant="outline">
                                  {incident.proposedRemediation.type}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1">Target</p>
                                <p className="font-mono text-xs">{incident.proposedRemediation.target}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1">Risk Level</p>
                                <Badge variant={getRiskBadgeVariant(incident.proposedRemediation.riskLevel)}>
                                  {incident.proposedRemediation.riskLevel} risk
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-muted-foreground mb-1">Description</p>
                                <p>{incident.proposedRemediation.description}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1">Blast Radius</p>
                                <p className="text-xs">{incident.proposedRemediation.blastRadius}</p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Shield className="size-4 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900 mb-1">Rollback Plan</p>
                                <p className="text-sm text-blue-700">
                                  {incident.proposedRemediation.rollbackPlan}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* RCA Summary */}
                      {incident.rca && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="size-5 text-blue-600" />
                              <h4 className="font-semibold">Root Cause Analysis</h4>
                            </div>
                            <p className="text-sm">{incident.rca.summary}</p>
                            {incident.rca.suspectedCauses && incident.rca.suspectedCauses.length > 0 && (
                              <div className="pt-2">
                                <p className="text-sm font-medium mb-2">Top Suspected Cause:</p>
                                <div className="bg-white border rounded-lg p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <p className="text-sm font-medium">
                                      {incident.rca.suspectedCauses[0].cause}
                                    </p>
                                    <Badge variant="outline">
                                      {Math.round(incident.rca.suspectedCauses[0].confidence * 100)}%
                                    </Badge>
                                  </div>
                                  <ul className="space-y-1 text-sm text-muted-foreground">
                                    {incident.rca.suspectedCauses[0].evidence.slice(0, 3).map((ev: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <span className="mt-1">•</span>
                                        <span>{ev}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <Separator />

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleApprove(incident)}
                          className="flex-1"
                          size="lg"
                          disabled={approving || rejecting}
                        >
                          {approving ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4 mr-2" />
                          )}
                          Approve & Execute
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(incident)}
                          className="flex-1"
                          size="lg"
                          disabled={approving || rejecting}
                        >
                          {rejecting ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="size-4 mr-2" />
                          )}
                          Reject
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">
                        Detected {formatTimestamp(incident.detectedAt)} •
                        Updated {formatTimestamp(incident.updatedAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={actionType !== null} onOpenChange={() => {
        setActionType(null);
        setSelectedIncident(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' ? 'Approve Remediation?' : 'Reject Remediation?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve'
                ? 'Review the proposed action below and confirm if you want to proceed with execution.'
                : 'This will reject the proposed remediation and escalate the incident for manual review.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>

          {actionType === 'approve' ? (
            <div className="space-y-3">
              {selectedIncident?.proposedRemediation && (
                <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Action:</span>{' '}
                    {selectedIncident.proposedRemediation.type}
                  </div>
                  <div>
                    <span className="font-semibold">Target:</span>{' '}
                    {selectedIncident.proposedRemediation.target}
                  </div>
                  <div>
                    <span className="font-semibold">Risk:</span>{' '}
                    {selectedIncident.proposedRemediation.riskLevel}
                  </div>
                </div>
              )}
              <div className="text-orange-600 font-medium text-sm">
                This action will be executed immediately on the Kubernetes cluster.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Service: {selectedIncident?.service}
              </div>
              <div className="text-orange-600 font-medium text-sm">
                The incident will remain active and require manual intervention.
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {actionType === 'approve' ? (
              <AlertDialogAction onClick={confirmApprove} disabled={approving}>
                {approving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Approve & Execute
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={confirmReject} className="bg-red-600 hover:bg-red-700" disabled={rejecting}>
                {rejecting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Reject & Escalate
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}