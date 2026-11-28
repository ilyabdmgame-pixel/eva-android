"""Exercise Android HOME, system Settings and the actual launcher WebView on an AVD."""
import re
import subprocess
import sys
import time
from pathlib import Path
from xml.etree import ElementTree as ET

api, output = sys.argv[1], Path(sys.argv[2])
package = 'org.evaassistant.app'
home = package + '/ru.eva.life.Home'

def shell(*args):
    return subprocess.check_output(['adb', 'shell', *args], text=True, timeout=35).strip()

def wait_for(label, tap=False):
    end = time.monotonic() + 65
    while time.monotonic() < end:
        # --compressed omits merely decorative descendants on both API levels.
        try:
            shell('uiautomator', 'dump', '--compressed', '/data/local/tmp/eva-ui.xml')
            tree = shell('cat', '/data/local/tmp/eva-ui.xml')
            (output/'last-ui.xml').write_text(tree)
            for node in ET.fromstring(tree).iter('node'):
                values = [node.get('text', ''), node.get('content-desc', '')]
                if any(label == value for value in values):
                    if tap:
                        x1,y1,x2,y2 = map(int,re.findall(r'\d+',node.get('bounds')))
                        shell('input','tap',str((x1+x2)//2),str((y1+y2)//2))
                    return
        except (subprocess.SubprocessError, ET.ParseError):
            pass
        time.sleep(1)
    raise RuntimeError(f'UI element missing on Android API {api}: {label}')

assert shell('getprop','ro.kernel.qemu') == '1'
assert shell('getprop','ro.build.version.sdk') == api
print('System',shell('getprop','ro.product.manufacturer'),shell('getprop','ro.build.version.release'),flush=True)
shell('cmd','package','set-home-activity',home)
shell('am','start','-W','-a','android.intent.action.MAIN','-c','android.intent.category.HOME')
target = shell('cmd','package','resolve-activity','--brief','-a','android.intent.action.MAIN','-c','android.intent.category.HOME')
assert home in target, target
wait_for('Диспетчер',tap=True)
wait_for('Службы',tap=True)
wait_for('Обновить')
shell('am','start','-W','-a','android.settings.SETTINGS')
shell('input','keyevent','KEYCODE_HOME')
wait_for('Все приложения',tap=True)
wait_for('Закрыть')
print('Release APK installed; default HOME, device monitor, services, Settings and return to app drawer passed.')
