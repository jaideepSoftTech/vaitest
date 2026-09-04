"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/shared/ui/button";
import { useAcceptInvite } from "@/features/auth/hooks";
import { acceptInviteSchema, type AcceptInviteFormData } from "@/features/auth/schemas";

// Next.js 15: route params are delivered as a Promise, even to Client
// Component pages — unwrap with React's `use()` rather than accessing
// `params.token` synchronously.
export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const acceptInviteMutation = useAcceptInvite();
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      token,
      password: "",
      name: "",
    },
  });

  const onSubmit = async (data: AcceptInviteFormData) => {
    try {
      await acceptInviteMutation.mutateAsync(data);
      router.push("/");
    } catch {
      // Error is shown in the form feedback
    }
  };

  if (acceptInviteMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Welcome!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your invitation has been accepted. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">You've been invited</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accept the invitation to join the organization
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Optional: Name field (if user doesn't exist yet) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={showOptionalFields}
              onChange={(e) => setShowOptionalFields(e.target.checked)}
              className="h-4 w-4"
            />
            Create new account with this invitation
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Check this if you don't already have an account
          </p>
        </div>

        {showOptionalFields && (
          <>
            {/* Name */}
            <div>
              <label className="text-sm font-medium">Full name (optional)</label>
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

            {/* Password */}
            <div>
              <label className="text-sm font-medium">Password (optional)</label>
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
          </>
        )}

        {/* Error message */}
        {acceptInviteMutation.isError && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-900">
            {acceptInviteMutation.error instanceof Error
              ? acceptInviteMutation.error.message
              : "Failed to accept invitation. Please try again."}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting || acceptInviteMutation.isPending}
          className="w-full"
        >
          {acceptInviteMutation.isPending ? "Accepting..." : "Accept invitation"}
        </Button>
      </form>

      <Link href="/login" className="text-center text-sm text-primary hover:underline">
        Already have an account? Log in
      </Link>
    </div>
  );
}
