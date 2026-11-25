package ru.eva.life;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class LifeBoot extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())||!Home.enabled(context)||!LifeState.enabled(context)
                ||!context.getSharedPreferences("theme",0).getBoolean("boot",true))return;
        LifeService.updateSchedule(context);
    }
}
