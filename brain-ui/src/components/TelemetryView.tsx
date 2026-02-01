import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { 
  Activity, 
  FileText, 
  Server, 
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  Terminal,
  Database
} from "lucide-react";
import { mockLogEntries, mockKubernetesEvents, generateMetricTimeSeries } from "../lib/mock-data";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TelemetryView() {
  const [metricsQuery, setMetricsQuery] = useState("container_memory_usage_bytes");
  const [logsFilter, setLogsFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [eventsFilter, setEventsFilter] = useState<'all' | 'Warning' | 'Normal'>('all');
  const [namespace, setNamespace] = useState('all');
  
  // Simulate real-time updates
  const [logs, setLogs] = useState(mockLogEntries);
  const [events, setEvents] = useState(mockKubernetesEvents);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new log entries
      if (Math.random() > 0.7) {
        const newLog = {
          timestamp: new Date(),
          level: Math.random() > 0.8 ? 'error' : Math.random() > 0.5 ? 'warn' : 'info' as const,
          message: [
            'Request processed successfully',
            'Cache hit for key: user_profile_12345',
            'Database query took 142ms',
            'Health check passed',
            'Connection timeout to external service'
          ][Math.floor(Math.random() * 5)],
          pod: `service-${Math.random() > 0.5 ? 'abc123' : 'def456'}`,
          namespace: 'production',
          container: 'main'
        };
        setLogs(prev => [newLog, ...prev.slice(0, 49)]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesLevel = logsFilter === 'all' || log.level === logsFilter;
    const matchesNamespace = namespace === 'all' || log.namespace === namespace;
    return matchesLevel && matchesNamespace;
  });

  const filteredEvents = events.filter(event => {
    const matchesType = eventsFilter === 'all' || event.type === eventsFilter;
    const matchesNamespace = namespace === 'all' || event.namespace === namespace;
    return matchesType && matchesNamespace;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="size-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="size-4 text-yellow-500" />;
      case 'info':
        return <Info className="size-4 text-blue-500" />;
      default:
        return <Terminal className="size-4 text-muted-foreground" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warn':
        return 'default';
      default:
        return 'outline';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  // Generate metric data based on query
  const metricData = generateMetricTimeSeries(30, 50, 10, 'stable');

  const availableQueries = [
    'container_memory_usage_bytes',
    'container_cpu_usage_seconds_total',
    'http_request_duration_seconds',
    'http_requests_total',
    'node_disk_usage_bytes'
  ];

  const namespaces = ['all', 'production', 'staging', 'monitoring'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="size-8" />
          Telemetry
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time metrics, logs, and events from the cluster
        </p>
      </div>

      {/* Global Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Namespace</label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map(ns => (
                    <SelectItem key={ns} value={ns}>
                      {ns === 'all' ? 'All Namespaces' : ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Telemetry Views */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">
            <Database className="size-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="size-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="events">
            <Server className="size-4 mr-2" />
            Events
          </TabsTrigger>
        </TabsList>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prometheus Query</CardTitle>
              <CardDescription>Query metrics from Prometheus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={metricsQuery} onValueChange={setMetricsQuery}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQueries.map(query => (
                      <SelectItem key={query} value={query}>
                        {query}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button>
                  <Search className="size-4 mr-2" />
                  Query
                </Button>
              </div>

              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-mono">{metricsQuery}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time Series Data</CardTitle>
              <CardDescription>Last 30 minutes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={metricData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [value.toFixed(2), metricsQuery]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pod Logs</CardTitle>
              <CardDescription>
                Real-time log streaming from Kubernetes pods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Select value={logsFilter} onValueChange={(v) => setLogsFilter(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="error">Errors Only</SelectItem>
                    <SelectItem value="warn">Warnings Only</SelectItem>
                    <SelectItem value="info">Info Only</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Badge variant="outline" className="animate-pulse">
                  <Activity className="size-3 mr-1" />
                  Live
                </Badge>
              </div>

              <ScrollArea className="h-[500px] rounded-lg border bg-black p-4">
                <div className="space-y-1 font-mono text-xs">
                  {filteredLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 hover:bg-muted/10 p-1 rounded"
                    >
                      <span className="text-muted-foreground shrink-0">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <Badge
                        variant={getLevelBadge(log.level)}
                        className="shrink-0 h-5 text-[10px]"
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-blue-400 shrink-0">{log.pod}</span>
                      <span className={
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn' ? 'text-yellow-400' :
                        'text-gray-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>Showing {filteredLogs.length} log entries</span>
                <Button variant="outline" size="sm">
                  <FileText className="size-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kubernetes Events</CardTitle>
              <CardDescription>
                Cluster events from the Kubernetes API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Select value={eventsFilter} onValueChange={(v) => setEventsFilter(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="Warning">Warnings Only</SelectItem>
                    <SelectItem value="Normal">Normal Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {filteredEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${
                      event.type === 'Warning' ? 'border-yellow-300 bg-yellow-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {event.type === 'Warning' ? (
                        <AlertTriangle className="size-5 text-yellow-600 mt-0.5" />
                      ) : (
                        <Info className="size-5 text-blue-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={event.type === 'Warning' ? 'default' : 'outline'}>
                            {event.type}
                          </Badge>
                          <Badge variant="outline">{event.reason}</Badge>
                          {event.count > 1 && (
                            <Badge variant="secondary">{event.count}x</Badge>
                          )}
                        </div>
                        <p className="text-sm mb-2">{event.message}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-mono">{event.object}</span>
                          <span>•</span>
                          <span>{event.namespace}</span>
                          <span>•</span>
                          <span>{formatTimestamp(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Server className="size-12 mx-auto mb-4 opacity-50" />
                  <p>No events match your filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
