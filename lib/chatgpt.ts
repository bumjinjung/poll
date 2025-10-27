import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PollTemplate {
	question: string;
	left: { label: string; emoji: string };
	right: { label: string; emoji: string };
}

/** SNS 트렌드형, 유행/자극형 밸런스게임 1개 생성 (클리셰 허용: 이성친구, 아아/뜨아 등) */
export async function generatePollWithChatGPT(
	recentQuestions: string[] = []
): Promise<{ success: boolean; poll?: PollTemplate; error?: string }> {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return { success: false, error: "OpenAI API 키가 설정되지 않았습니다." };
		}

		// 전역 금지 세트 제거 — 밈/클리셰 허용(아아 vs 뜨아 등)
		// 단, 직전·최근 질문(recentQuestions)만 회피하여 과도한 중복 방지
		const globalBanlist: string[] = [];

		const systemPrompt = `
너는 한국 SNS 밈 기반 밸런스게임 작가다.
문항은 도덕/교과서적일 필요 전혀 없음. 현실·감정·밈·유행·자극을 최우선.
질문은 짧고 강렬하게. "당신의 선택은?" 같은 꼬리 문장 금지.
"00 vs 00" 형식이 아니어도 되며, 한 문장만으로 의미가 통하면 충분.
주제 예: 이성친구 가능/불가능, 아아 vs 뜨아, 읽씹/既読, 퇴사, 야근, 헬스장, 소개팅, DM, 돈, 체면, 민망함, 질투, 자존심 등.
금지: 노골적 성적 표현, 혐오/차별, 직접적 폭력 조장.
규칙:
- question: 3~30자, 밈 감성/현실 대화체 가능.
- left/right: 1~15자, 의미 중복 금지, 각 1개 이모지 포함(자연스러운 이모지).
- 오직 JSON만 출력.
`.trim();

		const userPrompt = `
최근/회피 목록:
${[...globalBanlist, ...recentQuestions].join("\n") || "- (없음)"}

예시(JSON only):
{"question":"이성친구, 가능?","left":{"label":"가능","emoji":"🫱"},"right":{"label":"불가능","emoji":"⛔"}}
{"question":"아아 vs 뜨아","left":{"label":"아아","emoji":"🧊"},"right":{"label":"뜨아","emoji":"🔥"}}
{"question":"단톡방 읽씹 사태","left":{"label":"이모지로 마무리","emoji":"😅"},"right":{"label":"끝까지 잠수","emoji":"🌊"}}
{"question":"퇴사 메일 임시보관함 7일째","left":{"label":"보낸다","emoji":"📨"},"right":{"label":"버틴다","emoji":"🗓️"}}
{"question":"새벽 감성 DM","left":{"label":"보낸다","emoji":"🫣"},"right":{"label":"참는다","emoji":"⏰"}}

위 톤으로 새로운 밸런스게임 질문 1개 생성:
형식(JSON only):
{"question":"문장","left":{"label":"선택1","emoji":"🙂"},"right":{"label":"선택2","emoji":"😎"}}
`.trim();

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 1.1,          // 자극/밈 다양성 ↑
			presence_penalty: 0.9,     // 새로운 주제 유도
			frequency_penalty: 0.6,    // 반복 억제
			max_tokens: 200,
			n: 3,
		});

		const candidates = (completion.choices || [])
			.map(c => safeJsonParse<PollTemplate>(c.message?.content))
			.filter(Boolean) as PollTemplate[];

		const pick = pickValid(candidates, [...globalBanlist, ...recentQuestions]);
		if (!pick) return { success: false, error: "유효한 밸런스게임을 만들지 못했습니다." };

		// 마무리 정리(트림/일관화)
		const fixed: PollTemplate = {
			question: pick.question.trim(),
			left: { label: pick.left.label.trim(), emoji: pick.left.emoji.trim() },
			right: { label: pick.right.label.trim(), emoji: pick.right.emoji.trim() }
		};

		return { success: true, poll: fixed };
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

function isEmojiish(s: string) {
	if (typeof s !== "string") return false;
	const t = s.trim();
	return t.length > 0 && [...t].length <= 4; // 조합 이모지 대충 허용
}

function pickValid(cands: PollTemplate[], avoid: string[]) {
	// 1) 기본 구조/길이/이모지
	const valid = cands.filter(c =>
		typeof c?.question === "string" &&
		typeof c?.left?.label === "string" &&
		typeof c?.right?.label === "string" &&
		c.question.trim().length >= 3 && c.question.trim().length <= 30 &&
		c.left.label.trim().length >= 1 && c.left.label.trim().length <= 15 &&
		c.right.label.trim().length >= 1 && c.right.label.trim().length <= 15 &&
		isEmojiish(c.left.emoji) && isEmojiish(c.right.emoji) &&
		// 라벨끼리 너무 동일한 경우만 금지(질문과의 유사성은 허용: "아아 vs 뜨아" 케이스 보호)
		jaccard(c.left.label, c.right.label) < 0.65
	);

	if (!valid.length) return null;

	// 2) 최근/회피 목록과 과도한 유사성만 제거 (질문 기준)
	const fresh = valid.filter(c => !avoid.some(q => jaccard(c.question, q) >= 0.75));

	// 3) 우선 fresh에서 랜덤, 없으면 valid에서 랜덤
	const pool = fresh.length ? fresh : valid;
	return pool[Math.floor(Math.random() * pool.length)] || null;
}
