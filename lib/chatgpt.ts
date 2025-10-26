import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PollTemplate {
	question: string;
	left: { label: string; emoji: string };
	right: { label: string; emoji: string };
}

/** 테마 없이, 최근 질문과의 유사/중복을 강하게 회피해서 1개 생성 */
export async function generatePollWithChatGPT(
	recentQuestions: string[] = []
): Promise<{ success: boolean; poll?: PollTemplate; error?: string }> {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return { success: false, error: "OpenAI API 키가 설정되지 않았습니다. 환경 변수 OPENAI_API_KEY를 확인해주세요." };
		}

		// 너무 자주 나오는 클리셰 조합 전역 금지(원하면 자유롭게 수정/추가)
		const globalBanlist = [
			"치킨 vs 피자","민초 vs 반민초","부먹 vs 찍먹","아침형 vs 밤형","운동 vs 휴식",
			"집에서 vs 밖에서","콜라 vs 사이다","강아지 vs 고양이","여름 vs 겨울",
			"게임 vs 영화","커피 vs 차","바다 vs 산","아이폰 vs 갤럭시","축구 vs 야구"
		];

		const systemPrompt = `
당신은 한국 사용자용 밸런스게임 문제 작성 보조입니다.
반드시 JSON만 출력합니다(설명 금지).

규칙:
- 질문은 꼭 "라벨1 vs 라벨2" 형식.
- 라벨은 각각 1~20자, 의미 중복/동의어 금지, 밸런스가 팽팽하도록.
- 각 라벨에 맥락 맞는 이모지 1개씩 필수.
- 아래 금지/회피 목록과 "의미적으로 다른" 새 조합만 허용.
- 음식류/계절/아침밤/운동휴식/동물/디바이스 등 흔한 클리셰 조합은 가급적 피함.
- 오직 JSON만 출력.
`.trim();

		const userPrompt = `
금지/회피 목록(표현만 바꿔도 금지):
${[...globalBanlist, ...recentQuestions].map((q, i) => `${i + 1}. ${q}`).join("\n") || "- (없음)"}

출력 형식(JSON only):
{"question":"라벨1 vs 라벨2","left":{"label":"라벨1","emoji":"😀"},"right":{"label":"라벨2","emoji":"😎"}}
`.trim();

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			response_format: { type: "json_object" },   // ✅ JSON 강제
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.9,
			top_p: 0.9,
			presence_penalty: 0.9,   // ✅ 새 주제 유도
			frequency_penalty: 0.7,  // ✅ 흔한 패턴 억제
			n: 3,                     // ✅ 여러 후보 받고 로컬에서 고르기
			max_tokens: 200,
		});

		const candidates = (completion.choices || [])
			.map(c => safeJsonParse<PollTemplate>(c.message?.content))
			.filter(Boolean) as PollTemplate[];

		const pick = pickDiverseCandidate(candidates, [...globalBanlist, ...recentQuestions]);
		if (!pick) return { success: false, error: "새롭고 유효한 문제를 만들지 못했습니다." };

		return { success: true, poll: pick };
	} catch (error) {
		console.error("ChatGPT API 오류:", error);
		let msg = "알 수 없는 오류가 발생했습니다.";
		if (error instanceof Error) {
			if (error.message.includes("API key")) msg = "OpenAI API 키가 유효하지 않습니다.";
			else if (error.message.includes("quota")) msg = "OpenAI API 사용량 한도를 초과했습니다.";
			else if (error.message.includes("network")) msg = "네트워크 연결에 문제가 있습니다.";
			else msg = `ChatGPT API 오류: ${error.message}`;
		}
		return { success: false, error: msg };
	}
}

/* ---------- 유틸 ---------- */

function safeJsonParse<T>(s?: string | null): T | null {
	if (!s) return null;
	try { return JSON.parse(s) as T; }
	catch {
		const m = s.match(/\{[\s\S]*\}$/);
		if (!m) return null;
		try { return JSON.parse(m[0]) as T; } catch { return null; }
	}
}

function normalize(str: string) {
	return (str || "").toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function jaccardCharSim(a: string, b: string) {
	const A = new Set(normalize(a).split(""));
	const B = new Set(normalize(b).split(""));
	if (!A.size && !B.size) return 1;
	let inter = 0; for (const ch of A) if (B.has(ch)) inter++;
	return inter / (A.size + B.size - inter);
}

function labelsValid(left: string, right: string) {
	const L = (left || "").trim();
	const R = (right || "").trim();
	if (!L || !R) return false;
	if (L.length > 20 || R.length > 20) return false;
	// 동일/거의 동일 금지
	if (jaccardCharSim(L, R) >= 0.7) return false;
	return true;
}

function emojiValid(e: string) {
	return typeof e === "string" && e.length > 0;
}

function passesBanlist(q: string, avoid: string[]) {
	return !avoid.some(old => jaccardCharSim(q, old) >= 0.7);
}

function pickDiverseCandidate(cands: PollTemplate[], avoid: string[]): PollTemplate | null {
	// 1차: 구조/라벨/이모지 검증
	const valid = cands.filter(c =>
		c?.question && c.left?.label && c.right?.label &&
		labelsValid(c.left.label, c.right.label) &&
		emojiValid(c.left.emoji) && emojiValid(c.right.emoji)
	);
	if (!valid.length) return null;

	// 2차: 회피 목록과 유사한 질문 제거
	const fresh = valid.filter(c => passesBanlist(c.question, avoid));
	if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];

	// 3차: 없으면 valid 중 랜덤
	return valid[Math.floor(Math.random() * valid.length)];
}