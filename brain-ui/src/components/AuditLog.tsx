import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  Shield,
  User,
  Bot,
  Server,
  Search,
  Download,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useAuditLog } from "../lib/hooks";
import { AuditLogEntry } from "../types";

export function AuditLog() {
  const { entries, total, loading, error, refetch } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<'all' | 'system' | 'human' | 'gateway'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'failure'>('all');

  // Convert to AuditLogEntry format and filter
  const filteredLog = entries.filter((entry: any) => {
    const matchesSearch =
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.details || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesActor = actorFilter === 'all' || entry.actor === actorFilter;
    const matchesResult = resultFilter === 'all' || entry.result === resultFilter;

    return matchesSearch && matchesActor && matchesResult;
  });

  const getActorIcon = (actor: AuditLogEntry['actor']) => {
    switch (actor) {
      case 'system':
        return <Bot className="size-4" />;
      case 'human':
        return <User className="size-4" />;
      case 'gateway':
        return <Server className="size-4" />;
    }
  };

  const getActorColor = (actor: AuditLogEntry['actor']) => {
    switch (actor) {
      case 'system':
        return 'bg-blue-500';
      case 'human':
        return 'bg-green-500';
      case 'gateway':
        return 'bg-purple-500';
    }
  };

  const formatTimestamp = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatRelativeTime = (date: Date | string) => {
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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="size-8" />
          Audit Log
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete audit trail of all system actions
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
            <p className="text-xs text-muted-foreground">Logged actions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Actions</CardTitle>
            <Bot className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.filter((e: any) => e.actor === 'system').length}
            </div>
            <p className="text-xs text-muted-foreground">Auto-executed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Human Actions</CardTitle>
            <User className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.filter((e: any) => e.actor === 'human').length}
            </div>
            <p className="text-xs text-muted-foreground">Manual approvals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.length > 0 ? Math.round((entries.filter((e: any) => e.result === 'success').length / entries.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Successful actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              placeholder="Search actions, targets, details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:col-span-1"
            />

            <Select value={actorFilter} onValueChange={(v) => setActorFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actors</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="human">Human</SelectItem>
                <SelectItem value="gateway">Gateway</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Showing {filteredLog.length} of {entries.length} entries
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLog.length === 0 ? (
            <div className="text-center py-12">
              <Search className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No entries match your filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Actor Icon */}
                      <div className={`p-2 rounded-lg ${getActorColor(entry.actor)}/10`}>
                        <div className={`${getActorColor(entry.actor).replace('bg-', 'text-')}`}>
                          {getActorIcon(entry.actor)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{entry.action}</h4>
                            <Badge variant="outline" className="capitalize">
                              {entry.actor}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.result === 'success' ? (
                              <CheckCircle2 className="size-4 text-green-500" />
                            ) : (
                              <XCircle className="size-4 text-red-500" />
                            )}
                            <Badge variant={entry.result === 'success' ? 'outline' : 'destructive'}>
                              {entry.result}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm mb-2">{entry.details}</p>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-mono">{entry.target}</span>
                          <span>•</span>
                          <span>{formatTimestamp(entry.timestamp)}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(entry.timestamp)}</span>
                        </div>

                        {/* Metadata */}
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <div className="mt-3 p-2 bg-muted rounded text-xs font-mono">
                            <details>
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View metadata
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap">
                                {JSON.stringify(entry.metadata, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
