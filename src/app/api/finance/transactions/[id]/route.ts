import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("finance_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      type,
      category,
      amount,
      currency,
      description,
      reference_number,
      receipt_path,
      transaction_date,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) {
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive number" },
          { status: 400 }
        );
      }
      updateData.amount = amount;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (description !== undefined) updateData.description = description || null;
    if (reference_number !== undefined) updateData.reference_number = reference_number || null;
    if (receipt_path !== undefined) updateData.receipt_path = receipt_path || null;
    if (transaction_date !== undefined) updateData.transaction_date = transaction_date;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("finance_transactions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("finance_transactions")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
