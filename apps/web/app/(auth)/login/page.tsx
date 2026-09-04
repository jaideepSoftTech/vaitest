"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/shared/ui/button";
import { useLogin } from "@/features/auth/hooks";
import { ApiError } from "@/shared/api/client";

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type EmailFormData = z.infer<typeof emailSchema>;
type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password" | "sso">("email");
  const [discoveryMode, setDiscoveryMode] = useState<"PASSWORD" | "SSO_REQUIRED" | "SSO_OPTIONAL" | null>(null);
  const [ssoInfo, setSsoInfo] = useState<{ orgName?: string; mode: string } | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const {
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
    watch: emailWatch,
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const {
    control: loginControl,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
    reset: resetLoginForm,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const watchedEmail = emailWatch("email");

  const onEmailBlur = async () => {
    if (!watchedEmail) return;

    setIsDiscovering(true);
    setDiscoverError(null);

    try {
      const { apiClient } = await import("@/shared/api/client");
      const data = await apiClient.discover(watchedEmail);

      if (data.mode === "PASSWORD") {
        setEmail(watchedEmail);
        setDiscoveryMode("PASSWORD");
        setStep("password");
        resetLoginForm({ email: watchedEmail });
      } else if (data.mode === "SSO_REQUIRED" || data.mode === "SSO_OPTIONAL") {
        setEmail(watchedEmail);
        setSsoInfo({
          orgName: data.orgName,
          mode: data.mode,
        });
        setDiscoveryMode(data.mode);
        setStep("sso");
      }
    } catch {
      setDiscoverError("Could not discover organization. Please try again.");
    } finally {
      setIsDiscovering(false);
    }
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    try {
      await loginMutation.mutateAsync(data);
      router.push("/");
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        // Rate limited
      }
    }
  };

  const onBackClick = () => {
    setStep("email");
    setDiscoveryMode(null);
    setSsoInfo(null);
    setDiscoverError(null);
    resetLoginForm();
  };

  // Email step
  if (step === "email") {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Log in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email to get started
          </p>
        </div>

        <form onSubmit={handleEmailSubmit(() => {})} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <Controller
              control={emailControl}
              name="email"
              render={({ field }) => (
                <input
                  {...field}
                  type="email"
                  placeholder="you@example.com"
                  onBlur={() => {
                    field.onBlur();
                    onEmailBlur();
                  }}
                  disabled={isDiscovering}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              )}
            />
            {emailErrors.email && (
              <p className="mt-1 text-xs text-red-600">{emailErrors.email.message}</p>
            )}
            {discoverError && (
              <p className="mt-1 text-xs text-red-600">{discoverError}</p>
            )}
          </div>

          {isDiscovering && (
            <p className="text-xs text-muted-foreground">Checking organization...</p>
          )}
        </form>

        <div className="text-center text-sm">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  // Password login step
  if (step === "password" && discoveryMode === "PASSWORD") {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Log in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your password
          </p>
        </div>

        <form onSubmit={handleLoginSubmit(onLoginSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <Controller
              control={loginControl}
              name="password"
              render={({ field }) => (
                <input
                  {...field}
                  type="password"
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            />
            {loginErrors.password && (
              <p className="mt-1 text-xs text-red-600">{loginErrors.password.message}</p>
            )}
          </div>

          {loginMutation.isError && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-900">
              {loginMutation.error instanceof ApiError && loginMutation.error.status === 429
                ? "Too many login attempts. Please try again later."
                : loginMutation.error instanceof Error
                  ? loginMutation.error.message
                  : "Login failed. Please check your credentials and try again."}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoginSubmitting || loginMutation.isPending}
            className="w-full"
          >
            {loginMutation.isPending ? "Logging in..." : "Log in"}
          </Button>
        </form>

        <Button variant="ghost" onClick={onBackClick} className="w-full">
          Back
        </Button>

        <div className="text-center text-sm">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  // SSO step
  if (step === "sso" && ssoInfo) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Single Sign-On</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your organization uses single sign-on
          </p>
        </div>

        <div className="rounded bg-muted p-4">
          <p className="text-sm">
            <strong>{ssoInfo.orgName ?? "Your organization"}</strong> requires single sign-on to log in.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            SSO login will be available soon.
          </p>
        </div>

        <Button variant="ghost" onClick={onBackClick} className="w-full">
          Back
        </Button>
      </div>
    );
  }

  return null;
}
