import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { sheetId, sheetName = 'Sheet1', rowIndex, errorMsg = 'LỖI MẬT KHẨU' } = await request.json();

    if (!sheetId || !rowIndex) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số: sheetId hoặc rowIndex' },
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
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Cột H là cột lưu trạng thái / lỗi
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!H${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[errorMsg]] },
    });

    return NextResponse.json({ success: true, rowIndex, errorMsg });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[error-row] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
