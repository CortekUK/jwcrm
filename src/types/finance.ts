// Finance Dashboard Types

export type TransactionType = "earning" | "expense";

export type TransactionCategory =
  // Earning categories
  | "consultation_fee"
  | "service_fee"
  | "other_income"
  // Expense categories
  | "salary"
  | "rent"
  | "utilities"
  | "marketing"
  | "software"
  | "office_supplies"
  | "travel"
  | "legal"
  | "taxes"
  | "other_expense";

export const EARNING_CATEGORIES: TransactionCategory[] = [
  "consultation_fee",
  "service_fee",
  "other_income",
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  "salary",
  "rent",
  "utilities",
  "marketing",
  "software",
  "office_supplies",
  "travel",
  "legal",
  "taxes",
  "other_expense",
];

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  description: string | null;
  reference_number: string | null;
  receipt_path: string | null;
  transaction_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency?: string;
  description?: string;
  reference_number?: string;
  receipt_path?: string;
  transaction_date?: string;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  category?: TransactionCategory;
  amount?: number;
  currency?: string;
  description?: string;
  reference_number?: string;
  receipt_path?: string;
  transaction_date?: string;
}

// Proposal/Invoice types for the finance dashboard
export type ProposalStatus = "draft" | "sent" | "paid" | "cancelled";

export interface Proposal {
  id: string;
  lead_id: string;
  amount: number;
  currency: string;
  proposal_content: string | null;
  proposal_pdf_path: string | null;
  invoice_pdf_path: string | null;
  invoice_number: string | null;
  stripe_payment_link: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  lead?: {
    id: string;
    full_name: string;
    email: string;
    company_name: string | null;
  };
}

// Finance stats interfaces
export interface FinanceStats {
  // Invoice stats
  totalInvoices: number;
  totalInvoiceAmount: number;
  paidInvoices: number;
  paidAmount: number;
  pendingInvoices: number;
  pendingAmount: number;
  // Transaction stats
  totalEarnings: number;
  totalExpenses: number;
  netProfit: number;
  // Breakdown by status
  statusBreakdown: {
    draft: { count: number; amount: number };
    sent: { count: number; amount: number };
    paid: { count: number; amount: number };
    cancelled: { count: number; amount: number };
  };
  currency: string;
}

// Chart data types
export interface MonthlyData {
  month: string;
  earnings: number;
  expenses: number;
  invoicesPaid: number;
}

export interface CategoryData {
  category: string;
  amount: number;
  fill: string;
}
