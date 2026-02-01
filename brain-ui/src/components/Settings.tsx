import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Settings as SettingsIcon, 
  Zap, 
  Shield, 
  Bell,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner@2.0.3";

export function Settings() {
  // Remediation Settings
  const [autoRemediationEnabled, setAutoRemediationEnabled] = useState(true);
  const [requireApprovalThreshold, setRequireApprovalThreshold] = useState<number[]>([2]);
  const [maxPodsAffected, setMaxPodsAffected] = useState("5");
  const [cooldownPeriod, setCooldownPeriod] = useState("300");
  
  // Detection Settings
  const [minConfidence, setMinConfidence] = useState<number[]>([70]);
  const [correlationWindow, setCorrelationWindow] = useState("300");
  const [minSignals, setMinSignals] = useState<number[]>([2]);
  const [falsePositiveFiltering, setFalsePositiveFiltering] = useState(true);

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(true);
  const [pagerdutyIntegration, setPagerdutyIntegration] = useState(false);
  const [notifyOnDetection, setNotifyOnDetection] = useState(true);
  const [notifyOnRemediation, setNotifyOnRemediation] = useState(true);
  const [notifyOnEscalation, setNotifyOnEscalation] = useState(true);

  // LLM Settings
  const [llmProvider, setLlmProvider] = useState("openai-gpt4");
  const [llmTemperature, setLlmTemperature] = useState<number[]>([30]);
  const [maxTokens, setMaxTokens] = useState("2000");
  const [enableRCA, setEnableRCA] = useState(true);

  const handleSave = () => {
    toast.success("Settings Saved", {
      description: "Your configuration has been updated successfully"
    });
  };

  const handleReset = () => {
    toast.info("Settings Reset", {
      description: "Configuration has been reset to defaults"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="size-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system behavior and policies
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave}>
            <Save className="size-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabbed Settings */}
      <Tabs defaultValue="remediation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="remediation">
            <Zap className="size-4 mr-2" />
            Remediation
          </TabsTrigger>
          <TabsTrigger value="detection">
            <AlertTriangle className="size-4 mr-2" />
            Detection
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="llm">
            <Shield className="size-4 mr-2" />
            LLM & RCA
          </TabsTrigger>
        </TabsList>

        {/* Remediation Tab */}
        <TabsContent value="remediation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Remediation</CardTitle>
              <CardDescription>
                Configure automatic remediation behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Auto-Remediation</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically execute low-risk remediation actions
                  </p>
                </div>
                <Switch
                  checked={autoRemediationEnabled}
                  onCheckedChange={setAutoRemediationEnabled}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Require Approval Threshold (Risk Level)</Label>
                <p className="text-sm text-muted-foreground">
                  Actions at or above this risk level require human approval
                </p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={requireApprovalThreshold}
                    onValueChange={setRequireApprovalThreshold}
                    min={1}
                    max={3}
                    step={1}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="min-w-20 justify-center">
                    {requireApprovalThreshold[0] === 1 && "Low"}
                    {requireApprovalThreshold[0] === 2 && "Medium"}
                    {requireApprovalThreshold[0] === 3 && "High"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxPods">Max Pods Affected (Auto-Remediation)</Label>
                  <Input
                    id="maxPods"
                    type="number"
                    value={maxPodsAffected}
                    onChange={(e) => setMaxPodsAffected(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum pods that can be affected without approval
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown Period (seconds)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={cooldownPeriod}
                    onChange={(e) => setCooldownPeriod(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time to wait between remediation attempts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allowed Remediation Actions</CardTitle>
              <CardDescription>
                Control which actions can be executed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-green-600" />
                    <div>
                      <p className="font-medium">rollout_restart</p>
                      <p className="text-sm text-muted-foreground">
                        Rolling restart of deployments
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-green-600" />
                    <div>
                      <p className="font-medium">scale_deployment</p>
                      <p className="text-sm text-muted-foreground">
                        Scale replicas up or down
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-green-600" />
                    <div>
                      <p className="font-medium">cleanup_logs</p>
                      <p className="text-sm text-muted-foreground">
                        Clean up old log files
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="size-5 text-orange-600" />
                    <div>
                      <p className="font-medium">delete_pod</p>
                      <p className="text-sm text-muted-foreground">
                        Force delete specific pods
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Requires Approval</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detection Tab */}
        <TabsContent value="detection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incident Detection</CardTitle>
              <CardDescription>
                Configure incident detection thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Minimum Confidence Score (%)</Label>
                <p className="text-sm text-muted-foreground">
                  Only incidents above this confidence will be processed
                </p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={minConfidence}
                    onValueChange={setMinConfidence}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="min-w-16 justify-center">
                    {minConfidence[0]}%
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Minimum Correlated Signals</Label>
                <p className="text-sm text-muted-foreground">
                  Required number of signals to confirm an incident
                </p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={minSignals}
                    onValueChange={setMinSignals}
                    min={1}
                    max={5}
                    step={1}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="min-w-16 justify-center">
                    {minSignals[0]}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="correlationWindow">Correlation Time Window (seconds)</Label>
                <Input
                  id="correlationWindow"
                  type="number"
                  value={correlationWindow}
                  onChange={(e) => setCorrelationWindow(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Time window for correlating multiple signals
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable False Positive Filtering</Label>
                  <p className="text-sm text-muted-foreground">
                    Filter out transient spikes and noise
                  </p>
                </div>
                <Switch
                  checked={falsePositiveFiltering}
                  onCheckedChange={setFalsePositiveFiltering}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Severity Thresholds</CardTitle>
              <CardDescription>
                Define metric thresholds for severity classification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Critical (%)</Label>
                    <Input type="number" defaultValue="90" />
                  </div>
                  <div className="space-y-2">
                    <Label>High (%)</Label>
                    <Input type="number" defaultValue="75" />
                  </div>
                  <div className="space-y-2">
                    <Label>Medium (%)</Label>
                    <Input type="number" defaultValue="60" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Thresholds for CPU, Memory, and Disk usage metrics
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Configure where to send alerts and updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send alerts via email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              {emailNotifications && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ops-team@company.com"
                    defaultValue="ops-team@company.com"
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Slack Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Post alerts to Slack channels
                  </p>
                </div>
                <Switch
                  checked={slackNotifications}
                  onCheckedChange={setSlackNotifications}
                />
              </div>

              {slackNotifications && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="slack">Slack Webhook URL</Label>
                  <Input
                    id="slack"
                    type="text"
                    placeholder="https://hooks.slack.com/services/..."
                    defaultValue="https://hooks.slack.com/services/T00/B00/xxx"
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>PagerDuty Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Create incidents in PagerDuty
                  </p>
                </div>
                <Switch
                  checked={pagerdutyIntegration}
                  onCheckedChange={setPagerdutyIntegration}
                />
              </div>

              {pagerdutyIntegration && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="pagerduty">PagerDuty Integration Key</Label>
                  <Input
                    id="pagerduty"
                    type="password"
                    placeholder="Enter integration key"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Events</CardTitle>
              <CardDescription>
                Choose which events trigger notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Incident Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    When a new incident is detected
                  </p>
                </div>
                <Switch
                  checked={notifyOnDetection}
                  onCheckedChange={setNotifyOnDetection}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Remediation Execution</Label>
                  <p className="text-sm text-muted-foreground">
                    When a remediation action is executed
                  </p>
                </div>
                <Switch
                  checked={notifyOnRemediation}
                  onCheckedChange={setNotifyOnRemediation}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Incident Escalation</Label>
                  <p className="text-sm text-muted-foreground">
                    When an incident is escalated to humans
                  </p>
                </div>
                <Switch
                  checked={notifyOnEscalation}
                  onCheckedChange={setNotifyOnEscalation}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Tab */}
        <TabsContent value="llm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LLM Configuration</CardTitle>
              <CardDescription>
                Configure the language model for root cause analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="llmProvider">LLM Provider</Label>
                <Select value={llmProvider} onValueChange={setLlmProvider}>
                  <SelectTrigger id="llmProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai-gpt4">OpenAI GPT-4</SelectItem>
                    <SelectItem value="openai-gpt4-turbo">OpenAI GPT-4 Turbo</SelectItem>
                    <SelectItem value="anthropic-claude">Anthropic Claude</SelectItem>
                    <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  LLM provider for generating root cause analysis
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable RCA Generation</Label>
                  <p className="text-sm text-muted-foreground">
                    Use LLM to generate root cause analysis
                  </p>
                </div>
                <Switch
                  checked={enableRCA}
                  onCheckedChange={setEnableRCA}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Temperature</Label>
                <p className="text-sm text-muted-foreground">
                  Controls randomness in LLM responses (lower = more focused)
                </p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={llmTemperature}
                    onValueChange={setLlmTemperature}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="min-w-16 justify-center">
                    {(llmTemperature[0] / 100).toFixed(2)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum length of generated responses
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-300 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <Shield className="size-5" />
                Security Notice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                  <span>Secrets and sensitive data are never sent to the LLM</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                  <span>Only curated telemetry and sanitized logs are used</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                  <span>LLM is used for analysis only, not execution</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
