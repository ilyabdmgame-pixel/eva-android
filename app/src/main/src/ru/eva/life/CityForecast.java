package ru.eva.life;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.util.Locale;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

final class CityForecast {
    private long retryAt;
    private boolean loading;
    private static final String ENDPOINT="https://api.open-meteo.com/v1/forecast";

    synchronized void setLocation(Context context, String location) {
        context.getSharedPreferences("cityForecast",0).edit()
            .putString("location",location).remove("reading").remove("fetched").apply();
        retryAt=0;
    }

    synchronized String read(Context context) {
        SharedPreferences cache=context.getSharedPreferences("cityForecast",0);
        String location=cache.getString("location","");
        if(location.isEmpty())return "{}";
        long now=System.currentTimeMillis();
        if(!loading && now>=retryAt && now-cache.getLong("fetched",0)>20*60000L){
            loading=true;
            retryAt=now+120000L;
            new Thread(()->refresh(cache,location),"city-weather").start();
        }
        return cache.getString("reading","{}");
    }

    static String coordinates(String input) {
        String[] parts=input.trim().split("\\s+");
        if(parts.length!=2)throw new IllegalArgumentException();
        double latitude=Double.parseDouble(parts[0]),longitude=Double.parseDouble(parts[1]);
        if(!Double.isFinite(latitude)||!Double.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)
            throw new IllegalArgumentException();
        return String.format(Locale.ROOT,"latitude=%.4f&longitude=%.4f",latitude,longitude);
    }
    private void refresh(SharedPreferences cache, String location){
        HttpsURLConnection conn=null;
        try{
            conn=(HttpsURLConnection)new URL(ENDPOINT+"?"+location+"&current=temperature_2m,weather_code&timeformat=unixtime").openConnection();
            conn.setConnectTimeout(6000);conn.setReadTimeout(6000);
            conn.setInstanceFollowRedirects(false);
            if(conn.getResponseCode()!=200)return;
            try(InputStream in=conn.getInputStream(); ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                byte[] chunk=new byte[1024];
                int n;
                while((n=in.read(chunk))!=-1){
                    if(bytes.size()+n>32768)return;
                    bytes.write(chunk,0,n);
                }
                JSONObject data=new JSONObject(bytes.toString("UTF-8")).getJSONObject("current");
                JSONObject reading=new JSONObject().put("at",data.getLong("time")*1000L)
                    .put("code",data.getInt("weather_code")).put("degrees",data.getDouble("temperature_2m"));
                synchronized(this){
                    if(location.equals(cache.getString("location","")))
                        cache.edit().putString("reading",reading.toString()).putLong("fetched",System.currentTimeMillis()).apply();
                }
            }
        }catch(Exception unavailable){/* Keep a dated reading during a network outage. */}
        finally{if(conn!=null)conn.disconnect();synchronized(this){loading=false;}}
    }
}
