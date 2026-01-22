-- Migration: Create finance_transactions table for Finance Dashboard
-- Created: 2026-01-22

-- Create transaction type enum
CREATE TYPE transaction_type AS ENUM ('earning', 'expense');

-- Create transaction category enum
CREATE TYPE transaction_category AS ENUM (
    'consultation_fee',
    'service_fee',
    'other_income',
    'salary',
    'rent',
    'utilities',
    'marketing',
    'software',
    'office_supplies',
    'travel',
    'legal',
    'taxes',
    'other_expense'
);

-- Create finance_transactions table
CREATE TABLE finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type transaction_type NOT NULL,
    category transaction_category NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    description TEXT,
    reference_number TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_finance_transactions_type ON finance_transactions(type);
CREATE INDEX idx_finance_transactions_category ON finance_transactions(category);
CREATE INDEX idx_finance_transactions_date ON finance_transactions(transaction_date);
CREATE INDEX idx_finance_transactions_created_by ON finance_transactions(created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_finance_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_finance_transactions_updated_at
    BEFORE UPDATE ON finance_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_finance_transactions_updated_at();

-- Enable Row Level Security
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: finance role can do everything
CREATE POLICY "finance_full_access" ON finance_transactions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'finance'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'finance'
        )
    );

-- RLS Policy: admin role can do everything
CREATE POLICY "admin_full_access" ON finance_transactions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- RLS Policy: superadmin role can do everything
CREATE POLICY "superadmin_full_access" ON finance_transactions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'superadmin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'superadmin'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE finance_transactions IS 'Stores earnings and expenses for the finance dashboard';
COMMENT ON COLUMN finance_transactions.type IS 'Type of transaction: earning or expense';
COMMENT ON COLUMN finance_transactions.category IS 'Category of the transaction for reporting';
COMMENT ON COLUMN finance_transactions.amount IS 'Transaction amount (always positive)';
COMMENT ON COLUMN finance_transactions.reference_number IS 'Optional reference/receipt number';
COMMENT ON COLUMN finance_transactions.transaction_date IS 'Date the transaction occurred';
