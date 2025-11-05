import { NextRequest, NextResponse } from "next/server";
import { deleteHistory } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_KEY = process.env.ADMIN_KEY;

function ensureAdminKeyConfigured() {
  if (!ADMIN_KEY) {
    throw new Error("ADMIN_KEY is not configured in environment");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureAdminKeyConfigured();
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "서버 설정 오류: ADMIN_KEY 미설정" },
      { status: 500 }
    );
  }

  const key = req.headers.get("x-admin-key") || "";
  if (key !== ADMIN_KEY) {
    return NextResponse.json(
      { success: false, message: "권한이 없습니다." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { success: false, message: "날짜가 필요합니다." },
        { status: 400 }
      );
    }

    const deleted = await deleteHistory(date);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `${date} 히스토리가 삭제되었습니다.`,
      });
    } else {
      return NextResponse.json(
        { success: false, message: "히스토리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  } catch (e) {
    console.error("Delete history error:", e);
    return NextResponse.json(
      { success: false, message: "히스토리 삭제 실패" },
      { status: 500 }
    );
  }
}

