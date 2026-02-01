import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
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
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    AlertCircle,
    AlertTriangle,
    Loader2,
    Zap,
    Play,
    RotateCcw,
    Shield,
    Target,
    History
} from "lucide-react";
import { useIssue, useExecuteRemediation, useRetryRemediation } from "../lib/hooks";
import { Issue, IssueStatus, RemediationAttempt } from "../types";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface IssueDetailProps {
    issueId: string;
    onBack: () => void;
}

export function IssueDetail({ issueId, onBack }: IssueDetailProps) {
    const { issue, loading, error, refetch } = useIssue(issueId);
    const { execute, loading: executing } = useExecuteRemediation();
    const { retry, loading: retrying } = useRetryRemediation();
    const [showConfirm, setShowConfirm] = useState(false);

    // Auto-refresh while fixing
    useEffect(() => {
        if (issue?.status === 'fixing') {
            const interval = setInterval(refetch, 3000);
            return () => clearInterval(interval);
        }
    }, [issue?.status, refetch]);

    const handleExecute = async () => {
        setShowConfirm(false);
        try {
            const result = await execute(issueId);
            if (result.success) {
                toast.success("Remediation started", {
                    description: result.message
                });
            } else {
                toast.error("Execution failed", {
                    description: result.message
                });
            }
            refetch();
        } catch (e) {
            toast.error("Failed to execute remediation");
        }
    };

    const handleRetry = async () => {
        try {
            const result = await retry(issueId);
            if (result.success) {
                toast.success("Retry started", {
                    description: result.message
                });
            } else {
                toast.error("Retry failed", {
                    description: result.message
                });
            }
            refetch();
        } catch (e) {
            toast.error("Failed to retry remediation");
        }
    };

    const getStatusIcon = (status: IssueStatus) => {
        switch (status) {
            case 'open':
                return <Clock className="size-5 text-orange-500" />;
            case 'fixing':
                return <Loader2 className="size-5 text-blue-500 animate-spin" />;
            case 'resolved':
                return <CheckCircle2 className="size-5 text-green-500" />;
            case 'needs_attention':
                return <AlertCircle className="size-5 text-red-500" />;
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
        return d.toLocaleString();
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="size-4 mr-2" />
                    Back to Issues
                </Button>
                <Card>
                    <CardContent className="py-12 text-center">
                        <Loader2 className="size-12 mx-auto mb-4 text-muted-foreground animate-spin" />
                        <p className="text-muted-foreground">Loading issue details...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!issue) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="size-4 mr-2" />
                    Back to Issues
                </Button>
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">{error || "Issue not found"}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const incident = issue.incident;
    const remediation = incident?.proposedRemediation;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="size-4 mr-2" />
                    Back to Issues
                </Button>
                <div className="flex items-center gap-2">
                    {getStatusBadge(issue.status)}
                </div>
            </div>

            {/* Main Info */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <span className="font-mono">{issue.id}</span>
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Created {formatTimestamp(issue.createdAt)}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {incident && (
                        <>
                            <div>
                                <h3 className="font-semibold text-lg">{incident.title}</h3>
                                <p className="text-muted-foreground">{incident.description}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge variant="destructive">{incident.severity}</Badge>
                                <Badge variant="outline">{Math.round(incident.confidence * 100)}% confidence</Badge>
                                <span className="text-sm text-muted-foreground">
                                    {incident.namespace}/{incident.service}
                                </span>
                            </div>

                            {incident.affectedPods?.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium mb-2">Affected Pods</p>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.affectedPods.map((pod: string) => (
                                            <Badge key={pod} variant="outline" className="font-mono text-xs">
                                                {pod}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {issue.verificationMessage && (
                        <div className={`p-3 rounded-lg ${issue.status === 'resolved' ? 'bg-green-50 border border-green-200' :
                                'bg-red-50 border border-red-200'
                            }`}>
                            <p className={`text-sm ${issue.status === 'resolved' ? 'text-green-700' : 'text-red-700'
                                }`}>
                                {issue.verificationMessage}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recommended Action */}
            {remediation && (
                <Card className="border-2 border-blue-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="size-5 text-blue-600" />
                            Recommended Action
                        </CardTitle>
                        <CardDescription>
                            The system recommends the following remediation
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Action Type</p>
                                <Badge variant="outline" className="text-base py-1 px-3">
                                    {remediation.type}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Risk Level</p>
                                <Badge
                                    variant={remediation.riskLevel === 'high' ? 'destructive' :
                                        remediation.riskLevel === 'medium' ? 'default' : 'outline'}
                                >
                                    {remediation.riskLevel} risk
                                </Badge>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Target</p>
                            <p className="font-mono text-sm bg-muted p-2 rounded">{remediation.target}</p>
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground mb-1">What will happen</p>
                            <p className="text-sm">{remediation.description}</p>
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Blast Radius</p>
                            <p className="text-sm">{remediation.blastRadius}</p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <Shield className="size-4 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-blue-900 mb-1">Rollback Plan</p>
                                    <p className="text-sm text-blue-700">{remediation.rollbackPlan}</p>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {issue.status === 'open' && (
                                <Button
                                    className="flex-1"
                                    size="lg"
                                    onClick={() => setShowConfirm(true)}
                                    disabled={executing}
                                >
                                    {executing ? (
                                        <Loader2 className="size-4 mr-2 animate-spin" />
                                    ) : (
                                        <Play className="size-4 mr-2" />
                                    )}
                                    Execute Remediation
                                </Button>
                            )}

                            {issue.status === 'needs_attention' && (
                                <Button
                                    className="flex-1"
                                    size="lg"
                                    variant="outline"
                                    onClick={handleRetry}
                                    disabled={retrying}
                                >
                                    {retrying ? (
                                        <Loader2 className="size-4 mr-2 animate-spin" />
                                    ) : (
                                        <RotateCcw className="size-4 mr-2" />
                                    )}
                                    Retry Remediation
                                </Button>
                            )}

                            {issue.status === 'fixing' && (
                                <div className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 rounded-lg">
                                    <Loader2 className="size-5 text-blue-600 animate-spin" />
                                    <span className="text-blue-700 font-medium">
                                        Remediation in progress... Verifying results...
                                    </span>
                                </div>
                            )}

                            {issue.status === 'resolved' && (
                                <div className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-50 rounded-lg">
                                    <CheckCircle2 className="size-5 text-green-600" />
                                    <span className="text-green-700 font-medium">
                                        Issue resolved successfully
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Remediation History */}
            {issue.remediationAttempts?.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="size-5" />
                            Remediation History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {issue.remediationAttempts.map((attempt: RemediationAttempt, idx: number) => (
                                <div
                                    key={attempt.id}
                                    className={`p-3 rounded-lg border ${attempt.status === 'success' ? 'bg-green-50 border-green-200' :
                                            attempt.status === 'failed' ? 'bg-red-50 border-red-200' :
                                                attempt.status === 'executing' ? 'bg-blue-50 border-blue-200' :
                                                    'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {attempt.status === 'success' && <CheckCircle2 className="size-4 text-green-600" />}
                                            {attempt.status === 'failed' && <AlertCircle className="size-4 text-red-600" />}
                                            {attempt.status === 'executing' && <Loader2 className="size-4 text-blue-600 animate-spin" />}
                                            {attempt.status === 'pending' && <Clock className="size-4 text-gray-600" />}
                                            <span className="font-medium capitalize">{attempt.status}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {formatTimestamp(attempt.executedAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm">
                                        <span className="font-medium">Action:</span> {attempt.action}
                                    </p>
                                    <p className="text-sm">
                                        <span className="font-medium">Target:</span> {attempt.target}
                                    </p>
                                    {attempt.result && (
                                        <p className="text-sm text-green-700 mt-1">{attempt.result}</p>
                                    )}
                                    {attempt.error && (
                                        <p className="text-sm text-red-700 mt-1">{attempt.error}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="size-5 text-orange-500" />
                            Confirm Remediation Execution
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to execute a remediation action on your Kubernetes cluster.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {remediation && (
                        <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                            <div>
                                <span className="font-semibold">Action:</span> {remediation.type}
                            </div>
                            <div>
                                <span className="font-semibold">Target:</span> {remediation.target}
                            </div>
                            <div>
                                <span className="font-semibold">Risk:</span> {remediation.riskLevel}
                            </div>
                        </div>
                    )}

                    <div className="text-orange-600 font-medium text-sm">
                        This action will be executed immediately on your Kubernetes cluster.
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleExecute} disabled={executing}>
                            {executing && <Loader2 className="size-4 mr-2 animate-spin" />}
                            Execute Now
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
