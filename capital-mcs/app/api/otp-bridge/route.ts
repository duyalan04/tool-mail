import { NextRequest, NextResponse } from 'next/server';

// Global in-memory cache for OTPs
// Key: email (lowercase), Value: { otp, timestamp }
// Bằng cách lưu ở global, dữ liệu sẽ chia sẻ được giữa các request trong quá trình dev
const globalForOtp = global as unknown as {
  otpCache?: Map<string, { otp: string; timestamp: number }>;
};

if (!globalForOtp.otpCache) {
  globalForOtp.otpCache = new Map();
}

const otpCache = globalForOtp.otpCache;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) {
      return NextResponse.json({ success: false, error: 'Thiếu email hoặc otp' }, { status: 400, headers: corsHeaders });
    }

    const key = String(email).trim().toLowerCase();
    otpCache.set(key, { otp: String(otp).trim(), timestamp: Date.now() });
    console.log(`[otp-bridge] Nhận OTP mới cho ${key}: ${otp}`);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    const otp = request.nextUrl.searchParams.get('otp'); // Đọc tham số otp nếu có
    
    if (!email) {
      return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 400, headers: corsHeaders });
    }

    const key = email.trim().toLowerCase();

    // NẾU CÓ THAM SỐ OTP TRONG QUERY: Ghi nhận OTP (Image Beacon / GET fallback)
    if (otp) {
      otpCache.set(key, { otp: String(otp).trim(), timestamp: Date.now() });
      console.log(`[otp-bridge-GET] Ghi nhận OTP mới qua GET/Beacon cho ${key}: ${otp}`);
      
      // Trả về ảnh 1x1 GIF trong suốt
      const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'image/gif',
          'Content-Length': buf.length.toString(),
          ...corsHeaders
        }
      });
    }

    // NẾU CHỈ CÓ EMAIL: Truy vấn OTP
    const entry = otpCache.get(key);
    if (!entry) {
      return NextResponse.json({ success: true, otp: null }, { headers: corsHeaders });
    }

    // OTP hết hạn sau 10 phút
    if (Date.now() - entry.timestamp > 10 * 60 * 1000) {
      otpCache.delete(key);
      return NextResponse.json({ success: true, otp: null }, { headers: corsHeaders });
    }

    return NextResponse.json({ success: true, otp: entry.otp }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
}
