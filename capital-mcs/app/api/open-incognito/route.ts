import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// Hàm tìm đường dẫn thực thi của Google Chrome trên Windows
function getChromePath(): string | null {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
  ];
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null; // Trả về null nếu không tìm thấy (ví dụ khi chạy trên Vercel)
}

export async function POST(request: NextRequest) {
  try {
    const { url, mailboxUrl, capitalUrl, profile } = await request.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'Thiếu URL' }, { status: 400, headers: corsHeaders });
    }

    const chromePath = getChromePath();
    if (!chromePath) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy Chrome. Chức năng mở tab ẩn danh chỉ hoạt động khi chạy localhost trên máy tính cá nhân.' }, { status: 400, headers: corsHeaders });
    }
    
    // Sử dụng spawn để truyền các đối số (args) dưới dạng mảng
    const args = ['--incognito', '--new-window'];
    if (profile) {
      args.push(`--profile-directory=${profile}`);
    }
    
    // Đẩy tất cả các URL cần mở song song vào mảng đối số
    args.push(url);
    
    if (mailboxUrl) {
      args.push(mailboxUrl);
    }

    if (capitalUrl) {
      args.push(capitalUrl);
    }

    console.log(`[open-incognito] Spawning Chrome with parallel tabs: ${chromePath}`, args);

    const child = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    child.unref(); // Cho phép process cha (Next.js) thoát/chạy độc lập mà không đợi Chrome đóng

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error('[open-incognito] Lỗi spawn chrome mở song song:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
}
