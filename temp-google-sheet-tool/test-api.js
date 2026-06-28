const headers = { 'Accept': 'application/json, text/plain, */*' };

async function check() {
  const r2 = await fetch(`https://fviainboxes.com/message?username=andresa.victo1113&domain=fviainboxes.com&id=70cb5d51-19d8-4956-b09d-1c5672a9f674`, {headers});
  const text = await r2.text();
  
  let html = text;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') html = parsed;
  } catch (e) {}

  const cleanText = html.replace(/<[^>]*>/g, '').normalize("NFC");
  
  const MICROSOFT_OTP_REGEX = /(?:Security code|M[ãa]\s*b[ảaáo]o?\s*m[ậa]t|Mã bảo mật):\s*(\d{6})/i;
  const m = cleanText.match(MICROSOFT_OTP_REGEX);
  console.log('Regex match:', m ? m[1] : 'No match');
}
check();
