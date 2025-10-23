import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "app", "data", "today.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "dev-admin"; // 간단한 개발용 키

export async function GET() {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    const json = JSON.parse(data);
    return NextResponse.json({ success: true, data: json });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "설정 파일을 읽지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || "";
  if (key !== ADMIN_KEY) {
    return NextResponse.json(
      { success: false, message: "권한이 없습니다." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { question, left, right } = body || {};

    if (
      typeof question !== "string" ||
      !left || typeof left.label !== "string" ||
      !right || typeof right.label !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 입력입니다." },
        { status: 400 }
      );
    }

    const payload = {
      question: question.trim(),
      left: { label: left.label.trim(), emoji: left.emoji || "" },
      right: { label: right.label.trim(), emoji: right.emoji || "" },
    };

    await fs.writeFile(CONFIG_PATH, JSON.stringify(payload, null, 2), "utf-8");

    return NextResponse.json({ success: true, data: payload });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "설정을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
