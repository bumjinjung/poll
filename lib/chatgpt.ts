import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PollTemplate {
	question: string;
	left: { label: string; emoji: string };
	right: { label: string; emoji: string };
}

/** SNS 트렌드형, 유행/자극형 밸런스게임 1개 생성 */
export async function generatePollWithChatGPT(
	recentQuestions: string[] = []
): Promise<{ success: boolean; poll?: PollTemplate; error?: string }> {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return { success: false, error: "OpenAI API 키가 설정되지 않았습니다." };
		}

		// 반복 방지용 기본 금지 세트
		const globalBanlist = [
			"치킨 vs 피자","민초 vs 반민초","부먹 vs 찍먹","아침형 vs 밤형","운동 vs 휴식",
			"집에서 vs 밖에서","콜라 vs 사이다","강아지 vs 고양이","여름 vs 겨울",
			"게임 vs 영화","커피 vs 차","바다 vs 산","아이폰 vs 갤럭시","축구 vs 야구"
		];

		const systemPrompt = `
당신은 한국 SNS 밸런스게임 제작 도우미입니다.
밈스럽고 자극적이며 유행어가 섞인 짧고 강한 질문을 만들어야 합니다.
'당신의 선택은?', '무엇을 고를래요?' 같은 꼬리 문장은 절대 사용하지 마세요.
단, 선정적·혐오·폭력적인 내용은 금지입니다.

규칙:
- question은 5~20자, 간결하고 즉흥적 표현 가능.
- left/right는 1~15자, 의미 겹치지 않게.
- 각 label에 맞는 이모지 1개 포함.
- 반복, 동의어, 클리셰 피함.
- 오직 JSON만 출력.
`.trim();

		const userPrompt = `
금지/회피 목록:
${[...globalBanlist, ...recentQuestions].join("\n") || "- (없음)"}

출력 예시(JSON only):
{"question":"전남친 결혼식 초대장","left":{"label":"간다","emoji":"😈"},"right":{"label":"안 간다","emoji":"🙄"}}
`.trim();

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.95,
			presence_penalty: 0.9,
			frequency_penalty: 0.8,
			max_tokens: 180,
			n: 3,
		});

		const candidates = (completion.choices || [])
			.map(c => safeJsonParse<PollTemplate>(c.message?.content))
			.filter(Boolean) as PollTemplate[];

		const pick = pickValid(candidates, [...globalBanlist, ...recentQuestions]);
		if (!pick) return { success: false, error: "유효한 밸런스게임을 만들지 못했습니다." };

		return { success: true, poll: pick };
	} catch (error: any) {
		console.error("ChatGPT API 오류:", error);
		return { success: false, error: error.message || "알 수 없는 오류" };
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

function jaccard(a: string, b: string) {
	const A = new Set(normalize(a).split(""));
	const B = new Set(normalize(b).split(""));
	let inter = 0; for (const ch of A) if (B.has(ch)) inter++;
	return inter / (A.size + B.size - inter);
}

function pickValid(cands: PollTemplate[], avoid: string[]) {
	const valid = cands.filter(c =>
		c?.question && c.left?.label && c.right?.label &&
		jaccard(c.left.label, c.right.label) < 0.6 &&
		jaccard(c.question, c.left.label) < 0.7 &&
		jaccard(c.question, c.right.label) < 0.7
	);
	const fresh = valid.filter(c => !avoid.some(q => jaccard(c.question, q) > 0.7));
	if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
	return valid[Math.floor(Math.random() * valid.length)] || null;
}
