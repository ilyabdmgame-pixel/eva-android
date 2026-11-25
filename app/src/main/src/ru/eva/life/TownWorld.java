package ru.eva.life;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.Process;
import org.json.*;

public final class TownWorld extends ContentProvider {
    private static JSONObject scene;
    private static String queued="", result="";
    private static long published, expires;
    public boolean onCreate(){return true;}
    static synchronized void publish(String raw) {
        if(raw.length()>16000)return;
        try{scene=new JSONObject(raw);published=System.currentTimeMillis();}catch(JSONException ignored){}
    }
    static synchronized String take(){
        String request=System.currentTimeMillis()<=expires?queued:"";
        if(!queued.isEmpty()&&request.isEmpty())result="Время команды истекло";
        queued="";return request;
    }
    static synchronized void report(String text){result=text.substring(0,Math.min(200,text.length()));}
    public Bundle call(String method,String arg,Bundle extras){
        int uid=Binder.getCallingUid();
        if(uid!=2000&&uid!=Process.myUid()&&getContext().getPackageManager().checkSignatures(uid,Process.myUid())!=android.content.pm.PackageManager.SIGNATURE_MATCH)
            throw new SecurityException("Private simulator interface");
        synchronized(TownWorld.class){
            Bundle b=new Bundle();
            try{
                long now=System.currentTimeMillis();
                JSONObject reply=new JSONObject().put("ageSeconds",scene==null?-1:(now-published)/1000);
                if("look".equals(method))reply.put("world",scene==null?JSONObject.NULL:scene).put("lastAction",result);
                else if("use".equals(method)){
                    if(scene==null||now-published>300000)throw new JSONException("Открой город для свежего снимка");
                    if(!queued.isEmpty()&&now<=expires)throw new JSONException("Предыдущее действие ждёт открытия города");
                    String[] parts=(arg==null?"":arg).split("/",-1);
                    if(parts.length!=2||!parts[0].matches("[0-9]{1,5}")||!parts[1].matches("[a-zA-Z]{1,20}"))throw new JSONException("Неверное действие");
                    int id=Integer.parseInt(parts[0]);boolean allowed=false;
                    JSONArray list=scene.getJSONArray("nearby");
                    for(int i=0;i<list.length();i++){
                        JSONObject o=list.getJSONObject(i);
                        if(o.getInt("id")==id&&parts[1].equals(o.optString("use")))allowed=true;
                    }
                    if(!allowed)throw new JSONException("Предмет или действие отсутствует в снимке");
                    queued=new JSONObject().put("id",id).put("use",parts[1]).toString();expires=now+300000;result="В очереди";
                    reply.put("status",result);
                }else throw new JSONException("Неизвестная команда");
                b.putString("json",reply.toString());
            }catch(JSONException e){b.putString("error",e.getMessage());}
            return b;
        }
    }
    public Cursor query(Uri u,String[] p,String s,String[] a,String order){throw new UnsupportedOperationException();}
    public String getType(Uri u){return null;}
    public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
    public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
    public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
}
