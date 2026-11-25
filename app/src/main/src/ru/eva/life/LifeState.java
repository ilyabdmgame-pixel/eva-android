package ru.eva.life;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Calendar;

final class LifeState {
    static final long QUARTER = 900_000L;
    private static final int LIMIT = 96;
    private static final String[] DISTRICTS={"home","street","school","shop","cafe","beach","lane","garden","park","square","market","promenade","pier","headland","courtyard","terrace"};
    private static JSONObject routines, activities;
    static synchronized JSONObject routines(Context context){
        if(routines==null)routines=readAsset(context,"routines.json");
        return routines;
    }
    static synchronized JSONObject activities(Context context){
        if(activities==null)activities=readAsset(context,"room-activities.json");
        return activities;
    }
    private static JSONObject readAsset(Context context,String name){
        try(java.io.InputStream input=context.getAssets().open("home/"+name);
            java.util.Scanner reader=new java.util.Scanner(input,"UTF-8").useDelimiter("\\A")){
            return new JSONObject(reader.next());
        }catch(Exception error){throw new IllegalStateException("Invalid room asset: "+name,error);}
    }
    private static JSONArray entry(JSONObject person,int hour) throws JSONException{
        JSONArray rows=person.getJSONArray("entries");
        for(int i=rows.length()-1;i>=0;i--){
            JSONArray row=rows.getJSONArray(i);
            if(hour>=row.getInt(0))return row;
        }
        return rows.getJSONArray(rows.length()-1);
    }
    private static int hour(long at){
        Calendar local=Calendar.getInstance();
        local.setTimeInMillis(at);
        return local.get(Calendar.HOUR_OF_DAY);
    }
    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("life-v1", Context.MODE_PRIVATE);
    }
    static boolean enabled(Context c) {return prefs(c).getBoolean("live", false);}
    static void setEnabled(Context c,boolean enabled) {prefs(c).edit().putBoolean("live", enabled).commit();}

    private static JSONObject event(long at,String who,String where,String text) throws JSONException {
        return new JSONObject().put("at",at).put("who",who).put("where",where).put("text",text);
    }
    private static JSONArray append(JSONArray previous,JSONObject item) throws JSONException {
        JSONArray result = new JSONArray();
        for(int i=Math.max(0,previous.length()-LIMIT+1);i<previous.length();i++)result.put(previous.get(i));
        result.put(item);
        return result;
    }
    private static JSONObject base(SharedPreferences prefs) {
        try {return new JSONObject(prefs.getString("timeline","{}"));}
        catch(JSONException e) {return new JSONObject();}
    }
    private static JSONObject advance(Context c,long now) throws JSONException {
        SharedPreferences prefs = prefs(c);
        JSONObject state = base(prefs);
        long slot = Math.floorDiv(now,QUARTER);
        long before = state.optLong("slot",slot-1);
        JSONArray previous = state.optJSONArray("events");
        JSONArray events = previous == null ? new JSONArray() : previous;
        JSONObject person = routines(c).getJSONObject("eva");
        for(long i=Math.max(before+1,slot-LIMIT+1);i<=slot;i++) {
            long at = i*QUARTER;
            JSONArray current=entry(person,hour(at));
            if(current==entry(person,hour(at-QUARTER)) && !(before==slot-1 && previous==null))continue;
            events=append(events,event(at,person.getString("name"),current.getString(1),current.getString(4)));
        }
        if(before<slot) {
            state.put("slot",slot).put("events",events).put("at",now);
            prefs.edit().putString("timeline",state.toString()).commit();
        }
        return state;
    }

    static synchronized JSONObject read(Context c,long now) {
        try {
            JSONObject state=advance(c,now);
            return state.put("place",entry(routines(c).getJSONObject("eva"),hour(now)).getString(1)).put("live",enabled(c))
                .put("heartbeat",prefs(c).getLong("heartbeat",0));
        } catch(JSONException e) {return new JSONObject();}
    }
    static synchronized void heartbeat(Context c,long now) {
        read(c,now);
        prefs(c).edit().putLong("heartbeat",now).apply();
    }
    static synchronized void finishedActivity(Context c,String key){
        if(key==null||key.length()>32)return;
        JSONObject activity=activities(c).optJSONObject(key);
        if(activity==null)return;
        long now=System.currentTimeMillis();
        try{
            JSONObject state=advance(c,now);
            JSONArray events=state.optJSONArray("events");
            state.put("events",append(events==null?new JSONArray():events,
                event(now,"Ева","home",activity.getString("event"))));
            prefs(c).edit().putString("timeline",state.toString()).apply();
        }catch(JSONException ignored){}
    }
    static synchronized void localAction(Context c,String action,String where) {
        long now=System.currentTimeMillis();
        String line;
        switch(action) {
            case "snack": line="Сделала перерыв и перекусила"; break;
            case "lamp": line="Щёлкнула лампой. Уют даётся по талонам"; break;
            case "sit": line="Заняла стул. Ноги сами сказали спасибо"; break;
            case "move": line="Переставила мебель. Архитектору пельменей"; break;
            case "dialog": line="Перекинулась парой фраз с Рэном"; break;
            case "cargo": line="Помогла разгрузить ящики на причале"; break;
            case "forage": line="Подобрала находку для кармана"; break;
            case "meeting": line="Поболтала с соседом по району"; break;
            case "sell-drawing": line="Сдала этюд и заработала пять монет"; break;
            case "clean": line="Убрала улицу и заработала три монеты"; break;
            case "mio": line="Поговорила с Мио"; break;
            case "draw": line="Сделала набросок на мольберте"; break;
            case "wash": line="Промыла кисти"; break;
            case "bouquet": line="Собрала букет"; break;
            case "fill": line="Набрала ведро воды"; break;
            case "sell": line="Сдала букет и заработала шесть монет"; break;
            case "coffee": line="Купила чай за две монеты"; break;
            case "soda": line="Взяла газировку"; break;
            case "vending": line="Взяла банку в уличном автомате"; break;
            case "record": line="Поставила пластинку"; break;
            case "radio": line="Поставила кассету"; break;
            case "ball": line="Бросила и подобрала мяч"; break;
            case "plane": line="Запустила и подобрала самолётик"; break;
            case "shell": line="Подобрала ракушку"; break;
            case "bucket-moved": line="Переставила ведро Мио"; break;
            case "bucket-back": line="Вернула ведро Мио на место"; break;
            default: return;
        }
        try {
            JSONObject state = advance(c,now);
            JSONArray events=state.optJSONArray("events");
            String location="home";
            for(String key:DISTRICTS)if(key.equals(where)){location=key;break;}
            state.put("events",append(events==null?new JSONArray():events,event(now,"Ева",location,line)));
            SharedPreferences.Editor update=prefs(c).edit().putString("timeline",state.toString());
            if("bucket-moved".equals(action)||"bucket-back".equals(action))update.putBoolean("bucketAway","bucket-moved".equals(action));
            update.commit();
        } catch(JSONException ignored) { }
    }
}
