export interface BillingStatusResponse {
  projectId: string;
  plan: "free" | "pro" | "enterprise";
  usage: {
    analyze: { used: number; limit: number; remaining: number };
    generate_fix: { used: number; limit: number; remaining: number };
  };
}
