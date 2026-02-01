import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { IncidentsList } from "./components/IncidentsList";
import { IncidentDetail } from "./components/IncidentDetail";
import { ApprovalsQueue } from "./components/ApprovalsQueue";
import { IssuesView } from "./components/IssuesView";
import { IssueDetail } from "./components/IssueDetail";
import { TelemetryView } from "./components/TelemetryView";
import { AuditLog } from "./components/AuditLog";
import { SystemStatus } from "./components/SystemStatus";
import { Settings } from "./components/Settings";
import { Analytics } from "./components/Analytics";
import { Toaster } from "./components/ui/sonner";
import { useIncidents } from "./lib/hooks";
import { toast } from "sonner";

// Wrapper for IncidentDetail to use useParams
function IncidentDetailWrapper({ onApprove, onReject }: { onApprove: (id: string) => void, onReject: (id: string) => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <IncidentDetail
      incidentId={id || ''}
      onBack={() => navigate('/incidents')}
      onApprove={onApprove}
      onReject={onReject}
    />
  );
}

// Wrapper for IssueDetail to use useParams
function IssueDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <IssueDetail
      issueId={id || ''}
      onBack={() => navigate('/issues')}
    />
  );
}

function AppContent() {
  const navigate = useNavigate();

  // Get real incident stats from API
  const { incidents } = useIncidents();

  // Calculate stats for sidebar from real data
  const activeIncidents = incidents.filter(
    (i) => ['detected', 'analyzing', 'pending_approval', 'remediating'].includes(i.status)
  ).length;

  const pendingApprovals = incidents.filter(
    (i) => i.status === 'pending_approval'
  ).length;

  const handleApproveRemediation = (incidentId: string) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (incident) {
      toast.success("Remediation Approved", {
        description: `${incident.proposedRemediation?.type} will be executed for ${incident.service}`
      });
    }
  };

  const handleRejectRemediation = (incidentId: string) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (incident) {
      toast.error("Remediation Rejected", {
        description: `Action rejected for ${incident.service}. Incident will be escalated.`
      });
    }
  };

  const handleIncidentClick = (id: string) => {
    navigate(`/incidents/${id}`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        pendingApprovals={pendingApprovals}
        activeIncidents={activeIncidents}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          notifications={pendingApprovals}
        />

        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 max-w-7xl">
            <Routes>
              <Route path="/" element={<Dashboard onIncidentClick={handleIncidentClick} />} />
              <Route path="/incidents" element={<IncidentsList onIncidentClick={handleIncidentClick} />} />
              <Route
                path="/incidents/:id"
                element={
                  <IncidentDetailWrapper
                    onApprove={handleApproveRemediation}
                    onReject={handleRejectRemediation}
                  />
                }
              />
              <Route path="/approvals" element={<ApprovalsQueue onViewIncident={handleIncidentClick} />} />
              <Route path="/issues" element={<IssuesView onViewIssue={(id) => navigate(`/issues/${id}`)} />} />
              <Route path="/issues/:id" element={<IssueDetailWrapper />} />
              <Route path="/telemetry" element={<TelemetryView />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/system" element={<SystemStatus />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}