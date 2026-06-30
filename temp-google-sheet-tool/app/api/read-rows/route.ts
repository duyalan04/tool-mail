import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { sheetId, sheetName = 'Sheet1' } = await request.json();

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

    // Đọc cột A đến H, từ hàng 2
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A2:H`,
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
      mkCapital: string;
      code: string;
      status: string;
      isDone: boolean;
    };

    const rows: Row[] = [];

    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const name = String(r?.[0] ?? '').trim();
      const email = String(r?.[2] ?? '').trim();

      // Bỏ qua hàng không có tên và không có email
      if (!name && !email) continue;

      const recovery = String(r?.[4] ?? '').trim();
      const status = String(r?.[7] ?? '').trim();

      rows.push({
        rowIndex: i + 2, // hàng 1 là tiêu đề nên +2
        name,
        date: String(r?.[1] ?? '').trim(),
        email,
        password: String(r?.[3] ?? '').trim(),
        recovery,
        mkCapital: String(r?.[5] ?? '').trim(),
        code: String(r?.[6] ?? '').trim(),
        status,
        isDone: recovery.length > 0 || status.length > 0,
      });
    }

    return NextResponse.json({ success: true, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[read-rows] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
