package app.blueledgerpos.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app plugins must be registered before the bridge starts.
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
