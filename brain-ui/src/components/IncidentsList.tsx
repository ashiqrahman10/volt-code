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
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  XCircle,
  Zap,
  TrendingUp,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useIncidents } from "../lib/hooks";
import { Incident, IncidentStatus, IncidentSeverity } from "../types";

interface IncidentsListProps {
  onIncidentClick: (id: string) => void;
}

export function IncidentsList({ onIncidentClick }: IncidentsListProps) {
  const { incidents, total, loading, refetch } = useIncidents();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "all">("all");
  const [sortBy, setSortBy] = useState<"time" | "severity" | "confidence">("time");

  // Filter incidents
  let filteredIncidents = incidents.filter((incident: Incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.namespace.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Sort incidents
  filteredIncidents = [...filteredIncidents].sort((a: Incident, b: Incident) => {
    if (sortBy === "time") {
      const aTime = typeof a.detectedAt === 'string' ? new Date(a.detectedAt).getTime() : a.detectedAt.getTime();
      const bTime = typeof b.detectedAt === 'string' ? new Date(b.detectedAt).getTime() : b.detectedAt.getTime();
      return bTime - aTime;
    } else if (sortBy === "severity") {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    } else {
      return b.confidence - a.confidence;
    }
  });

  const getStatusIcon = (status: IncidentStatus) => {
    switch (status) {
      case 'detected':
        return <AlertCircle className="size-4" />;
      case 'analyzing':
        return <Search className="size-4" />;
      case 'pending_approval':
        return <Clock className="size-4" />;
      case 'remediating':
        return <Zap className="size-4" />;
      case 'resolved':
        return <CheckCircle2 className="size-4" />;
      case 'escalated':
        return <AlertTriangle className="size-4" />;
      case 'rejected':
        return <XCircle className="size-4" />;
    }
  };

  const getStatusBadgeVariant = (status: IncidentStatus) => {
    switch (status) {
      case 'detected':
      case 'analyzing':
        return 'secondary';
      case 'pending_approval':
        return 'default';
      case 'remediating':
        return 'default';
      case 'resolved':
        return 'outline';
      case 'escalated':
        return 'destructive';
      case 'rejected':
        return 'outline';
    }
  };

  const getSeverityBadgeVariant = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
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
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incidents</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all detected incidents
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search incidents, services, namespaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="detected">Detected</SelectItem>
                <SelectItem value="analyzing">Analyzing</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="remediating">Remediating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <div className="flex gap-2">
              <Button
                variant={sortBy === "time" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("time")}
              >
                Time
              </Button>
              <Button
                variant={sortBy === "severity" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("severity")}
              >
                Severity
              </Button>
              <Button
                variant={sortBy === "confidence" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("confidence")}
              >
                Confidence
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredIncidents.length} of {total} incidents
        </p>
        {(searchQuery || statusFilter !== "all" || severityFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setSeverityFilter("all");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="size-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading incidents...</p>
            </CardContent>
          </Card>
        ) : filteredIncidents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No incidents match your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredIncidents.map((incident: Incident) => (
            <Card
              key={incident.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onIncidentClick(incident.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="mt-1">
                    {getStatusIcon(incident.status)}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title and Badges */}
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="font-semibold text-lg flex-1">{incident.title}</h3>
                      <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                        {incident.severity}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(incident.status)}>
                        {incident.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-3">
                      {incident.description}
                    </p>

                    {/* Meta Information */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="size-4" />
                        {Math.round(incident.confidence * 100)}% confidence
                      </span>
                      <span>•</span>
                      <span>{incident.namespace}/{incident.service}</span>
                      <span>•</span>
                      <span>{incident.affectedPods?.length || 1} pods affected</span>
                      <span>•</span>
                      <span>{formatTimestamp(incident.detectedAt)}</span>
                      {incident.resolvedAt && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">
                            Resolved {formatTimestamp(incident.resolvedAt)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Tags */}
                    {incident.tags && incident.tags.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {incident.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
