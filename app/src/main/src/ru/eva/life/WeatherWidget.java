package ru.eva.life;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.JSONArray;

// Read the Android widget the user explicitly binds as a weather source.
final class WeatherWidget {
    static final int BIND=4161, CONFIGURE=4162;
    static final String PACKAGE="com.hihonor.android.totemweather";
    final Home home;
    final AppWidgetHost host;
    final AppWidgetManager manager;
    final SharedPreferences prefs;
    AppWidgetHostView view;
    volatile String state="disconnected", labels="[]";
    final FrameLayout root;
    int widthPx,heightPx;
    boolean listening;
    WeatherWidget(Home home,FrameLayout root){
        this.root=root;
        this.home=home;
        manager=AppWidgetManager.getInstance(home);
        prefs=home.getSharedPreferences("honor-widget",0);
        host=new AppWidgetHost(home,96);
    }
    void start(){
        if(manager==null)return;
        try{
            host.startListening();listening=true;
            int id=prefs.getInt("bound",-1);
            if(id!=-1 && view==null){
                if(manager.getAppWidgetInfo(id)!=null)attach(id);
                else {prefs.edit().remove("bound").apply();state="disconnected";}
            }
        }catch(IllegalStateException|SecurityException e){state="unavailable";}
    }
    void stop(){
        if(listening)try{host.stopListening();}catch(IllegalStateException|SecurityException ignored){}
        listening=false;
    }
    private void attach(int id){
        AppWidgetProviderInfo info=manager.getAppWidgetInfo(id);
        if(info==null){discard();return;}
        AppWidgetHostView replacement=host.createView(home,id,info);
        int old=prefs.getInt("bound",-1);
        if(view!=null&&view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);
        view=replacement;
        float density=home.getResources().getDisplayMetrics().density;
        widthPx=Math.min(home.getResources().getDisplayMetrics().widthPixels,Math.max(Math.round(170*density),info.minWidth));
        heightPx=Math.max(Math.round(80*density),info.minHeight);
        int width=Math.round(widthPx/density),height=Math.round(heightPx/density);
        view.updateAppWidgetSize(null,width,height,width,height);
        park();
        prefs.edit().putInt("bound",id).remove("pending").apply();
        if(old!=-1&&old!=id)release(old);
        state="connected";read();
    }
    private void park(){
        if(view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);
        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        view.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        root.addView(view,0,new FrameLayout.LayoutParams(widthPx,heightPx));
    }
    private void release(int id){
        try{host.deleteAppWidgetId(id);}catch(IllegalStateException|SecurityException ignored){}
    }
    private void discard(){
        int pending=prefs.getInt("pending",-1);
        if(pending!=-1)release(pending);
        prefs.edit().remove("pending").apply();
        state=view==null?"disconnected":"connected";
    }
    void result(int request,int code){
        int id=prefs.getInt("pending",-1);
        if(id==-1)return;
        if(code!=Activity.RESULT_OK){discard();return;}
        try{
            AppWidgetProviderInfo info=manager.getAppWidgetInfo(id);
            if(info==null){discard();return;}
            if(request==BIND && info.configure!=null){
                host.startAppWidgetConfigureActivityForResult(home,id,0,CONFIGURE,null);
            }else attach(id);
        }catch(ActivityNotFoundException|IllegalStateException|SecurityException ex){discard();unavailable();}
    }
    void connect(){
        if(manager==null){unavailable();return;}
        if(view==null){choose(true);return;}
        if(view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);
        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
        view.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);
        AlertDialog dialog=new AlertDialog.Builder(home).setTitle("Виджет погоды").setView(view)
            .setNeutralButton("Сменить виджет",(d,w)->choose(false)).setPositiveButton("Готово",null).create();
        dialog.setOnDismissListener(d->park());dialog.show();
    }
    private void unavailable(){
        if(view==null)state="unavailable";
        Toast.makeText(home,"Виджет недоступен. В меню погоды можно выбрать город для прогноза",Toast.LENGTH_LONG).show();
    }
    private void choose(boolean usePreferred){
        java.util.List<AppWidgetProviderInfo> providers;
        try{providers=new java.util.ArrayList<>(manager.getInstalledProviders());}
        catch(IllegalStateException|SecurityException unavailable){unavailable();return;}
        if(providers.isEmpty()){unavailable();return;}
        if(usePreferred){
            String[] preferred={".widget.simplewidget.SimpleWidgetWeatherProvider",".card.small.SmallCardWeatherProvider",".widget.honorwidget.HonorWidgetWeatherProvider"};
            for(String suffix:preferred)for(AppWidgetProviderInfo info:providers){
                if(PACKAGE.equals(info.provider.getPackageName())&&info.provider.getClassName().endsWith(suffix)){bind(info);return;}
            }
        }
        android.content.pm.PackageManager pm=home.getPackageManager();
        providers.sort(java.util.Comparator.comparing(info->String.valueOf(info.loadLabel(pm)),java.text.Collator.getInstance()));
        CharSequence[] titles=new CharSequence[providers.size()];
        for(int i=0;i<providers.size();i++){
            AppWidgetProviderInfo info=providers.get(i);
            String app=info.provider.getPackageName();
            try{app=pm.getApplicationLabel(pm.getApplicationInfo(app,0)).toString();}
            catch(android.content.pm.PackageManager.NameNotFoundException ignored){}
            CharSequence label=info.loadLabel(pm);
            titles[i]=label==null||app.contentEquals(label)?app:label+" · "+app;
        }
        new AlertDialog.Builder(home).setTitle("Выбери виджет с погодой").setItems(titles,(d,index)->bind(providers.get(index)))
            .setNegativeButton("Отмена",null).show();
    }
    private void bind(AppWidgetProviderInfo chosen){
        discard();
        try{
            int id=host.allocateAppWidgetId();prefs.edit().putInt("pending",id).apply();
            if(manager.bindAppWidgetIdIfAllowed(id,chosen.provider))result(BIND,Activity.RESULT_OK);
            else home.startActivityForResult(new Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,chosen.provider),BIND);
        }catch(ActivityNotFoundException|IllegalStateException|SecurityException ex){discard();unavailable();}
    }
    void read(){if(view!=null){JSONArray list=new JSONArray();collect(view,list);labels=list.toString();}}
    private void collect(View v,JSONArray list){
        if(v.getVisibility()!=View.VISIBLE||list.length()>=30)return;
        if(v instanceof TextView){
            String value=((TextView)v).getText().toString().trim(),name="";
            if(v.getId()!=View.NO_ID){
                try{name=v.getResources().getResourceEntryName(v.getId());}
                catch(android.content.res.Resources.NotFoundException ignored){}
            }
            if(name.matches(".*(city|district|location|locality).*")&&!value.isEmpty())add("area="+value,list);
            else if(name.matches(".*temp.*")&&!name.matches(".*(high|low|max|min|day|night|forecast).*")&&value.matches("[+−-]?[0-9]{1,2}"))add(value+"°",list);
            else add(value,list);
        }
        add(v.getContentDescription(),list);
        if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)collect(g.getChildAt(i),list);}
    }
    private void add(CharSequence s,JSONArray list){if(s!=null&&s.length()>0&&s.length()<240)list.put(s.toString());}
}
