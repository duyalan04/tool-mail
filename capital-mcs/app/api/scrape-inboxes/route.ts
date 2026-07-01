import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  const domain = email.split('@')[1]?.toLowerCase() || '';
  const isSmv = domain === 'smvmail.com';

  try {
    if (isSmv) {
      // 1. CÀO QUA ENDPOINT API CHÍNH XÁC CỦA SMVMAIL.COM
      // Endpoint: https://smvmail.com/api/email?page=1&q=&email={email}
      const url = `https://smvmail.com/api/email?page=1&q=&email=${encodeURIComponent(email)}&_t=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        next: { revalidate: 0 } // Ngăn chặn Next.js cache dữ liệu cũ
      });

      if (!res.ok) {
        return NextResponse.json({ success: true, otp: null, message: `SMVmail API returned status ${res.status}` });
      }

      const json = await res.json();
      // data.docs hoặc data.data.docs tùy cấu trúc trả về
      const docs = json.data?.docs || json.data?.data?.docs || json.docs || [];
      let foundOtp: string | null = null;

      for (const doc of docs) {
        const subject = (doc.subject || '').toLowerCase();
        const text = doc.text || '';
        
        // Kiểm tra thư gửi từ Microsoft
        if (subject.includes('microsoft') || text.toLowerCase().includes('microsoft')) {
          const otpMatches = text.match(/\b\d{6}\b/);
          if (otpMatches) {
            foundOtp = otpMatches[0];
            break;
          }
        }
      }

      return NextResponse.json({ success: true, otp: foundOtp });

    } else {
      // 2. CÀO QUA API CỦA INBOXES.COM CHO CÁC ĐUÔI KHÁC (FIVERMAIL, FVIA...)
      const listUrl = `https://inboxes.com/api/v2/inbox/${encodeURIComponent(email)}?_t=${Date.now()}`;
      const res = await fetch(listUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 0 }
      });

      if (!res.ok) {
        return NextResponse.json({ success: true, otp: null, message: `Inboxes API returned status ${res.status}` });
      }

      const data = await res.json();
      const messages = data.msgs || [];
      let foundOtp: string | null = null;

      for (const msg of messages) {
        if (!msg.f.toLowerCase().includes('microsoft')) continue;

        const bodyUrl = `https://inboxes.com/api/v2/message/${encodeURIComponent(msg.uid)}`;
        const bodyRes = await fetch(bodyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          next: { revalidate: 0 }
        });

        if (bodyRes.ok) {
          const bodyData = await bodyRes.json();
          const bodyText = bodyData.html || bodyData.text || '';
          const otpMatches = bodyText.match(/\b\d{6}\b/);
          if (otpMatches) {
            foundOtp = otpMatches[0];
            break;
          }
        }
      }

      return NextResponse.json({ success: true, otp: foundOtp });
    }
  } catch (error: any) {
    console.error('[Backend Scraper] Lỗi cào thư:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
