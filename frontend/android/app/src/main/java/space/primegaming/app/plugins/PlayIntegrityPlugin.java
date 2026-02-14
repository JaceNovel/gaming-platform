package space.primegaming.app.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;

@CapacitorPlugin(name = "PlayIntegrity")
public class PlayIntegrityPlugin extends Plugin {
    private IntegrityManager integrityManager;

    @Override
    public void load() {
        integrityManager = IntegrityManagerFactory.create(getContext());
    }

    @PluginMethod
    public void requestToken(PluginCall call) {
        String nonce = call.getString("nonce");
        Long cloudProjectNumber = call.getLong("cloudProjectNumber");

        if (nonce == null || nonce.trim().isEmpty()) {
            call.reject("Nonce is required");
            return;
        }
        if (cloudProjectNumber == null || cloudProjectNumber <= 0) {
            call.reject("cloudProjectNumber is required");
            return;
        }

        IntegrityTokenRequest request = IntegrityTokenRequest.builder()
            .setNonce(nonce.trim())
            .setCloudProjectNumber(cloudProjectNumber)
            .build();

        integrityManager.requestIntegrityToken(request)
            .addOnSuccessListener(response -> {
                JSObject result = new JSObject();
                result.put("token", response.token());
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("Integrity token failed", e));
    }
}
