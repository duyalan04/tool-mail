'use client';

import React from 'react';

type Props = {
  uniqueNames: string[];
  selectedName: string;
  statusFilter: 'all' | 'done' | 'not-done';
  searchText: string;
  totalCount: number;
  shownCount: number;
  doneCount: number;
  notDoneCount: number;
  onChangeName: (v: string) => void;
  onChangeStatus: (v: 'all' | 'done' | 'not-done') => void;
  onChangeSearch: (v: string) => void;
};

export function FilterBar({
  uniqueNames,
  selectedName,
  statusFilter,
  searchText,
  totalCount,
  shownCount,
  doneCount,
  notDoneCount,
  onChangeName,
  onChangeStatus,
  onChangeSearch,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Lọc theo người:</label>
          <select
            value={selectedName}
            onChange={(e) => onChangeName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="" disabled>-- Chọn người cần xem --</option>
            {uniqueNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">📌 Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={(e) => onChangeStatus(e.target.value as 'all' | 'done' | 'not-done')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Tất cả</option>
            <option value="not-done">⏳ Đang làm</option>
            <option value="done">✅ Đã làm</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">🔎 Tìm kiếm:</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder="Tìm theo email, tên..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex items-end">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 rounded-lg w-full text-sm">
            <div>📋 Hiển thị: <b>{shownCount}</b> / {totalCount}</div>
            <div>
              ✅ <b className="text-green-600">{doneCount}</b>{' '}
              ⏳ <b className="text-orange-600">{notDoneCount}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
