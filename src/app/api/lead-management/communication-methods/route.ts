import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List all communication methods
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("communication_methods")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching communication methods:", error);
      return NextResponse.json(
        { error: "Failed to fetch communication methods" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in communication methods GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new communication method (admin only - to be protected by frontend)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, icon, is_active, display_order } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("communication_methods")
      .insert({
        name,
        icon: icon || "phone",
        is_active: is_active ?? true,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating communication method:", error);
      return NextResponse.json(
        { error: "Failed to create communication method" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error in communication methods POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
