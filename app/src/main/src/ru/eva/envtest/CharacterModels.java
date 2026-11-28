package ru.eva.envtest;

import android.os.FileObserver;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;
import java.util.function.Consumer;

/** Observes the user's atomic slot selection; model bytes never leave app-private storage. */
public final class CharacterModels {
    private static final int WATCH=FileObserver.CREATE|FileObserver.CLOSE_WRITE|FileObserver.MOVED_TO|
        FileObserver.MOVED_FROM|FileObserver.DELETE|FileObserver.DELETE_SELF|FileObserver.MOVE_SELF;
    private final File sandbox,models;
    private final CharacterFiles files;
    private final String slot;
    private final Executor worker;
    private final Consumer<String> changed;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final Runnable refresh=this::check;
    private FileObserver observer;
    private File watching;
    private boolean active;
    private int generation;
    private volatile String revision="";

    public CharacterModels(File filesDir,String slot,Executor worker,Consumer<String> changed){
        this.sandbox=filesDir;this.slot=slot;this.worker=worker;this.changed=changed;
        files=new CharacterFiles(filesDir);models=files.models;
    }
    public String revision(){return revision;}
    public void start(){if(!active){active=true;check();}}
    public void stop(){
        active=false;generation++;main.removeCallbacks(refresh);
        if(observer!=null){observer.stopWatching();observer=null;watching=null;}
    }
    public void check(){
        if(!active)return;
        int request=++generation;
        worker.execute(()->{
            File parent=existingAncestor();
            main.post(()->{
                if(!active||request!=generation)return;
                if(!parent.equals(watching)){
                    if(observer!=null)observer.stopWatching();
                    watching=parent;
                    File next=models;
                    while(!next.equals(parent)&&!parent.equals(next.getParentFile()))next=next.getParentFile();
                    String target=parent.equals(models)?"slots.json":next.getName();
                    observer=new FileObserver(parent.getPath(),WATCH){
                        @Override public void onEvent(int event,String name){
                            if(name==null||target.equals(name))main.post(()->{
                                if(active&&observer==this){main.removeCallbacks(refresh);main.postDelayed(refresh,35);}
                            });
                        }
                    };
                    observer.startWatching();
                }
                // Read after registering: a completed rename before registration must also be visible.
                worker.execute(()->{
                    String selected=readSlot();boolean moved=!parent.equals(existingAncestor());
                    main.post(()->{
                        if(!active||request!=generation)return;
                        if(!revision.equals(selected)){revision=selected;changed.accept(selected);}
                        if(moved)check();
                    });
                });
            });
        });
    }
    private File existingAncestor(){
        File dir=models;
        while(!dir.isDirectory()&&!dir.equals(sandbox))dir=dir.getParentFile();
        return dir;
    }
    private String readSlot(){
        try{
            File slots=files.slots();if(!slots.isFile()||slots.length()>4096)return "";
            byte[] data=new byte[4097];int position=0;
            try(InputStream input=new FileInputStream(slots)){
                int n;while(position<data.length&&(n=input.read(data,position,data.length-position))>0)position+=n;
            }
            if(position>4096)return "";
            String value=new JSONObject(new String(data,0,position,StandardCharsets.UTF_8)).optString(slot,"");
            return CharacterFiles.revision(value)?value:"";
        }catch(Exception invalid){return "";}
    }
    /** Called only by a WebView IO thread or the pet art loader. */
    public InputStream open(String hash,String asset)throws IOException{
        return files.open(slot,readSlot(),hash,asset);
    }
}
