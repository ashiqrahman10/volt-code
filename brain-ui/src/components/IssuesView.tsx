import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    AlertCircle,
    Loader2,
    RefreshCw,
    Wrench,
    ExternalLink
} from "lucide-react";
import { useIssues } from "../lib/hooks";
import { Issue, IssueStatus } from "../types";

interface IssuesViewProps {
    onViewIssue: (id: string) => void;
}

export function IssuesView({ onViewIssue }: IssuesViewProps) {
    const { issues, counts, loading, refetch } = useIssues();
    const [filter, setFilter] = useState<IssueStatus | 'all'>('all');

    const filteredIssues = filter === 'all'
        ? issues
        : issues.filter((i: Issue) => i.status === filter);

    const getStatusIcon = (status: IssueStatus) => {
        switch (status) {
            case 'open':
                return <Clock className="size-4 text-orange-500" />;
            case 'fixing':
                return <Loader2 className="size-4 text-blue-500 animate-spin" />;
            case 'resolved':
                return <CheckCircle2 className="size-4 text-green-500" />;
            case 'needs_attention':
                return <AlertCircle className="size-4 text-red-500" />;
        }
    };

    const getStatusBadge = (status: IssueStatus) => {
        const variants: Record<IssueStatus, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
            open: { variant: "outline", className: "bg-orange-50 text-orange-700 border-orange-300" },
            fixing: { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-300" },
            resolved: { variant: "outline", className: "bg-green-50 text-green-700 border-green-300" },
            needs_attention: { variant: "destructive", className: "" }
        };

        const config = variants[status];
        return (
            <Badge variant={config.variant} className={config.className}>
                {getStatusIcon(status)}
                <span className="ml-1 capitalize">{status.replace('_', ' ')}</span>
            </Badge>
        );
    };

    const formatTimestamp = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        const minutes = Math.floor((Date.now() - d?.getTime()) / 60000);
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
                        <Wrench className="size-8" />
                        Issues
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track and remediate detected issues
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()} disabled={loading}>
                    <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card
                    className={`cursor-pointer transition-colors ${filter === 'open' ? 'ring-2 ring-orange-500' : ''}`}
                    onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open</CardTitle>
                        <Clock className="size-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.open}</div>
                        <p className="text-xs text-muted-foreground">Pending action</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${filter === 'fixing' ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setFilter(filter === 'fixing' ? 'all' : 'fixing')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fixing</CardTitle>
                        <Loader2 className="size-4 text-blue-500 animate-spin" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.fixing}</div>
                        <p className="text-xs text-muted-foreground">In progress</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${filter === 'resolved' ? 'ring-2 ring-green-500' : ''}`}
                    onClick={() => setFilter(filter === 'resolved' ? 'all' : 'resolved')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                        <CheckCircle2 className="size-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.resolved}</div>
                        <p className="text-xs text-muted-foreground">Fixed</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${filter === 'needs_attention' ? 'ring-2 ring-red-500' : ''}`}
                    onClick={() => setFilter(filter === 'needs_attention' ? 'all' : 'needs_attention')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                        <AlertCircle className="size-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{counts.needs_attention}</div>
                        <p className="text-xs text-muted-foreground">Requires review</p>
                    </CardContent>
                </Card>
            </div>

            {/* Issues List */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {filter === 'all' ? 'All Issues' : `${filter.replace('_', ' ')} Issues`.replace(/\b\w/g, l => l.toUpperCase())}
                    </CardTitle>
                    <CardDescription>
                        {filter === 'all'
                            ? 'All tracked issues from detected incidents'
                            : `Showing ${filteredIssues.length} issue(s)`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="size-12 mx-auto mb-4 text-muted-foreground animate-spin" />
                            <p className="text-muted-foreground">Loading issues...</p>
                        </div>
                    ) : filteredIssues.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle2 className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No issues found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {filter === 'all'
                                    ? 'Raise issues from detected incidents to track them here'
                                    : 'No issues match this filter'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredIssues.map((issue: any) => (
                                <Card
                                    key={issue.id}
                                    className={`cursor-pointer hover:shadow-md transition-shadow ${issue.status === 'needs_attention' ? 'border-red-200 bg-red-50/30' :
                                            issue.status === 'fixing' ? 'border-blue-200 bg-blue-50/30' :
                                                issue.status === 'open' ? 'border-orange-200 bg-orange-50/30' :
                                                    'border-green-200 bg-green-50/30'
                                        }`}
                                    onClick={() => onViewIssue(issue.id)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-mono text-sm font-medium">{issue.id}</span>
                                                    {getStatusBadge(issue.status)}
                                                </div>

                                                {issue.incident && (
                                                    <>
                                                        <h3 className="font-semibold mb-1">{issue.incident.title}</h3>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Badge variant="outline">{issue.incident.severity}</Badge>
                                                            <span>{issue.incident.namespace}/{issue.incident.service}</span>
                                                        </div>
                                                    </>
                                                )}

                                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                                    <span>Created {formatTimestamp(issue.createdAt)}</span>
                                                    {issue.remediationAttempts?.length > 0 && (
                                                        <span>{issue.remediationAttempts.length} attempt(s)</span>
                                                    )}
                                                    {issue.verificationMessage && (
                                                        <span className="italic">{issue.verificationMessage}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <Button variant="ghost" size="sm">
                                                <ExternalLink className="size-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
