'use client';

import { useCallback, useEffect, useState } from 'react';

export type SheetRow = {
  rowIndex: number;
  name: string;
  date: string;
  email: string;
  password: string;
  recovery: string;
  mkCapital: string;
  code: string;
  status?: string;
  isDone: boolean;
};

export function extractSheetId(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : url.trim();
}

export function useSheet(initialSheetId: string, sheetName = 'Sheet1') {
  const [sheetId, setSheetId] = useState(initialSheetId);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRows = useCallback(async () => {
    if (!sheetId) {
      setError('Vui lòng nhập sheetId');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/read-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId, sheetName }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Không đọc được sheet');
        setRows([]);
      } else {
        setRows(data.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sheetId, sheetName]);

  useEffect(() => {
    if (sheetId) void fetchRows();
  }, [sheetId, fetchRows]);

  const patchRow = useCallback((rowIndex: number, patch: Partial<SheetRow>) => {
    setRows(prev =>
      prev.map(r => (r.rowIndex === rowIndex ? { ...r, ...patch } : r))
    );
  }, []);

  return { sheetId, setSheetId, rows, loading, error, fetchRows, patchRow };
}
