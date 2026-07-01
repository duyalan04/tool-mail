import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { sheetId } = await request.json();

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

    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets/properties/title',
    });

    const sheetNames = (response.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((title): title is string => typeof title === 'string');

    return NextResponse.json({ success: true, sheetNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[get-sheets] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
