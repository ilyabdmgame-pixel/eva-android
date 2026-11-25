package ru.eva.life;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.JSONArray;

// Read only the presentation of the HONOR weather widget bound by Android.
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
    WeatherWidget(Home home,FrameLayout root){
        this.root=root;
        this.home=home;
        manager=AppWidgetManager.getInstance(home);
        prefs=home.getSharedPreferences("honor-widget",0);
        host=new AppWidgetHost(home,96);
    }
    void start(){
        host.startListening();
        int id=prefs.getInt("bound",-1);
        if(id!=-1 && view==null){
            if(manager.getAppWidgetInfo(id)!=null)attach(id);
            else {prefs.edit().remove("bound").apply();state="disconnected";}
        }
    }
    void stop(){host.stopListening();}
    private void attach(int id){
        AppWidgetProviderInfo info=manager.getAppWidgetInfo(id);
        if(info==null||!PACKAGE.equals(info.provider.getPackageName())){discard();return;}
        view=host.createView(home,id,info);
        float density=home.getResources().getDisplayMetrics().density;
        widthPx=Math.min(home.getResources().getDisplayMetrics().widthPixels,Math.max(Math.round(170*density),info.minWidth));
        heightPx=Math.max(Math.round(80*density),info.minHeight);
        int width=Math.round(widthPx/density),height=Math.round(heightPx/density);
        view.updateAppWidgetSize(null,width,height,width,height);
        park();
        prefs.edit().putInt("bound",id).remove("pending").apply();
        state="connected";read();
    }
    private void park(){
        if(view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);
        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        view.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        root.addView(view,0,new FrameLayout.LayoutParams(widthPx,heightPx));
    }
    private void discard(){
        int pending=prefs.getInt("pending",-1);
        if(pending!=-1)host.deleteAppWidgetId(pending);
        prefs.edit().remove("pending").apply();
        state="disconnected";
    }
    void result(int request,int code){
        int id=prefs.getInt("pending",-1);
        if(id==-1)return;
        if(code!=Activity.RESULT_OK){discard();return;}
        AppWidgetProviderInfo info=manager.getAppWidgetInfo(id);
        if(info==null){discard();return;}
        if(request==BIND && info.configure!=null){
            try {host.startAppWidgetConfigureActivityForResult(home,id,0,CONFIGURE,null);}
            catch(ActivityNotFoundException ex){discard();}
        }else attach(id);
    }
    void connect(){
        if(view!=null){
            if(view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);
            view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
            view.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);
            AlertDialog d=new AlertDialog.Builder(home).setTitle("Погода HONOR").setView(view)
                .setPositiveButton("Готово",null).create();
            d.setOnDismissListener(dialog->park());d.show();return;
        }
        AppWidgetProviderInfo chosen=null;
        String[] preferred={".widget.simplewidget.SimpleWidgetWeatherProvider",".card.small.SmallCardWeatherProvider",".widget.honorwidget.HonorWidgetWeatherProvider"};
        for(String suffix:preferred){
            for(AppWidgetProviderInfo info:manager.getInstalledProviders()){
                if(PACKAGE.equals(info.provider.getPackageName())&&info.provider.getClassName().endsWith(suffix)){
                    chosen=info;break;
                }
            }
            if(chosen!=null)break;
        }
        if(chosen==null){state="unavailable";Toast.makeText(home,"Виджет погоды HONOR недоступен",Toast.LENGTH_SHORT).show();return;}
        discard();
        int id=host.allocateAppWidgetId();prefs.edit().putInt("pending",id).apply();
        try{
            if(manager.bindAppWidgetIdIfAllowed(id,chosen.provider))result(BIND,Activity.RESULT_OK);
            else home.startActivityForResult(new Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,chosen.provider),BIND);
        }catch(ActivityNotFoundException|SecurityException ex){discard();Toast.makeText(home,"Android не смог подключить виджет",Toast.LENGTH_SHORT).show();}
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
