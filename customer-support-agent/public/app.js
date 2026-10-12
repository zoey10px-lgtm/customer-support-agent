const $ = s => document.querySelector(s);
let examples = [], history = [], busy = false;
const status = text => $('#status').textContent = text;
function message(text, user = false) {
  const el = document.createElement('div');
  el.className = 'msg' + (user ? ' user' : '');
  el.textContent = text;
  $('#output').append(el);
}
function lock(value) {
  busy = value;
  $('#submit').disabled = value;
  $('#send').disabled = value || !history.length;
  $('#followup').disabled = value || !history.length;
  document.querySelectorAll('[data-example]').forEach(b => b.disabled = value);
  $('#submit').textContent = value ? '자료 조회 및 답변 작성 중…' : '문의 접수하기 →';
}
$('#complaint').oninput = () => $('#count').textContent = $('#complaint').value.length;
document.querySelectorAll('[data-example]').forEach((button, i) => {
  button.onclick = () => {
    const sample = examples[[0, 1, 3][i]];
    if (!sample) return;
    $('#complaint').value = sample.message;
    $('#product').value = sample.product_code;
    $('#order').value = sample.lot_id;
    $('#count').textContent = sample.message.length;
  };
});
async function ask(text, initial) {
  if (busy) return;
  $('#error').textContent = '';
  if (initial) { history = []; $('#output').replaceChildren(); }
  lock(true);
  status('확인 중');
  message(text, true);
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: text, product: $('#product').value.trim(),
                            lot: $('#order').value.trim(), history})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '요청에 실패했습니다.');
    history.push({role: 'user', content: text}, {role: 'assistant', content: result.answer});
    const title = document.createElement('div');
    title.className = 'msg-title';
    title.textContent = '✧ Carely · 품질 불만 분석 및 회신 초안';
    const answer = document.createElement('textarea');
    answer.value = result.answer;
    answer.setAttribute('aria-label', '분석 결과 및 회신 초안 편집');
    answer.style.minHeight = '360px';
    const copy = document.createElement('button');
    copy.type = 'button'; copy.className = 'example'; copy.textContent = '답변 복사';
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(answer.value); copy.textContent = '복사 완료'; }
      catch { answer.focus(); answer.select(); copy.textContent = '선택된 글을 Ctrl+C로 복사해주세요'; }
    };
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '조회한 참고 자료 ' + result.sources.length + '건';
    const pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px';
    pre.textContent = JSON.stringify(result.sources, null, 2);
    details.append(summary, pre);
    const usage = document.createElement('p');
    usage.className = 'sub';
    usage.textContent = '사용량: 입력 ' + (result.usage.input_tokens ?? '?') +
      ' / 출력 ' + (result.usage.output_tokens ?? '?') + ' 토큰';
    $('#output').append(title, answer, copy, details, usage);
    status('초안 작성 완료');
    $('#followup').placeholder = '추가로 확인할 내용을 입력해주세요';
  } catch (error) {
    $('#error').textContent = error.message;
    message(error.message);
    status('설정 또는 입력 확인');
  } finally {
    lock(false);
    $('#output').scrollTop = $('#output').scrollHeight;
  }
}
$('#complaintForm').onsubmit = e => {
  e.preventDefault();
  const text = $('#complaint').value.trim();
  if (text) ask(text, true);
};
$('#chatForm').onsubmit = async e => {
  e.preventDefault();
  const text = $('#followup').value.trim();
  if (!text || busy) return;
  await ask(text, false);
  if (!$('#error').textContent) $('#followup').value = '';
};
fetch('/api/examples').then(r => { if (!r.ok) throw new Error(); return r.json(); })
  .then(data => examples = data)
  .catch(() => $('#error').textContent = 'start.cmd로 실행한 후 열린 웹 화면에서 사용해주세요.');
