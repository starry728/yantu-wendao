// 研途问道 · AI 代理（Cloudflare Pages Function）
// 路由：/api/chat
// 密钥在 Pages 项目 Settings → Environment variables（Production）配置，绝不写进代码/前端：
//   ARK_API_KEY  火山方舟“免费专用” Key
//   ARK_MODEL    模型 / 推理接入点 ID（形如 ep-xxxx 或模型名）
const ARK_URL = 'https://ark.cn-beijing.volcesapi.com/api/v3/chat/completions';
const SYS = {
  tutor: '你是网页游戏《研途问道·研究生修仙录》里的AI导师“问道真人”，擅长 C++ 编程、雅思英语、研究生科研方法与就业/社会常识。要求：1) 语气鼓励，像靠谱的师兄师姐；2) 回答简洁、必要时分点；3) 关键处给一个最小例子；4) 学生若焦虑，先安抚再解答。默认使用中文。',
  char: '你是网页游戏《研途问道》中的角色，请严格按给定的角色人设、语气与口吻，与玩家（一名研究生）对话；回答简短自然、有个性，可结合“修仙 × 研究生生活”的比喻，不要跳出角色。'
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handle(request, env) {
  const key = env.ARK_API_KEY, model = env.ARK_MODEL;
  if (!key || !model) return json(500, { error: '后端未配置 ARK_API_KEY / ARK_MODEL' });

  let data;
  try { data = await request.json(); } catch (e) { return json(400, { error: '请求体需为 JSON' }); }

  const kind = data.kind === 'char' ? 'char' : 'tutor';
  let msgs = Array.isArray(data.messages) ? data.messages.slice(-12) : [];
  msgs = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  if (kind === 'char' && data.persona) {
    msgs = [{ role: 'system', content: SYS.char + '\n角色人设：' + String(data.persona).slice(0, 800) }, ...msgs];
  } else {
    msgs = [{ role: 'system', content: SYS.tutor }, ...msgs];
  }

  const r = await fetch(ARK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model, messages: msgs, temperature: kind === 'char' ? 0.9 : 0.6, max_tokens: 600 })
  });
  const d = await r.json();
  if (!r.ok) return json(r.status || 500, { error: (d.error && d.error.message) || 'AI 调用失败' });
  const reply = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '';
  return json(200, { reply });
}

export const onRequestOptions = async () => new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
});
export const onRequestPost = async (ctx) => {
  try { return await handle(ctx.request, ctx.env); }
  catch (e) { return json(500, { error: 'AI 服务异常：' + e.message }); }
};
export const onRequest = async (ctx) => {
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  if (ctx.request.method === 'OPTIONS') return onRequestOptions();
  return json(405, { error: '仅支持 POST' });
};
