'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { SheetRow } from '../hooks/useSheet';

declare global {
  interface Window {
    GM_fetch?: (url: string, options?: any) => Promise<any>;
  }
}

const MICROSOFT_OTP_REGEX = /(?:Security code|M[ãa]\s*b[ảaáo]o?\s*m[ậa]t|Mã bảo mật):\s*(\d{6})/i;
const GENERIC_6_DIGIT_REGEX = /\b(\d{6})\b/;

function extractOtp(rawText: string): string | null {
  let html = rawText;
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'string') html = parsed;
  } catch (e) { }

  const cleanText = html.replace(/<[^>]*>/g, '').normalize("NFC");

  const m = cleanText.match(MICROSOFT_OTP_REGEX);
  if (m) return m[1];

  const m2 = cleanText.match(GENERIC_6_DIGIT_REGEX);
  return m2?.[1] ?? null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

function extractLatestOtpFromHtml(html: string): string | null {
  const plainText = stripHtml(html);
  
  // Cắt văn bản theo tiêu đề mỗi khối thư
  const blocks = plainText.split(/CHI TIẾT THƯ Click Chuột Ở ĐÂY/i);
  let newestOtp: string | null = null;
  let minSeconds = Infinity;
  
  for (let i = 1; i < blocks.length; i++) {
    const blockText = blocks[i];
    
    // Quét tìm các số 6 chữ số
    const matches = blockText.match(/\b\d{6}\b/g);
    if (!matches) continue;
    
    const blockOtp = matches[matches.length - 1]; // Lấy mã số cuối cùng trong khối (OTP)
    
    // Tính toán thời gian thực tế của thư
    let seconds = 9999999;
    const secMatch = blockText.match(/(\d+)\s*giây/i);
    const minMatch = blockText.match(/(\d+)\s*phút/i);
    const hourMatch = blockText.match(/(\d+)\s*giờ/i);
    const dayMatch = blockText.match(/(\d+)\s*ngày/i);
    
    if (secMatch) {
      seconds = parseInt(secMatch[1], 10);
    } else if (minMatch) {
      seconds = parseInt(minMatch[1], 10) * 60;
    } else if (hourMatch) {
      seconds = parseInt(hourMatch[1], 10) * 3600;
    } else if (dayMatch) {
      seconds = parseInt(dayMatch[1], 10) * 86400;
    }
    
    if (seconds < minSeconds) {
      minSeconds = seconds;
      newestOtp = blockOtp;
    }
  }
  
  return newestOtp;
}

function triggerTampermonkeyScrape(email: string): Promise<string | null> {
  return new Promise((resolve) => {
    const handler = (e: any) => {
      if (e.detail && e.detail.email === email) {
        document.removeEventListener('SCRAPE_TRANGCODE_RESPONSE', handler);
        resolve(e.detail.html);
      }
    };
    document.addEventListener('SCRAPE_TRANGCODE_RESPONSE', handler);
    document.dispatchEvent(new CustomEvent('SCRAPE_TRANGCODE_REQUEST', { detail: { email } }));
    
    // Timeout 3.5 giây nếu không có Tampermonkey phản hồi thì resolve null để fallback gọi API route Next.js
    setTimeout(() => {
      document.removeEventListener('SCRAPE_TRANGCODE_RESPONSE', handler);
      resolve(null);
    }, 3500);
  });
}

type Props = {
  row: SheetRow;
  index: number;
  sheetId: string;
  sheetName: string;
  onUpdated: (rowIndex: number, updates: any) => void;
  fviaToken?: string;
  preferredDomain?: string;
  mailProvider: 'fvia' | 'inboxes';
  mode?: 'default' | 'capital';
  activeEmail?: string;
  onActive?: (email: string) => void;
};

