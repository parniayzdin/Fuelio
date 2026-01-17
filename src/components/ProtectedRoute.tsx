import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAuthenticated } from "@/api/client";
import { getMe } from "@/api/endpoints";
import { RefreshCw } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const isAuth = isAuthenticated();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: isAuth,
    retry: 1,
  });

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user hasn't accepted ToS and is not already on /terms page, redirect there
  if (user && !user.tos_accepted_at && location.pathname !== "/terms") {
    return <Navigate to="/terms" replace />;
  }

  return <>{children}</>;
}
