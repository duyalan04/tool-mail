import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET(req: any) {
  const email = req.nextUrl.searchParams.get('email');
  const url = `https://api.internal.temp-mail.io/api/v3/email/${email}/messages?_t=${Date.now()}`;
  const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://temp-mail.io',
    Referer: 'https://temp-mail.io/',
  };
  const res = await fetch(url, { headers: COMMON_HEADERS, cache: 'no-store' });
  const text = await res.text();
  return NextResponse.json({ status: res.status, url, text });
}
