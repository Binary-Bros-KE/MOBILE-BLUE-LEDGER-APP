package app.blueledgerpos.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

/**
 * Prints raw ESC/POS bytes to a paired classic-Bluetooth receipt printer — the cheap 58mm/80mm
 * thermal printers Kenyan shops actually use speak Bluetooth Classic (Serial Port Profile), which no
 * browser can reach, which is why this lives natively. The receipt itself is laid out in the web app
 * (src/lib/escpos.ts) and arrives here as base64; this class only knows how to deliver bytes.
 *
 * JS side: src/lib/printer.ts (registerPlugin("BluetoothPrinter")).
 */
@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = { @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class BluetoothPrinterPlugin extends Plugin {

    /** The standard Serial Port Profile service id every SPP printer answers on. */
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    /** Let the printer's buffer drain before the socket closes, or the tail of a receipt is lost. */
    private static final long DRAIN_MS = 400;

    /** BLUETOOTH_CONNECT is a runtime permission only from Android 12 (API 31); older phones get
     * Bluetooth access from the install-time BLUETOOTH permission in the manifest. */
    private boolean needsRuntimePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    /** Null when Bluetooth is usable; otherwise the call has already been rejected. */
    private BluetoothAdapter readyAdapter(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("This phone has no Bluetooth.", "NO_BLUETOOTH");
            return null;
        }
        if (!adapter.isEnabled()) {
            call.reject("Turn on Bluetooth first.", "BLUETOOTH_OFF");
            return null;
        }
        return adapter;
    }

    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        if (needsRuntimePermission()) {
            requestPermissionForAlias("bluetooth", call, "afterPermissionForList");
            return;
        }
        listPaired(call);
    }

    @PermissionCallback
    private void afterPermissionForList(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is needed to find your printer.", "PERMISSION_DENIED");
            return;
        }
        listPaired(call);
    }

    @SuppressLint("MissingPermission") // checked in listPairedPrinters / afterPermissionForList
    private void listPaired(PluginCall call) {
        BluetoothAdapter adapter = readyAdapter(call);
        if (adapter == null) return;
        JSArray devices = new JSArray();
        for (BluetoothDevice device : adapter.getBondedDevices()) {
            JSObject entry = new JSObject();
            entry.put("name", device.getName() != null ? device.getName() : device.getAddress());
            entry.put("address", device.getAddress());
            devices.put(entry);
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needsRuntimePermission()) {
            requestPermissionForAlias("bluetooth", call, "afterPermissionForPrint");
            return;
        }
        sendBytes(call);
    }

    @PermissionCallback
    private void afterPermissionForPrint(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is needed to print.", "PERMISSION_DENIED");
            return;
        }
        sendBytes(call);
    }

    @SuppressLint("MissingPermission") // checked in print / afterPermissionForPrint
    private void sendBytes(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || address.isEmpty() || data == null || data.isEmpty()) {
            call.reject("Missing printer address or receipt data.", "BAD_REQUEST");
            return;
        }
        BluetoothAdapter adapter = readyAdapter(call);
        if (adapter == null) return;
        final byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Receipt data was not valid.", "BAD_REQUEST");
            return;
        }

        // Connecting blocks for up to several seconds — never on the UI thread.
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                adapter.cancelDiscovery(); // discovery slows RFCOMM connects to a crawl
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = connect(device);
                OutputStream out = socket.getOutputStream();
                out.write(bytes);
                out.flush();
                Thread.sleep(DRAIN_MS);
                call.resolve();
            } catch (Exception e) {
                call.reject("Couldn't reach the printer — is it switched on, paired and in range?", "PRINT_FAILED", e);
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (IOException ignored) {
                        // Already closed.
                    }
                }
            }
        }).start();
    }

    /** Secure RFCOMM first; many cheap printers only accept the insecure variant, so fall back to it. */
    @SuppressLint("MissingPermission")
    private BluetoothSocket connect(BluetoothDevice device) throws IOException {
        try {
            BluetoothSocket secure = device.createRfcommSocketToServiceRecord(SPP_UUID);
            secure.connect();
            return secure;
        } catch (IOException secureFailed) {
            BluetoothSocket insecure = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            insecure.connect();
            return insecure;
        }
    }
}
