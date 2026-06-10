import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing GOOGLE_SHEETS_WEBHOOK_URL environment variable' },
        { status: 500 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: 'Google Sheets webhook returned an error', details: text },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to forward data to Google Sheets',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
