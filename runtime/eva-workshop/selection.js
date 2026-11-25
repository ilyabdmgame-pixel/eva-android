'use strict';
// Pure selection: no model calls. Catalog presence is not an entitlement guarantee.
const preferred={simple:['gpt-6-luna','gpt-6.1-sol'],normal:['gpt-6.1-sol'],complex:['gpt-6.1-terra','gpt-6.1-sol']};
function chooseTask(tasks,history=[]){if(!Array.isArray(tasks)||!tasks.length)throw Error('Нет задач');let eligible=tasks.filter(t=>t&&typeof t.id==='string'&&preferred[t.complexity]&&!history.includes(t.id));if(!eligible.length)return null;return eligible[0]}
function chooseModel(task,catalog){const available=new Set((catalog||[]).map(x=>x.model||x.id));return (preferred[task?.complexity]||[]).find(id=>available.has(id))||null}
module.exports={chooseTask,chooseModel};
