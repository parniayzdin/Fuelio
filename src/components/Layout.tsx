import { NavLink, useNavigate } from "react-router-dom";
import { Fuel, LayoutDashboard, MapPin, Map, Bell, Settings, LogOut, TrendingUp, Moon, Sun, User as UserIcon } from "lucide-react";
import { clearToken } from "@/api/client";
import { cn } from "@/lib/utils";
import { AdBanner } from "@/components/promotions";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { getMe } from "@/api/endpoints";
import { useState, useEffect } from "react";
import type { User } from "@/types";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Gas Map", icon: Map },
  { to: "/prices", label: "Price Forecast", icon: TrendingUp },
  { to: "/trips", label: "Trips", icon: MapPin },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(console.error);
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-transparent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Should I Fill Up?</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}

            {/* User Email Display */}
            {user && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                <span className="hidden lg:inline">{user.email}</span>
              </div>
            )}

            {/* Theme Toggle */}


            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label.split(" ")[0]}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main content with sidebar ads */}
      <div className="container py-6 pb-20 md:pb-6">
        <div className="flex gap-6">
          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>

          {/* Right sidebar with vertical ads - hidden on mobile */}
          <aside className="hidden xl:flex flex-col gap-4 w-[160px] flex-shrink-0">
            <AdBanner slot="sidebar-skyscraper-1" format="skyscraper" />
            <AdBanner slot="sidebar-vertical" format="vertical" />
          </aside>
        </div>
      </div>
    </div>
  );
}
