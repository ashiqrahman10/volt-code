import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  Zap,
  Server,
  Activity,
  Loader2,
} from "lucide-react";
import { useIncident, useApproveAction, useRejectAction } from "../lib/hooks";
import { generateMetricTimeSeries } from "../lib/mock-data";
import { Incident, Signal } from "../types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime)

interface IncidentDetailProps {
  incidentId: string;
  onBack: () => void;
  onApprove?: (incidentId: string) => void;
  onReject?: (incidentId: string) => void;
}

export function IncidentDetail({ incidentId, onBack, onApprove, onReject }: IncidentDetailProps) {
  const { incident, loading, error, refetch } = useIncident(incidentId);
  const { approve, loading: approving } = useApproveAction();
  const { reject, loading: rejecting } = useRejectAction();


  const handleApprove = async () => {
    try {
      await approve(incidentId);
      toast.success("Remediation approved and executed");
      await refetch();
      onApprove?.(incidentId);
    } catch (e) {
      toast.error("Failed to approve remediation");
    }
  };

  const handleReject = async () => {
    try {
      await reject(incidentId);
      toast.error("Remediation rejected");
      await refetch();
      onReject?.(incidentId);
    } catch (e) {
      toast.error("Failed to reject remediation");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="size-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground">Loading incident details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{error || "Incident not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  const getStatusIcon = (status: Incident['status']) => {
    switch (status) {
      case 'detected':
        return <AlertCircle className="size-5" />;
      case 'analyzing':
        return <Activity className="size-5" />;
      case 'pending_approval':
        return <Clock className="size-5" />;
      case 'remediating':
        return <Zap className="size-5" />;
      case 'resolved':
        return <CheckCircle2 className="size-5" />;
      case 'escalated':
        return <AlertTriangle className="size-5" />;
      case 'rejected':
        return <AlertCircle className="size-5" />;
    }
  };

  const getSeverityColor = (severity: Incident['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const formatTimestamp = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSignalIcon = (type: Signal['type']) => {
    switch (type) {
      case 'metric':
        return <TrendingUp className="size-4" />;
      case 'log':
        return <FileText className="size-4" />;
      case 'event':
        return <Server className="size-4" />;
    }
  };

  // Generate mock metric data
  const memoryData = generateMetricTimeSeries(60, 45, 5, 'increasing');
  const cpuData = generateMetricTimeSeries(60, 55, 8, 'stable');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" onClick={onBack} className="mt-1">
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2">{incident.title}</h1>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                {incident.severity} severity
              </Badge>
              <Badge variant="outline">
                {incident.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline">
                {Math.round(incident.confidence * 100)}% confidence
              </Badge>
              <Badge variant="outline">
                Correlation: {Math.round(incident.correlationScore * 100)}%
              </Badge>
            </div>
            <p className="text-muted-foreground">{incident.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {getStatusIcon(incident.status)}

        </div>
      </div>

      {/* Key Information */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Service</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{incident.service}</p>
            <p className="text-sm text-muted-foreground">{incident.namespace}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{formatTimestamp(incident.detectedAt)}</p>
            <p className="text-sm text-muted-foreground">
              {dayjs(incident.detectedAt).fromNow()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Affected Pods</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{incident.affectedPods.length}</p>
            <p className="text-sm text-muted-foreground">pods impacted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{incident.signals.length}</p>
            <p className="text-sm text-muted-foreground">correlated signals</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rca">Root Cause Analysis</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Affected Pods */}
            <Card>
              <CardHeader>
                <CardTitle>Affected Pods</CardTitle>
                <CardDescription>Pods impacted by this incident</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {incident.affectedPods.map((pod) => (
                      <div
                        key={pod}
                        className="flex items-center gap-2 p-2 rounded border text-sm font-mono"
                      >
                        <Server className="size-4 text-muted-foreground" />
                        {pod}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Tags & Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Tags & Metadata</CardTitle>
                <CardDescription>Classification and labels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {(incident.tags || []).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Incident ID</span>
                    <span className="font-mono">{incident.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{formatTimestamp(incident.updatedAt)}</span>
                  </div>
                  {incident.resolvedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolved At</span>
                      <span className="text-green-600">{formatTimestamp(incident.resolvedAt)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RCA Tab */}
        <TabsContent value="rca" className="space-y-4">
          {incident.rca ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                  <CardDescription>AI-generated root cause analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">
                    {incident.rca.summary || incident.rca.root_cause || 'Analysis in progress...'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Suspected Root Causes</CardTitle>
                  <CardDescription>Ranked by confidence level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(incident.rca.suspectedCauses || []).length > 0 ? (
                      incident.rca.suspectedCauses!.map((cause, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold">{cause.cause}</h4>
                            <Badge variant="outline">
                              {Math.round(cause.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Evidence:</p>
                            <ul className="space-y-1 text-sm">
                              {(cause.evidence || []).map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-muted-foreground mt-1">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold">{incident.rca.root_cause || 'Unknown'}</h4>
                          <Badge variant="outline">
                            {Math.round((incident.rca.confidence || 0) * 100)}% confidence
                          </Badge>
                        </div>
                        {(incident.rca.evidence || incident.rca.contributing_factors || []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Evidence:</p>
                            <ul className="space-y-1 text-sm">
                              {(incident.rca.evidence || incident.rca.contributing_factors || []).map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-muted-foreground mt-1">•</span>
                                  <span>{String(item)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recommended Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {(incident.rca.recommendedActions || (incident.rca.recommended_action ? [incident.rca.recommended_action] : [])).map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="font-semibold text-muted-foreground">{idx + 1}.</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Rollback Guidance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{incident.rca.rollbackGuidance || incident.rca.rollback_guidance || 'No rollback guidance available'}</p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="size-12 mx-auto mb-4 text-muted-foreground opacity-50 animate-pulse" />
                <p className="text-muted-foreground">Root cause analysis in progress...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Memory Usage</CardTitle>
              <CardDescription>Container memory over the last hour</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={memoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'Memory']}
                  />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CPU Usage</CardTitle>
              <CardDescription>Container CPU over the last hour</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cpuData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'CPU']}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signals Tab */}
        <TabsContent value="signals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Correlated Signals</CardTitle>
              <CardDescription>
                {incident.signals.length} signals detected and correlated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incident.signals.map((signal) => (
                  <div key={signal.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      {getSignalIcon(signal.type)}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {signal.type}
                            </Badge>
                            {signal.type === 'metric' && (
                              <h4 className="font-semibold text-sm">{signal.name}</h4>
                            )}
                            {signal.type === 'log' && (
                              <h4 className="font-semibold text-sm flex items-center gap-2">
                                Log Entry
                                <Badge variant={signal.level === 'error' ? 'destructive' : 'secondary'}>
                                  {signal.level}
                                </Badge>
                              </h4>
                            )}
                            {signal.type === 'event' && (
                              <h4 className="font-semibold text-sm">{signal.reason}</h4>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(signal.timestamp)}
                          </span>
                        </div>

                        {signal.type === 'metric' && (
                          <div className="space-y-1 text-sm">
                            <p>Value: <span className="font-mono">
                              {typeof signal.value === 'number'
                                ? signal.value.toExponential(2)
                                : String(signal.value)}
                            </span></p>
                            {signal.threshold !== undefined && (
                              <p>Threshold: <span className="font-mono">
                                {typeof signal.threshold === 'number'
                                  ? signal.threshold.toExponential(2)
                                  : String(signal.threshold)}
                              </span></p>
                            )}
                            {signal.trend && (
                              <p>Trend: <Badge variant="outline">{signal.trend}</Badge></p>
                            )}
                            {signal.query && (
                              <p className="text-muted-foreground font-mono text-xs mt-2">{signal.query}</p>
                            )}
                          </div>
                        )}

                        {signal.type === 'log' && (
                          <div className="space-y-1 text-sm">
                            <p className="font-mono text-xs bg-muted p-2 rounded">{signal.message}</p>
                            <p>Pod: <span className="font-mono">{signal.pod}</span></p>
                            <p>Occurrences: <Badge variant="outline">{signal.count}</Badge></p>
                          </div>
                        )}

                        {signal.type === 'event' && (
                          <div className="space-y-1 text-sm">
                            <p>{signal.message}</p>
                            <p>Resource: <span className="font-mono">{signal.resource}</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incident Timeline</CardTitle>
              <CardDescription>Chronological sequence of events</CardDescription>
            </CardHeader>
            <CardContent>
              {incident.rca?.timeline ? (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {incident.rca.timeline.map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-6 top-1 size-4 rounded-full border-2 border-primary bg-background" />
                      <div className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-1">
                          <Badge variant="outline">{item.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm">{item.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Timeline not available yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Remediation Action */}
      {incident.proposedRemediation && (incident.status === 'pending_approval' || incident.status === 'resolved') && (
        <Card className={incident.status === 'resolved' ? "border-green-300 bg-green-50/50" : "border-orange-300 bg-orange-50/50"}>
          <CardHeader>
            <CardTitle className={incident.status === 'resolved' ? "text-green-900" : "text-orange-900"}>
              {incident.status === 'resolved' ? "Remediation Executed" : "Proposed Remediation"}
            </CardTitle>
            <CardDescription>
              {incident.status === 'resolved'
                ? "Action completed and verified automatically"
                : "Action requires human approval"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium mb-1">Action Type</p>
                <Badge variant={incident.status === 'resolved' ? "outline" : "default"}>
                  {incident.proposedRemediation.type}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Risk Level</p>
                <Badge variant={
                  incident.proposedRemediation.riskLevel === 'high' ? 'destructive' :
                    incident.proposedRemediation.riskLevel === 'medium' ? 'default' : 'outline'
                }>
                  {incident.proposedRemediation.riskLevel}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Target</p>
                <p className="text-sm font-mono">{incident.proposedRemediation.target}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Description</p>
              <p className="text-sm">{incident.proposedRemediation.description}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Blast Radius</p>
              <p className="text-sm text-muted-foreground">{incident.proposedRemediation.blastRadius}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Rollback Plan</p>
              <p className="text-sm text-muted-foreground">{incident.proposedRemediation.rollbackPlan}</p>
            </div>

            {incident.status === 'pending_approval' ? (
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleApprove}
                  className="flex-1"
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
                  onClick={handleReject}
                  className="flex-1"
                  disabled={approving || rejecting}
                >
                  {rejecting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <AlertCircle className="size-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-white/50 rounded border border-green-200 flex items-center gap-2 text-green-800 text-sm">
                <CheckCircle2 className="size-4" />
                <span>Action <strong>{incident.proposedRemediation.type}</strong> was executed successfully. Incident resolved.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
