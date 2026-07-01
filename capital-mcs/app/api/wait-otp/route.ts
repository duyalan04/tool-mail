import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      sheetId,
      rowIndex,
      otp,
      otpColumn = 'F',
    } = body ?? {};

    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số: otp' },
        { status: 400 }
      );
    }

    if (sheetId && rowIndex) {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

      if (!privateKey || !clientEmail) {
        return NextResponse.json({
          success: true,
          otp,
          warning: 'Lấy được OTP nhưng thiếu biến môi trường để ghi sheet',
        });
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${otpColumn}${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[otp]] },
      });
    }

    return NextResponse.json({
      success: true,
      otp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[wait-otp] error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
