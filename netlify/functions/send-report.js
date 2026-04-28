/**
 * 프리미너 무료 진단 결과 자동 발송
 * Netlify Function · send-report.js
 *
 * 흐름:
 * 1. 클라이언트(diagnosis.js)에서 진단 데이터 POST
 * 2. Claude API로 맞춤 결과 텍스트 생성
 * 3. SendGrid로 사용자 이메일 자동 발송
 *
 * 필요한 환경변수 (Netlify 대시보드 > Site Settings > Environment Variables):
 *   ANTHROPIC_API_KEY   — Anthropic API 키
 *   SENDGRID_API_KEY    — SendGrid API 키
 *   FROM_EMAIL          — 발신 이메일 (SendGrid에서 인증한 주소)
 *   FROM_NAME           — 발신자 이름 (예: 프리미너 FreeMeaner)
 */

const DOMAIN_LABELS = ['일 구조', '수입 구조', '건강 구조', '관계 구조', '의미 구조'];

const QUESTIONS = [
  '지금 하는 일이 5년 후에도 나에게 가치 있는 무언가를 남길 것 같다',
  '내가 없어도 돌아가는 일의 구조(시스템, 콘텐츠, 프로세스)가 일부라도 있다',
  '지금 하는 일은 이 조직을 떠나도 통하는 역량을 키워준다',
  '일이 끝난 후 소진되기보다 무언가 채워지는 느낌을 자주 경험한다',
  '나는 지금 하는 일의 방향과 목적을 스스로 정의할 수 있다',
  '주 수입원이 사라져도 3개월 이상 버틸 수 있는 구조가 있다',
  '직장 수입 외에 별도의 수입이 있거나 구체적으로 준비 중이다',
  '나의 지식, 경험, 콘텐츠가 수입으로 연결되는 경로가 있다',
  '내가 일을 덜 해도 수입이 줄지 않는 구조가 일부라도 있다',
  '10년 후에도 지금과 비슷한 수준의 수입이 유지될 것 같다',
  '운동, 수면, 식사 중 최소 두 가지 이상 의도적인 루틴이 있다',
  '몸과 마음이 방전됐을 때 충전하는 나만의 방법과 시간이 확보되어 있다',
  '지금 생활 방식을 유지하면 10년 후 건강이 지금보다 나을 것 같다',
  '건강 관리를 위한 시간과 비용을 기꺼이 투자하고 있다',
  '만나고 나면 에너지가 생기는 사람이 소진되는 사람보다 많다',
  '나의 성장과 전환을 진심으로 응원하거나 함께 고민하는 사람이 있다',
  '가장 중요한 관계에 충분한 시간과 에너지를 의도적으로 쏟고 있다',
  '나는 어떤 관계를 유지하고 어떤 관계에서 거리를 둘지 스스로 선택한다',
  '나는 왜 사는가에 대한 나름의 답을 갖고 있다',
  '지금 하는 일과 일상이 내가 중요하게 생각하는 가치와 연결되어 있다',
  '오늘 하루가 끝날 때 잘 살았다는 느낌이 드는 날이 더 많다',
  '5년 후 나의 삶이 지금보다 더 나아질 것이라는 확신이 있다',
];

/* ── Claude API 호출 ── */
async function callClaude(name, typeCode, typeName, scores, avg, answers) {
  const domainCounts = [5, 5, 4, 4, 4];
  let qDetails = '';
  let qIdx = 0;
  DOMAIN_LABELS.forEach((label, di) => {
    qDetails += `\n[${label} · ${scores[di]}점]\n`;
    for (let i = 0; i < domainCounts[di]; i++) {
      const stars = '★'.repeat(answers[qIdx]) + '☆'.repeat(5 - answers[qIdx]);
      qDetails += `  Q${qIdx + 1}. ${QUESTIONS[qIdx]}\n  → ${answers[qIdx]}점 ${stars}\n`;
      qIdx++;
    }
  });

  const lowQs = answers
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a <= 2)
    .map(({ a, i }) => `  • Q${i + 1}. ${QUESTIONS[i]} (${a}점)`)
    .join('\n') || '  (특별히 낮은 문항 없음)';

  const prompt = `당신은 프리미너(FreeMeaner) Life 2.0 프레임워크의 전문 분석가입니다.
아래 진단 결과를 바탕으로 무료 기본 결과 이메일 본문을 작성하세요.

## 진단 데이터
- 이름: ${name}
- 진단 유형: [${typeCode}] ${typeName}
- 전체 평균: ${avg}점
- 영역별 점수: ${DOMAIN_LABELS.map((l, i) => `${l} ${scores[i]}점`).join(', ')}

## 문항별 응답
${qDetails}

## 주목할 낮은 문항 (1~2점)
${lowQs}

## 작성 지침
- 따뜻하되 직설적. 위로가 아닌 구조적 진단
- 문어체 사용 (습니다/입니다)
- 이름을 직접 부르며 시작
- 프리미너 핵심 철학 반영: "삶은 노력이 아닌 구조로 바뀐다"
- 분량: 600~800자

## 출력 구조 (순서 엄수)
1. 인사 (이름 호명, 진단 완료 감사)
2. 핵심 진단 한 줄 (유형과 전체 평균 기반)
3. 가장 강한 영역 1개 + 의미 해석
4. 가장 취약한 영역 1개 + 구체적 첫 번째 행동 제안
5. 마무리 (3년이면 충분하다는 희망 메시지)
6. 마지막 줄: "프리미너 FreeMeaner · Life Redesign Framework"

이메일 본문 텍스트만 출력하세요. 앞뒤 설명 없이 본문만.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

/* ── SendGrid 이메일 발송 ── */
async function sendEmail(to, name, typeCode, typeName, scores, avg, bodyText) {
  const scoreRows = DOMAIN_LABELS.map((label, i) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#555558;font-family:sans-serif;">${label}</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:600;color:#0D0D0F;font-family:sans-serif;text-align:right;">${scores[i]}점</td>
    </tr>`).join('');

  const htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:'Apple SD Gothic Neo',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:40px 20px;">
