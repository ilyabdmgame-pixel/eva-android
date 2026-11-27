"""Replay the launcher's recorded WebGL2 draw calls on a real EGL/GLES 3 driver.

EVA_EGL_REPLAY=1 EVA_DEVTOOLS_URL=http://127.0.0.1:9222 node tools/verify_ui.mjs /tmp/eva-ui
Dependencies for this optional path: Python 3, Pillow, libEGL, libGLESv2, a surfaceless
ES3 driver (Mesa llvmpipe works), and Chromium for the launcher DOM. No Android device.
"""
import argparse
import base64
import ctypes as c
import ctypes.util
import io
import json
from pathlib import Path

from PIL import Image

Int, Uint, Ptr, Float = c.c_int, c.c_uint, c.c_void_p, c.c_float
ASSETS = Path(__file__).resolve().parents[1] / 'app/src/main/assets/home'


class Driver:
    def __init__(self, library):
        soname = {'EGL': 'libEGL.so.1', 'GLESv2': 'libGLESv2.so.2'}[library]
        self.lib = c.CDLL(c.util.find_library(library) or soname)
        self.functions = {}

    def fn(self, name, result, *params):
        if name not in self.functions:
            f = getattr(self.lib, name)
            f.restype, f.argtypes = result, params
            self.functions[name] = f
        return self.functions[name]


def surface(width, height):
    egl = Driver('EGL').fn
    display = egl('eglGetDisplay', Ptr, Ptr)(None)
    major, minor = Int(), Int()
    if not egl('eglInitialize', Int, Ptr, c.POINTER(Int), c.POINTER(Int))(display, c.byref(major), c.byref(minor)):
        raise RuntimeError('Surfaceless EGL is unavailable')
    config = Ptr()
    count = Int()
    # Pbuffer, OpenGL ES 3, 24-bit depth, stencil for the shadow union, and RGB8.
    attrs = (Int * 15)(0x3033, 1, 0x3040, 0x40, 0x3025, 24, 0x3026, 8, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3038)
    choose = egl('eglChooseConfig', Int, Ptr, c.POINTER(Int), c.POINTER(Ptr), Int, c.POINTER(Int))
    if not choose(display, attrs, c.byref(config), 1, c.byref(count)) or not count.value:
        raise RuntimeError('EGL has no ES3 pbuffer with depth and stencil')
    egl('eglBindAPI', Int, Uint)(0x30A0)
    make_context = egl('eglCreateContext', Ptr, Ptr, Ptr, Ptr, c.POINTER(Int))
    ctx = make_context(display, config, None, (Int * 3)(0x3098, 3, 0x3038))
    make_surface = egl('eglCreatePbufferSurface', Ptr, Ptr, Ptr, c.POINTER(Int))
    buf = make_surface(display, config, (Int * 5)(0x3057, width, 0x3056, height, 0x3038))
    if not ctx or not buf or not egl('eglMakeCurrent', Int, Ptr, Ptr, Ptr, Ptr)(display, buf, buf, ctx):
        raise RuntimeError('EGL could not make its ES3 context current')
    return egl


SIGNATURES = {
    'attachShader': 'II', 'compileShader': 'I', 'linkProgram': 'I', 'useProgram': 'I',
    'bindBuffer': 'II', 'bindVertexArray': 'I', 'bindFramebuffer': 'II', 'bindRenderbuffer': 'II', 'bindTexture': 'II',
    'texParameteri': 'III', 'texParameterf': 'IIf', 'texStorage2D': 'IIIII', 'framebufferTexture2D': 'IIIII',
    'renderbufferStorage': 'IIII', 'framebufferRenderbuffer': 'IIII', 'viewport': 'IIII',
    'clearColor': 'ffff', 'clear': 'I', 'depthMask': 'b', 'drawArrays': 'III', 'drawElements': 'IIIP',
    'enableVertexAttribArray': 'I', 'vertexAttribPointer': 'IIIbIP', 'enable': 'I', 'disable': 'I',
    'blendFunc': 'II', 'stencilFunc': 'III', 'stencilOp': 'III', 'uniform1f': 'If',
    'uniform1i': 'II', 'uniform2f': 'Iff', 'uniform3f': 'Ifff', 'uniform4f': 'Iffff', 'generateMipmap': 'I',
}
TYPES = {'I': Int, 'f': Float, 'b': c.c_ubyte, 'P': Ptr}
OBJECTS = {s: s + 's' for s in ('Buffer', 'VertexArray', 'Texture', 'Renderbuffer', 'Framebuffer')}


def image_source(arg):
    if 'file' in arg:
        # The Android and local Chromium entry points both serve textures from /art/.
        name = arg['file'].split('/art/', 1)[-1]
        file = (ASSETS / 'art' / name).resolve()
        if ASSETS / 'art' not in file.parents:
            raise ValueError('Texture outside the room art directory')
    else:
        file = io.BytesIO(base64.b64decode(arg['image'].split(',', 1)[1]))
    with Image.open(file) as src:
        rgba = src.convert('RGBA')
        return rgba.width, rgba.height, rgba.tobytes()


