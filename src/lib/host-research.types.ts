import type { HostProviderId } from "./hosts";

/** Report prodotto dall'Host Research Agent (client + server). */
export type HostResearchReport = {
  query: string;
  providerId: HostProviderId | "unknown";
  label: string;
  summary: string;
  apiAvailable: boolean;
  mcpHint: string;
  suggestedBaseUrl: string;
  suggestedFields: string[];
  pricingNotes: string;
  riskNotes: string;
  sources: { title: string; url: string }[];
  draftProfile: {
    label: string;
    provider: HostProviderId;
    baseUrl: string;
    notes: string;
  };
};
