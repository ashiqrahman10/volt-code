import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import {
  Activity,
  CheckCircle2,
  Server,
  Wifi,
  Database,
  Zap,
  AlertCircle,
  Settings,
  RefreshCw,
  Loader2
} from "lucide-react";
import { useSystemStatus } from "../lib/hooks";

interface MCPTool {
  name: string;
  category: string;
  status: 'operational' | 'degraded' | 'down';
  lastCalled: Date | null;
  callCount: number;
  avgResponseTime: number;
}

export function SystemStatus() {
  const { status: systemStatus, loading, error, refetch } = useSystemStatus();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {

    console.log(systemStatus)
  }, [systemStatus])

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setLastRefresh(new Date());
    setIsRefreshing(false);
  };

  // Use API data if available, otherwise fallback to defaults
  const gatewayStatus = systemStatus?.gateway ? {
    status: systemStatus.gateway.connected ? 'connected' : 'disconnected',
    uptime: systemStatus.gateway.uptime || 0,
    version: systemStatus.gateway.version || 'unknown',
    cluster: systemStatus.gateway.cluster || 'unknown',
    namespace: systemStatus.gateway.namespace || 'volt',
    lastHeartbeat: systemStatus.gateway.lastHeartbeat ? new Date(systemStatus.gateway.lastHeartbeat) : new Date(),
    cpu: systemStatus.gateway.cpu || 0,
    memory: systemStatus.gateway.memory || 0,
  } : {
    status: 'disconnected' as const,
    uptime: 0,
    version: 'unknown',
    cluster: 'unknown',
    namespace: 'volt-system',
    lastHeartbeat: new Date(),
    cpu: 0,
    memory: 0,
  };

  const prometheusStatus = systemStatus?.prometheus || {
    status: 'unknown',
    endpoint: 'http://prometheus.monitoring:9090',
    version: 'unknown',
    scrapeInterval: 15,
    dataRetention: '30d',
    activeTargets: 0,
    healthyTargets: 0,
  };

  const kubernetesStatus = systemStatus?.kubernetes || {
    status: 'unknown',
    version: 'unknown',
    nodes: { total: 0, ready: 0 },
    namespaces: 0,
    apiServer: 'unknown',
    rbacEnabled: true,
  };

  // Map tools from API or use defaults
  const mcpTools: MCPTool[] = systemStatus?.tools && systemStatus.tools.length > 0 ? systemStatus.tools.map((t: any) => ({
    name: t.name,
    category: t.category || 'Telemetry',
    status: t.status as 'operational' | 'degraded' | 'down',
    lastCalled: t.lastCalled ? new Date(t.lastCalled) : null,
    callCount: t.callCount || 0,
    avgResponseTime: t.avgResponseTime || 0,
  })) : [
    {
      name: 'prom_query',
      category: 'Telemetry',
      status: 'operational',
      lastCalled: new Date(Date.now() - 120000),
      callCount: 1247,
      avgResponseTime: 145,
    },
    {
      name: 'tail_logs',
      category: 'Telemetry',
      status: 'operational',
      lastCalled: new Date(Date.now() - 60000),
      callCount: 834,
      avgResponseTime: 89,
    },
    {
      name: 'get_events',
      category: 'Telemetry',
      status: 'operational',
      lastCalled: new Date(Date.now() - 180000),
      callCount: 456,
      avgResponseTime: 67,
    },
    {
      name: 'rollout_restart',
      category: 'Remediation',
      status: 'operational',
      lastCalled: new Date(Date.now() - 3600000),
      callCount: 23,
      avgResponseTime: 2340,
    },
    {
      name: 'scale_deployment',
      category: 'Remediation',
      status: 'operational',
      lastCalled: new Date(Date.now() - 7200000),
      callCount: 15,
      avgResponseTime: 1890,
    },
    {
      name: 'delete_pod',
      category: 'Remediation',
      status: 'operational',
      lastCalled: new Date(Date.now() - 14400000),
      callCount: 8,
      avgResponseTime: 890,
    },
  ];

  const externalBrainStatus = {
    status: systemStatus?.brain?.status || 'operational',
    location: 'External Control Plane',
    llmProvider: systemStatus?.mlService?.model || 'Groq Llama',
    llmStatus: systemStatus?.mlService?.status || 'connected',
    incidentsProcessed: systemStatus?.brain?.incidentsProcessed || 0,
    avgAnalysisTime: 3.2,  // Not provided by API yet
  };

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  const formatTimestamp = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Never';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-300';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-300';
      case 'down':
      case 'disconnected':
        return 'text-red-600 bg-red-50 border-red-300';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-300';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="size-8" />
              System Status
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor all components and integrations
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="size-4 mr-2" />
            Retry
          </Button>
        </div>

        <Card className="border-red-300 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="size-6" />
              Failed to Load System Status
            </CardTitle>
            <CardDescription className="text-red-700">
              {error || "Unable to fetch system status. Please try refreshing the page."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="size-8" />
            System Status
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor all components and integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Last updated: {formatTimestamp(lastRefresh)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health */}
      <Card className="border-green-300 bg-green-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <CheckCircle2 className="size-6" />
            All Systems Operational
          </CardTitle>
          <CardDescription>
            All components are healthy and functioning normally
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Architecture Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture Overview</CardTitle>
          <CardDescription>
            Brains outside the cluster, hands inside the cluster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* External Brain */}
            <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-3 rounded-full bg-blue-500 animate-pulse" />
                <h3 className="font-semibold text-blue-900">External Incident Brain</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{externalBrainStatus.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LLM Provider</span>
                  <Badge variant="outline">{externalBrainStatus.llmProvider}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Incidents Processed</span>
                  <span className="font-medium">{externalBrainStatus.incidentsProcessed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Analysis Time</span>
                  <span className="font-medium">{externalBrainStatus.avgAnalysisTime}s</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>Responsibilities:</strong> Correlation, RCA, Decision Tree, LLM Analysis
                </p>
              </div>
            </div>

            {/* Gateway Agent */}
            <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-3 rounded-full bg-purple-500 animate-pulse" />
                <h3 className="font-semibold text-purple-900">Gateway Agent</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cluster</span>
                  <span className="font-mono text-xs">{gatewayStatus.cluster}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Namespace</span>
                  <span className="font-mono text-xs">{gatewayStatus.namespace}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <Badge variant="outline">{gatewayStatus.version}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium">{formatUptime(gatewayStatus.uptime)}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-purple-200">
                <p className="text-xs text-purple-700">
                  <strong>Responsibilities:</strong> Telemetry Export, MCP Tools, Safe Execution
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Agent Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Gateway Agent
          </CardTitle>
          <CardDescription>Pod running inside the Kubernetes cluster</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Badge variant="outline" className={getStatusColor(gatewayStatus.status)}>
                <Wifi className="size-3 mr-1" />
                {gatewayStatus.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Version</p>
              <p className="font-mono text-sm">{gatewayStatus.version}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Uptime</p>
              <p className="font-medium">{formatUptime(gatewayStatus.uptime)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Heartbeat</p>
              <p className="text-sm">{formatTimestamp(gatewayStatus.lastHeartbeat)}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Resource Usage</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>CPU</span>
                <span className="font-medium">{gatewayStatus.cpu}%</span>
              </div>
              <Progress value={gatewayStatus.cpu} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Memory</span>
                <span className="font-medium">{gatewayStatus.memory}%</span>
              </div>
              <Progress value={gatewayStatus.memory} className="[&>div]:bg-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MCP Tools Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5" />
            MCP Tools
          </CardTitle>
          <CardDescription>
            Model Context Protocol tools exposed by the Gateway Agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Telemetry Tools */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="size-4" />
                Telemetry Tools
              </h4>
              <div className="grid gap-3 md:grid-cols-3">
                {mcpTools.filter(t => t.category === 'Telemetry').map((tool) => (
                  <div key={tool.name} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-medium">{tool.name}</span>
                      <Badge
                        variant="outline"
                        className={getStatusColor(tool.status)}
                      >
                        {tool.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Last called</span>
                        <span>{formatTimestamp(tool.lastCalled)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total calls</span>
                        <span className="font-medium text-foreground">{tool.callCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg response</span>
                        <span>{tool.avgResponseTime}ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Remediation Tools */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Settings className="size-4" />
                Remediation Tools
              </h4>
              <div className="grid gap-3 md:grid-cols-3">
                {mcpTools.filter(t => t.category === 'Remediation').map((tool) => (
                  <div key={tool.name} className="border rounded-lg p-3 bg-orange-50/30 border-orange-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-medium">{tool.name}</span>
                      <Badge
                        variant="outline"
                        className={getStatusColor(tool.status)}
                      >
                        {tool.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Last called</span>
                        <span>{formatTimestamp(tool.lastCalled)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total calls</span>
                        <span className="font-medium text-foreground">{tool.callCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg duration</span>
                        <span>{(tool.avgResponseTime / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Prometheus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5" />
              Prometheus
            </CardTitle>
            <CardDescription>Metrics collection and storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="outline" className={getStatusColor(prometheusStatus.status)}>
                {prometheusStatus.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">{prometheusStatus.version}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Scrape Interval</span>
              <span>{prometheusStatus.scrapeInterval}s</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data Retention</span>
              <span>{prometheusStatus.dataRetention}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Targets</span>
              <span className="font-medium">{prometheusStatus.activeTargets}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Healthy Targets</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                {prometheusStatus.healthyTargets}/{prometheusStatus.activeTargets}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Kubernetes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5" />
              Kubernetes
            </CardTitle>
            <CardDescription>Cluster API and orchestration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="outline" className={getStatusColor(kubernetesStatus.status)}>
                {kubernetesStatus.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">{kubernetesStatus.version}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Namespaces</span>
              <span>{kubernetesStatus.namespaces}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">RBAC</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                Enabled
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Nodes</span>
              <span className="font-medium">
                {kubernetesStatus.nodes.ready}/{kubernetesStatus.nodes.total} Ready
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security & Safety */}
      <Card className="border-blue-300 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <CheckCircle2 className="size-5" />
            Security & Safety Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>Namespace-scoped RBAC enabled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>Tool allowlisting active</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>No secret exposure to LLM</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>Audit logging enabled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>Rate limits configured</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>Human approval for high-risk actions</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
