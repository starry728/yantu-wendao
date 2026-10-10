// 研途问道 · AI 代理（Vercel Serverless Function，CommonJS）
// 密钥只从环境变量读取，绝不写进代码或前端：
//   ARK_API_KEY  火山方舟“免费专用” API Key（不是付费 key）
//   ARK_MODEL    模型 / 推理接入点 ID（方舟控制台获取，形如 ep-xxxx 或模型名）
const ARK_URL = 'https://ark.cn-beijing.volcesapi.com/api/v3/chat/completions';
const SYS = {
  tutor: '你是网页游戏《研途问道·研究生修仙录》里的AI导师“问道真人”，擅长 C++ 编程、雅思英语、研究生科研方法与就业/社会常识。要求：1) 语气鼓励，像靠谱的师兄师姐；2) 回答简洁、必要时分点；3) 关键处给一个最小例子；4) 学生若焦虑，先安抚再解答。默认使用中文。',
  char: '你是网页游戏《研途问道》中的角色，请严格按给定的角色人设、语气与口吻，与玩家（一名研究生）对话；回答简短自然、有个性，可结合“修仙 × 研究生生活”的比喻，不要跳出角色。'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: '仅支持 POST' }); return; }

  const key = process.env.ARK_API_KEY, model = process.env.ARK_MODEL;
  if (!key || !model) { res.status(500).json({ error: '后端未配置 ARK_API_KEY / ARK_MODEL' }); return; }

  const body = req.body || {};
  const kind = body.kind === 'char' ? 'char' : 'tutor';
  let msgs = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  msgs = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  if (kind === 'char' && body.persona) {
    msgs = [{ role: 'system', content: SYS.char + '\n角色人设：' + String(body.persona).slice(0, 800) }, ...msgs];
  } else {
    msgs = [{ role: 'system', content: SYS.tutor }, ...msgs];
  }

  try {
    const r = await fetch(ARK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, messages: msgs, temperature: kind === 'char' ? 0.9 : 0.6, max_tokens: 600 })
    });
    const d = await r.json();
    if (!r.ok) { res.status(r.status || 500).json({ error: (d.error && d.error.message) || 'AI 调用失败' }); return; }
    const reply = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '';
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'AI 服务异常：' + e.message });
  }
};
