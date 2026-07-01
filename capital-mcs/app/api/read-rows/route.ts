import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { sheetId, sheetName = 'Sheet1', mode = 'default' } = await request.json();

    if (!sheetId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu sheetId' },
        { status: 400 }
      );
    }

    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!privateKey || !clientEmail) {
      return NextResponse.json(
        { success: false, error: 'Thiếu biến môi trường Google Service Account' },
        { status: 500 }
      );
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Đọc cột A đến N, từ hàng 2
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetName}'!A2:N`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = result.data.values ?? [];

    type Row = {
      rowIndex: number;
      name: string;
      date: string;
      email: string;
      password: string;
      recovery: string;
      oldRecovery?: string;
      newPassword?: string;
      newMkCapital?: string;
      mkCapital: string;
      code: string;
      isDone: boolean;
      isPasswordError?: boolean;
    };

    const rows: Row[] = [];

    for (let i = 0; i < values.length; i++) {
      const r = values[i];

      if (mode === 'capital') {
        const email = String(r?.[0] ?? '').trim();
        // Bỏ qua hàng trống
        if (!email) continue;

        const password = String(r?.[1] ?? '').trim();
        const oldRecovery = String(r?.[2] ?? '').trim();
        const mkCapital = String(r?.[3] ?? '').trim();
        
        const newPassword = String(r?.[11] ?? '').trim(); // Cột L: MK Hotmail mới
        const recovery = String(r?.[12] ?? '').trim();    // Cột M: Mail khôi phục mới
        const newMkCapital = String(r?.[13] ?? '').trim(); // Cột N: MK Capital mới

        const isPasswordError = newPassword === 'SAI MẬT KHẨU';

        rows.push({
          rowIndex: i + 2, // hàng 1 là tiêu đề nên +2
          name: 'Capital',
          date: '',
          email,
          password,
          recovery,
          oldRecovery,
          newPassword,
          newMkCapital,
          mkCapital,
          code: '',
          isDone: recovery.length > 0 && !isPasswordError,
          isPasswordError,
        });
      } else {
        const name = String(r?.[0] ?? '').trim();
        const email = String(r?.[2] ?? '').trim();

        // Bỏ qua hàng không có tên và không có email
        if (!name && !email) continue;

        const recovery = String(r?.[4] ?? '').trim();
        const isPasswordError = recovery === 'SAI MẬT KHẨU';

        rows.push({
          rowIndex: i + 2, // hàng 1 là tiêu đề nên +2
          name,
          date: String(r?.[1] ?? '').trim(),
          email,
          password: String(r?.[3] ?? '').trim(),
          recovery,
          mkCapital: String(r?.[5] ?? '').trim(),
          code: String(r?.[6] ?? '').trim(),
          isDone: recovery.length > 0 && !isPasswordError,
          isPasswordError,
        });
      }
    }

    return NextResponse.json({ success: true, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[read-rows] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
