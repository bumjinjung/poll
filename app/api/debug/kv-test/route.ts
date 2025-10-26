import { NextResponse } from "next/server";
import { getPollData, getVoteData } from "@/lib/kv";

export async function GET() {
  try {
    const pollData = await getPollData();
    const voteData = await getVoteData();
    
    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      hasKvUrl: !!process.env.KV_URL,
      hasKvRestApiUrl: !!process.env.KV_REST_API_URL,
      hasKvRestApiToken: !!process.env.KV_REST_API_TOKEN,
      pollData,
      voteData,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      environment: process.env.NODE_ENV,
      hasKvUrl: !!process.env.KV_URL,
      hasKvRestApiUrl: !!process.env.KV_REST_API_URL,
      hasKvRestApiToken: !!process.env.KV_REST_API_TOKEN,
    }, { status: 500 });
  }
}

