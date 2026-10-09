import { NextRequest } from "next/server";
import { handleMatchOptIn } from "@/lib/matchOptInHandler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleMatchOptIn(req, params, "decline");
}