class Replay:
    def __init__(self):
        self.driver = Driver('GLESv2')
        self.objects, self.uniforms, self.program = {}, {}, 0

    def gl(self, name, result, *params):
        return self.driver.fn('gl' + name[0].upper() + name[1:], result, *params)

    def argument(self, value):
        if value is None:
            return 0
        if not isinstance(value, dict):
            return value
        if 'obj' in value:
            return self.objects[value['obj']]
        if 'uniform' in value:
            key = self.program, value['uniform']
            if key not in self.uniforms:
                self.uniforms[key] = self.gl('getUniformLocation', Int, Uint, c.c_char_p)(key[0], key[1].encode())
            return self.uniforms[key]
        if 'binary' in value:
            return base64.b64decode(value['binary'])
        return value

    def validate_shader(self, handle, linked):
        kind, status = ('Program', 0x8B82) if linked else ('Shader', 0x8B81)
        value = Int()
        self.gl('get' + kind + 'iv', None, Uint, Uint, c.POINTER(Int))(handle, status, c.byref(value))
        if not value.value:
            log = c.create_string_buffer(32768)
            self.gl('get' + kind + 'InfoLog', None, Uint, Int, Ptr, Ptr)(handle, len(log), None, log)
            raise RuntimeError(log.value.decode(errors='replace'))

    def command(self, op, args):
        if op.startswith('create'):
            kind, key = op[6:], args[0]['obj']
            if kind == 'Program':
                self.objects[key] = self.gl(op, Uint)()
            elif kind == 'Shader':
                self.objects[key] = self.gl(op, Uint, Uint)(args[1])
            else:
                obj = Uint()
                self.gl('gen' + OBJECTS[kind], None, Int, c.POINTER(Uint))(1, c.byref(obj))
                self.objects[key] = obj.value
            return
        args = [self.argument(arg) for arg in args]
        if op.startswith('delete'):
            kind, obj = op[6:], Uint(args[0])
            if kind in ('Program', 'Shader'):
                self.gl(op, None, Uint)(obj)
            else:
                self.gl('delete' + OBJECTS[kind], None, Int, c.POINTER(Uint))(1, c.byref(obj))
        elif op == 'shaderSource':
            src = c.c_char_p(args[1].encode())
            self.gl(op, None, Uint, Int, c.POINTER(c.c_char_p), Ptr)(args[0], 1, c.byref(src), None)
        elif op == 'bufferData':
            target, data, usage = args
            self.gl(op, None, Uint, c.c_ssize_t, Ptr, Uint)(target, len(data), data, usage)
        elif op == 'texImage2D':
            if len(args) == 6:
                target, level, internal, fmt, typ, image = args
                w, h, data = image_source(image)
                args = [target, level, internal, w, h, 0, fmt, typ, data]
            self.gl(op, None, Uint, Int, Int, Int, Int, Int, Uint, Uint, Ptr)(*args)
        elif op == 'texSubImage2D':
            target, level, x, y, fmt, typ, image = args
            w, h, data = image_source(image)
            self.gl(op, None, Uint, Int, Int, Int, Int, Int, Uint, Uint, Ptr)(target, level, x, y, w, h, fmt, typ, data)
        elif op == 'uniformMatrix4fv':
            spot, transpose, values = args
            data = (Float * len(values))(*values)
            self.gl(op, None, Int, Int, c.c_ubyte, c.POINTER(Float))(spot, len(values) // 16, transpose, data)
        elif op in ('uniform3fv', 'uniform4fv'):
            spot, values = args
            data = (Float * len(values))(*values)
            self.gl(op, None, Int, Int, c.POINTER(Float))(spot, len(values) // int(op[7]), data)
        else:
            self.gl(op, None, *[TYPES[key] for key in SIGNATURES[op]])(*args)
            if op == 'useProgram':
                self.program = args[0]
            if op in ('compileShader', 'linkProgram'):
                self.validate_shader(args[0], op == 'linkProgram')
        error = self.gl('getError', Uint)()
        if error:
            raise RuntimeError(f'{op} failed with GL error {error:#x}')

    def save(self, width, height, target):
        data = (c.c_ubyte * (width * height * 4))()
        self.gl('readPixels', None, Int, Int, Int, Int, Uint, Uint, Ptr)(0, 0, width, height, 0x1908, 0x1401, data)
        result = Image.frombytes('RGBA', (width, height), bytes(data)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        result.convert('RGB').save(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recording', type=Path)
    parser.add_argument('frame')
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    events = json.loads(args.recording.read_text())
    matches = [i for i, event in enumerate(events) if event[:2] == ['photo', args.frame]]
    if not matches:
        parser.error('Frame missing from recording')
    end = matches[-1]
    sizes = [event[2:] for event in events[:end + 1] if event[0] == 'photo']
    width, height = map(max, zip(*sizes))
    egl = surface(width, height)
    replay = Replay()
    for op, *arguments in events[:end]:
        if op != 'photo':
            replay.command(op, arguments)
    w, h = events[end][2:]
    replay.save(w, h, args.target)
    driver = replay.gl('getString', c.c_char_p, Uint)(0x1F01).decode()
    print(f'{args.frame}: {w}×{h}, {end} commands, {driver}')
    # Retain the EGL library until the readback finishes. Driver resources die with this subprocess.
    _ = egl


if __name__ == '__main__':
    main()
