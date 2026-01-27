import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'earning' | 'expense'
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");

    // Build query
    let query = supabaseAdmin
      .from("finance_transactions")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }

    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      category,
      amount,
      currency = "AED",
      description,
      reference_number,
      receipt_path,
      transaction_date,
    } = body;

    // Validate required fields
    if (!type || !category || !amount) {
      return NextResponse.json(
        { error: "Type, category, and amount are required" },
        { status: 400 }
      );
    }

    // Validate type
    if (!["earning", "expense"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'earning' or 'expense'" },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Create the transaction
    const { data: transaction, error: createError } = await supabaseAdmin
      .from("finance_transactions")
      .insert({
        type,
        category,
        amount,
        currency,
        description: description || null,
        reference_number: reference_number || null,
        receipt_path: receipt_path || null,
        transaction_date: transaction_date || new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (createError) throw createError;

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
