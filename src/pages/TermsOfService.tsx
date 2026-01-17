import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, FileText, CheckCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptTerms } from "@/api/endpoints";
import { clearToken } from "@/api/client";

export function TermsOfService() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            await acceptTerms();
            window.location.href = "/dashboard";
        } catch (error) {
            console.error("Failed to accept terms:", error);
            setIsLoading(false);
        }
    };

    const handleDecline = () => {
        clearToken();
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Terms of Service</CardTitle>
                    <CardDescription>
                        Please read and accept our terms to continue using Should I Fill Up?
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto border-t border-b py-6 my-4">
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <section>
                            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                1. No Data Responsibility
                            </h3>
                            <p>
                                "Should I Fill Up?" (the "Service") is provided "as is" and "as available" without any warranties of any kind, whether express or implied.
                                By using this Service, you acknowledge and agree that the developers, owners, and operators of the Service assume <strong>no responsibility or liability</strong> for any data loss, corruption, or unauthorized access to your data.
                            </p>
                        </section>

                        <section>
                            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                2. Use at Your Own Risk
                            </h3>
                            <p>
                                Any decisions made based on the fuel price predictions, trip suggestions, or other information provided by the Service are your sole responsibility.
                                We do not guarantee the accuracy, completeness, or timeliness of any data or predictions. Financial losses or damages resulting from your reliance on the Service are not our liability.
                            </p>
                        </section>

                        <section>
                            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                3. Service Availability
                            </h3>
                            <p>
                                We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We are not liable for any interruptions or unavailability of the Service.
                            </p>
                        </section>

                        <section>
                            <p className="bg-muted p-4 rounded-md font-medium text-foreground">
                                By clicking "I Agree" below, you explicitly acknowledge that you have read, understood, and agree to be bound by these Terms of Service, specifically the clauses releasing us from data responsibility and liability.
                            </p>
                        </section>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                    <Button variant="outline" onClick={handleDecline} className="w-full sm:w-auto">
                        <LogOut className="h-4 w-4 mr-2" />
                        Decline & Logout
                    </Button>
                    <Button onClick={handleAccept} disabled={isLoading} className="w-full sm:w-auto">
                        {isLoading ? "Accepting..." : (
                            <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                I Agree
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
