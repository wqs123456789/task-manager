require('dotenv').config();

const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PORT = 3000 } = process.env;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
// 兼容直接粘贴带 /rest/v1/ 后缀的项目地址
const SUPABASE_URL = (process.env.SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('缺少 Supabase 配置：请在 .env 中设置 SUPABASE_URL 和 SUPABASE_ANON_KEY（或 SUPABASE_SERVICE_ROLE_KEY）。');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
const PRIORITIES = ['高', '中', '低'];
const ID_RE = /^[1-9]\d*$/;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 查询任务：支持按优先级筛选，按创建时间倒序
app.get('/api/tasks', async (req, res) => {
  const { priority } = req.query;

  if (priority && priority !== 'all' && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: '无效的优先级' });
  }

  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (priority && priority !== 'all') query = query.eq('priority', priority);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 新建任务
app.post('/api/tasks', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const { priority } = req.body ?? {};

  if (!title) return res.status(400).json({ error: '任务标题不能为空' });
  if (title.length > 200) return res.status(400).json({ error: '任务标题不能超过 200 个字符' });
  if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: '无效的优先级' });

  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, priority, completed: false })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// 更新完成状态
app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body ?? {};

  if (!ID_RE.test(id)) return res.status(400).json({ error: '无效的任务 ID' });
  if (typeof completed !== 'boolean') return res.status(400).json({ error: 'completed 必须为布尔值' });

  const { data, error } = await supabase
    .from('tasks')
    .update({ completed })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: '任务不存在' });
  res.json(data);
});

// 删除任务
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  if (!ID_RE.test(id)) return res.status(400).json({ error: '无效的任务 ID' });

  const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id');

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(404).json({ error: '任务不存在' });
  res.status(204).end();
});

// 兜底：未匹配的 API 请求返回 JSON
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

const server = app.listen(PORT, () => {
  console.log(`任务管理系统已启动：http://localhost:${PORT}`);
});

module.exports = { app, server };
