package space.primegaming.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import space.primegaming.app.plugins.FirebaseBridgePlugin;
import space.primegaming.app.plugins.PlayIntegrityPlugin;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		registerPlugin(FirebaseBridgePlugin.class);
		registerPlugin(PlayIntegrityPlugin.class);
	}

	@Override
	public void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		setIntent(intent);
	}
}
