import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Layout } from "@/components/Layout";
import { DecisionBadge } from "@/components/DecisionBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAlerts } from "@/api/endpoints";
import type { Alert } from "@/types";

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .catch((err) => {
        console.error("Failed to fetch alerts:", err);
        const stored = localStorage.getItem("alerts");
        if (stored) {
          setAlerts(JSON.parse(stored));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Alert History</h1>
          <p className="text-muted-foreground">Past fuel decisions and recommendations</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading alerts...
            </CardContent>
          </Card>
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No alerts yet. Evaluate a decision on the dashboard to see history here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <DecisionBadge decision={alert.decision} />
                    <SeverityBadge severity={alert.severity} />
                    {alert.status === "new" && (
                      <Badge variant="secondary">New</Badge>
                    )}
                    <span className="text-sm text-muted-foreground ml-auto">
                      {format(new Date(alert.date), "PPp")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{alert.explanation}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

