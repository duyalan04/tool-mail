import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://fviainboxes.com',
  Referer: 'https://fviainboxes.com/',
};

type FviaMessage = {
  id: string;
  from: string;
  subject: string;
  createdAt: number;
};

const MICROSOFT_OTP_REGEX = /(?:Security code|M[ãa]\s*b[ảaáo]o?\s*m[ậa]t|Mã bảo mật):\s*(\d{6})/i;
const GENERIC_6_DIGIT_REGEX = /\b(\d{6})\b/;

function extractOtp(rawText: string): string | null {
  let html = rawText;
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'string') html = parsed;
  } catch (e) { }

  // Loại bỏ toàn bộ thẻ HTML và chuẩn hóa Unicode (giải quyết lỗi font NFD của Microsoft)
  const cleanText = html.replace(/<[^>]*>/g, '').normalize("NFC");

  const m = cleanText.match(MICROSOFT_OTP_REGEX);
  if (m) return m[1];

  const m2 = cleanText.match(GENERIC_6_DIGIT_REGEX);
  return m2?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const {
      sheetId,
      rowIndex,
      email,
      sinceMs,
      timeoutMs = 50_000,
      pollMs = 1_000,
      filterMicrosoftOnly = true,
      otpColumn = 'F',
      fviaToken,
    } = body ?? {};

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số: email' },
        { status: 400 }
      );
    }
    
    // Tạo headers động dựa vào fviaToken
    const requestHeaders: Record<string, string> = { ...COMMON_HEADERS };
    if (fviaToken) {
      requestHeaders['Authorization'] = `Bearer ${fviaToken}`;
    }

    const [username, domain] = email.split('@');
    if (!username || !domain) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    // Vercel Hobby plan giới hạn 10s timeout cho function. 
    // Do đó, giới hạn vòng lặp trên server tối đa là 8s để trả về kịp thời.
    const deadline = Date.now() + Math.min(timeoutMs, 8_000);
    const poll = Math.max(1000, Number(pollMs) || 3000);

    let otp: string | null = null;
    let matchedMessage: FviaMessage | null = null;

    while (Date.now() < deadline) {
      const listUrl = `https://fviainboxes.com/messages?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&_t=${Date.now()}`;
      const res = await fetch(listUrl, { headers: requestHeaders, cache: 'no-store' });

      if (res.ok) {
        const data = (await res.json()) as { result?: FviaMessage[] };
        const messages = data.result || [];

        for (const msg of messages) {
          if (filterMicrosoftOnly) {
            const fromLower = msg.from.toLowerCase();
            if (!fromLower.includes('microsoft')) {
              continue;
            }
          }

          // Gọi API để lấy nội dung HTML của bức thư
          const bodyUrl = `https://fviainboxes.com/message?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(msg.id)}`;
          const bodyRes = await fetch(bodyUrl, { headers: requestHeaders, cache: 'no-store' });

          if (bodyRes.ok) {
            const bodyText = await bodyRes.text();
            const code = extractOtp(bodyText);
            if (code) {
              otp = code;
              matchedMessage = msg;
              break;
            }
          }
        }
        if (otp) break;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise((r) => setTimeout(r, Math.min(poll, remaining)));
    }

    if (!otp) {
      return NextResponse.json(
        {
          success: false,
          error: `Không nhận được OTP cho ${email} trong ${Math.round(
            (Date.now() - startedAt) / 1000
          )}s`,
        },
        { status: 408 }
      );
    }

    if (sheetId && rowIndex) {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

      if (!privateKey || !clientEmail) {
        return NextResponse.json({
          success: true,
          otp,
          warning: 'Lấy được OTP nhưng thiếu biến môi trường để ghi sheet',
          from: matchedMessage?.from,
          subject: matchedMessage?.subject,
        });
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${otpColumn}${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[otp]] },
      });
    }

    return NextResponse.json({
      success: true,
      otp,
      from: matchedMessage?.from,
      subject: matchedMessage?.subject,
      createdAt: matchedMessage?.createdAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[wait-otp] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
