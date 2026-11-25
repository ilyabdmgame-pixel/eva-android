package ru.eva.life;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class LifeService extends JobService {
    private static final int JOB_WORLD_SCHEDULE = 19;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private JobParameters running;

    private static boolean enabled(Context context) {
        return Home.enabled(context) && LifeState.enabled(context);
    }

    static void updateSchedule(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (!enabled(context)) {
            scheduler.cancel(JOB_WORLD_SCHEDULE);
        } else if (scheduler.getPendingJob(JOB_WORLD_SCHEDULE) == null) {
            JobInfo job = new JobInfo.Builder(JOB_WORLD_SCHEDULE, new ComponentName(context, LifeService.class))
                    .setPeriodic(LifeState.QUARTER)
                    .build();
            if (scheduler.schedule(job) != JobScheduler.RESULT_SUCCESS) {
                android.util.Log.w("EvaLife", "Android did not schedule the city job");
            }
        }
    }

    @Override public boolean onStartJob(JobParameters params) {
        if (!enabled(this)) return false;
        running = params;
        worker.execute(() -> {
            try {
                if (enabled(this)) LifeState.heartbeat(this, System.currentTimeMillis());
            } catch (RuntimeException error) {
                android.util.Log.w("EvaLife", "Could not advance the city schedule", error);
            } finally {
                main.post(() -> {
                    if (running != params) return;
                    running = null;
                    jobFinished(params, false);
                });
            }
        });
        return true;
    }

    @Override public boolean onStopJob(JobParameters params) {
        if (running == params) running = null;
        return enabled(this);
    }

    @Override public void onDestroy() {
        running = null;
        worker.shutdownNow();
        super.onDestroy();
    }
}
