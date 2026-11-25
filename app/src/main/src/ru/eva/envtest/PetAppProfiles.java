package ru.eva.envtest;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.LinkedHashSet;
import java.util.Set;

final class PetAppProfiles {
    static final int AUTO=0,QUIET=1,WATCH=2,HIDE=3;
    static final String[] LABELS={"По обстановке","Тихо сидеть","Смотреть видео внизу","Уйти с экрана"};
    private static String recent="";
    static void seen(String app){recent=app;}
    static String recent(){return recent;}
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("eva_pet_apps",0);}
    static int get(Context c,String app){return prefs(c).getInt(app,AUTO);}
    static void set(Context c,String app,int mode){
        SharedPreferences.Editor e=prefs(c).edit();
        if(mode==AUTO)e.remove(app);else e.putInt(app,mode);
        e.apply();
    }
    static Set<String> apps(Context c){
        Set<String> apps=new LinkedHashSet<>();
        if(!recent.isEmpty())apps.add(recent);
        apps.addAll(prefs(c).getAll().keySet());
        return apps;
    }
    static String label(Context c,String app){
        try{return c.getPackageManager().getApplicationLabel(c.getPackageManager().getApplicationInfo(app,0)).toString();}
        catch(android.content.pm.PackageManager.NameNotFoundException e){return app;}
    }
}
