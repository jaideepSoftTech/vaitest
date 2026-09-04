// packages/shared/src/storage/index.ts
//
// CRITICAL: This is the ONLY place object keys for S3/MinIO are constructed
// in the entire monorepo. Every storage operation must use one of the key
// builder functions below. Any new code constructing a key outside this file
// (e.g., interpolating literal "org/" paths) violates the tenancy contract.
//
// This mirrors the `no-bare-prisma-client` ESLint rule pattern for the DB layer:
// object keys are a tenancy boundary, and string interpolation is unreviewable.
//
// TODO(week-6+): add an eslint rule forbidding literal "org/" string keys
// outside this file, mirroring packages/config's no-bare-prisma-client rule.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUUID(id: string, fieldName: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error(
      `Invalid UUID for ${fieldName}: "${id}" does not match UUID v1-8 format`,
    );
  }
}

export interface ArtifactKeyParams {
  orgId: string;
  projectId: string;
  executionId: string;
  executionTestId: string;
  seq: number;
  kind: string;
  artifactId: string;
  ext: string;
}

/**
 * Builds the object key for an artifact.
 * Format: org/{orgId}/artifacts/proj/{projectId}/exec/{executionId}/et/{executionTestId}/s{seq zero-padded to 4 digits}/{kind}/{artifactId}.{ext}
 */
export function artifactKey(p: ArtifactKeyParams): string {
  validateUUID(p.orgId, "orgId");
  validateUUID(p.projectId, "projectId");
  validateUUID(p.executionId, "executionId");
  validateUUID(p.executionTestId, "executionTestId");

  const seqPadded = String(p.seq).padStart(4, "0");
  return `org/${p.orgId}/artifacts/proj/${p.projectId}/exec/${p.executionId}/et/${p.executionTestId}/s${seqPadded}/${p.kind}/${p.artifactId}.${p.ext}`;
}

export interface KnowledgePageKeyParams {
  orgId: string;
  applicationId: string;
  pageId: string;
  explorationId: string;
}

/**
 * Builds the object key for a knowledge page screenshot.
 * Format: org/{orgId}/pages/app/{applicationId}/page/{pageId}/{explorationId}.webp
 */
export function knowledgePageKey(p: KnowledgePageKeyParams): string {
  validateUUID(p.orgId, "orgId");
  validateUUID(p.applicationId, "applicationId");
  validateUUID(p.pageId, "pageId");
  validateUUID(p.explorationId, "explorationId");

  return `org/${p.orgId}/pages/app/${p.applicationId}/page/${p.pageId}/${p.explorationId}.webp`;
}

export interface KnowledgeBundleKeyParams {
  orgId: string;
  issueId: string;
  bundleId: string;
}

/**
 * Builds the object key for a knowledge bundle.
 * Format: org/{orgId}/bundles/issue/{issueId}/{bundleId}.zip
 */
export function knowledgeBundleKey(p: KnowledgeBundleKeyParams): string {
  validateUUID(p.orgId, "orgId");
  validateUUID(p.issueId, "issueId");
  validateUUID(p.bundleId, "bundleId");

  return `org/${p.orgId}/bundles/issue/${p.issueId}/${p.bundleId}.zip`;
}

export interface ExportZipKeyParams {
  orgId: string;
  exportId: string;
  date: Date;
}

/**
 * Builds the object key for an export ZIP file.
 * Format: org/{orgId}/exports/{exportId}/qa-export-{YYYYMMDD}.zip
 * The date is formatted as YYYYMMDD.
 */
export function exportZipKey(p: ExportZipKeyParams): string {
  validateUUID(p.orgId, "orgId");
  validateUUID(p.exportId, "exportId");

  const year = p.date.getUTCFullYear();
  const month = String(p.date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(p.date.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  return `org/${p.orgId}/exports/${p.exportId}/qa-export-${dateStr}.zip`;
}

export interface ExportManifestKeyParams {
  orgId: string;
  exportId: string;
}

/**
 * Builds the object key for an export manifest.
 * Format: org/{orgId}/exports/{exportId}/manifest.json
 */
export function exportManifestKey(p: ExportManifestKeyParams): string {
  validateUUID(p.orgId, "orgId");
  validateUUID(p.exportId, "exportId");

  return `org/${p.orgId}/exports/${p.exportId}/manifest.json`;
}

export interface TmpUploadKeyParams {
  orgId: string;
  userId: string;
  nonce: string;
  filename: string;
}

/**
 * Builds the object key for a temporary upload.
 * Format: uploads/org/{orgId}/{userId}/{nonce}/{filename}
 */
export function tmpUploadKey(p: TmpUploadKeyParams): string {
  validateUUID(p.orgId, "orgId");
  validateUUID(p.userId, "userId");

  return `uploads/org/${p.orgId}/${p.userId}/${p.nonce}/${p.filename}`;
}
