import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const maxDuration = 30;

const MICROSOFT_OTP_REGEX = /(?:Security code|M[ãa]\s*b[ảaáo]o?\s*m[ậa]t|Mã bảo mật):\s*(\d{6})/i;
const GENERIC_6_DIGIT_REGEX = /\b(\d{6})\b/;

function extractOtp(rawText: string): string | null {
  let html = rawText;
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'string') html = parsed;
  } catch (e) { }

  const cleanText = html.replace(/<[^>]*>/g, '').normalize("NFC");

  const m = cleanText.match(MICROSOFT_OTP_REGEX);
  if (m) return m[1];

  const m2 = cleanText.match(GENERIC_6_DIGIT_REGEX);
  return m2?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, domain, provider, fviaToken } = body;

    if (!username || !domain) {
      return NextResponse.json(
        { success: false, error: 'Thiếu username hoặc domain' },
        { status: 400 }
      );
    }

    if (provider === 'fvia') {
      const listUrl = `https://fviainboxes.com/messages?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&_t=${Date.now()}`;
      
      const commonHeaders = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://fviainboxes.com',
        'Referer': 'https://fviainboxes.com/',
        'Authorization': fviaToken ? `Bearer ${fviaToken}` : '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      };

      const res = await axios.get(listUrl, { headers: commonHeaders, validateStatus: () => true });

      if (res.status !== 200) {
        return NextResponse.json({
          success: false, 
          error: `Lỗi fetch danh sách thư: ${res.status} ${res.statusText}`,
          status: res.status
        });
      }

      const messages = res.data.result || [];

      let foundOtp = null;

      for (const msg of messages) {
        const fromLower = msg.from.toLowerCase();
        if (!fromLower.includes('microsoft')) continue;

        const bodyUrl = `https://fviainboxes.com/message?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(msg.id)}`;
        const bodyRes = await axios.get(bodyUrl, { headers: commonHeaders, validateStatus: () => true });

        if (bodyRes.status === 200) {
          const bodyText = typeof bodyRes.data === 'string' ? bodyRes.data : JSON.stringify(bodyRes.data);
          const code = extractOtp(bodyText);
          if (code) {
            foundOtp = code;
            break;
          }
        }
      }

      if (foundOtp) {
        return NextResponse.json({ success: true, otp: foundOtp });
      }

      return NextResponse.json({ success: true, otp: null, message: "Chưa thấy thư chứa OTP" });
    }

    if (provider === 'inboxes') {
      const email = `${username}@${domain}`;
      const listUrl = `https://inboxes.com/api/v2/inbox/${encodeURIComponent(email)}`;
      
      const commonHeaders = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      };

      const res = await axios.get(listUrl, { headers: commonHeaders, validateStatus: () => true });

      if (res.status !== 200) {
        return NextResponse.json({
          success: false, 
          error: `Lỗi fetch danh sách thư inboxes.com: ${res.status} ${res.statusText}`,
          status: res.status
        });
      }

      const messages = res.data.msgs || [];

      let foundOtp = null;

      for (const msg of messages) {
        const fromLower = (msg.f || '').toLowerCase();
        if (!fromLower.includes('microsoft')) continue;

        const bodyUrl = `https://inboxes.com/api/v2/message/${encodeURIComponent(msg.uid)}`;
        const bodyRes = await axios.get(bodyUrl, { headers: commonHeaders, validateStatus: () => true });

        if (bodyRes.status === 200) {
          const bodyData = bodyRes.data;
          const bodyText = bodyData.html || bodyData.text || '';
          const code = extractOtp(bodyText);
          if (code) {
            foundOtp = code;
            break;
          }
        }
      }

      if (foundOtp) {
        return NextResponse.json({ success: true, otp: foundOtp });
      }

      return NextResponse.json({ success: true, otp: null, message: "Chưa thấy thư chứa OTP trên inboxes.com" });
    }

    return NextResponse.json({
      success: false,
      error: `Provider ${provider} chưa được hỗ trợ lấy OTP qua API server.`,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[read-email] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
