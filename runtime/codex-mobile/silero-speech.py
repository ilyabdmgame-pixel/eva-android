#!/usr/bin/env python3
import sys, wave, struct, torch
if len(sys.argv)!=3 or sys.argv[1] not in ('xenia','kseniya','baya'):
    raise SystemExit('Usage: silero-speech.py xenia|kseniya|baya output.wav')
text=sys.stdin.read(12001).strip()
if not text or len(text)>12000: raise SystemExit('Неверная длина текста')
torch.set_num_threads(2)
model=torch.package.PackageImporter('/root/codex-mobile/voices/silero/v5_6_ru.pt').load_pickle('tts_models','model')
with torch.inference_mode():
    audio=model.apply_tts(text=text,speaker=sys.argv[1],sample_rate=24000,put_accent=True,put_yo=True)
    pcm=(audio.clamp(-1,1)*32767).to(torch.int16).tolist()
with wave.open(sys.argv[2],'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(24000);out.writeframes(struct.pack('<%dh'%len(pcm),*pcm))
