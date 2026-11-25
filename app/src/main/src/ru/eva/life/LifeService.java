package ru.eva.life;

import android.app.*;
import android.content.Intent;
import android.os.*;

public final class LifeService extends Service {
    private static final String CHANNEL = "eva-life";
    private static final String STOP = "ru.eva.life.STOP";
    private final Handler timer = new Handler(Looper.getMainLooper());
    private final Runnable activity = new Runnable() {
        public void run() {
            long now = System.currentTimeMillis();
            LifeState.heartbeat(LifeService.this,now);
            timer.postDelayed(this,Math.max(1000,LifeState.nextDeadline(now)-now));
        }
    };
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            LifeState.setEnabled(this,false);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!LifeState.enabled(this)) {stopSelf();return START_NOT_STICKY;}
        NotificationManager notifications = getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL,"Жизнь Евы",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this,0,new Intent(this,Home.class),PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this,1,new Intent(this,LifeService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(this,CHANNEL)
                .setContentTitle("Дом Евы")
                .setContentText("Расписание мира идёт. Ева шляется по делам.")
                .setSmallIcon(android.R.drawable.ic_menu_today).setContentIntent(open).setOngoing(true)
                .addAction(new Notification.Action.Builder(null,"Остановить фон",stop).build()).build();
        startForeground(19,notification);
        timer.removeCallbacks(activity);
        activity.run();
        return START_STICKY;
    }
    @Override public void onDestroy(){timer.removeCallbacks(activity);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
