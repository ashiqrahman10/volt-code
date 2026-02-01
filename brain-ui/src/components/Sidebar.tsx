import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  Clock,
  Activity,
  Shield,
  Zap,
  Settings as SettingsIcon,
  Server,
  BarChart3,
  Wrench
} from "lucide-react";

type Page = 'dashboard' | 'incidents' | 'approvals' | 'issues' | 'telemetry' | 'audit' | 'system' | 'settings' | 'analytics';

import { useSystemStatus } from "../lib/hooks";

interface SidebarProps {
  pendingApprovals?: number;
  activeIncidents?: number;
}

export function Sidebar({ pendingApprovals = 0, activeIncidents = 0 }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSystemStatus();

  const navItems = [
    {
      id: 'dashboard' as Page,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      path: '/'
    },
    {
      id: 'incidents' as Page,
      label: 'Incidents',
      icon: AlertTriangle,
      badge: activeIncidents > 0 ? activeIncidents : null,
      path: '/incidents'
    },
    {
      id: 'approvals' as Page,
      label: 'Approvals',
      icon: Clock,
      badge: pendingApprovals > 0 ? pendingApprovals : null,
      highlight: pendingApprovals > 0,
      path: '/approvals'
    },
    {
      id: 'issues' as Page,
      label: 'Issues',
      icon: Wrench,
      badge: null,
      path: '/issues'
    },
    {
      id: 'telemetry' as Page,
      label: 'Telemetry',
      icon: Activity,
      badge: null,
      path: '/telemetry'
    },
    {
      id: 'analytics' as Page,
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
      path: '/analytics'
    },
    {
      id: 'audit' as Page,
      label: 'Audit Log',
      icon: Shield,
      badge: null,
      path: '/audit'
    },
    {
      id: 'system' as Page,
      label: 'System Status',
      icon: Server,
      badge: null,
      path: '/system'
    },
    {
      id: 'settings' as Page,
      label: 'Settings',
      icon: SettingsIcon,
      badge: null,
      path: '/settings'
    }
  ];

  return (
    <div className="w-64 border-r bg-muted/30 h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="relative">
            <div className="size-10 rounded-lg bg-white border border-black flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
              <Zap className="size-5 text-black" strokeWidth={2.5} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-500 border-2 border-background" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight">Volt</h1>
            <p className="text-xs text-muted-foreground">Incident Response</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start ${item.highlight && !isActive ? 'border-orange-300 bg-orange-50/50 hover:bg-orange-100/50' : ''
                }`}
              onClick={() => navigate(item.path)}
            >
              <Icon className="size-4 mr-2" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== null && (
                <Badge
                  variant={item.highlight ? "default" : "outline"}
                  className={item.highlight ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  {item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Gateway</span>
          <Badge
            variant="outline"
            className={status?.gateway?.connected
              ? "bg-green-50 text-green-700 border-green-300"
              : "bg-red-50 text-red-700 border-red-300"
            }
          >
            {status?.gateway?.connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Cluster</span>
          <span className="font-mono">{status?.cluster?.name || 'Loading...'}</span>
        </div>
      </div>
    </div>
  );
}