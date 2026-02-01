import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Keyboard
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  notifications?: number;
}

export function Header({ notifications = 0 }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Command palette shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const quickActions = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      path: '/'
    },
    {
      id: 'incidents',
      label: 'View Incidents',
      path: '/incidents'
    },
    {
      id: 'approvals',
      label: 'Approval Queue',
      path: '/approvals'
    },
    {
      id: 'telemetry',
      label: 'View Telemetry',
      path: '/telemetry'
    },
    {
      id: 'analytics',
      label: 'Analytics & Reports',
      path: '/analytics'
    },
    {
      id: 'audit',
      label: 'Audit Log',
      path: '/audit'
    },
    {
      id: 'system',
      label: 'System Status',
      path: '/system'
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/settings'
    },
  ];

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-6 max-w-7xl">
          {/* Search */}
          <Button
            variant="outline"
            className="relative w-64 justify-start text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            <Search className="size-4 mr-2" />
            <span>Search...</span>
            <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="size-5" />
                  {notifications > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-xs"
                    >
                      {notifications}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications > 0 ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/approvals')}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="size-2 p-0 rounded-full" />
                          <span className="font-medium">Approval Required</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {notifications} {notifications === 1 ? 'action' : 'actions'} pending your review
                        </p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/approvals')} className="text-center justify-center">
                      View All Approvals
                    </DropdownMenuItem>
                  </>
                ) : (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No new notifications
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Help */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Help & Resources</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <HelpCircle className="size-4 mr-2" />
                  Documentation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOpen(true)}>
                  <Keyboard className="size-4 mr-2" />
                  Keyboard Shortcuts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Report an Issue
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/placeholder-avatar.png" alt="User" />
                    <AvatarFallback className="bg-white border border-black text-black">
                      OE
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Ops Engineer</p>
                    <p className="text-xs text-muted-foreground">ops@company.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="size-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="size-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="size-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => (
              <CommandItem
                key={action.id}
                onSelect={() => handleNavigate(action.path)}
              >
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Recent Incidents">
            <CommandItem
              onSelect={() => handleNavigate('/incidents/inc-001')}
            >
              Memory Leak in payment-service
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate('/incidents/inc-002')}
            >
              High API Latency in user-service
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate('/incidents/inc-003')}
            >
              Disk Pressure on logging-collector
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Keyboard Shortcuts">
            <CommandItem disabled>
              <kbd className="mr-2 px-2 py-1 text-xs border rounded">⌘K</kbd>
              Open command palette
            </CommandItem>
            <CommandItem disabled>
              <kbd className="mr-2 px-2 py-1 text-xs border rounded">⌘/</kbd>
              Search incidents
            </CommandItem>
            <CommandItem disabled>
              <kbd className="mr-2 px-2 py-1 text-xs border rounded">G D</kbd>
              Go to dashboard
            </CommandItem>
            <CommandItem disabled>
              <kbd className="mr-2 px-2 py-1 text-xs border rounded">G I</kbd>
              Go to incidents
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}