import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

function getWithHttps(url: string, headers: Record<string, string> = {}): Promise<{ statusCode?: number, headers: any, data: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    }).on('error', reject);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ success: false, error: 'Thiếu email' }, { headers: corsHeaders });
  }

  try {
    const emailEncoded = encodeURIComponent(email);
    const initialUrl = `https://sellallmail.com/mailbox/${emailEncoded}`;
    
    // Bước 1: Gọi mailbox email cụ thể bằng https thuần để bắt Set-Cookie (không bị Fetch API block)
    const res1 = await getWithHttps(initialUrl);
    
    const setCookie = res1.headers['set-cookie'] || [];
    const cookiesStr = setCookie.map((c: string) => c.split(';')[0]).join('; ');

    // Bước 2: Tải trang hòm thư chính dùng Session Cookie vừa lấy được
    const res2 = await getWithHttps('https://sellallmail.com/mailbox', {
      'Cookie': cookiesStr,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    if (res2.statusCode === 200) {
      return NextResponse.json({ success: true, html: res2.data }, { headers: corsHeaders });
    }
    
    return NextResponse.json({ success: false, error: `Lỗi fetch hòm thư chính: ${res2.statusCode}` }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Lỗi cào Trangcode server-side:', err);
    return NextResponse.json({ success: false, error: err.message }, { headers: corsHeaders });
  }
}