<tr><td>
<table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;width:100%;">

  <!-- 헤더 -->
  <tr>
    <td style="background:#0D0D0F;padding:32px 40px;">
      <p style="margin:0;font-size:20px;color:#FAFAF8;font-family:Georgia,serif;">
        프리미너 <em style="color:#B8935A;">FreeMeaner</em>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#A0A0A8;letter-spacing:2px;">
        삶 구조 진단 결과 · LIFE STRUCTURE DIAGNOSIS
      </p>
    </td>
  </tr>

  <!-- 유형 배지 -->
  <tr>
    <td style="background:#FAFAF8;padding:32px 40px;border-bottom:1px solid #EBEBEB;">
      <p style="margin:0 0 8px;font-size:11px;color:#A0A0A8;letter-spacing:2px;">나의 삶 구조 유형</p>
      <p style="margin:0 0 4px;font-size:28px;color:#0D0D0F;font-family:Georgia,serif;font-weight:400;">
        [${typeCode}] ${typeName}
      </p>
      <p style="margin:0;font-size:14px;color:#B8935A;letter-spacing:1px;">전체 평균 ${avg}점</p>
    </td>
  </tr>

  <!-- 영역별 점수 -->
  <tr>
    <td style="background:#FAFAF8;padding:0 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EBEBEB;">
        <tr style="background:#0D0D0F;">
          <td style="padding:10px 12px;font-size:12px;color:#A0A0A8;letter-spacing:2px;">영역</td>
          <td style="padding:10px 12px;font-size:12px;color:#A0A0A8;letter-spacing:2px;text-align:right;">점수</td>
        </tr>
        ${scoreRows}
      </table>
    </td>
  </tr>

  <!-- 본문 (Claude 생성) -->
  <tr>
    <td style="background:#FAFAF8;padding:0 40px 40px;">
      <div style="border-left:3px solid #B8935A;padding-left:20px;">
        ${bodyText.split('\n').map(line =>
          line.trim()
            ? `<p style="margin:0 0 16px;font-size:15px;color:#555558;line-height:1.8;">${line}</p>`
            : '<br>'
        ).join('')}
      </div>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="background:#F5F3EE;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 20px;font-size:14px;color:#555558;">
        더 깊은 분석이 필요하신가요?
      </p>
      <a href="https://juhewow.gumroad.com/l/hsvdwi"
         style="display:inline-block;background:#0D0D0F;color:#FAFAF8;padding:14px 32px;font-size:14px;text-decoration:none;letter-spacing:1px;">
        심층분석보고서 받기 ($7) →
      </a>
      <p style="margin:16px 0 0;font-size:12px;color:#A0A0A8;">
        22개 문항 기반 맞춤형 보고서 · 48시간 이내 발송
      </p>
    </td>
  </tr>

  <!-- 푸터 -->
  <tr>
    <td style="background:#0D0D0F;padding:24px 40px;">
      <p style="margin:0;font-size:12px;color:#555558;">
        © 2025 FreeMeaner · 프리미너. Life Redesign Framework.<br>
        본 이메일은 삶 구조 진단 신청에 의해 발송되었습니다.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, name: name }] }],
      from: {
        email: process.env.FROM_EMAIL,
        name: process.env.FROM_NAME || '프리미너 FreeMeaner',
      },
      subject: `[프리미너] ${name}님의 삶 구조 진단 결과 — [${typeCode}] ${typeName}`,
      content: [
        {
          type: 'text/plain',
          value: bodyText,
        },
        {
          type: 'text/html',
          value: htmlBody,
        },
      ],
    }),
  });

  return response.status;
}

/* ── 메인 핸들러 ── */
exports.handler = async (event) => {
  // CORS 프리플라이트
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, name, typeCode, typeName, scores, avg, answers } = JSON.parse(event.body);

    // 입력값 검증
    if (!email || !typeCode || !scores || !answers) {
      return { statusCode: 400, body: JSON.stringify({ error: '필수 데이터 누락' }) };
    }

    const displayName = name || '익명';

    // 1. Claude API로 맞춤 결과 생성
    const bodyText = await callClaude(
      displayName, typeCode, typeName, scores, avg, answers
    );

    // 2. SendGrid로 이메일 발송
    const status = await sendEmail(
      email, displayName, typeCode, typeName, scores, avg, bodyText
    );

    if (status >= 200 && status < 300) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true }),
      };
    } else {
      throw new Error(`SendGrid error: ${status}`);
    }

  } catch (err) {
    console.error('send-report error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '처리 중 오류가 발생했습니다.' }),
    };
  }
};
