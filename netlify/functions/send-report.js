/**
 * 프리미너 무료 진단 결과 자동 발송
 * Netlify Function · send-report.js (Brevo SMTP 버전)
 *
 * 필요한 환경변수:
 *   BREVO_SMTP_USER  — Brevo SMTP 로그인 이메일 (예: a9dd0b001@smtp-brevo.com)
 *   BREVO_SMTP_PASS  — Brevo SMTP 패스워드 (xsmtpsib-... 키)
 *   FROM_EMAIL       — 발신 이메일 (Brevo에서 인증한 주소)
 *   FROM_NAME        — 발신자 이름 (프리미너 FreeMeaner)
 */

const nodemailer = require('nodemailer');

const DOMAIN_LABELS = ['일 구조', '수입 구조', '건강 구조', '관계 구조', '의미 구조'];

const TYPE_MESSAGES = {
  A: {
    name: '소진형 연소자',
    headline: '지금 가장 열심히 살고 있지만, 그 열심이 삶을 갉아먹고 있습니다.',
    body: '열심히가 아닌 올바른 방향이 필요한 시점입니다. 5대 영역 중 4개가 동시에 취약한 상태는 노력의 문제가 아니라 구조의 문제입니다. 지금 당장 가장 취약한 영역 하나에만 집중해보세요. 작은 구조 하나가 전체를 바꿉니다.',
    action: '오늘 할 일: "이 조직이 없어도 나에게 남는 역량"을 3가지 적어보세요.',
  },
  B: {
    name: '외줄 타기형',
    headline: '하나의 수입원에 삶 전체가 걸려 있습니다.',
    body: '지금 당장 두 번째 기둥을 세우는 것이 가장 시급한 과제입니다. 일 구조는 괜찮지만 수입 구조가 단일 경로에 집중되어 있어 작은 충격에도 전체가 흔들릴 수 있습니다. 지식 자산화가 두 번째 수입의 출발점입니다.',
    action: '오늘 할 일: 지금 내가 아는 것 중 누군가에게 도움이 될 것 하나를 적어보세요.',
  },
  C: {
    name: '인프라 붕괴형',
    headline: '건강과 관계라는 삶의 인프라가 흔들리고 있습니다.',
    body: '이 두 영역이 무너지면 다른 모든 성취가 의미를 잃습니다. 일이나 수입이 잘 되더라도 건강과 관계가 뒷받침되지 않으면 지속 가능성이 낮습니다. 지금 당장 가장 기본적인 것을 먼저 돌볼 필요가 있습니다.',
    action: '오늘 할 일: 주 3회 30분 걷기, 밤 12시 전 취침 중 하나를 선택해 2주간 실행해보세요.',
  },
  D: {
    name: '공허한 성공형',
    headline: '겉으로 보면 안정적이지만 안에서 공허함이 자랍니다.',
    body: '이제 성취를 넘어 충만으로 이동할 때입니다. 일과 수입 구조는 탄탄하지만 의미 구조가 비어 있습니다. 더 많은 성공이 아니라 더 깊은 의미가 필요한 시점입니다.',
    action: '오늘 할 일: "나는 왜 사는가"에 대한 답을 한 문장으로 적어보세요.',
  },
  E: {
    name: '전환 준비형',
    headline: '왜 살아야 하는지는 알고 있습니다.',
    body: '이제 그 의미를 현실 구조 — 일과 수입 — 로 연결하는 작업이 남아 있습니다. 방향은 맞습니다. 구조만 완성하면 됩니다. 의미 구조가 명확하다는 것은 이미 절반은 온 것입니다.',
    action: '오늘 할 일: 내가 중요하게 생각하는 가치와 연결된 일 한 가지를 이번 주 시작해보세요.',
  },
  F: {
    name: '균형 설계형',
    headline: '5대 영역의 기초 구조가 갖춰진 상태입니다.',
    body: '이제 각 영역의 깊이를 더하고 영역 간 시너지를 설계할 단계입니다. 프리미너 여정의 다음 챕터로 넘어갈 준비가 됐습니다. 지금의 균형을 더 정교하게 다듬으면 삶 전체의 질이 한 단계 올라갑니다.',
    action: '오늘 할 일: 5개 영역 중 가장 낮은 점수의 영역에 이번 달 집중해보세요.',
  },
};

