package com.ekpgames.hagu;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

// Modo imersivo "tela cheia igual jogo nativo": desenha atrás da status bar
// e da barra de navegação (edge-to-edge) e as esconde, deixando o usuário
// revelar com um swipe temporário se precisar (BEHAVIOR_SHOW_TRANSIENT_BARS_
// BY_SWIPE). Sem isso, mesmo com @capacitor/status-bar via JS, o Android
// (targetSdk 35+) reserva a área da barra de navegação e ela continua
// visível, dando a impressão de estar dentro de uma WebView comum.
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // As barras podem reaparecer (swipe do usuário, diálogos, retorno de
        // segundo plano) — reaplica sempre que a janela reganha o foco.
        if (hasFocus) enableImmersiveMode();
    }

    private void enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
