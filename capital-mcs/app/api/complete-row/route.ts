import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { sheetId, sheetName = 'Sheet1', rowIndex, recovery, code, mode = 'default', newMkHotmail = '', newMkCapital = '', email = '' } = await request.json();

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

    if (mode === 'capital') {
      // Ghi 4 cột bắt đầu từ cột K: K (Email Hotmail), L (MK Hotmail mới), M (Mail khôi phục mới), N (MK Capital mới)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${sheetName}'!K${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { 
          values: [[email, newMkHotmail, recovery, newMkCapital]] 
        },
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${sheetName}'!E${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[recovery]] },
      });
    }


    return NextResponse.json({ success: true, rowIndex, recovery, code });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[complete-row] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
