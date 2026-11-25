#!/usr/bin/env python3
"""Take one camera-intent photo using the verified Android accessibility labels."""
import subprocess,sys,time,xml.etree.ElementTree as ET,re,os
ROOT='/root/codex-mobile'
def run(*args):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=25)
 if p.returncode: raise RuntimeError((p.stderr or p.stdout).strip()[:250])
 return p.stdout

def screen():
 data=run('node',ROOT+'/android-control.js','screen')
 return ET.fromstring(data[data.find('<?xml'):])

def find(root,label):
 matches=[n for n in root.iter('node') if n.get('content-desc')==label and n.get('enabled')=='true']
 if len(matches)!=1:return None
 n=matches[0]; pkg=n.get('package','')
 if pkg not in ('com.hihonor.camera','com.huawei.camera'): raise RuntimeError('Открыто неожиданное приложение; съёмка остановлена')
 m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.get('bounds',''))
 if not m:raise RuntimeError('Кнопка камеры недоступна')
 x1,y1,x2,y2=map(int,m.groups())
 if x1>=x2 or y1>=y2:raise RuntimeError('Кнопка камеры не видна')
 return (x1+x2)//2,(y1+y2)//2

def wait_button(label,proc):
 for _ in range(8):
  if proc.poll() is not None:raise RuntimeError('Запрос камеры завершился раньше ожидаемого')
  p=find(screen(),label)
  if p:return p
  time.sleep(.4)
 raise RuntimeError('Не найдена кнопка «'+label+'»; съёмка остановлена')

def main():
 if len(sys.argv)!=1:raise RuntimeError('Сценарий снимает на основную камеру и не принимает параметры')
 status=run('node',ROOT+'/android-control.js','status')
 import json
 if not any(d.get('state')=='device' for d in json.loads(status).get('devices',[])):raise RuntimeError('ADB не подключён')
 proc=subprocess.Popen(['node',ROOT+'/phone.js','photo','back'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  for label in ('Нажмите, чтобы сделать фото','OK'):
   x,y=wait_button(label,proc);run('node',ROOT+'/android-control.js','tap',str(x),str(y))
  out,err=proc.communicate(timeout=45)
  if proc.returncode:raise RuntimeError((err or out).strip()[:250])
  path=out.strip()
  if not path.startswith('/sdcard/Documents/Codex/') or not os.path.isfile(path):raise RuntimeError('Файл снимка не подтверждён')
  with open(path,'rb') as f:
   if f.read(2)!=b'\xff\xd8':raise RuntimeError('Получен некорректный снимок')
  print(path)
 finally:
  if proc.poll() is None:proc.terminate()
if __name__=='__main__':
 try:main()
 except Exception as e:print('Ошибка: '+str(e),file=sys.stderr);sys.exit(1)
