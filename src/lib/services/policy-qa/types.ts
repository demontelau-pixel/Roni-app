import type { AnnotatedAutoPolicyFacts } from "@/lib/wallet/annotate";

/** Context is assembled only after the route authorizes both the user and the selected policy/document. */
export interface PolicyQAContext {
  policyId: string;
  /** Already annotated so a provider can distinguish saved document evidence from manual corrections when needed. */
  facts: AnnotatedAutoPolicyFacts;
  carrierLabel: string | null;
  question: string;
  /** Private PDF bytes supplied server-to-server only; never sent to the browser or stored in a chat row. */
  document?: {
    bytes: Buffer;
    mimeType: string | null;
    originalFilename: string | null;
    /** Null when the independent text layer could not determine a page count. */
    pageCount: number | null;
    /** Independently extracted page text used only to verify a returned excerpt. */
    pages: Array<{ pageNumber: number; text: string }>;
  };
}

export interface PolicyQACitation {
  /** Human-readable policy page reference, never constructed from a user-supplied path. */
  label: string;
  pageNumber: number | null;
  /** Short document excerpt when the model could provide one. */
  snippet?: string | null;
  /** True only when Roni found the excerpt in independently extracted page text. */
  verified?: boolean;
}

export interface PolicyQAAnswer {
  /** Backward-compatible plain-text rendering assembled from the three explicit sections below. */
  answerText: string;
  /** What the selected policy itself says, if it can be determined. */
  policyStatement?: string | null;
  /** Optional general explanation that is clearly separate from the policy statement. */
  generalExplanation?: string | null;
  /** What cannot be settled from the document and what to confirm with the insurer. */
  notDetermined?: string | null;
  citations: PolicyQACitation[];
  /** True only when a policy statement is backed by at least one document page citation. */
  grounded: boolean;
}

export interface PolicyQAProvider {
  readonly id: string;
  answer(context: PolicyQAContext): Promise<PolicyQAAnswer>;
}
