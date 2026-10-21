// 优先级取值直接使用中文，样式类名保持英文
const PRIORITY_CLASS = { 高: 'high', 中: 'medium', 低: 'low' };

const state = {
  tasks: [],
  filter: 'all',
};

const listEl = document.getElementById('task-list');
const formEl = document.getElementById('add-form');
const titleEl = document.getElementById('title');
const priorityEl = document.getElementById('priority');
const submitBtn = document.getElementById('submit-btn');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('empty');
const emptyTextEl = document.getElementById('empty-text');
const summaryEl = document.getElementById('summary');
const toastEl = document.getElementById('toast');

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // 忽略空响应
  }
  if (!res.ok) throw new Error(payload?.error || '请求失败，请稍后重试');
  return payload;
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return `今天 ${time}`;
  const isSameYear = date.getFullYear() === now.getFullYear();
  const day = `${date.getMonth() + 1}月${date.getDate()}日`;
  return isSameYear ? `${day} ${time}` : `${date.getFullYear()}年${day}`;
}

function createTaskItem(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' is-done' : ''}`;
  li.dataset.id = task.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle';
  toggle.dataset.action = 'toggle';
  toggle.setAttribute('aria-label', task.completed ? '标记为未完成' : '标记为已完成');
  toggle.setAttribute('aria-pressed', String(task.completed));
  toggle.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8.5 6 12l7.5-8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const main = document.createElement('div');
  main.className = 'task-main';

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const badge = document.createElement('span');
  badge.className = `badge badge-${PRIORITY_CLASS[task.priority]}`;
  badge.textContent = `${task.priority}优先级`;

  const time = document.createElement('span');
  time.textContent = formatTime(task.created_at);

  meta.append(badge, time);
  main.append(title, meta);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-btn';
  del.dataset.action = 'delete';
  del.setAttribute('aria-label', '删除任务');
  del.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  li.append(toggle, main, del);
  return li;
}

function updateSummary(counts) {
  const done = state.tasks.filter((task) => task.completed).length;
  summaryEl.innerHTML = `共 <strong>${counts.all}</strong> 项 · 已完成 <strong>${done}</strong> 项`;

  document.querySelectorAll('[data-count]').forEach((el) => {
    el.textContent = counts[el.dataset.count] ?? 0;
  });
}

function render() {
  const counts = { all: state.tasks.length, 高: 0, 中: 0, 低: 0 };
  state.tasks.forEach((task) => {
    counts[task.priority] = (counts[task.priority] || 0) + 1;
  });

  const visible =
    state.filter === 'all'
      ? state.tasks
      : state.tasks.filter((task) => task.priority === state.filter);

  listEl.replaceChildren(...visible.map(createTaskItem));

  const hasAny = state.tasks.length > 0;
  emptyEl.hidden = visible.length > 0;
  if (!visible.length) {
    emptyTextEl.textContent = hasAny
      ? `没有${state.filter}优先级的任务`
      : '还没有任务，先添加一条吧';
  }

  updateSummary(counts);
}

async function loadTasks() {
  loadingEl.hidden = false;
  loadingEl.textContent = '正在加载任务…';
  emptyEl.hidden = true;
  try {
    const tasks = await request('/api/tasks');
    state.tasks = tasks;
    loadingEl.hidden = true;
    render();
  } catch (error) {
    loadingEl.hidden = false;
    loadingEl.textContent = `加载失败：${error.message}`;
  }
}

function showToast(message) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add('is-visible'));
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
    setTimeout(() => {
      toastEl.hidden = true;
    }, 200);
  }, 2600);
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = titleEl.value.trim();
  if (!title) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '添加中…';
  try {
    const task = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, priority: priorityEl.value }),
    });
    state.tasks.unshift(task);
    titleEl.value = '';
    titleEl.focus();
    loadingEl.hidden = true;
    render();
  } catch (error) {
    showToast(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '添加任务';
  }
});

listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = button.closest('.task-item');
  const task = state.tasks.find((t) => String(t.id) === item?.dataset.id);
  if (!task) return;

  if (button.dataset.action === 'toggle') {
    button.disabled = true;
    try {
      const updated = await request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      });
      Object.assign(task, updated);
      render();
    } catch (error) {
      showToast(error.message);
      button.disabled = false;
    }
  }

  if (button.dataset.action === 'delete') {
    button.disabled = true;
    try {
      await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      render();
      showToast('任务已删除');
    } catch (error) {
      showToast(error.message);
      button.disabled = false;
    }
  }
});

document.getElementById('filters').addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach((el) => {
    el.classList.toggle('is-active', el === button);
  });
  render();
});

loadTasks();
