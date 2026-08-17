import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
