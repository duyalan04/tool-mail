import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sheetId, rowIndex, emailTao } = await request.json();

    if (!sheetId || !rowIndex || !emailTao) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số' },
        { status: 400 }
      );
    }

    // Xử lý private key
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Thiếu biến môi trường' },
        { status: 500 }
      );
    }

    // Tạo auth
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Ghi vào cột E
    const range = `E${rowIndex}`;

    const result = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[emailTao]]
      }
    });

    console.log('Update result:', result.data);

    return NextResponse.json({
      success: true,
      message: `Đã ghi "${emailTao}" vào hàng ${rowIndex}, cột E!`,
      data: result.data
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    const details = error instanceof Error ? error.toString() : String(error);

    console.error('Lỗi chi tiết:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: message,
        details
      },
      { status: 500 }
    );
  }
}
