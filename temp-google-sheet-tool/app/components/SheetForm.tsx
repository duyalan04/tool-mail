'use client';

import React, { useState } from 'react';
import { extractSheetId } from '../hooks/useSheet';

type Props = {
  currentSheetId: string;
  onSubmit: (sheetId: string) => void;
};

export function SheetForm({ currentSheetId, onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractSheetId(url);
    if (!id) {
      setErr('Link Google Sheet không hợp lệ');
      return;
    }
    setErr('');
    onSubmit(id);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Link Google Sheet:
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Xác nhận
            </button>
          </div>
        </div>
        {currentSheetId && (
          <div className="text-sm text-green-600">✅ Sheet ID: {currentSheetId}</div>
        )}
        {err && <div className="text-sm text-red-600">{err}</div>}
      </form>
    </div>
  );
}
