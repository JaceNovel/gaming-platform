package space.primegaming.app.plugins;

import android.os.Bundle;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import com.google.firebase.remoteconfig.FirebaseRemoteConfig;
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@CapacitorPlugin(name = "FirebaseBridge")
public class FirebaseBridgePlugin extends Plugin {
    private FirebaseAnalytics analytics;
    private FirebaseCrashlytics crashlytics;
    private FirebaseRemoteConfig remoteConfig;

    @Override
    public void load() {
        analytics = FirebaseAnalytics.getInstance(getContext());
        crashlytics = FirebaseCrashlytics.getInstance();
        remoteConfig = FirebaseRemoteConfig.getInstance();
    }

    @PluginMethod
    public void logEvent(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.trim().isEmpty()) {
            call.reject("Event name is required");
            return;
        }

        JSObject params = call.getObject("params", new JSObject());
        Bundle bundle = new Bundle();
        if (params != null) {
            Iterator<String> keys = params.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = params.opt(key);
                if (value instanceof String) {
                    bundle.putString(key, (String) value);
                } else if (value instanceof Integer) {
                    bundle.putInt(key, (Integer) value);
                } else if (value instanceof Double) {
                    bundle.putDouble(key, (Double) value);
                } else if (value instanceof Boolean) {
                    bundle.putBoolean(key, (Boolean) value);
                } else if (value != null) {
                    bundle.putString(key, value.toString());
                }
            }
        }

        analytics.logEvent(name.trim(), bundle);
        call.resolve();
    }

    @PluginMethod
    public void recordException(PluginCall call) {
        String message = call.getString("message");
        if (message == null || message.trim().isEmpty()) {
            call.reject("Message is required");
            return;
        }
        Exception ex = new Exception(message.trim());
        crashlytics.recordException(ex);
        call.resolve();
    }

    @PluginMethod
    public void fetchRemoteConfig(PluginCall call) {
        long minFetchInterval = call.getLong("minFetchIntervalSeconds", 3600L);
        JSObject defaults = call.getObject("defaults", new JSObject());
        JSArray keys = call.getArray("keys");

        FirebaseRemoteConfigSettings settings = new FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(minFetchInterval)
            .build();
        remoteConfig.setConfigSettingsAsync(settings);

        if (defaults != null && defaults.length() > 0) {
            Map<String, Object> map = new HashMap<>();
            Iterator<String> it = defaults.keys();
            while (it.hasNext()) {
                String key = it.next();
                Object value = defaults.opt(key);
                if (value instanceof Boolean || value instanceof Number || value instanceof String) {
                    map.put(key, value);
                } else if (value != null) {
                    map.put(key, value.toString());
                }
            }
            remoteConfig.setDefaultsAsync(map);
        }

        remoteConfig.fetchAndActivate().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                call.reject("Remote Config fetch failed");
                return;
            }

            JSObject values = new JSObject();
            if (keys != null) {
                for (int i = 0; i < keys.length(); i++) {
                    String key = keys.optString(i, null);
                    if (key == null) {
                        continue;
                    }
                    values.put(key, remoteConfig.getString(key));
                }
            }

            JSObject result = new JSObject();
            result.put("values", values);
            call.resolve(result);
        });
    }
}