function buildEmailHtml(name, typeCode, typeName, scores, avg) {
  const t = TYPE_MESSAGES[typeCode] || TYPE_MESSAGES['F'];
  const scoreRows = DOMAIN_LABELS.map((label, i) => {
    const score = scores[i] || 0;
    const color = score >= 68 ? '#2D6A5F' : score >= 52 ? '#B8935A' : '#A0856C';
    return `<tr style="border-bottom:1px solid #EBEBEB;">
      <td style="padding:10px 16px;font-size:14px;color:#555558;">${label}</td>
      <td style="padding:10px 16px;font-size:14px;font-weight:600;color:${color};text-align:right;">${score}점</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F3EE;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:32px 16px;">
<tr><td>
<table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;width:100%;background:#FAFAF8;">
  <tr><td style="background:#0D0D0F;padding:28px 40px;">
    <p style="margin:0;font-size:22px;color:#FAFAF8;font-family:Georgia,serif;">프리미너 <em style="color:#B8935A;">FreeMeaner</em></p>
    <p style="margin:6px 0 0;font-size:11px;color:#A0A0A8;letter-spacing:2px;">삶 구조 진단 결과 · LIFE STRUCTURE DIAGNOSIS</p>
  </td></tr>
  <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #EBEBEB;">
    <p style="margin:0 0 6px;font-size:11px;color:#A0A0A8;letter-spacing:2px;">나의 삶 구조 유형</p>
    <p style="margin:0 0 6px;font-size:26px;color:#0D0D0F;font-family:Georgia,serif;">[${typeCode}] ${typeName}</p>
    <p style="margin:0;font-size:14px;color:#B8935A;">전체 평균 ${avg}점</p>
  </td></tr>
  <tr><td style="padding:24px 40px;">
    <p style="margin:0 0 12px;font-size:11px;color:#A0A0A8;letter-spacing:2px;">영역별 점수</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EBEBEB;border-collapse:collapse;">
      ${scoreRows}
    </table>
  </td></tr>
  <tr><td style="padding:0 40px 32px;">
    <div style="border-left:3px solid #B8935A;padding:16px 20px;background:#F6F0E6;">
      <p style="margin:0 0 8px;font-size:11px;color:#B8935A;letter-spacing:2px;">핵심 진단</p>
      <p style="margin:0;font-size:15px;color:#0D0D0F;line-height:1.7;font-family:Georgia,serif;">${t.headline}</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 40px 24px;">
    <p style="margin:0 0 16px;font-size:14px;color:#555558;line-height:1.9;">${name}님,<br><br>${t.body}</p>
  </td></tr>
  <tr><td style="padding:0 40px 32px;">
    <div style="background:#0D0D0F;padding:20px 24px;">
      <p style="margin:0 0 8px;font-size:11px;color:#B8935A;letter-spacing:2px;">오늘의 첫 번째 행동</p>
      <p style="margin:0;font-size:14px;color:#FAFAF8;line-height:1.7;">${t.action}</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:14px;color:#555558;line-height:1.9;">
      삶은 노력이 아닌 구조로 바뀝니다.<br>3년이면 충분합니다.<br><br>
      <em style="color:#B8935A;">프리미너 FreeMeaner · Life Redesign Framework</em>
    </p>
  </td></tr>
  <tr><td style="background:#F5F3EE;padding:28px 40px;text-align:center;border-top:1px solid #EBEBEB;">
    <p style="margin:0 0 16px;font-size:13px;color:#555558;">더 깊은 분석이 필요하신가요?</p>
    <a href="https://juhewow.gumroad.com/l/hsvdwi"
       style="display:inline-block;background:#0D0D0F;color:#FAFAF8;padding:14px 32px;font-size:13px;text-decoration:none;letter-spacing:1px;">
      심층분석보고서 받기 ($7) →
    </a>
    <p style="margin:12px 0 0;font-size:11px;color:#A0A0A8;">22개 문항 기반 맞춤형 보고서 · 48시간 이내 발송</p>
  </td></tr>
  <tr><td style="background:#0D0D0F;padding:20px 40px;">
    <p style="margin:0;font-size:11px;color:#555558;line-height:1.7;">
      © 2025 FreeMeaner · 프리미너. Life Redesign Framework.<br>
      본 이메일은 삶 구조 진단 신청에 의해 발송되었습니다.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

exports.handler = async (event) => {
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
    const { email, name, typeCode, typeName, scores, avg } = JSON.parse(event.body);

    if (!email || !typeCode || !scores) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '필수 데이터 누락' }),
      };
    }

    const displayName = name || '익명';
    const t = TYPE_MESSAGES[typeCode] || TYPE_MESSAGES['F'];

    const plainText = `[프리미너] ${displayName}님의 삶 구조 진단 결과

유형: [${typeCode}] ${typeName}
전체 평균: ${avg}점

영역별 점수:
${DOMAIN_LABELS.map((l, i) => `  ${l}: ${scores[i] || 0}점`).join('\n')}

핵심 진단: ${t.headline}

${t.body}

${t.action}

삶은 노력이 아닌 구조로 바뀝니다. 3년이면 충분합니다.
프리미너 FreeMeaner · Life Redesign Framework`;

    // Brevo SMTP 전송
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,  // a9dd0b001@smtp-brevo.com
        pass: process.env.BREVO_SMTP_PASS,  // xsmtpsib-... 키
      },
    });

    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || '프리미너 FreeMeaner'}" <${process.env.FROM_EMAIL}>`,
      to: `"${displayName}" <${email}>`,
      subject: `[프리미너] ${displayName}님의 삶 구조 진단 결과 — [${typeCode}] ${typeName}`,
      text: plainText,
      html: buildEmailHtml(displayName, typeCode, typeName, scores, avg),
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };

  } catch (err) {
    console.error('send-report error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '처리 중 오류가 발생했습니다.' }),
    };
  }
};
