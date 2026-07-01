import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

const FVIA_DOMAINS_API = 'https://fviainboxes.com/domains';

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://fviainboxes.com',
  Referer: 'https://fviainboxes.com/',
};

const FVIA_DOMAINS = [
  'fviainboxes.com',
  'fviadropinbox.com',
  'fviamail.work',
  'dropinboxes.com',
];

const INBOXES_DOMAINS = [
  'blondmail.com', 'chapsmail.com', 'clowmail.com', 'dropjar.com',
  'fivermail.com', 'getairmail.com', 'getmule.com', 'getnada.com',
  'gimpmail.com', 'givmail.com', 'guysmail.com', 'inboxbear.com',
  'replyloop.com', 'robot-mail.com', 'tafmail.com', 'temptami.com',
  'tupmail.com', 'vomoto.com', 'smvmail.com'
];

async function pickDomain(preferred?: string, provider?: string): Promise<string> {
  const allDomains = [...FVIA_DOMAINS, ...INBOXES_DOMAINS];

  if (preferred && preferred !== 'random' && preferred !== 'Ngẫu nhiên (Tự động)' && allDomains.includes(preferred)) {
    return preferred;
  }

  if (provider === 'fvia') {
    return FVIA_DOMAINS[Math.floor(Math.random() * FVIA_DOMAINS.length)];
  } else if (provider === 'inboxes') {
    return INBOXES_DOMAINS[Math.floor(Math.random() * INBOXES_DOMAINS.length)];
  }

  const randomIndex = Math.floor(Math.random() * allDomains.length);
  return allDomains[randomIndex];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sheetId, rowIndex, name, domain: preferredDomain, provider } = body ?? {};

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số: name' },
        { status: 400 }
      );
    }

    const domain = await pickDomain(preferredDomain, provider);
    // fviainboxes.com là hệ thống catch-all, không cần gọi API tạo email.
    // Chỉ cần bịa ra username kết hợp với domain là thành email có thể nhận thư.
    const email = `${name}@${domain}`;
    const token = ''; // Không cần token bảo mật nữa

    // Nếu có thông tin sheet thì ghi email vào cột E
    if (sheetId && rowIndex) {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

      if (!privateKey || !clientEmail) {
        return NextResponse.json(
          {
            success: false,
            error: 'Thiếu biến môi trường Google Service Account',
            email,
            token,
            domain,
          },
          { status: 500 }
        );
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `E${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[email]] },
      });
    }

    return NextResponse.json({
      success: true,
      email,
      token,
      domain,
      createdAtMs: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-email] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

