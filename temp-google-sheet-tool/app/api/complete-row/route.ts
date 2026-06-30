import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { sheetId, sheetName = 'Sheet1', rowIndex, recovery, code } = await request.json();

    if (!sheetId || !rowIndex || !recovery) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số: sheetId, rowIndex hoặc recovery' },
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

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!E${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[recovery]] },
    });

    // Xóa lỗi ở cột H nếu có (khi người dùng làm lại một row từng bị lỗi)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!H${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['']] },
    });


    return NextResponse.json({ success: true, rowIndex, recovery, code });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[complete-row] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
