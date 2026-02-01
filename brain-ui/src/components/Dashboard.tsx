import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  Server,
  Zap,
  RefreshCw,
  Loader2
} from "lucide-react";
import { useClusterMetrics, useIncidents, usePendingApprovals, useScan } from "../lib/hooks";
import { Incident } from "../types";
import { toast } from "sonner";

interface DashboardProps {
  onIncidentClick: (id: string) => void;
}

export function Dashboard({ onIncidentClick }: DashboardProps) {
  // Fetch real data from API
  const { metrics, loading: metricsLoading, refetch: refetchMetrics } = useClusterMetrics();
  const { incidents, loading: incidentsLoading, refetch: refetchIncidents } = useIncidents();
  const { pending, count: pendingCount, refetch: refetchPending } = usePendingApprovals();
  const { scan, loading: scanning } = useScan();

  // Calculate incident stats
  const recentIncidents = incidents.filter(
    (i: Incident) => ['detected', 'analyzing', 'pending_approval', 'remediating', 'resolved', 'escalated', 'rejected'].includes(i.status)
  ).reverse(); // Show newest first

  const activeCount = incidents.filter(
    (i: Incident) => ['detected', 'analyzing', 'pending_approval', 'remediating'].includes(i.status)
  ).length;

  const criticalIncidents = recentIncidents.filter((i: Incident) => i.severity === 'critical' && i.status !== 'resolved');
  const resolvedToday = incidents.filter((i: Incident) => i.status === 'resolved');

  const handleRefresh = async () => {
    refetchMetrics();
    refetchIncidents();
    refetchPending();
    toast.success("Dashboard refreshed");
  };

  const handleScan = async () => {
    try {
      const result = await scan();
      if (result && result.detected > 0) {
        toast.success(`Scan complete: ${result.detected} incident(s) detected`);
        refetchIncidents();
        refetchPending();
      } else {
        toast.info("Scan complete: No new incidents detected");
      }
    } catch (e) {
      toast.error("Scan failed");
    }
  };

  const getStatusColor = (status: Incident['status']) => {
    const colors = {
      detected: 'bg-yellow-500',
      analyzing: 'bg-blue-500',
      pending_approval: 'bg-orange-500',
      remediating: 'bg-purple-500',
      resolved: 'bg-green-500',
      escalated: 'bg-red-500',
      rejected: 'bg-gray-500'
    };
    return colors[status];
  };

  const getSeverityBadge = (severity: Incident['severity']) => {
    const variants = {
      critical: 'destructive',
      high: 'default',
      medium: 'secondary',
      low: 'outline'
    } as const;
    return variants[severity];
  };

  const formatTimeAgo = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  // Show loading state
  const isLoading = metricsLoading || incidentsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="size-8" />
            Volt
          </h1>
          <p className="text-muted-foreground mt-1">
            Intelligent Incident Response System
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleScan} disabled={scanning}>
            {scanning ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Activity className="size-4 mr-2" />
            )}
            Run Scan
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">
              {criticalIncidents.length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Require human review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedToday.length}</div>
            <p className="text-xs text-muted-foreground">
              Auto-remediated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cluster Health</CardTitle>
            <Server className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? `${metrics.nodes.ready}/${metrics.nodes.total}` : '-/-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Nodes ready
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Resources */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-5" />
              CPU & Memory
            </CardTitle>
            <CardDescription>Current cluster resource usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>CPU Usage</span>
                <span className="font-medium">
                  {metrics ? `${metrics.cpu.usage.toFixed(1)} / ${metrics.cpu.capacity} cores` : '- / -'}
                  {metrics && metrics.cpu.capacity > 0 && ` (${Math.round((metrics.cpu.usage / metrics.cpu.capacity) * 100)}%)`}
                </span>
              </div>
              <Progress value={metrics && metrics.cpu.capacity > 0 ? (metrics.cpu.usage / metrics.cpu.capacity) * 100 : 0} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Memory Usage</span>
                <span className="font-medium">
                  {metrics ? `${(metrics.memory.usage / (1024 * 1024 * 1024)).toFixed(1)} / ${(metrics.memory.capacity / (1024 * 1024 * 1024)).toFixed(1)} GB` : '- / -'}
                  {metrics && metrics.memory.capacity > 0 && ` (${Math.round((metrics.memory.usage / metrics.memory.capacity) * 100)}%)`}
                </span>
              </div>
              <Progress value={metrics && metrics.memory.capacity > 0 ? (metrics.memory.usage / metrics.memory.capacity) * 100 : 0} className="[&>div]:bg-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="size-5" />
              Pod Status
            </CardTitle>
            <CardDescription>Kubernetes pod distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Running</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-300">
                {metrics?.pods.running || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pending</span>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-300">
                {metrics?.pods.pending || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Failed</span>
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-300">
                {metrics?.pods.failed || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Recent incidents and remediation actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incidentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="size-8 mx-auto mb-2 animate-spin" />
              <p>Loading incidents...</p>
            </div>
          ) : recentIncidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="size-12 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map((incident: Incident) => (
                <div
                  key={incident.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => onIncidentClick(incident.id)}
                >
                  <div className={`size-2 rounded-full mt-2 ${getStatusColor(incident.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{incident.title}</h4>
                      <Badge variant={getSeverityBadge(incident.severity)}>
                        {incident.severity}
                      </Badge>
                      <Badge variant="outline" className="ml-auto">
                        {Math.round(incident.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {incident.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{incident.namespace}/{incident.service}</span>
                      <span>•</span>
                      <span>{incident.affectedPods?.length || 1} pods affected</span>
                      <span>•</span>
                      <span>{formatTimeAgo(incident.detectedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <Card className="border-orange-300 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Clock className="size-5" />
              Pending Approvals
            </CardTitle>
            <CardDescription>
              Remediation actions waiting for human review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending.map((incident: Incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => onIncidentClick(incident.id)}
                >
                  <div>
                    <h4 className="font-medium mb-1">{incident.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {incident.proposedRemediation?.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                    Review Required
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
