"""Keep native startup recovery connected to the real JS entry points and compositor."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / 'app/src/main/src/ru/eva'


class NativeSurfaceContract(unittest.TestCase):
    def test_full_chat_keeps_its_native_cover_until_the_compositor_confirms_the_loaded_ui(self):
        code = (JAVA / 'envtest/MainActivity.java').read_text()
        startup = code.split('private void showWeb(String url)', 1)[1].split('onRequestPermissionsResult', 1)[0]
        self.assertIn('petChat||assistantVoice?Color.TRANSPARENT:CHAT_SURFACE', startup)
        self.assertLess(startup.index('content.addView(chatCover'), startup.index('setContentView(content);web.loadUrl(url);'))
        finish = startup.split('public void onPageFinished', 1)[1].split('shouldOverrideUrlLoading', 1)[0]
        order = ['!sameLocalOrigin(url,loaded)', "typeof window.evaOpenRoomChat==='function'",
                 'if(v!=web)return', 'postVisualStateCallback', 'if(v!=web||chatCover==null)return',
                 'removeView(chatCover)']
        self.assertEqual(sorted(map(finish.index, order)), list(map(finish.index, order)))
        self.assertIsNotNone(re.search(r'if\(!retried\[0\]\)\{retried\[0\]=true;', startup))
        self.assertIn('chatRetryButton(owner,url)', startup)
        self.assertIn('app.js', (ROOT / 'runtime/codex-mobile/index.html').read_text())
        self.assertIn('window.evaOpenRoomChat=', (ROOT / 'runtime/codex-mobile/app.js').read_text())

    def test_provider_failure_or_unsupported_javascript_preserves_native_launcher_entries(self):
        home = (JAVA / 'life/Home.java').read_text()
        self.assertIn('try{web=new WebView(this);}catch(RuntimeException unavailable){showRecovery();return;}', home)
        self.assertIn("typeof window.closeSheet==='function' && typeof window.setHomeActive==='function'", home)
        self.assertIn('discardRoomView();showRecovery();', home)
        self.assertIn('Восстановить комнату', home)
        self.assertIn('Приложения', home)
        self.assertIn('new Bridge().open(keys[i])', home)
        self.assertIn('window.setHomeActive=', (ROOT / 'app/src/main/assets/home/game.mjs').read_text())
