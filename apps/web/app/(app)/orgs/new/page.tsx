"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/shared/ui/button";
import { useCreateOrg } from "@/features/auth/hooks";
import { createOrgSchema, type CreateOrgFormData, deriveSlug } from "@/features/auth/schemas";
import { useSessionStore } from "@/features/auth/session-store";

export default function CreateOrgPage() {
  const router = useRouter();
  const createOrgMutation = useCreateOrg();
  const accessToken = useSessionStore((s) => s.accessToken);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!accessToken) {
      router.push("/login");
    }
  }, [accessToken, router]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
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

  const onSubmit = async (data: CreateOrgFormData) => {
    try {
      await createOrgMutation.mutateAsync(data);
      // Redirect to home or org dashboard
      router.push("/");
    } catch {
      // Error is shown in the form feedback
    }
  };

  if (!accessToken) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Create organization</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Set up a new organization
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            {createOrgMutation.isError && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-900">
                {createOrgMutation.error instanceof Error
                  ? createOrgMutation.error.message
                  : "Failed to create organization. Please try again."}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting || createOrgMutation.isPending}
              className="w-full"
            >
              {createOrgMutation.isPending
                ? "Creating organization..."
                : "Create organization"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
