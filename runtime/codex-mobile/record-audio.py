#!/usr/bin/env python3
"""Start the Honor recorder, without stopping or replacing an existing recording."""
import subprocess,sys,time,xml.etree.ElementTree as ET,re,json
ROOT='/root/codex-mobile';PKG='com.hihonor.soundrecorder'
def run(*args):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=25)
 if p.returncode:raise RuntimeError((p.stderr or p.stdout).strip()[:250])
 return p.stdout

def screen():
 xml=run('node',ROOT+'/android-control.js','screen');root=ET.fromstring(xml[xml.find('<?xml'):]);
 if not any(n.get('package')==PKG for n in root.iter('node')):raise RuntimeError('Диктофон не на переднем плане')
 return root

def nodes(root,label):return [n for n in root.iter('node') if n.get('package')==PKG and n.get('enabled')=='true' and n.get('content-desc')==label]

def tap(node):
 m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.get('bounds',''))
 if not m:raise RuntimeError('Кнопка недоступна')
 x1,y1,x2,y2=map(int,m.groups())
 if x1>=x2 or y1>=y2:raise RuntimeError('Кнопка не видна')
 run('node',ROOT+'/android-control.js','tap',str((x1+x2)//2),str((y1+y2)//2))

def status(root):
 if nodes(root,'Завершить') and nodes(root,'Пауза, кнопка'):return 'recording'
 if nodes(root,'Завершить'):return 'paused_or_unknown'
 return 'idle'

def main():
 if len(sys.argv)!=1:raise RuntimeError('Команда не принимает параметры')
 state=json.loads(run('node',ROOT+'/android-control.js','status'))
 if not any(d.get('state')=='device' for d in state.get('devices',[])):raise RuntimeError('ADB не подключён')
 try:
  root=screen()
 except RuntimeError:
  run('node',ROOT+'/phone.js','open-app',PKG)
  root=screen()
 current=status(root)
 if current=='recording':print('Запись уже идёт.');return
 if current=='paused_or_unknown':raise RuntimeError('Запись открыта, но её состояние неясно; проверьте диктофон')
 start=nodes(root,'Начать')
 if len(start)!=1:raise RuntimeError('Кнопка начала записи не найдена однозначно; проверьте диктофон')
 tap(start[0])
 for _ in range(6):
  time.sleep(.4);root=screen()
  if status(root)=='recording':print('Запись началась в диктофоне.');return
 raise RuntimeError('Команда передана, но запись не подтверждена; проверьте диктофон')
if __name__=='__main__':
 try:main()
 except Exception as e:print('Ошибка: '+str(e),file=sys.stderr);sys.exit(1)
