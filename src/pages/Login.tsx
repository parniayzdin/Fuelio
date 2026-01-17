import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login, signup, loginWithGoogle, getMe } from "@/api/endpoints";
import { ApiError } from "@/api/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: { theme: string; size: string; width: number }
          ) => void;
        };
      };
    };
  }
}

interface LoginForm {
  email: string;
  password: string;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const handleGoogleCallback = useCallback(async (response: { credential: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle(response.credential);
      navigate("/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        setError("Failed to sign in with Google");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // Initialize Google Sign-In when the library loads
    const initGoogleSignIn = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });

        const googleButtonDiv = document.getElementById("google-signin-button");
        if (googleButtonDiv) {
          window.google.accounts.id.renderButton(googleButtonDiv, {
            theme: "outline",
            size: "large",
            width: 300,
          });
        }
      }
    };

    // Check if script is already loaded
    if (window.google) {
      initGoogleSignIn();
    } else {
      // Wait for script to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogleLoaded);
          initGoogleSignIn();
        }
      }, 100);

      // Clean up after 5 seconds
      setTimeout(() => clearInterval(checkGoogleLoaded), 5000);
    }
  }, [handleGoogleCallback]);

  const getUserLocation = (): Promise<{ lat: number, lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log('Geolocation not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error.message);
          resolve(null); // Don't block login if location fails
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  };

  const onLogin = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      // Get user location
      const location = await getUserLocation();

      await login(data.email, data.password, location?.lat, location?.lng);
      navigate("/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        setError("Invalid email or password");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSignup = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      // Get user location
      const location = await getUserLocation();

      await signup(data.email, data.password, location?.lat, location?.lng);

      // Verify the account is ready by fetching user data
      await getMe();

      navigate("/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        setError("Could not create account. Email may already be in use.");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary">
              <Fuel className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Should I Fill Up?</CardTitle>
          <CardDescription>
            Smart fuel decisions based on price trends and your driving patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Sign-In Button */}
          {GOOGLE_CLIENT_ID && (
            <div className="flex flex-col items-center gap-4">
              <div id="google-signin-button" className="flex justify-center"></div>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password", { required: "Password is required", minLength: 6 })}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSubmit(onSignup)}
                disabled={isLoading}
              >
                Sign Up
              </Button>
              <Button
                type="submit"
                className="flex-1"
                onClick={handleSubmit(onLogin)}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Log In"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

