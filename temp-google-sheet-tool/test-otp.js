const msg = {
  "id": "c8a98da9-3a1f-44cf-bc20-3762e8ba674d",
  "from": "Nhóm tài khoản Microsoft <account-security-noreply@accountprotection.microsoft.com>",
  "to": "lowentangan5649@bltiwd.com",
  "subject": "Mã bảo mật tài khoản Microsoft cá nhân",
  "body_text": "Vui lòng sử dụng mã bảo mật sau đây cho tài khoản Microsoft cá nhân lo**n@hotmail.com của bạn.\n\nMã bảo mật: 855884\n\nChỉ nhập mã này vào một website hoặc ứng dụng chính thức.",
  "created_at": "2026-06-27T17:54:06.204438Z"
};

const MICROSOFT_OTP_REGEX = /(?:Security code|M[ãa] b[ảaáo] m[ậa]t):\s*(\d{6})/i;
const GENERIC_6_DIGIT_REGEX = /\b(\d{6})\b/;

function extractOtp(msg) {
  const m = msg.body_text.match(MICROSOFT_OTP_REGEX);
  if (m) return m[1];
  const m2 = msg.body_text.match(GENERIC_6_DIGIT_REGEX);
  return m2?.[1] ?? null;
}

console.log("Extracted:", extractOtp(msg));
console.log("Includes microsoft:", msg.from.toLowerCase().includes("microsoft"));
