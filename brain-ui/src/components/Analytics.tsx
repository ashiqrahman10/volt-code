import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";

export function Analytics() {
  // Mock analytics data
  const incidentTrend = [
    { date: 'Mon', detected: 12, resolved: 10, escalated: 2 },
    { date: 'Tue', detected: 15, resolved: 14, escalated: 1 },
    { date: 'Wed', detected: 8, resolved: 8, escalated: 0 },
    { date: 'Thu', detected: 18, resolved: 15, escalated: 3 },
    { date: 'Fri', detected: 14, resolved: 13, escalated: 1 },
    { date: 'Sat', detected: 6, resolved: 6, escalated: 0 },
    { date: 'Sun', detected: 5, resolved: 5, escalated: 0 },
  ];

  const mttrData = [
    { date: 'Mon', mttr: 4.2 },
    { date: 'Tue', mttr: 3.8 },
    { date: 'Wed', mttr: 2.5 },
    { date: 'Thu', mttr: 5.1 },
    { date: 'Fri', mttr: 3.2 },
    { date: 'Sat', mttr: 2.8 },
    { date: 'Sun', mttr: 2.1 },
  ];

  const severityDistribution = [
    { name: 'Critical', value: 12, color: '#ef4444' },
    { name: 'High', value: 28, color: '#f97316' },
    { name: 'Medium', value: 45, color: '#eab308' },
    { name: 'Low', value: 15, color: '#3b82f6' },
  ];

  const remediationTypeData = [
    { type: 'rollout_restart', count: 34 },
    { type: 'scale_deployment', count: 18 },
    { type: 'cleanup_logs', count: 12 },
    { type: 'delete_pod', count: 8 },
  ];

  const stats = [
    {
      label: 'Total Incidents',
      value: '156',
      change: '+12%',
      trend: 'up' as const,
      description: 'vs last week'
    },
    {
      label: 'MTTR',
      value: '3.4m',
      change: '-18%',
      trend: 'down' as const,
      description: 'Mean Time to Resolution'
    },
    {
      label: 'Auto-Remediated',
      value: '89%',
      change: '+5%',
      trend: 'up' as const,
      description: 'Without human intervention'
    },
    {
      label: 'False Positives',
      value: '4.2%',
      change: '-2%',
      trend: 'down' as const,
      description: 'Rejected incidents'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="size-8" />
          Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          System performance metrics and trends
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              {stat.trend === 'up' ? (
                <TrendingUp className="size-4 text-green-600" />
              ) : (
                <TrendingDown className="size-4 text-green-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className={stat.trend === 'down' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-blue-50 text-blue-700 border-blue-300'}
                >
                  {stat.change}
                </Badge>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incident Volume (Last 7 Days)</CardTitle>
              <CardDescription>
                Detected, resolved, and escalated incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={incidentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="detected" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Detected"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="resolved" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Resolved"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="escalated" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Escalated"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mean Time to Resolution (MTTR)</CardTitle>
              <CardDescription>
                Average time from detection to resolution (minutes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mttrData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="mttr" fill="#8b5cf6" name="MTTR (min)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
                <CardDescription>
                  Incidents by severity level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remediation Actions</CardTitle>
                <CardDescription>
                  Most frequently used remediation types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={remediationTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="type" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Affected Services</CardTitle>
              <CardDescription>
                Services with the most incidents (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { service: 'payment-service', incidents: 23, trend: 'up' },
                  { service: 'user-service', incidents: 18, trend: 'stable' },
                  { service: 'api-gateway', incidents: 15, trend: 'down' },
                  { service: 'recommendation-engine', incidents: 12, trend: 'up' },
                  { service: 'logging-collector', incidents: 8, trend: 'stable' },
                ].map((item) => (
                  <div key={item.service} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Activity className="size-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{item.service}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.incidents} incidents
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {item.trend === 'up' && <TrendingUp className="size-3 mr-1 text-red-500" />}
                      {item.trend === 'down' && <TrendingDown className="size-3 mr-1 text-green-500" />}
                      {item.trend}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Detection Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">95.8%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  True positive rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">RCA Quality Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">4.6/5.0</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average operator rating
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">94%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Proposed actions approved
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Performance Metrics</CardTitle>
              <CardDescription>
                Key performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Mean Time to Detection (MTTD)</span>
                      <span className="font-medium">42s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Mean Time to Resolution (MTTR)</span>
                      <span className="font-medium">3.4m</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>RCA Generation Time</span>
                      <span className="font-medium">3.2s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Remediation Success Rate</span>
                      <span className="font-medium">96.5%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Gateway Agent Uptime</span>
                      <span className="font-medium">99.98%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>LLM API Latency (p95)</span>
                      <span className="font-medium">1.8s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Prometheus Query Time</span>
                      <span className="font-medium">145ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Log Streaming Latency</span>
                      <span className="font-medium">89ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-300 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-green-900 flex items-center gap-2">
                <CheckCircle2 className="size-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>All components operational</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>No degraded services</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>Prometheus healthy</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>LLM API responding</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
