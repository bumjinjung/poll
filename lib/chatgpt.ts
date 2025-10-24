import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface PollTemplate {
  question: string;
  left: { label: string; emoji: string };
  right: { label: string; emoji: string };
}

export async function generatePollWithChatGPT(): Promise<{ success: boolean; poll?: PollTemplate; error?: string }> {
  try {
    // API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      return { 
        success: false, 
        error: "OpenAI API 키가 설정되지 않았습니다. 환경 변수 OPENAI_API_KEY를 확인해주세요." 
      };
    }

    const systemPrompt = `당신은 한국 사용자용 밸런스게임 작성 도우미입니다.
규칙:
- 질문은 반드시 "00 vs 00" 형식으로만 작성하세요.
- 선택지 라벨은 1~20자, 중복/의미중복 금지.
- 난이도: "선택이 팽팽하도록" 조절.
- 이모지는 반드시 1개씩, 적절한 이모지 사용.
- 동일한 문제가 반복되도록 하지 마세요.
- JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

    const userPrompt = `다음 예시처럼 "00 vs 00" 형식으로만 질문을 만들어주세요.
예시: 
- "민초 vs 반민초" (🍃 vs ❌)
- "부먹 vs 찍먹" (🥄 vs 🥢)
- "아침형 vs 밤형" (🌅 vs 🌙)
- "치킨 vs 피자" (🍗 vs 🍕)
- "운동 vs 휴식" (💪 vs 😴)

반드시 "00 vs 00" 형식으로만 질문을 작성하고, JSON 형식으로만 응답하세요:
{"question":"00 vs 00","left":{"label":"선택지1","emoji":"이모지"},"right":{"label":"선택지2","emoji":"이모지"}}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 500,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return { 
        success: false, 
        error: "ChatGPT에서 응답을 받지 못했습니다." 
      };
    }

    // JSON 파싱 (더 안전한 방식)
    let pollData;
    let jsonString = '';
    
    try {
      // 응답 정리
      let cleanedResponse = response.trim();
      
      // JSON 부분만 추출
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { 
          success: false, 
          error: "응답에서 JSON을 찾을 수 없습니다." 
        };
      }
      
      jsonString = jsonMatch[0];
      
      // 일반적인 문제들 해결
      jsonString = jsonString
        .replace(/[\u201C\u201D]/g, '"') // 스마트 따옴표
        .replace(/[\u2018\u2019]/g, "'") // 스마트 작은따옴표
        .replace(/\n/g, ' ') // 줄바꿈
        .replace(/\s+/g, ' ') // 여러 공백
        .replace(/,\s*}/g, '}') // 마지막 쉼표 제거
        .replace(/,\s*]/g, ']') // 배열 마지막 쉼표 제거
        .trim();
      
      // JSON 파싱 시도
      pollData = JSON.parse(jsonString);
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.error('원본 응답:', response);
      console.error('정리된 JSON:', jsonString);
      
      // 마지막 시도: 수동으로 JSON 구성
      try {
        const questionMatch = response.match(/"question"\s*:\s*"([^"]+)"/);
        const leftLabelMatch = response.match(/"label"\s*:\s*"([^"]+)"[^}]*"emoji"\s*:\s*"([^"]*)"/);
        const rightLabelMatch = response.match(/"label"\s*:\s*"([^"]+)"[^}]*"emoji"\s*:\s*"([^"]*)"/);
        
        if (questionMatch && leftLabelMatch && rightLabelMatch) {
          pollData = {
            question: questionMatch[1],
            left: { label: leftLabelMatch[1], emoji: leftLabelMatch[2] || '' },
            right: { label: rightLabelMatch[1], emoji: rightLabelMatch[2] || '' }
          };
        } else {
          throw new Error('수동 파싱도 실패');
        }
      } catch (manualParseError) {
        return { 
          success: false, 
          error: `JSON 파싱 실패: ${parseError instanceof Error ? parseError.message : '알 수 없는 오류'}` 
        };
      }
    }
    
    // 데이터 검증
    if (!pollData.question || !pollData.left || !pollData.right) {
      return { 
        success: false, 
        error: "ChatGPT 응답에 필수 필드가 누락되었습니다." 
      };
    }

    if (!pollData.left.label || !pollData.right.label) {
      return { 
        success: false, 
        error: "선택지 라벨이 누락되었습니다." 
      };
    }

    // 이모지 검증 (없어도 괜찮지만 있으면 검증)
    if (pollData.left.emoji && typeof pollData.left.emoji !== 'string') {
      pollData.left.emoji = '';
    }
    if (pollData.right.emoji && typeof pollData.right.emoji !== 'string') {
      pollData.right.emoji = '';
    }

    return { success: true, poll: pollData as PollTemplate };
  } catch (error) {
    console.error('ChatGPT API 오류:', error);
    
    let errorMessage = "알 수 없는 오류가 발생했습니다.";
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = "OpenAI API 키가 유효하지 않습니다.";
      } else if (error.message.includes('quota')) {
        errorMessage = "OpenAI API 사용량 한도를 초과했습니다.";
      } else if (error.message.includes('network')) {
        errorMessage = "네트워크 연결에 문제가 있습니다.";
      } else {
        errorMessage = `ChatGPT API 오류: ${error.message}`;
      }
    }
    
    return { success: false, error: errorMessage };
  }
}

function getFallbackTemplate(): PollTemplate {
  const fallbackTemplates = [
    {
      question: "치킨 vs 피자",
      left: { label: "치킨", emoji: "🍗" },
      right: { label: "피자", emoji: "🍕" }
    },
    {
      question: "민초 vs 반민초",
      left: { label: "민초", emoji: "🍃" },
      right: { label: "반민초", emoji: "❌" }
    },
    {
      question: "부먹 vs 찍먹",
      left: { label: "부먹", emoji: "🥄" },
      right: { label: "찍먹", emoji: "🥢" }
    },
    {
      question: "집에서 vs 밖에서",
      left: { label: "집에서", emoji: "🏠" },
      right: { label: "밖에서", emoji: "🌃" }
    },
    {
      question: "운동 vs 휴식",
      left: { label: "운동", emoji: "💪" },
      right: { label: "휴식", emoji: "😴" }
    }
  ];

  const randomIndex = Math.floor(Math.random() * fallbackTemplates.length);
  return fallbackTemplates[randomIndex];
}

