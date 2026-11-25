'use strict';

(() => {
  function parse(text) {
    const structured = /```eva-poll[^\S\n]*\n([\s\S]*?)\n```/i.exec(text);
    if (structured) {
      try {
        const {question, options} = JSON.parse(structured[1]);
        if (typeof question === 'string' && question.trim() && question.length <= 300 &&
            Array.isArray(options) && options.length >= 2 && options.length <= 5 &&
            options.every(value => typeof value === 'string' && value.trim() && value.length <= 120)) {
          return {question: question.trim(), options: options.map(value => value.trim()),
            text: (text.slice(0, structured.index) + text.slice(structured.index + structured[0].length)).trim()};
        }
      } catch {}
      return null;
    }

    // Recognize a short question followed by a list of choices at the end of the reply.
    // Ordinary lists and code examples stay as written.
    if (text.includes('```')) return null;
    const lines = text.trim().split(/\r?\n/);
    const options = [];
    while (lines.length) {
      const entry = /^(?:\d{1,2}[.)]|[-*•])\s+(.{1,120})$/.exec(lines.at(-1).trim());
      if (!entry) break;
      options.unshift(entry[1].trim().replace(/^\*\*(.+)\*\*$/, '$1'));
      lines.pop();
    }
    if (options.length < 2 || options.length > 5 || new Set(options).size !== options.length) return null;
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    if (/^(варианты(?: ответа)?|выбери(?: один)? вариант)\s*:?$/i.test(lines.at(-1)?.trim() || '')) lines.pop();
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    const question = lines.pop()?.trim().replace(/^\*\*(.+)\*\*$/, '$1') || '';
    if (!question.endsWith('?') || question.length > 300) return null;
    return {question, options, text: lines.join('\n').trim()};
  }

  if (typeof module === 'object' && module.exports) module.exports = {parse};
  else globalThis.EvaQuestions = {parse};
})();