function CopyField({ label, value, color = 'blue', noMargin = false }: { label: string; value: string; color?: 'blue' | 'green' | 'purple' | 'gray'; noMargin?: boolean }) {
  const [copied, setCopied] = useState(false);
  const colorClass: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-700 bg-green-100 border-green-200 hover:bg-green-200',
    purple: 'text-purple-700 bg-purple-100 border-purple-200 hover:bg-purple-200',
    gray: 'text-gray-900',
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  };
  if (!value) return null;
  return (
    <div className={noMargin ? "" : "mb-3"}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div
        onClick={copy}
        className={`flex items-center justify-between bg-white rounded p-2 border border-gray-200 cursor-pointer transition-colors ${colorClass[color] ?? colorClass.blue}`}
        title="Click để copy"
      >
        <span className="text-sm font-medium truncate">{value}</span>
        <span className="ml-2 text-xs flex-shrink-0">{copied ? '✅' : '📋'}</span>
      </div>
    </div>
  );
}

export function RowCard({ row, index, sheetId, sheetName, onUpdated, fviaToken, preferredDomain, mailProvider, mode = 'default', activeEmail, onActive }: Props) {
  const [isCreatingMail, setIsCreatingMail] = useState(false);
  const [generated, setGenerated] = useState<string>(row.recovery);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [otp, setOtp] = useState<string>('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [err, setErr] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [newMkCapital, setNewMkCapital] = useState('');
  const [oldOtp, setOldOtp] = useState('');
  const [loadingMarkError, setLoadingMarkError] = useState(false);

  const handleMarkPasswordError = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn báo lỗi dòng #${row.rowIndex} (${row.email}) và tô đỏ trên Google Sheet không?`)) {
      return;
    }
    setLoadingMarkError(true);
    setErr('');
    try {
      const res = await fetch('/api/mark-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId,
          sheetName,
          rowIndex: row.rowIndex,
          mode,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi báo lỗi');
      
      onUpdated(row.rowIndex, { isPasswordError: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMarkError(false);
    }
  };

  const generateRandomPassword = () => {
    // Chỉ tạo chữ và số dài 10 ký tự, sau đó thêm A! ở dưới
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const isDone = row.isDone;

  const pollingRef = useRef(false);
  const latestTokenRef = useRef(fviaToken);

  useEffect(() => {
    latestTokenRef.current = fviaToken;
  }, [fviaToken]);

  useEffect(() => {
    if (row.newPassword) setNewPassword(row.newPassword);
    if (row.newMkCapital) setNewMkCapital(row.newMkCapital);
  }, [row.newPassword, row.newMkCapital]);

  // Polling để lấy OTP đăng nhập gửi về hòm thư cũ
  useEffect(() => {
    if (isDone || mode !== 'capital' || !row.oldRecovery || activeEmail !== row.email) return;

    let active = true;
    const parts = row.oldRecovery.split('@');
    const username = parts[0] || '';
    const domain = parts[1] || '';
    
    const fviaDomains = ['fviainboxes.com', 'fviadropinbox.com', 'fviamail.work', 'dropinboxes.com'];
    const inboxesDomains = ['inboxes.com', 'dropjar.com', 'kapsule.info', 'getinbox.work', 'fivermail.com', 'smvmail.com'];
    
    const isFvia = fviaDomains.includes(domain);
    const isInboxes = inboxesDomains.includes(domain);

    const poll = async () => {
      try {
        let foundOtp = null;

        if (isFvia || isInboxes) {
          // TOOL TỰ CÀO OTP CHO CÁC DOMAIN INBOXES/FVIA CŨ BẰNG API TỪ CỬA SỔ THƯỜNG
          if (isFvia && username && domain) {
            if (window.GM_fetch) {
              const listUrl = `https://fviainboxes.com/messages?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&_t=${Date.now()}`;
              const res = await window.GM_fetch(listUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json, text/plain, */*',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Authorization': fviaToken ? `Bearer ${fviaToken}` : ''
                }
              });
              if (res.ok) {
                const data = await res.json();
                const messages = data.result || [];
                for (const msg of messages) {
                  if (msg.from.toLowerCase().includes('microsoft')) {
                    const bodyUrl = `https://fviainboxes.com/message?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(msg.id)}`;
                    const bodyRes = await window.GM_fetch(bodyUrl, {
                      method: 'GET',
                      headers: { 'Authorization': fviaToken ? `Bearer ${fviaToken}` : '' }
                    });
                    if (bodyRes.ok) {
                      const bodyText = await bodyRes.text();
                      const code = extractOtp(bodyText);
                      if (code) {
                        foundOtp = code;
                        break;
                      }
                    }
                  }
                }
              }
            }
          } else if (isInboxes && row.oldRecovery) {
            try {
              const res = await fetch(`/api/scrape-inboxes?email=${encodeURIComponent(row.oldRecovery)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.otp) {
                  foundOtp = data.otp;
                }
              }
            } catch (e) {
              console.error('Lỗi cào email cũ qua backend:', e);
            }
          }

          // Khi cào được OTP bằng API, POST lên bridge để tab ẩn danh đọc được
          if (foundOtp) {
            setOldOtp(foundOtp);
            try {
              await fetch('/api/otp-bridge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: row.oldRecovery, otp: foundOtp })
              });
            } catch (postErr) {
              console.error('Lỗi POST OTP cũ lên bridge:', postErr);
            }
          }
        } else {
          // VỚI MAIL TRANGCODE: Chỉ cần đọc từ API bridge (vì Script 2 chạy trên tab ẩn danh hòm thư phụ sẽ tự động cào và đẩy lên bridge)
          if (row.oldRecovery) {
            try {
              const res = await fetch(`/api/otp-bridge?email=${encodeURIComponent(row.oldRecovery)}&_t=${Date.now()}`);
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.otp) {
                  foundOtp = data.otp;
                }
              }
            } catch (err) {
              console.error('Lỗi đọc OTP Trangcode từ bridge:', err);
            }
          }
        }

        // Đồng bộ OTP lên API bridge để tab ẩn danh Microsoft tự đọc và tự điền
        if (foundOtp) {
          setOldOtp(foundOtp);
          try {
            await fetch('/api/otp-bridge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: row.oldRecovery, otp: foundOtp })
            });
          } catch (postErr) {
            console.error('Lỗi POST OTP Trangcode lên bridge:', postErr);
          }
        }
      } catch (e) {
        console.error('Lỗi khi poll OTP cũ:', e);
      }
    };

    const timer = setInterval(() => {
      if (active) void poll();
    }, 7000); // 7s check 1 lần để tránh Rate Limit 429 của Trangcode

    void poll();

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isDone, mode, row.oldRecovery, fviaToken, activeEmail, row.email]);

  const handleCreate = async () => {
    setLoadingCreate(true);
    setErr('');
    try {
      const baseName = row.email.split('@')[0] || 'user';
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const name = `${baseName}${rnd}`;
      const res = await fetch('/api/create-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain: preferredDomain && preferredDomain !== 'Ngẫu nhiên (Tự động)' ? preferredDomain : undefined,
          provider: mailProvider,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Không tạo được email');
      setGenerated(data.email);
      setCreatedAt(Date.now());
      
      const updates: any = { recovery: data.email };
      if (mode === 'capital') {
        const generatedPass = generateRandomPassword(); // Hotmail mới (không có A!)
        const generatedCap = generatedPass + 'A!';     // Capital mới (bằng MK Hotmail + 'A!')
        setNewPassword(generatedPass);
        setNewMkCapital(generatedCap);
        updates.newPassword = generatedPass;
        updates.newMkCapital = generatedCap;
      }
      onUpdated(row.rowIndex, updates);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleGetOtp = async () => {
    if (!generated) return;
    if (pollingRef.current) return;

    setLoadingOtp(true);
    setErr('');
    pollingRef.current = true;

    const maxWaitTime = 10 * 60 * 1000; // Đợi tối đa 10 phút
    const startTime = Date.now();

    const [username, domain] = generated.split('@');
    if (!username || !domain) {
      setErr('Email lấy thư bị lỗi định dạng.');
      setLoadingOtp(false);
      return;
    }

    const fviaDomains = ['fviainboxes.com', 'fviadropinbox.com', 'fviamail.work', 'dropinboxes.com'];
    const isFvia = fviaDomains.includes(domain);

    while (pollingRef.current && (Date.now() - startTime < maxWaitTime)) {
      let currentWaitMs = isFvia ? 2000 : 4000; // Mặc định 2s cho Fvia, 4s cho Inboxes
      try {
        let foundOtp: string | null = null;
        let isAuthError = false;

        if (isFvia) {
          if (!window.GM_fetch) {
            throw new Error('Chưa cài đặt Tampermonkey Proxy Script! Không tìm thấy window.GM_fetch.');
          }

          const listUrl = `https://fviainboxes.com/messages?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&_t=${Date.now()}`;
          const res = await window.GM_fetch(listUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Origin': 'https://fviainboxes.com',
              'Referer': 'https://fviainboxes.com/',
              'Authorization': latestTokenRef.current ? `Bearer ${latestTokenRef.current}` : ''
            }
          });

          if (res.ok) {
            const data = await res.json();
            const messages = data.result || [];

            for (const msg of messages) {
              const fromLower = msg.from.toLowerCase();
              if (!fromLower.includes('microsoft')) continue;

              const bodyUrl = `https://fviainboxes.com/message?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(msg.id)}`;
              const bodyRes = await window.GM_fetch(bodyUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json, text/plain, */*',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Origin': 'https://fviainboxes.com',
                  'Referer': 'https://fviainboxes.com/',
                  'Authorization': latestTokenRef.current ? `Bearer ${latestTokenRef.current}` : ''
                }
              });

              if (bodyRes.ok) {
                const bodyText = await bodyRes.text();
                const code = extractOtp(bodyText);
                if (code) {
                  foundOtp = code;
                  break;
                }
              }
            }
          } else if (res.status === 403 || res.status === 401) {
            isAuthError = true;
            console.error('Token Fvia bị từ chối hoặc hết hạn!');
          }
        } else {
          // Inboxes.com logic gọi qua backend Next.js để vượt CORS 100%
          try {
            const res = await fetch(`/api/scrape-inboxes?email=${encodeURIComponent(generated)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.otp) {
                foundOtp = data.otp;
              }
            } else if (res.status === 429 || res.status === 403) {
              console.warn(`[Inboxes.com] Bị giới hạn rate limit (Lỗi ${res.status}). Sẽ đợi thêm 15 giây...`);
              currentWaitMs = 15000;
            }
          } catch (e) {
            console.error('Lỗi cào email mới qua backend:', e);
          }
        }

          if (foundOtp) {
            // Đã lấy được OTP, chỉ lưu vào State, KHÔNG ghi lên sheet tự động
            setOtp(foundOtp);
            onUpdated(row.rowIndex, { code: foundOtp });
            pollingRef.current = false;
            setLoadingOtp(false);
            return;
          }
      } catch (e) {
        console.error('Lỗi khi lấy OTP:', e);
        if (e instanceof Error && e.message.includes('GM_fetch')) {
          setErr(e.message);
          pollingRef.current = false;
          setLoadingOtp(false);
          return;
        }
      }

      // Đợi trước khi hỏi lại (sử dụng currentWaitMs thay vì 200ms)
      await new Promise(r => setTimeout(r, currentWaitMs));
    }

    if (pollingRef.current) {
      setErr('Quá thời gian chờ OTP (10 phút). Hãy thử lại.');
      pollingRef.current = false;
      setLoadingOtp(false);
    }
  };

  const handleComplete = async () => {
    setLoadingComplete(true);
    setErr('');
    try {
      const body: any = {
        sheetId,
        sheetName,
        rowIndex: row.rowIndex,
        recovery: generated,
        code: otp,
        mode,
      };

      if (mode === 'capital') {
        body.email = row.email;
        body.newMkHotmail = newPassword;
        body.newMkCapital = newMkCapital;
      }

      const res = await fetch('/api/complete-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi cập nhật Sheet');
      
      const updates: any = { isDone: true, recovery: generated };
      if (mode === 'capital') {
        updates.newPassword = newPassword;
        updates.newMkCapital = newMkCapital;
      }
      onUpdated(row.rowIndex, updates);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingComplete(false);
    }
  };

  const oldRecoveryUser = row.oldRecovery ? row.oldRecovery.split('@')[0] : '';

  const isActive = activeEmail === row.email;
  const isPasswordError = row.isPasswordError || false;

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-5 border-2 transition-all duration-300 relative ${
        isActive 
          ? 'border-blue-500 ring-4 ring-blue-400 ring-opacity-40 shadow-blue-200 shadow-xl scale-[1.02] z-10 bg-blue-50/10' 
          : isPasswordError
            ? 'border-red-400 bg-red-50'
            : isDone 
              ? 'border-green-400 bg-green-50' 
              : 'border-orange-200 bg-orange-50 hover:border-blue-300'
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          #{row.rowIndex} · <span className="font-medium text-gray-700">{row.name || '—'}</span>
          {isActive && (
            <span className="flex h-2.5 w-2.5 relative" title="Tài khoản đang xử lý">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
            isActive
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200 animate-pulse'
              : isPasswordError
                ? 'bg-red-500 text-white shadow-md shadow-red-200'
                : isDone 
                  ? 'bg-green-500 text-white' 
                  : 'bg-orange-400 text-white'
          }`}
        >
          {isActive ? '⚡ Đang chạy...' : isPasswordError ? '❌ Báo lỗi' : isDone ? '✓ Đã làm' : '⏳ Đang làm'}
        </span>
      </div>

      <div className="mb-3">
        <CopyField label="📧 Email Hotmail" value={row.email} color="blue" />
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (onActive) onActive(row.email);
              const accData = {
                email: row.email,
                password: row.password,
                newPassword: newPassword,
                newRecovery: generated,
                oldRecovery: row.oldRecovery || '',
                mkCapital: row.mkCapital,
                newMkCapital: newMkCapital || row.newMkCapital || '',
                sheetId,
                sheetName,
                rowIndex: row.rowIndex,
                mode
              };
              try {
                await fetch('/api/current-account', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(accData)
                });
              } catch (e) {
                console.error('Lỗi đặt current-account:', e);
              }
              // Thiết lập mailboxUrl đối với email Trangcode để mở song song trong cửa sổ ẩn danh
              let mailboxUrl = '';
              if (row.oldRecovery) {
                const domain = row.oldRecovery.split('@')[1]?.toLowerCase() || '';
                const fviaDomains = ['fviainboxes.com', 'fviadropinbox.com', 'fviamail.work', 'dropinboxes.com'];
                const inboxesDomains = ['inboxes.com', 'dropjar.com', 'kapsule.info', 'getinbox.work', 'fivermail.com', 'smvmail.com'];
                const isFvia = fviaDomains.some(d => domain.includes(d));
                const isInboxes = inboxesDomains.some(d => domain.includes(d));
                if (!isFvia && !isInboxes) {
                  // Đây là email thuộc Trangcode (sellallmail.com) -> bắt buộc phải mở tab hòm thư Trangcode ẩn danh
                  mailboxUrl = `https://sellallmail.com/mailbox/${encodeURIComponent(row.oldRecovery)}`;
                }
              }

              // Mở song song link Capital One Shopping nếu ở chế độ Capital
              let capitalUrl = '';
              if (mode === 'capital') {
                capitalUrl = 'https://capitaloneshopping.com/sign-in';
              }

              // Mã hóa Base64 an toàn để truyền qua URL Hash
              const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(accData))));
              const loginUrl = `https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=198&ct=1782607399&rver=7.5.2211.0&wp=SA_20MIN&wreply=https%3A%2F%2Faccount.live.com%2Fproofs%2FManage%2Fadditional%3Fuaid%3D233239318fd1447bab2b4edd22546006&lc=1033&id=38936&mkt=vi-VN#acc=${base64Data}`;
              
              try {
                const openRes = await fetch('/api/open-incognito', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: loginUrl, mailboxUrl, capitalUrl })
                });
                const openData = await openRes.json();
                if (!openData.success) {
                  window.open(loginUrl, '_blank');
                  if (capitalUrl) window.open(capitalUrl, '_blank');
                }
              } catch (e) {
                console.error('Lỗi khi gọi API mở ẩn danh:', e);
                window.open(loginUrl, '_blank');
                if (capitalUrl) window.open(capitalUrl, '_blank');
              }
            }}
            disabled={!generated}
            className={`flex-1 mt-1 px-3 py-2 rounded border transition-colors font-medium text-xs flex items-center h-[38px] justify-center whitespace-nowrap ${
              !generated 
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 animate-pulse'
            }`}
            title={!generated ? 'Vui lòng tạo thông tin mới trước' : 'Đăng nhập tự động vào Hotmail'}
          >
            {mode === 'capital' ? '🔑 Tự động Hotmail + Capital' : '🔑 Vào Hotmail'}
          </button>
          
          <button
            onClick={handleMarkPasswordError}
            disabled={loadingMarkError}
            className="mt-1 px-3 py-2 bg-red-100 text-red-700 rounded border border-red-200 hover:bg-red-200 disabled:bg-gray-200 transition-colors font-medium text-xs flex items-center h-[38px] justify-center whitespace-nowrap"
            title="Báo lỗi tài khoản và tô đỏ trên Google Sheet"
          >
            ❌ {loadingMarkError ? 'Đang lưu...' : 'Báo lỗi'}
          </button>
        </div>
      </div>
      
      {/* Hiển thị mật khẩu cũ khi chưa làm, hoặc mật khẩu mới khi đã làm */}
      {!isDone ? (
        <CopyField label="🔑 Mật khẩu Hotmail (cũ)" value={row.password} color="gray" />
      ) : (
        mode === 'capital' && row.newPassword && (
          <CopyField label="🔑 Mật khẩu Hotmail (MỚI)" value={row.newPassword} color="green" />
        )
      )}

      {mode === 'capital' && row.oldRecovery && (
        <>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <CopyField label="📬 Mail khôi phục cũ" value={row.oldRecovery} color="blue" />
            </div>
            <a
              href={`https://sellallmail.com/mailbox/${row.oldRecovery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 px-3 py-2 bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200 transition-colors font-medium text-xs flex items-center h-[38px] justify-center whitespace-nowrap"
              title="Mở hòm thư cũ trên sellallmail.com"
            >
              📬 Vào Mailbox
            </a>
          </div>
          <CopyField label="👤 User khôi phục cũ" value={oldRecoveryUser} color="green" />

          {/* Hiển thị OTP đăng nhập lấy tự động từ mailbox cũ */}
          {oldOtp && (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 my-2 animate-bounce">
              <CopyField label="🔐 OTP Đăng nhập (Mail cũ)" value={oldOtp} color="purple" />
            </div>
          )}
        </>
      )}

      {/* Hiển thị mật khẩu Capital cũ khi chưa làm, hoặc mật khẩu mới khi đã làm, kèm nút mở Capital */}
      {mode === 'capital' && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            {!isDone ? (
              row.mkCapital && <CopyField label="💳 Mật khẩu Capital (cũ)" value={row.mkCapital} color="purple" />
            ) : (
              row.newMkCapital && <CopyField label="💳 Mật khẩu Capital (MỚI)" value={row.newMkCapital} color="green" />
            )}
          </div>
          <button
            onClick={async () => {
              const capitalUrl = 'https://capitaloneshopping.com/sign-in';
              try {
                await fetch('/api/current-account', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: row.email,
                    password: row.password,
                    newPassword: newPassword,
                    newRecovery: generated,
                    oldRecovery: row.oldRecovery || '',
                    mkCapital: row.mkCapital,
                    newMkCapital: newMkCapital || row.newMkCapital || ''
                  })
                });
              } catch (e) {
                console.error('Lỗi đặt current-account:', e);
              }
              
              try {
                const openRes = await fetch('/api/open-incognito', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: capitalUrl })
                });
                const openData = await openRes.json();
                if (!openData.success) {
                  window.open(capitalUrl, '_blank');
                }
              } catch (e) {
                console.error('Lỗi khi gọi API mở ẩn danh:', e);
                window.open(capitalUrl, '_blank');
              }
            }}
            className="mb-3 px-3 py-2 bg-purple-100 text-purple-700 rounded border border-purple-200 hover:bg-purple-200 transition-colors font-medium text-xs flex items-center h-[38px] justify-center whitespace-nowrap"
            title="Mở trang đăng nhập Capital One Shopping"
          >
            🛍️ Vào Capital
          </button>
        </div>
      )}

      <div className="border-t border-dashed border-gray-300 my-3" />

      {generated ? (
        <>
          <CopyField label={mode === 'capital' ? "✨ Mail khôi phục mới" : "✨ Mail khôi phục đã tạo"} value={generated} color="green" />
          {otp && <CopyField label="🔐 Code (OTP Microsoft)" value={otp} color="purple" />}
          
          {/* Form điền mật khẩu mới khi đang tiến hành (chỉ ở chế độ capital) */}
          {mode === 'capital' && !isDone && (
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-3 space-y-3">
              <div className="font-semibold text-xs text-blue-800">✍️ Điền thông tin mới sau khi đổi:</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">🔑 Mật khẩu Hotmail mới</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập MK Hotmail mới..."
                    className="flex-1 text-sm bg-white border border-gray-300 rounded p-1.5 outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const generatedVal = generateRandomPassword(); // Không có A!
                      setNewPassword(generatedVal);
                      setNewMkCapital(generatedVal + 'A!');
                    }}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 whitespace-nowrap"
                    title="Tự động tạo mật khẩu ngẫu nhiên"
                  >
                    🎲 Ngẫu nhiên
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">💳 Mật khẩu Capital mới</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMkCapital}
                    onChange={(e) => setNewMkCapital(e.target.value)}
                    placeholder="Nhập MK Capital mới..."
                    className="flex-1 text-sm bg-white border border-gray-300 rounded p-1.5 outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {!otp && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={loadingOtp ? () => { pollingRef.current = false; setLoadingOtp(false); } : handleGetOtp}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${loadingOtp ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
              >
                {loadingOtp ? '⏹ Dừng chờ OTP' : '🔐 Lấy code'}
              </button>

              {!loadingOtp && (
                <button
                  onClick={() => {
                    setGenerated('');
                    setOtp('');
                    onUpdated(row.rowIndex, { recovery: '' });
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm flex-shrink-0"
                  title="Xóa mail ảo này để tạo mail mới"
                >
                  🔄 Đổi mail khác
                </button>
              )}
            </div>
          )}
          
          {!isDone && (
            <button
              onClick={handleComplete}
              disabled={loadingComplete}
              className="w-full px-4 py-2 mt-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
            >
              {loadingComplete ? '⏳ Đang lưu...' : '✅ Hoàn thành & Lưu'}
            </button>
          )}
        </>
      ) : (
        <button
          onClick={handleCreate}
          disabled={loadingCreate}
          className="w-full px-4 py-2 mt-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loadingCreate ? '⏳ Đang tạo...' : (mode === 'capital' ? '✨ Tạo thông tin mới' : '✨ Tạo mail khôi phục')}
        </button>
      )}

      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </div>
  );
}
