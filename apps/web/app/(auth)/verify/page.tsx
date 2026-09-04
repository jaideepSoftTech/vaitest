"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useVerifyEmail, useResendVerification } from "@/features/auth/hooks";
import { useSessionStore } from "@/features/auth/session-store";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();
  const [email, setEmail] = useState("");

  const sessionToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    // If already logged in, redirect to home
    if (sessionToken) {
      router.push("/");
      return;
    }

    // Auto-verify on mount if token is present
    if (token) {
      verifyMutation.mutate({ token });
    }
  }, [token, sessionToken, router, verifyMutation]);

  // Success state
  if (verifyMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Email verified!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is ready to go. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  // Error state with resend (also shown when no token is present in the URL)
  if (verifyMutation.isError || !token) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">
            {token ? "Verification failed" : "Verify your email"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {token
              ? "Your verification link may have expired"
              : "Enter your email to resend the verification link"}
          </p>
        </div>

        {verifyMutation.isError && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-900">
            {verifyMutation.error instanceof Error
              ? verifyMutation.error.message
              : "Verification failed. Please try again."}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <Button
            onClick={() => {
              if (email) {
                resendMutation.mutate({ email });
              }
            }}
            disabled={!email || resendMutation.isPending}
            className="w-full"
          >
            {resendMutation.isPending
              ? "Sending..."
              : "Resend verification email"}
          </Button>
        </div>

        {resendMutation.isSuccess && (
          <div className="rounded bg-green-50 p-3 text-sm text-green-900">
            If that email exists, we've sent a verification link.
          </div>
        )}

        <Link href="/login" className="text-center text-sm text-primary hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex flex-col gap-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Verifying email...</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we verify your email address.
        </p>
      </div>
    </div>
  );
}
