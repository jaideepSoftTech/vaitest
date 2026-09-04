"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/shared/ui/button";
import { useSignup } from "@/features/auth/hooks";
import { signupSchema, type SignupFormData, deriveSlug } from "@/features/auth/schemas";

export default function SignupPage() {
  const signupMutation = useSignup();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      dataRegion: "US",
      orgSlug: "",
    },
  });

  // Auto-derive slug when org name changes
  const handleOrgNameChange = (value: string) => {
    if (value && !watch("orgSlug")) {
      setValue("orgSlug", deriveSlug(value));
    }
  };

  const onSubmit = async (data: SignupFormData) => {
    try {
      await signupMutation.mutateAsync({
        ...data,
        idempotencyKey,
      });
      setShowVerificationPrompt(true);
    } catch {
      // Error is shown in the form feedback
    }
  };

  if (showVerificationPrompt) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We've sent a verification link to your email. Click it to verify your account and get started.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setShowVerificationPrompt(false);
            signupMutation.reset();
          }}
        >
          Back to signup
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started with qa-platform
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Email */}
        <div>
          <label className="text-sm font-medium">Email</label>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <input
                {...field}
                type="email"
                placeholder="you@example.com"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="text-sm font-medium">Password</label>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <input
                {...field}
                type="password"
                placeholder="At least 12 characters"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium">Full name</label>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="John Doe"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Organization Name */}
        <div>
          <label className="text-sm font-medium">Organization name</label>
          <Controller
            control={control}
            name="orgName"
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="Acme Corp"
                onChange={(e) => {
                  field.onChange(e);
                  handleOrgNameChange(e.target.value);
                }}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          />
          {errors.orgName && (
            <p className="mt-1 text-xs text-red-600">{errors.orgName.message}</p>
          )}
        </div>

        {/* Organization Slug */}
        <div>
          <label className="text-sm font-medium">Organization slug (optional)</label>
          <Controller
            control={control}
            name="orgSlug"
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="auto-derived from org name"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          />
          {errors.orgSlug && (
            <p className="mt-1 text-xs text-red-600">{errors.orgSlug.message}</p>
          )}
        </div>

        {/* Data Region */}
        <fieldset>
          <legend className="text-sm font-medium">Data region</legend>
          <div className="mt-2 flex gap-4">
            <Controller
              control={control}
              name="dataRegion"
              render={({ field }) => (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...field}
                      value="US"
                      checked={field.value === "US"}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">US</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...field}
                      value="EU"
                      checked={field.value === "EU"}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">EU</span>
                  </label>
                </>
              )}
            />
          </div>
          <div className="mt-2 rounded border-l-2 border-amber-500 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Note:</strong> Your data region is permanent and cannot be changed after creation.
          </div>
        </fieldset>

        {/* Error message */}
        {signupMutation.isPending === false && signupMutation.isError && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-900">
            {signupMutation.error instanceof Error
              ? signupMutation.error.message
              : "Signup failed. Please try again."}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting || signupMutation.isPending}
          className="w-full"
        >
          {signupMutation.isPending ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </div>
    </div>
  );
}
