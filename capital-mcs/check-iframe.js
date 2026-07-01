async function testHeaders() {
  const res = await fetch("https://fviainboxes.com/");
  console.log("x-frame-options:", res.headers.get("x-frame-options"));
  console.log("content-security-policy:", res.headers.get("content-security-policy"));
}
testHeaders();
