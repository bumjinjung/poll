import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Poll - 매일 하나씩 가벼운 설문조사';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* 메인 컨텐츠 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px',
          }}
        >
          {/* 타이틀 */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 30,
              textAlign: 'center',
            }}
          >
            Poll
          </div>

          {/* 설명 */}
          <div
            style={{
              fontSize: 36,
              color: 'rgba(255, 255, 255, 0.95)',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            매일 하나씩 가벼운 설문조사
          </div>

          {/* 데코레이션 */}
          <div
            style={{
              display: 'flex',
              marginTop: 60,
              gap: 30,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 30,
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 50,
              }}
            >
              👍
            </div>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 30,
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 50,
              }}
            >
              👎
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

