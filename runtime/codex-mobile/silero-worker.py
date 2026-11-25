#!/usr/bin/env python3
import sys,json,io,wave,struct,base64,traceback,re,html
import torch
from speech_breath import add_breaths, prepare_text
torch.set_num_threads(2)
model=torch.package.PackageImporter('/root/codex-mobile/voices/silero/v5_6_ru.pt').load_pickle('tts_models','model')

def speech_markup(text):
    # Construct the markup ourselves: messages can never supply SSML tags.
    paragraphs=[p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    sentences_all=[s for p in paragraphs for s in re.split(r'(?<=[.!?…])\s+(?=[А-ЯЁA-Z])',p)]
    index=0
    def paragraph(p):
        nonlocal index
        sentences=re.split(r'(?<=[.!?…])\s+(?=[А-ЯЁA-Z])', p)
        chunks=[]
        for sentence in sentences:
            greeting=index==0 and bool(re.match(r'^\s*(привет|здравствуй|доброе утро|добрый день|добрый вечер)\b',sentence,re.I))
            slow='?' in sentence or (index==len(sentences_all)-1 and index>0)
            attrs='pitch="high"' if greeting else 'pitch="medium"'+(' rate="slow"' if slow else '')
            chunks.append('<prosody '+attrs+'>'+html.escape(sentence, quote=False)+'</prosody>')
            index+=1
        return '<break time="180ms"/>'.join(chunks)
    return '<speak>'+ '<break time="350ms"/>'.join(paragraph(p) for p in paragraphs) +'</speak>'

def speech_chunks(text, limit=220):
    # Silero's practical input limit is lower than the HTTP limit; split on
    # sentence/word boundaries without dropping or reordering any content.
    chunks=[]
    while len(text)>limit:
        window=text[:limit+1]
        endings=list(re.finditer(r'[.!?…](?:\s+|$)|\n\s*\n',window))
        cut=endings[-1].end() if endings and endings[-1].end()>=limit//3 else -1
        if cut<1: cut=max(window.rfind(' '),window.rfind('\n'))
        if cut<1: cut=limit
        part=text[:cut].strip()
        if part: chunks.append(part)
        text=text[cut:].lstrip()
    if text.strip(): chunks.append(text.strip())
    return chunks

def spell_latin(text):
    names={'a':'эй','b':'би','c':'си','d':'ди','e':'и','f':'эф','g':'джи','h':'эйч','i':'ай','j':'джей','k':'кей','l':'эл','m':'эм','n':'эн','o':'оу','p':'пи','q':'кью','r':'ар','s':'эс','t':'ти','u':'ю','v':'ви','w':'дабл ю','x':'икс','y':'уай','z':'зет'}
    common={'gpt':'джи пи ти','codex':'кодекс','luna':'луна','eva':'ева','api':'эй пи ай','crm':'си ар эм'}
    def word(match):
        value=match.group(0).lower()
        return common.get(value,' '.join(names[ch] for ch in value))
    return re.sub(r'[A-Za-z]+',word,text)

def synth_chunk(chunk, accent=True, yo=True):
    opts={'speaker':'kseniya','sample_rate':24000,'put_accent':accent,'put_yo':yo}
    try:
        return model.apply_tts(ssml_text=speech_markup(chunk),**opts)
    except Exception:
        # Some model packages cannot parse Latin words in SSML. Retrying once
        # with Cyrillic pronunciation changes speech only, not the chat text.
        fallback=spell_latin(chunk)
        try:
            return model.apply_tts(ssml_text=speech_markup(fallback),**opts)
        except Exception:
            return model.apply_tts(text=fallback,**opts)

for line in sys.stdin:
    request={}
    try:
        request=json.loads(line)
        text=request.get('text','')
        if not isinstance(text,str) or not text.strip() or len(text)>12000: raise ValueError('Неверная длина текста')
        text=prepare_text(text)
        with torch.inference_mode():
            pieces=[]
            for chunk in speech_chunks(text):
                if pieces: pieces.append(torch.zeros(6000))
                pieces.append(synth_chunk(chunk, request.get('accent', True) is not False, request.get('yo', True) is not False))
            audio=torch.cat(pieces)
            audio=add_breaths(audio)
            pcm=(audio.clamp(-1,1)*32767).to(torch.int16).tolist()
        out=io.BytesIO()
        with wave.open(out,'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(24000);wav.writeframes(struct.pack('<%dh'%len(pcm),*pcm))
        print(json.dumps({'id':request.get('id'),'audio':base64.b64encode(out.getvalue()).decode('ascii')}),flush=True)
    except Exception as e:
        print(json.dumps({'id':request.get('id'),'error':str(e)[:250]}),flush=True)
