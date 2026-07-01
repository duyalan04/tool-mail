import { NextRequest, NextResponse } from 'next/server';

// Global variable for current active account
const globalForAccount = global as unknown as {
  currentAccount?: {
    email: string;
    password: string;
    newPassword?: string;
    newRecovery?: string;
    oldRecovery?: string;
    mkCapital?: string;
    newMkCapital?: string;
    sheetId?: string;
    sheetName?: string;
    rowIndex?: number;
    mode?: string;
    timestamp: number;
  };
};

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
    const { email, password, newPassword, newRecovery, oldRecovery, mkCapital, newMkCapital, sheetId, sheetName, rowIndex, mode } = await request.json();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 400, headers: corsHeaders });
    }

    globalForAccount.currentAccount = {
      email: String(email).trim(),
      password: password ? String(password).trim() : '',
      newPassword: newPassword ? String(newPassword).trim() : '',
      newRecovery: newRecovery ? String(newRecovery).trim() : '',
      oldRecovery: oldRecovery ? String(oldRecovery).trim() : '',
      mkCapital: mkCapital ? String(mkCapital).trim() : '',
      newMkCapital: newMkCapital ? String(newMkCapital).trim() : '',
      sheetId,
      sheetName,
      rowIndex,
      mode,
      timestamp: Date.now()
    };
    
    console.log(`[current-account] Đặt tài khoản hiện tại (kèm Capital info): ${email}`);
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(request: NextRequest) {
  try {
    const account = globalForAccount.currentAccount;
    if (!account) {
      return NextResponse.json({ success: true, account: null }, { headers: corsHeaders });
    }

    // Thời gian hết hạn là 5 phút
    if (Date.now() - account.timestamp > 5 * 60 * 1000) {
      globalForAccount.currentAccount = undefined;
      return NextResponse.json({ success: true, account: null }, { headers: corsHeaders });
    }

    return NextResponse.json({ success: true, account }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE() {
  globalForAccount.currentAccount = undefined;
  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
